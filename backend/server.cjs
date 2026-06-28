const express = require('express');
const { createClient } = require('@supabase/supabase-js');



const path = require('path');
const fs = require('fs');
const ws = require('ws');
const cron = require('node-cron');
const { runDailyEmailJob, processEmailQueue, sendSingleTestEmail } = require('./email_service.cjs');
const { processTimelineData } = require('./timeline_processor.cjs');
const multer = require('multer');

// Configure multer for PDF uploads
const uploadDir = path.join(__dirname, 'attachments');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const category = req.params.category.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${category}.pdf`);
    }
});
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});


const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me-in-production';

// Initialize Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://odgtubiqvxcszsfifjfd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false
    },
    global: {
        headers: { 'x-my-custom-header': 'my-app-name' },
    },
    realtime: {
        transport: ws
    }
});

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));


// Create default admin on startup


// Authentication Middleware
function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ------------------------------------------
// API Routes: Authentication
// ------------------------------------------
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    
    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true, role: user.role });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

app.get('/api/me', (req, res) => {
    res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

// ------------------------------------------
// API Routes: Drivers & Tasks
// ------------------------------------------
app.get('/api/drivers', async (req, res) => {
    const jsonPath = path.join(__dirname, 'absent_drivers_last_3_days.json');
    if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'Data not found' });

    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    if (req.user.role === 'admin') {
        return res.json(rawData);
    }

    const { data: rows, error } = await supabase.from('assignments').select('driver_pn').eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: 'Database error' });

    const assignedPns = new Set(rows.map(r => r.driver_pn));
    const filteredData = rawData.filter(d => assignedPns.has(d.pn));
    res.json(filteredData);
});

// Post a daily action (e.g. "To Call", "In Progress", "Finished")
app.post('/api/driver/action', async (req, res) => {
    const { driver_pn, status } = req.body;
    if (!driver_pn || !status) return res.status(400).json({ error: 'driver_pn and status required' });

    const { error } = await supabase.from('daily_actions').insert([{
        user_id: req.user.id,
        driver_pn: driver_pn,
        status: status
    }]);

    if (error) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
});

// Get today's actions for the current user to know status
app.get('/api/driver/status', async (req, res) => {
    // We only care about actions created today (in server time, or approx last 24h)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: rows, error } = await supabase.from('daily_actions')
        .select('driver_pn, status, created_at')
        .eq('user_id', req.user.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Database error' });

    // Deduplicate to only keep the latest status per driver
    const latestStatus = {};
    for (const row of rows) {
        if (!latestStatus[row.driver_pn]) {
            latestStatus[row.driver_pn] = row.status;
        }
    }
    
    res.json(latestStatus);
});

// ------------------------------------------
// API Routes: Admin Panel
// ------------------------------------------
app.get('/api/users', async (req, res) => {
    const { data: rows, error } = await supabase.from('users').select('id, email, role').neq('role', 'admin');
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
});

app.post('/api/users', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const { data, error } = await supabase.from('users').insert([{ email, password_hash: hash, role: 'worker' }]).select('id, email, role').single();
    if (error) return res.status(400).json({ error: 'User already exists or error' });
    res.json(data);
});

app.delete('/api/users/:id', async (req, res) => {
    const userId = req.params.id;
    await supabase.from('assignments').delete().eq('user_id', userId);
    await supabase.from('daily_actions').delete().eq('user_id', userId);
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
});

app.get('/api/assignments/:userId', async (req, res) => {
    const { data: rows, error } = await supabase.from('assignments').select('driver_pn').eq('user_id', req.params.userId);
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(rows.map(r => r.driver_pn));
});

app.post('/api/assignments/:userId', async (req, res) => {
    const userId = req.params.userId;
    const { driver_pns } = req.body;
    if (!Array.isArray(driver_pns)) return res.status(400).json({ error: 'driver_pns must be an array' });

    // Clean old assignments
    await supabase.from('assignments').delete().eq('user_id', userId);
    
    // Insert new ones
    if (driver_pns.length > 0) {
        const payload = driver_pns.map(pn => ({ user_id: userId, driver_pn: pn }));
        const { error } = await supabase.from('assignments').insert(payload);
        if (error) return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ success: true });
});

// Admin API: Stats for a specific date
app.get('/api/admin/stats', async (req, res) => {
    const dateQuery = req.query.date; // format YYYY-MM-DD
    if (!dateQuery) return res.status(400).json({ error: 'Date is required' });

    const startDate = new Date(dateQuery);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const { data: logs, error: logError } = await supabase.from('daily_actions')
        .select('user_id, driver_pn, status, created_at')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true }); // Process chronologically

    if (logError) return res.status(500).json({ error: 'Database error fetching logs' });

    const { data: users, error: userError } = await supabase.from('users').select('id, email').neq('role', 'admin');
    if (userError) return res.status(500).json({ error: 'Database error fetching users' });

    // Calculate "Finished" count per user for the day
    const stats = {};
    users.forEach(u => { stats[u.id] = { email: u.email, count: 0, latestStates: {} }; });

    // We only care if the *final* state for a driver on that day was "Finished"
    for (const log of logs) {
        if (stats[log.user_id]) {
            stats[log.user_id].latestStates[log.driver_pn] = log.status;
        }
    }

    for (const userId in stats) {
        for (const pn in stats[userId].latestStates) {
            if (stats[userId].latestStates[pn] === 'Finished') {
                stats[userId].count++;
            }
        }
    }

    const results = Object.values(stats).map(s => ({ email: s.email, count: s.count }));
    res.json(results);
});

// ------------------------------------------
// API Routes: Campaigns
// ------------------------------------------
app.post('/api/campaigns', async (req, res) => {
    const { title, description, target_role, trigger_type, custom_steps, workers, drivers } = req.body;
    
    if (!title || !custom_steps || !workers || !drivers || workers.length === 0 || drivers.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert campaign
    const { data: campaign, error: campaignError } = await supabase.from('campaigns').insert([{
        title,
        description,
        target_role,
        trigger_type,
        custom_steps: JSON.stringify(custom_steps)
    }]).select('id').single();

    if (campaignError) return res.status(500).json({ error: 'Failed to create campaign' });

    // Distribute tasks evenly among selected workers
    const tasks = [];
    for (let i = 0; i < drivers.length; i++) {
        const workerId = workers[i % workers.length];
        tasks.push({
            campaign_id: campaign.id,
            user_id: workerId,
            driver_pn: drivers[i],
            current_step: custom_steps[0]
        });
    }

    const { error: tasksError } = await supabase.from('campaign_tasks').insert(tasks);
    if (tasksError) return res.status(500).json({ error: 'Failed to assign tasks' });

    res.json({ success: true, campaign_id: campaign.id });
});

app.get('/api/campaigns', async (req, res) => {
    const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(data);
});

app.delete('/api/campaigns/:id', async (req, res) => {
    const campaignId = req.params.id;
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
});


// ------------------------------------------
// API Routes: Email Automation (Admin)
// ------------------------------------------
let emailCronTask = null;
let queueProcessorTask = null;

async function setupEmailCron() {
    if (emailCronTask) {
        emailCronTask.stop();
        emailCronTask = null;
    }
    if (queueProcessorTask) {
        queueProcessorTask.stop();
        queueProcessorTask = null;
    }

    const { data: settings } = await supabase.from('driver_email_settings').select('*').eq('id', 1).maybeSingle();
    
    // Always start the queue processor (every 5 minutes)
    queueProcessorTask = cron.schedule('*/5 * * * *', () => {
        processEmailQueue();
    });
    console.log('[Email Queue] Processor scheduled every 5 minutes.');

    if (settings && settings.is_enabled && settings.send_time) {
        const [hour, minute] = settings.send_time.split(':');
        const cronStr = `${minute} ${hour} * * *`;
        emailCronTask = cron.schedule(cronStr, () => {
            runDailyEmailJob();
        });
        console.log(`[Email Automation] Daily Job scheduled at: ${settings.send_time} (cron: ${cronStr})`);
    } else {
        console.log('[Email Automation] Daily Job is disabled or not configured.');
    }
}
setupEmailCron();

app.get('/api/admin/cron-status', (req, res) => {
    res.json({
        queueProcessorRunning: !!queueProcessorTask,
        dailyJobRunning: !!emailCronTask,
        serverTime: new Date().toISOString()
    });
});

app.get('/api/admin/tables', async (req, res) => {
    try {
        const { data, error } = await supabase.from('custom_tables').select('table_name, title_ro').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching custom tables:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch tables' });
    }
});

const uploadJson = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            cb(null, 'timeline_' + Date.now() + '.json');
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json') {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'));
        }
    }
});

app.post('/api/admin/upload-timeline', uploadJson.single('jsonFile'), async (req, res) => {
    try {
        const jsonFilePath = req.file?.path;
        if (!jsonFilePath) {
            return res.status(400).json({ success: false, message: 'Missing JSON file' });
        }

        // Fetch active table
        const { data: settingsData } = await supabase.from('dashboard_settings').select('active_table').eq('id', 1).single();
        const tableName = settingsData?.active_table || 'angajati';

        // Fetch driver data from the selected table
        const { data: supabaseData, error } = await supabase.from(tableName).select('*');
        if (error) {
            throw new Error(`Failed to fetch from ${tableName}: ${error.message}`);
        }

        // Process timeline data
        const allDriversResult = await processTimelineData(jsonFilePath, supabaseData);

        // Save processed result locally
        const processedPath = path.join(__dirname, 'attachments', 'processed_' + path.basename(jsonFilePath));
        fs.writeFileSync(processedPath, JSON.stringify(allDriversResult, null, 2), 'utf8');

        // Update dashboard_settings with paths
        await supabase.from('dashboard_settings').upsert({
            id: 1,
            active_table: tableName,
            raw_file_path: jsonFilePath,
            timeline_file_path: processedPath,
            updated_at: new Date().toISOString()
        });
        
        res.json({ success: true, message: 'Timeline uploaded and processed successfully!' });
    } catch (err) {
        console.error('Timeline upload error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/admin/set-table', async (req, res) => {
    try {
        const tableName = req.body.tableName;
        if (!tableName) {
            return res.status(400).json({ success: false, message: 'Missing table name' });
        }

        // Get existing paths
        const { data: settingsData } = await supabase.from('dashboard_settings').select('*').eq('id', 1).maybeSingle();
        
        if (settingsData && settingsData.raw_file_path && fs.existsSync(settingsData.raw_file_path)) {
            const { data: supabaseData, error } = await supabase.from(tableName).select('*');
            if (error) throw new Error(`Failed to fetch from ${tableName}: ${error.message}`);

            const allDriversResult = await processTimelineData(settingsData.raw_file_path, supabaseData);
            
            const processedPath = path.join(__dirname, 'attachments', 'processed_' + Date.now() + '.json');
            fs.writeFileSync(processedPath, JSON.stringify(allDriversResult, null, 2), 'utf8');
            
            await supabase.from('dashboard_settings').upsert({
                id: 1,
                active_table: tableName,
                raw_file_path: settingsData.raw_file_path,
                timeline_file_path: processedPath,
                updated_at: new Date().toISOString()
            });
            
            return res.json({ success: true, message: 'Table updated and data re-processed!' });
        }

        // No raw file yet, just update table name
        await supabase.from('dashboard_settings').upsert({
            id: 1,
            active_table: tableName,
            updated_at: new Date().toISOString()
        });

        res.json({ success: true, message: 'Table updated, but no timeline data to process yet.' });
    } catch (err) {
        console.error('Set table error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/admin/active-table', async (req, res) => {
    try {
        const { data, error } = await supabase.from('dashboard_settings').select('active_table').eq('id', 1).maybeSingle();
        if (error || !data || !data.active_table) return res.json({ tableName: 'angajati' });
        res.json({ tableName: data.active_table });
    } catch (e) {
        res.json({ tableName: 'angajati' });
    }
});

app.get('/api/admin/timeline-data', async (req, res) => {
    try {
        const { data, error } = await supabase.from('dashboard_settings').select('timeline_file_path').eq('id', 1).maybeSingle();
        let targetPath = path.join(__dirname, '../public/driver-dashboard/timeline_data.json'); // Default fallback
        if (!error && data && data.timeline_file_path) {
            targetPath = path.isAbsolute(data.timeline_file_path) ? data.timeline_file_path : path.resolve(__dirname, data.timeline_file_path);
        }
        
        if (fs.existsSync(targetPath)) {
            const fileData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
            return res.json(fileData);
        }
        res.json([]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/email-status', async (req, res) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Sent today
        const { count: sentToday } = await supabase.from('driver_email_logs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Success')
            .gte('sent_at', `${todayStr}T00:00:00Z`)
            .lt('sent_at', `${todayStr}T23:59:59Z`);
            
        // Pending Queue
        const { count: pendingQueue } = await supabase.from('driver_email_logs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Pending');
            
        const { data: settings } = await supabase.from('driver_email_settings').select('*').eq('id', 1).maybeSingle();
        const dailyLimit = (settings && settings.daily_limit) ? settings.daily_limit : 1000;
        
        res.json({
            sent_today: sentToday || 0,
            pending_queue: pendingQueue || 0,
            daily_limit: dailyLimit
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/email-settings', async (req, res) => {
    const { data, error } = await supabase.from('driver_email_settings').select('*').eq('id', 1).maybeSingle();
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(data || { 
        send_time: '09:00', 
        is_enabled: false,
        daily_limit: 1000,
        pn_range_start: '',
        pn_range_end: '',
        allowed_categories: ['Started Late', 'Left Early / Big Gaps', 'No Shifts', 'Absent']
    });
});

app.put('/api/admin/email-settings', async (req, res) => {
    const { send_time, is_enabled, daily_limit, pn_range_start, pn_range_end, allowed_categories } = req.body;
    const { error } = await supabase.from('driver_email_settings').upsert([{ 
        id: 1, 
        send_time, 
        daily_limit,
        is_enabled,
        pn_range_start,
        pn_range_end,
        allowed_categories: allowed_categories || ['Started Late', 'Left Early / Big Gaps', 'No Shifts', 'Absent']
    }]);
    if (error) return res.status(500).json({ error: 'Database error' });
    setupEmailCron(); // Reload cron
    res.json({ success: true });
});

app.get('/api/admin/email-templates', async (req, res) => {
    const { data, error } = await supabase.from('driver_email_templates').select('*').order('category');
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(data);
});

app.put('/api/admin/email-templates', async (req, res) => {
    const { category, subject, body } = req.body;
    const { error } = await supabase.from('driver_email_templates').upsert([{ category, subject, body }], { onConflict: 'category' });
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
});

app.get('/api/admin/email-logs', async (req, res) => {
    const { data, error } = await supabase.from('driver_email_logs').select('*').order('sent_at', { ascending: false }).limit(1500);
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(data);
});

app.post('/api/admin/email-templates/:category/attachment', upload.single('pdf'), (req, res) => {
    res.json({ success: true, message: 'Attachment uploaded successfully' });
});

app.get('/api/admin/email-templates/:category/attachment', (req, res) => {
    const category = req.params.category.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = path.join(__dirname, 'attachments', `${category}.pdf`);
    res.json({ exists: fs.existsSync(filePath) });
});

app.delete('/api/admin/email-templates/:category/attachment', (req, res) => {
    const category = req.params.category.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = path.join(__dirname, 'attachments', `${category}.pdf`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    res.json({ success: true });
});

app.post('/api/admin/test-email', async (req, res) => {
    // Manually trigger the job immediately for testing
    runDailyEmailJob();
    res.json({ success: true, message: 'Email job triggered in background' });
});

app.post('/api/admin/send-single-test', async (req, res) => {
    const { toEmail, subject, body, testPn, category } = req.body;
    if (!toEmail || !subject || !body) {
        return res.status(400).json({ error: 'Missing toEmail, subject, or body' });
    }
    
    let finalSubject = subject;
    let finalBody = body;
    
    let driver = null;
    if (testPn) {
        const jsonPath = path.join(__dirname, 'absent_drivers_last_3_days.json');
        if (fs.existsSync(jsonPath)) {
            const drivers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            driver = drivers.find(d => d.pn === testPn);
        }
    }
    
    if (driver) {
        finalSubject = finalSubject.replace(/{{name}}/g, driver.name).replace(/{{pn}}/g, driver.pn);
        finalBody = finalBody.replace(/{{name}}/g, driver.name).replace(/{{pn}}/g, driver.pn);
        let detailsText = (driver.missedShifts && driver.missedShifts.length > 0) ? driver.missedShifts.join('<br>') : 'No specific violations found.';
        finalBody = finalBody.replace(/{{details}}/g, detailsText);
    } else {
        // Dummy data fallback
        const dummyName = 'Ion Popescu';
        const dummyPn = testPn || 'TEST-9999';
        const dummyDetails = '[Started Late] Scheduled start: 19.06.2026 08:00 | Actual active start: 19.06.2026 09:30 (Late by 90 mins)<br>[Left Early] Scheduled end: 19.06.2026 16:00 | Actual active end: 19.06.2026 15:00 (Left early by 60 mins)';
        finalSubject = finalSubject.replace(/{{name}}/g, dummyName).replace(/{{pn}}/g, dummyPn);
        finalBody = finalBody.replace(/{{name}}/g, dummyName).replace(/{{pn}}/g, dummyPn);
        finalBody = finalBody.replace(/{{details}}/g, dummyDetails);
    }
    
    const result = await sendSingleTestEmail(toEmail, finalSubject, finalBody, category);
    if (result.success) {
        res.json({ success: true, message: 'Test email sent successfully' });
    } else {
        res.status(500).json({ error: result.error });
    }
});


// ------------------------------------------
// API Routes: Proxy endpoints for API Workspace
// ------------------------------------------
app.get('/api/proxy/:endpoint', async (req, res) => {
    const endpoint = req.params.endpoint;
    
    const urlMap = {
        'status': process.env.FLUXER_STATUS_URL || '',
        'schedules': process.env.FLUXER_SCHEDULES_URL || '',
        'links': process.env.FLUXER_LINKS_URL || ''
    };

    const targetUrl = urlMap[endpoint];
    if (!targetUrl) {
        if (endpoint === 'status') {
            const { data, error } = await supabase.from('drivers').select('*');
            if (error) return res.json({ data: [], _warning: "DB Fetch Error: " + error.message });
            return res.json({ data: data || [], _warning: "API not configured. Falling back to Supabase DB." });
        }
        return res.json({ data: [], _warning: "Endpoint not configured in .env" });
    }

    try {
        const response = await fetch(targetUrl);
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/state', async (req, res) => {
    const targetUrl = process.env.STATE_API_URL || '';
    if (!targetUrl) {
        const { data, error } = await supabase.from('drivers').select('*');
        if (error) return res.json({ drivers: [], _warning: "DB Fetch Error: " + error.message });
        return res.json({ drivers: data || [], _warning: "State API not configured. Falling back to Supabase DB." });
    }

    try {
        const response = await fetch(targetUrl);
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ------------------------------------------
// Static files (Protected dashboard, public login)
// ------------------------------------------
app.get('/', (req, res) => {
    res.redirect('/dashboard.html');
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/absent_drivers_last_3_days.csv', (req, res) => {
    res.sendFile(path.join(__dirname, 'absent_drivers_last_3_days.csv'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve CSS files
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/fleetcap.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'fleetcap.css'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
