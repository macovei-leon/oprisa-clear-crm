require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://odgtubiqvxcszsfifjfd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws }
});

// Nodemailer transport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'ture@oprisa.de',
        pass: process.env.EMAIL_PASS || 'crskjjbecrrnqiky'
    },
    pool: true, // Use pooled connections for bulk sending
    maxConnections: 3, // Limit concurrent connections
    maxMessages: 1500 // Limit messages per connection
});

async function runDailyEmailJob() {
    console.log('[Email Service] Starting daily email job...');
    try {
        // 1. Get templates
        const { data: templatesData, error: tErr } = await supabase.from('driver_email_templates').select('*');
        if (tErr) throw new Error('Failed to fetch templates: ' + tErr.message);
        
        const templates = {};
        templatesData.forEach(t => templates[t.category] = t);

        // 2. Load drivers data
        const jsonPath = path.join(__dirname, 'absent_drivers_last_3_days.json');
        if (!fs.existsSync(jsonPath)) {
            console.log('[Email Service] Data file not found. Aborting.');
            return;
        }
        const drivers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        // 3. Get settings and filter drivers
        const { data: settings } = await supabase.from('driver_email_settings').select('*').eq('id', 1).maybeSingle();
        const targetCategories = settings && settings.allowed_categories ? settings.allowed_categories : ['Started Late', 'Left Early / Big Gaps', 'No Shifts', 'Absent'];
        const pnStart = settings && settings.pn_range_start ? parseInt(settings.pn_range_start, 10) : null;
        const pnEnd = settings && settings.pn_range_end ? parseInt(settings.pn_range_end, 10) : null;

        const targets = drivers.filter(d => {
            if (!targetCategories.includes(d.status)) return false;
            if (pnStart && pnEnd && d.pn) {
                const driverPn = parseInt(d.pn, 10);
                if (driverPn < pnStart || driverPn > pnEnd) return false;
            }
            return true;
        });

        // 4. Get today's logs to prevent duplicates
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: logsData, error: lErr } = await supabase.from('driver_email_logs')
            .select('driver_pn')
            .gte('sent_at', `${todayStr}T00:00:00Z`)
            .lt('sent_at', `${todayStr}T23:59:59Z`);
        
        if (lErr) throw new Error('Failed to fetch logs: ' + lErr.message);

        const alreadySentPns = new Set(logsData.map(l => l.driver_pn));

        // 5. Send emails
        let sentCount = 0;
        for (const driver of targets) {
            if (alreadySentPns.has(driver.pn)) continue; // Already sent today
            if (!driver.email) continue; // No email address

            const template = templates[driver.status];
            if (!template) {
                console.warn(`[Email Service] No template found for category: ${driver.status}`);
                continue;
            }

            // Simple templating
            let subject = template.subject.replace(/{{name}}/g, driver.name).replace(/{{pn}}/g, driver.pn);
            let body = template.body.replace(/{{name}}/g, driver.name).replace(/{{pn}}/g, driver.pn);
            
            // Format details if available
            let detailsText = '';
            if (driver.missedShifts && driver.missedShifts.length > 0) {
                detailsText = driver.missedShifts.join('<br>');
            }
            body = body.replace(/{{details}}/g, detailsText);

            try {
                // Check for attachments
                const catSafe = driver.status.replace(/[^a-zA-Z0-9]/g, '_');
                const attachmentPath = path.join(__dirname, 'attachments', `${catSafe}.pdf`);
                const attachments = fs.existsSync(attachmentPath) ? [{
                    filename: `${catSafe}.pdf`,
                    path: attachmentPath,
                    contentType: 'application/pdf'
                }] : [];

                // Send email
                await transporter.sendMail({
                    from: `"Oprisa Team" <${process.env.EMAIL_USER}>`,
                    to: driver.email,
                    subject: subject,
                    html: body,
                    attachments: attachments
                });

                // Log success
                await supabase.from('driver_email_logs').insert([{
                    driver_pn: driver.pn,
                    email: driver.email,
                    category: driver.status,
                    status: 'Success'
                }]);

                sentCount++;
                console.log(`[Email Service] Sent email to ${driver.email} (${driver.status})`);
                
                // Add a small delay (1 second) to prevent Google Workspace rate limiting (500/1500 daily limit, but strict per-second burst limits)
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
                console.error(`[Email Service] Failed to send email to ${driver.email}:`, err.message);
                await supabase.from('driver_email_logs').insert([{
                    driver_pn: driver.pn,
                    email: driver.email,
                    category: driver.status,
                    status: 'Failed: ' + err.message
                }]);
            }
        }

        console.log(`[Email Service] Job completed. Emails sent: ${sentCount}`);
    } catch (error) {
        console.error('[Email Service] Error running job:', error);
    }
}

async function sendSingleTestEmail(toEmail, subject, body, category = null) {
    try {
        let attachments = [];
        if (category) {
            const catSafe = category.replace(/[^a-zA-Z0-9]/g, '_');
            const attachmentPath = path.join(__dirname, 'attachments', `${catSafe}.pdf`);
            if (fs.existsSync(attachmentPath)) {
                attachments.push({
                    filename: `${catSafe}.pdf`,
                    path: attachmentPath,
                    contentType: 'application/pdf'
                });
            }
        }

        await transporter.sendMail({
            from: `"Oprisa Team" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: subject,
            html: body,
            attachments: attachments
        });
        return { success: true };
    } catch (err) {
        console.error('[Email Service] Failed to send test email:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    runDailyEmailJob,
    sendSingleTestEmail,
    transporter
};
