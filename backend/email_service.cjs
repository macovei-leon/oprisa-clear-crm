require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
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


async function stampPdf(catSafe, driver) {
    try {
        const publicPdfUrl = supabase.storage.from('crm-attachments').getPublicUrl(`${catSafe}.pdf`).data.publicUrl;
        const pdfFetch = await fetch(publicPdfUrl);
        if (!pdfFetch.ok) return null;
        
        const pdfArrayBuffer = await pdfFetch.arrayBuffer();
        
        const publicConfigUrl = supabase.storage.from('crm-attachments').getPublicUrl(`${catSafe}_config.json`).data.publicUrl;
        const configFetch = await fetch(publicConfigUrl);
        let config = null;
        if (configFetch.ok) {
            try { config = await configFetch.json(); } catch(e) {}
        }

        if (!config || config.length === 0) {
            return { buffer: Buffer.from(pdfArrayBuffer) };
        }

        const pdfBytes = Buffer.from(pdfArrayBuffer);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        const { width, height } = firstPage.getSize();

        for (const field of config) {
            let textToDraw = field.tag;
            // Replace placeholders
            textToDraw = textToDraw.replace(/\[Driver Name\]/g, driver.name || '');
            textToDraw = textToDraw.replace(/\[Driver PN\]/g, driver.pn || '');
            textToDraw = textToDraw.replace(/\[Phone\]/g, driver.phone || '');
            textToDraw = textToDraw.replace(/\[Email\]/g, driver.email || '');
            textToDraw = textToDraw.replace(/\[Company\]/g, (driver.companies || []).join(', ') || '');
            textToDraw = textToDraw.replace(/\[Contract Type\]/g, driver.contractType || '');
            textToDraw = textToDraw.replace(/\[Today's Date\]/g, new Date().toLocaleDateString('ro-RO'));
            textToDraw = textToDraw.replace(/\[Details\]/g, (driver.missedShifts && driver.missedShifts.length > 0) ? driver.missedShifts.join('\n') : 'No specific violations found.');
            
            const x = (field.x / 100) * width;
            const y = height - ((field.y / 100) * height) - 12; // offset for font height

            firstPage.drawText(textToDraw, {
                x: x,
                y: y,
                size: 12,
                color: rgb(0, 0, 0)
            });
        }

        const modifiedPdfBytes = await pdfDoc.save();
        return { buffer: Buffer.from(modifiedPdfBytes) };
    } catch (err) {
        console.error('Error stamping PDF:', err);
        return null;
    }
}


async function getTimelineDrivers() {
    try {
        const { data, error } = await supabase.from('dashboard_settings').select('timeline_file_path').eq('id', 1).maybeSingle();
        if (!error && data && data.timeline_file_path) {
            let parsedData = null;
            if (data.timeline_file_path.startsWith('http')) {
                const fetchRes = await fetch(data.timeline_file_path);
                if (fetchRes.ok) parsedData = await fetchRes.json();
            } else {
                let targetPath = path.isAbsolute(data.timeline_file_path) ? data.timeline_file_path : path.resolve(__dirname, data.timeline_file_path);
                if (fs.existsSync(targetPath)) parsedData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
            }
            
            if (parsedData) {
                if (!Array.isArray(parsedData) && parsedData.drivers) return parsedData.drivers;
                return Array.isArray(parsedData) ? parsedData : [];
            }
        }
        return [];
    } catch (e) {
        console.error('Error fetching timeline drivers:', e);
        return [];
    }
}

let isProcessingQueue = false;

// 1. Queue Emails
async function runDailyEmailJob(overrideCategories = null) {
    console.log('[Email Queue] Starting daily email queuing job...');
    try {
        const drivers = await getTimelineDrivers();
        if (!drivers || drivers.length === 0) {
            console.log('[Email Queue] Data file not found or empty. Aborting.');
            return { success: false, message: 'Data file not found or empty.' };
        }

        const { data: settings } = await supabase.from('driver_email_settings').select('*').eq('id', 1).maybeSingle();
        const targetCategories = overrideCategories || (settings && settings.allowed_categories ? settings.allowed_categories : ['Started Late', 'Left Early / Big Gaps', 'No Shifts', 'Absent', 'Test']);
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

        // Automatically inject test drivers if 'Test' category is active
        if (targetCategories.includes('Test')) {
            try {
                const fs = require('fs');
                const path = require('path');
                const testFilePath = path.resolve(__dirname, '../test_timeline.json');
                if (fs.existsSync(testFilePath)) {
                    const testDriversRaw = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
                    const testDrivers = Array.isArray(testDriversRaw) ? testDriversRaw : (testDriversRaw.drivers || []);
                    targets.push(...testDrivers.filter(d => d.status === 'Test'));
                }
            } catch (err) {
                console.error("Error injecting test drivers:", err);
            }
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: logsData, error: lErr } = await supabase.from('driver_email_logs')
            .select('driver_pn')
            .gte('sent_at', `${todayStr}T00:00:00Z`)
            .lt('sent_at', `${todayStr}T23:59:59Z`);
        
        if (lErr) throw new Error('Failed to fetch logs: ' + lErr.message);
        const alreadyProcessedPns = new Set(logsData.map(l => l.driver_pn));

        const validTargets = [];
        for (const driver of targets) {
            // Bypass the once-a-day check if the category is 'Test' so users can run multiple tests
            if (driver.status !== 'Test' && alreadyProcessedPns.has(driver.pn)) continue;
            if (!driver.email) continue;
            validTargets.push(driver);
        }

        if (validTargets.length === 0) {
            console.log('[Email Queue] No valid targets to queue today.');
            return { success: false, message: `No valid targets to queue today. Checked ${targets.length} drivers, but ${targets.length - validTargets.length} were already emailed or lacked emails.` };
        }

        // Create batch
        const batchName = `Automation Run - ${new Date().toLocaleString()}`;
        const { data: batchData, error: bErr } = await supabase.from('driver_email_batches')
            .insert([{ name: batchName, total_emails: validTargets.length }])
            .select()
            .single();
            
        if (bErr) throw new Error('Failed to create batch: ' + bErr.message);
        
        const queueEntries = validTargets.map(driver => ({
            batch_id: batchData.id,
            driver_pn: driver.pn,
            email: driver.email,
            category: driver.status,
            status: 'Pending'
        }));
        
        const { error: qErr } = await supabase.from('driver_email_queue').insert(queueEntries);
        if (qErr) throw new Error('Failed to queue emails: ' + qErr.message);

        console.log(`[Email Queue] Created batch ${batchData.id} with ${queueEntries.length} emails.`);
        
        // Immediately try to process the queue
        processEmailQueue();
        
        return { success: true, message: `Created batch ${batchData.id} with ${queueEntries.length} emails queued.` };
    } catch (error) {
        console.error('[Email Queue] Error queuing emails:', error);
        return { success: false, message: 'Error queuing emails: ' + error.message };
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
        // Find ALL active batches
        const { data: activeBatches, error: bErr } = await supabase.from('driver_email_batches')
            .select('*')
            .eq('status', 'Running')
            .order('created_at', { ascending: true });
            
        if (bErr) throw new Error('Failed to fetch active batches: ' + bErr.message);
        
        if (!activeBatches || activeBatches.length === 0) {
            console.log('[Email Queue] No active batches.');
            isProcessingQueue = false;
            return;
        }

        // Fetch Pending from active batches
        const activeBatchIds = activeBatches.map(b => b.id);
        const { data: pendingData, error: pErr } = await supabase.from('driver_email_queue')
            .select('*')
            .eq('status', 'Pending')
            .in('batch_id', activeBatchIds)
            .order('created_at', { ascending: true }) // FIFO
            .limit(50); // Process 50 at a time

        if (pErr) throw new Error('Failed to fetch pending: ' + pErr.message);

        if (!pendingData || pendingData.length === 0) {
            console.log('[Email Queue] No pending emails to send. Checking for completed batches.');
            // Let's mark batches as completed if sent_count + failed_count >= total_emails
            for (const b of activeBatches) {
                 if (b.sent_count + b.failed_count >= b.total_emails) {
                      await supabase.from('driver_email_batches').update({ status: 'Completed' }).eq('id', b.id);
                 }
            }
            isProcessingQueue = false;
            return;
        }

        console.log(`[Email Queue] Found ${pendingData.length} pending emails. Sending...`);

        const { data: templatesData, error: tErr } = await supabase.from('driver_email_templates').select('*');
        if (tErr) throw new Error('Failed to fetch templates: ' + tErr.message);
        
        const templates = {};
        templatesData.forEach(t => templates[t.category] = t);
        
        let driversData = await getTimelineDrivers();

        let processCount = 0;
        for (const item of pendingData) {
            // Check if batch is STILL running (might have been paused by admin during the loop)
            const { data: currentBatch } = await supabase.from('driver_email_batches').select('status, sent_count, failed_count').eq('id', item.batch_id).single();
            if (currentBatch && currentBatch.status !== 'Running') {
                console.log(`[Email Queue] Batch ${item.batch_id} is no longer running. Skipping item.`);
                continue;
            }

            const template = templates[item.category];
            const driver = driversData.find(d => d.pn === item.driver_pn) || { name: 'Driver', pn: item.driver_pn, missedShifts: [] };

            if (!template) {
                await supabase.from('driver_email_queue').update({ status: 'Failed' }).eq('id', item.id);
                if (currentBatch) await supabase.from('driver_email_batches').update({ failed_count: currentBatch.failed_count + 1 }).eq('id', item.batch_id);
                continue;
            }

            let subject = template.subject.replace(/{{name}}/g, driver.name).replace(/{{pn}}/g, driver.pn);
            let body = template.body.replace(/{{name}}/g, driver.name).replace(/{{pn}}/g, driver.pn);
            
            let detailsText = (driver.missedShifts && driver.missedShifts.length > 0) ? driver.missedShifts.join('<br>') : '';
            body = body.replace(/{{details}}/g, detailsText);

            try {
                const catSafe = item.category.replace(/[^a-zA-Z0-9]/g, '_');
                
                let attachments = [];
                const stamped = await stampPdf(catSafe, driver);
                if (stamped && stamped.buffer) {
                    attachments.push({ filename: `${catSafe}.pdf`, content: stamped.buffer, contentType: 'application/pdf' });
                }

                await transporter.sendMail({
                    from: `"Oprisa Team" <${process.env.EMAIL_USER}>`,
                    to: item.email,
                    subject: subject,
                    html: body,
                    attachments: attachments
                });

                // Success: delete from queue, log, update batch
                await supabase.from('driver_email_queue').delete().eq('id', item.id);
                await supabase.from('driver_email_logs').insert([{ driver_pn: item.driver_pn, email: item.email, category: item.category, status: 'Success' }]);
                if (currentBatch) await supabase.from('driver_email_batches').update({ sent_count: currentBatch.sent_count + 1 }).eq('id', item.batch_id);

                processCount++;
                await new Promise(resolve => setTimeout(resolve, 1500)); // Google rate limit spacing
            } catch (err) {
                console.error(`[Email Queue] Failed sending to ${item.email}`, err.message);
                await supabase.from('driver_email_queue').update({ status: 'Failed' }).eq('id', item.id);
                await supabase.from('driver_email_logs').insert([{ driver_pn: item.driver_pn, email: item.email, category: item.category, status: 'Failed: ' + err.message }]);
                if (currentBatch) await supabase.from('driver_email_batches').update({ failed_count: currentBatch.failed_count + 1 }).eq('id', item.batch_id);
            }
        }

        console.log(`[Email Queue] Processor finished batch portion. Sent ${processCount} emails.`);
        
        if (pendingData.length === 50) {
             setTimeout(processEmailQueue, 1000);
        } else {
             // Let's run it one more time to mark batches as completed
             setTimeout(processEmailQueue, 1000);
        }
    } catch (error) {
        console.error('[Email Queue] Error processing queue:', error);
    } finally {
        isProcessingQueue = false;
    }
}

async function sendSingleTestEmail(toEmail, subject, body, category = null, driver = {}) {
    try {
        let attachments = [];
        if (category) {
            const catSafe = category.replace(/[^a-zA-Z0-9]/g, '_');
            
            const stamped = await stampPdf(catSafe, driver || {});
            if (stamped && stamped.buffer) {
                attachments.push({ filename: `${catSafe}.pdf`, content: stamped.buffer, contentType: 'application/pdf' });
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
    getTimelineDrivers,
    runDailyEmailJob,
    processEmailQueue,
    sendSingleTestEmail,
    transporter
};
