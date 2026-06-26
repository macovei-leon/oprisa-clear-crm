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

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'ture@oprisa.de',
        pass: process.env.EMAIL_PASS || 'crskjjbecrrnqiky'
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 1500
});

let isProcessingQueue = false;

// 1. Queue Emails
async function runDailyEmailJob() {
    console.log('[Email Queue] Starting daily email queuing job...');
    try {
        const jsonPath = path.join(__dirname, 'absent_drivers_last_3_days.json');
        if (!fs.existsSync(jsonPath)) {
            console.log('[Email Queue] Data file not found. Aborting.');
            return;
        }
        const drivers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

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

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: logsData, error: lErr } = await supabase.from('driver_email_logs')
            .select('driver_pn')
            .gte('sent_at', `${todayStr}T00:00:00Z`)
            .lt('sent_at', `${todayStr}T23:59:59Z`);
        
        if (lErr) throw new Error('Failed to fetch logs: ' + lErr.message);
        const alreadyProcessedPns = new Set(logsData.map(l => l.driver_pn));

        let queuedCount = 0;
        for (const driver of targets) {
            if (alreadyProcessedPns.has(driver.pn)) continue;
            if (!driver.email) continue;

            // Insert as Pending
            await supabase.from('driver_email_logs').insert([{
                driver_pn: driver.pn,
                email: driver.email,
                category: driver.status,
                status: 'Pending'
            }]);
            queuedCount++;
        }

        console.log(`[Email Queue] Queued ${queuedCount} emails for sending.`);
        
        // Immediately try to process the queue
        processEmailQueue();
    } catch (error) {
        console.error('[Email Queue] Error queuing emails:', error);
    }
}

// 2. Process Queue
async function processEmailQueue() {
    if (isProcessingQueue) {
        console.log('[Email Queue] Already processing queue...');
        return;
    }
    isProcessingQueue = true;
    console.log('[Email Queue] Processor started...');

    try {
        const { data: settings } = await supabase.from('driver_email_settings').select('*').eq('id', 1).maybeSingle();
        const dailyLimit = (settings && settings.daily_limit) ? settings.daily_limit : 1000;

        const todayStr = new Date().toISOString().split('T')[0];
        
        // Count how many we already SENT today (Success)
        const { count: sentToday, error: cErr } = await supabase.from('driver_email_logs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Success')
            .gte('sent_at', `${todayStr}T00:00:00Z`)
            .lt('sent_at', `${todayStr}T23:59:59Z`);
            
        if (cErr) throw new Error('Failed to count sent logs: ' + cErr.message);
        
        const remainingCapacity = dailyLimit - (sentToday || 0);
        console.log(`[Email Queue] Capacity: limit=${dailyLimit}, sent_today=${sentToday}, remaining=${remainingCapacity}`);

        if (remainingCapacity <= 0) {
            console.log('[Email Queue] Daily limit reached. Halting processor for today.');
            isProcessingQueue = false;
            return;
        }

        // Fetch Pending from today (or earlier, but let's just fetch pending)
        const { data: pendingData, error: pErr } = await supabase.from('driver_email_logs')
            .select('*')
            .eq('status', 'Pending')
            .order('sent_at', { ascending: true }) // FIFO
            .limit(remainingCapacity);

        if (pErr) throw new Error('Failed to fetch pending: ' + pErr.message);

        if (!pendingData || pendingData.length === 0) {
            console.log('[Email Queue] No pending emails to send.');
            isProcessingQueue = false;
            return;
        }

        console.log(`[Email Queue] Found ${pendingData.length} pending emails. Sending...`);

        const { data: templatesData, error: tErr } = await supabase.from('driver_email_templates').select('*');
        if (tErr) throw new Error('Failed to fetch templates: ' + tErr.message);
        
        const templates = {};
        templatesData.forEach(t => templates[t.category] = t);
        
        const jsonPath = path.join(__dirname, 'absent_drivers_last_3_days.json');
        let driversData = [];
        if (fs.existsSync(jsonPath)) {
            driversData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        }

        let processCount = 0;
        for (const item of pendingData) {
            const template = templates[item.category];
            const driver = driversData.find(d => d.pn === item.driver_pn) || { name: 'Driver', pn: item.driver_pn, missedShifts: [] };

            if (!template) {
                await supabase.from('driver_email_logs').update({ status: 'Failed: No template found' }).eq('id', item.id);
                continue;
            }

            let subject = template.subject.replace(/{{name}}/g, driver.name).replace(/{{pn}}/g, driver.pn);
            let body = template.body.replace(/{{name}}/g, driver.name).replace(/{{pn}}/g, driver.pn);
            
            let detailsText = (driver.missedShifts && driver.missedShifts.length > 0) ? driver.missedShifts.join('<br>') : '';
            body = body.replace(/{{details}}/g, detailsText);

            try {
                const catSafe = item.category.replace(/[^a-zA-Z0-9]/g, '_');
                const attachmentPath = path.join(__dirname, 'attachments', `${catSafe}.pdf`);
                const attachments = fs.existsSync(attachmentPath) ? [{
                    filename: `${catSafe}.pdf`,
                    path: attachmentPath,
                    contentType: 'application/pdf'
                }] : [];

                await transporter.sendMail({
                    from: `"Oprisa Team" <${process.env.EMAIL_USER}>`,
                    to: item.email,
                    subject: subject,
                    html: body,
                    attachments: attachments
                });

                await supabase.from('driver_email_logs')
                    .update({ status: 'Success', sent_at: new Date().toISOString() }) // Update sent_at to actual send time
                    .eq('id', item.id);

                processCount++;
                await new Promise(resolve => setTimeout(resolve, 1500)); // Google rate limit spacing
            } catch (err) {
                console.error(`[Email Queue] Failed sending to ${item.email}`, err.message);
                await supabase.from('driver_email_logs').update({ status: 'Failed: ' + err.message }).eq('id', item.id);
            }
        }

        console.log(`[Email Queue] Processor finished. Sent ${processCount} emails.`);
    } catch (error) {
        console.error('[Email Queue] Error processing queue:', error);
    } finally {
        isProcessingQueue = false;
    }
}

async function sendSingleTestEmail(toEmail, subject, body, category = null) {
    try {
        let attachments = [];
        if (category) {
            const catSafe = category.replace(/[^a-zA-Z0-9]/g, '_');
            const attachmentPath = path.join(__dirname, 'attachments', `${catSafe}.pdf`);
            if (fs.existsSync(attachmentPath)) {
                attachments.push({ filename: `${catSafe}.pdf`, path: attachmentPath, contentType: 'application/pdf' });
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
        return { success: false, error: err.message };
    }
}

module.exports = {
    runDailyEmailJob,
    processEmailQueue,
    sendSingleTestEmail,
    transporter
};
