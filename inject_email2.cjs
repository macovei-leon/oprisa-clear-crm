const fs = require('fs');
let content = fs.readFileSync('backend/email_service.cjs', 'utf8');

const helper = `async function getTimelineDrivers() {
    try {
        const { data, error } = await supabase.from('dashboard_settings').select('timeline_file_path').eq('id', 1).maybeSingle();
        let targetPath = path.join(__dirname, '../public/driver-dashboard/timeline_data.json');
        if (!error && data && data.timeline_file_path) {
            targetPath = path.isAbsolute(data.timeline_file_path) ? data.timeline_file_path : path.resolve(__dirname, data.timeline_file_path);
        }
        if (fs.existsSync(targetPath)) {
            return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        }
        return [];
    } catch (e) {
        console.error('Error fetching timeline drivers:', e);
        return [];
    }
}`;

content = content.replace(/let isProcessingQueue = false;/, helper + '\n\nlet isProcessingQueue = false;');

const oldRunJobLogic = `        const jsonPath = path.join(__dirname, 'absent_drivers_last_3_days.json');
        if (!fs.existsSync(jsonPath)) {
            console.log('[Email Queue] Data file not found. Aborting.');
            return;
        }
        const drivers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));`;

const newRunJobLogic = `        const drivers = await getTimelineDrivers();
        if (!drivers || drivers.length === 0) {
            console.log('[Email Queue] Data file not found or empty. Aborting.');
            return;
        }`;

content = content.replace(oldRunJobLogic, newRunJobLogic);

const oldProcessQueueLogic = `        const jsonPath = path.join(__dirname, 'absent_drivers_last_3_days.json');
        let driversData = [];
        if (fs.existsSync(jsonPath)) {
            driversData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        }`;

const newProcessQueueLogic = `        let driversData = await getTimelineDrivers();`;

content = content.replace(oldProcessQueueLogic, newProcessQueueLogic);

content = content.replace(/module\.exports = \{/, 'module.exports = {\n    getTimelineDrivers,');

fs.writeFileSync('backend/email_service.cjs', content);
console.log('Done mapping email_service.cjs');
