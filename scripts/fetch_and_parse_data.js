const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Base date for calculating hours
const BASE_DATE_STR = '2026-06-19T00:00:00+03:00';
const BASE_DATE = new Date(BASE_DATE_STR);

function getHoursSinceBase(dateStr) {
    let dStr = dateStr;
    if (!dStr.includes('+')) dStr += '+03:00';
    const d = new Date(dStr);
    return (d.getTime() - BASE_DATE.getTime()) / 3600000;
}

function normalizeName(name) {
    if (!name) return '';
    return name.replace(/^[-\u2013\u2014\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function formatHourToDateTime(t) {
    const timeInMs = t * 60 * 60 * 1000;
    const d = new Date(BASE_DATE.getTime() + timeInMs);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

const DAY_MAP = {
    'friday': 0,    // June 19
    'saturday': 24, // June 20
    'sunday': 48,   // June 21
    'monday': 72,   // June 22
    'tuesday': 96   // June 23
};

async function run() {
    try {
        console.log("Reading angajati.xlsx...");
        const excelMapByPn = new Map();
        const excelMapByName = new Map();
        const excelPath = path.join(__dirname, 'angajati.xlsx');
        if (fs.existsSync(excelPath)) {
            const workbook = xlsx.readFile(excelPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = xlsx.utils.sheet_to_json(worksheet);
            rows.forEach(row => {
                const pn = row['PN'] ? String(row['PN']).trim() : '';
                const rawName = row['Nume'] ? String(row['Nume']).trim() : '';
                const normalizedName = normalizeName(rawName);
                const info = {
                    email: row['Email'] ? String(row['Email']).trim() : '',
                    phone: row['Telefon'] ? String(row['Telefon']).trim() : '',
                    company: row['Companie'] ? String(row['Companie']).trim() : '',
                    city: row['Orase'] ? String(row['Orase']).trim() : '',
                    contractType: row['Tip Contract'] ? String(row['Tip Contract']).trim() : ''
                };
                if (pn) excelMapByPn.set(pn, info);
                if (normalizedName) excelMapByName.set(normalizedName, info);
            });
        }

        console.log("Fetching Ture Programate from API...");
        const apiRes = await fetch('https://oprisa.fluxer.io/rest/Oprisa/getTureProgramateRest', {
            method: 'POST',
            headers: { 'X-API-KEY': '2f4f26ea80e689ae2b54138ac45f859cf360871236636819e832fb91938e13ff', 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataStart: '2026-06-19', dataEnd: '2026-06-23' })
        });
        const apiData = await apiRes.json();
        const scheduledShiftsMap = new Map();
        if (apiData.success && apiData.data) {
            apiData.data.forEach(d => {
                const angajatId = String(d.driver_id).trim();
                const s = d.schedules || [];
                scheduledShiftsMap.set(angajatId, s);
            });
        }

        console.log("Loading JSON data file...");
        const jsonPath = path.join(__dirname, 'samedataasinhtmlbutinjson.json');
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const soferi = jsonData.data.soferi;
        
        const allDriversResult = [];
        
        const LEAVE_NAMES = {
            '#6366f1': 'Concediu medical copil',
            '#78716c': 'Somaj tehnic',
            '#1e3a8a': 'Concediu medical',
            '#3b82f6': 'Concediu de odihna',
            '#a855f7': 'Concediu parental',
            '#bfdbfe': 'Concediu fara plata'
        };

        soferi.forEach(sofer => {
            const name = sofer.nume;
            const pn = String(sofer.pn || '');
            const key = pn || normalizeName(name);
            
            const shifts = [];
            const activities = [];
            const scheduledShifts = [];
            const leaveSegments = [];
            const disponibilitate = [];
            const forecast = [];
            
            const angajatId = String(sofer.id || '');
            
            if (angajatId && scheduledShiftsMap.has(angajatId)) {
                const apiSchedules = scheduledShiftsMap.get(angajatId);
                apiSchedules.forEach(s => {
                    const dayOffset = DAY_MAP[s.day.toLowerCase()];
                    if (dayOffset !== undefined) {
                        const [startH, startM] = s.start.split(':').map(Number);
                        const [endH, endM] = s.end.split(':').map(Number);
                        let start = dayOffset + startH + startM / 60;
                        let end = dayOffset + endH + endM / 60;
                        if (end < start) end += 24; 
                        shifts.push({ type: 'HR App Shift', start: formatHourToDateTime(start), end: formatHourToDateTime(end), startHour: start, endHour: end });
                        scheduledShifts.push({ start, end, type: 'HR App Shift' });
                    }
                });
            }

            if (sofer.ture) {
                sofer.ture.forEach(t => {
                    if (t.tipTuraId === '1') {
                        const start = getHoursSinceBase(t.dataOraStart);
                        const end = getHoursSinceBase(t.dataOraEnd);
                        shifts.push({ type: 'Real Shift', start: formatHourToDateTime(start), end: formatHourToDateTime(end), startHour: start, endHour: end });
                    }
                });
            }
            
            if (sofer.timeline) {
                sofer.timeline.forEach(t => {
                    const start = getHoursSinceBase(t.dataOraStart);
                    const end = getHoursSinceBase(t.dataOraEnd);
                    let color = t.culoareTipTimeline || t.color;
                    if (!color) color = '#94a3b8';
                    let type = 'Inactive';
                    let bg = color.toLowerCase();
                    if (bg === '#22c55e') type = 'Active';
                    else if (bg === '#94a3b8') type = 'Inactive';
                    else if (bg === '#fbbf24' || bg === '#f59e0b' || bg === '#f97316' || bg === '#c2410c') type = 'Break';
                    else if (LEAVE_NAMES[bg]) {
                        type = `Leave: ${LEAVE_NAMES[bg]}`;
                        leaveSegments.push({ start, end, name: LEAVE_NAMES[bg], color: bg });
                    }
                    
                    if (type === 'Break' && (end - start) > 1.0) {
                        type = 'Missing';
                        color = '#ef4444';
                    }
                    activities.push({ type, start: formatHourToDateTime(start), end: formatHourToDateTime(end), startHour: start, endHour: end, color });
                });
            }

            if (sofer.disponibilitate) {
                sofer.disponibilitate.forEach(d => {
                    const start = getHoursSinceBase(d.dataOraStart);
                    const end = getHoursSinceBase(d.dataOraEnd);
                    disponibilitate.push({ start: formatHourToDateTime(start), end: formatHourToDateTime(end), startHour: start, endHour: end });
                });
            }

            if (sofer.forecastTure) {
                sofer.forecastTure.forEach(f => {
                    const start = getHoursSinceBase(f.dataOraStart);
                    const end = getHoursSinceBase(f.dataOraEnd);
                    forecast.push({ start: formatHourToDateTime(start), end: formatHourToDateTime(end), startHour: start, endHour: end });
                });
            }

            const missedShifts = [];
            let totalActiveWorkAcrossAllShifts = 0;
            let totalScheduledShiftsCount = scheduledShifts.length;

            scheduledShifts.forEach(s => {
                const startStr = formatHourToDateTime(s.start);
                const endStr = formatHourToDateTime(s.end);
                const shiftDur = s.end - s.start;

                let day = 19;
                if (s.start >= 24 && s.start < 48) day = 20;
                else if (s.start >= 48 && s.start < 72) day = 21;
                else if (s.start >= 72 && s.start < 96) day = 22;
                else if (s.start >= 96) day = 23;

                let hasLeaveOnSameDay = false;
                const dayStartOffset = (day - 19) * 24;
                const dayEndOffset = dayStartOffset + 24;

                leaveSegments.forEach(l => {
                    const overlapWithDay = Math.min(dayEndOffset, l.end) - Math.max(dayStartOffset, l.start);
                    if (overlapWithDay > 0) hasLeaveOnSameDay = true;
                });
                
                if (hasLeaveOnSameDay) return;

                const overlappingActive = [];
                activities.forEach(act => {
                    if (act.type === 'Active') {
                        const overlap = Math.min(s.end, act.endHour) - Math.max(s.start, act.startHour);
                        if (overlap > 0) overlappingActive.push({ startHour: act.startHour, endHour: act.endHour, overlap: overlap });
                    }
                });

                let totalActiveOverlap = 0;
                overlappingActive.forEach(o => totalActiveOverlap += o.overlap);
                totalActiveWorkAcrossAllShifts += totalActiveOverlap;

                if (overlappingActive.length === 0) {
                    missedShifts.push({ type: s.type, start: startStr, end: endStr, startHour: s.start, endHour: s.end, day: day, violationType: 'Missed Shift', detail: `[Missed Shift] Scheduled: ${startStr} - ${endStr} (No active work logged)` });
                } else {
                    let earliestStart = Infinity;
                    overlappingActive.forEach(o => { if (o.startHour < earliestStart) earliestStart = o.startHour; });
                    const actualStartHour = Math.max(s.start, earliestStart);
                    if (actualStartHour > s.start + 10 / 60) {
                        const latenessMins = Math.round((actualStartHour - s.start) * 60);
                        missedShifts.push({ type: s.type, start: startStr, end: endStr, startHour: s.start, endHour: s.end, day: day, violationType: 'Started Late', detail: `[Started Late] Scheduled start: ${startStr} | Actual active start: ${formatHourToDateTime(earliestStart)} (Late by ${latenessMins} mins)` });
                    }

                    let latestEnd = -Infinity;
                    overlappingActive.forEach(o => { if (o.endHour > latestEnd) latestEnd = o.endHour; });
                    const actualEndHour = Math.min(s.end, latestEnd);
                    if (actualEndHour < s.end - 10 / 60) {
                        const earlyMins = Math.round((s.end - actualEndHour) * 60);
                        missedShifts.push({ type: s.type, start: startStr, end: endStr, startHour: s.start, endHour: s.end, day: day, violationType: 'Left Early', detail: `[Left Early] Scheduled end: ${endStr} | Actual active end: ${formatHourToDateTime(latestEnd)} (Left early by ${earlyMins} mins)` });
                    }

                    const workPct = (totalActiveOverlap / shiftDur) * 100;
                    if (workPct < 40) {
                        missedShifts.push({ type: s.type, start: startStr, end: endStr, startHour: s.start, endHour: s.end, day: day, violationType: 'Big Gaps', detail: `[Big Gaps] Scheduled: ${startStr} - ${endStr} | Active work: ${totalActiveOverlap.toFixed(1)} hrs (${Math.round(workPct)}% of shift)` });
                    }
                }
            });

            let totalWorkedActiveHours = 0;
            activities.forEach(act => {
                if (act.type === 'Active') totalWorkedActiveHours += (act.endHour - act.startHour);
            });

            let status = 'OK';
            const hasMissedShift = missedShifts.some(m => m.violationType === 'Missed Shift');
            const hasLateViolation = missedShifts.some(m => m.violationType === 'Started Late');
            const hasEarlyOrGaps = missedShifts.some(m => m.violationType === 'Left Early' || m.violationType === 'Big Gaps');

            if (totalScheduledShiftsCount === 0 && totalWorkedActiveHours === 0) {
                status = 'No Shifts';
            } else if (hasMissedShift) {
                status = 'Absent';
            } else if (hasLateViolation) {
                status = 'Started Late';
            } else if (hasEarlyOrGaps) {
                status = 'Left Early / Big Gaps';
            } else if (totalScheduledShiftsCount > 0 && totalWorkedActiveHours === 0) {
                status = 'OK';
            }

            let hasConcediu = leaveSegments.length > 0;
            if (hasConcediu && status === 'OK') {
                status = 'Concediu';
            }

            const m19 = missedShifts.some(m => m.day === 19 && m.violationType === 'Missed Shift');
            const m20 = missedShifts.some(m => m.day === 20 && m.violationType === 'Missed Shift');
            const m21 = missedShifts.some(m => m.day === 21 && m.violationType === 'Missed Shift');
            const m22 = missedShifts.some(m => m.day === 22 && m.violationType === 'Missed Shift');
            const m23 = missedShifts.some(m => m.day === 23 && m.violationType === 'Missed Shift');
            const missedThreeDaysInARow = (m19 && m20 && m21) || (m20 && m21 && m22) || (m21 && m22 && m23);

            let phone = '', email = '', companies = [], cities = [], contractType = '';
            const normalizedDriverName = normalizeName(name);
            let matchedInfo = null;
            if (pn && excelMapByPn.has(pn)) matchedInfo = excelMapByPn.get(pn);
            else if (normalizedDriverName && excelMapByName.has(normalizedDriverName)) matchedInfo = excelMapByName.get(normalizedDriverName);

            if (matchedInfo) {
                phone = matchedInfo.phone;
                email = matchedInfo.email;
                if (matchedInfo.company) companies.push(matchedInfo.company);
                if (matchedInfo.city) cities.push(matchedInfo.city);
                if (matchedInfo.contractType) contractType = matchedInfo.contractType;
            }

            allDriversResult.push({
                name, pn, phone, email, companies, cities, contractType, status, hasConcediu,
                projects: ['Timeline Report'],
                missedShifts: missedShifts.map(m => m.detail),
                missedShiftsRaw: missedShifts,
                missedThreeDaysInARow,
                timelineShifts: shifts,
                timelineActivities: activities,
                disponibilitate: disponibilitate,
                forecast: forecast
            });
        });

        console.log(`Successfully generated timeline profiles for ${allDriversResult.length} drivers.`);

        let csvContent = 'Driver Name,Phone,Email,Driver ID (PN),Companies,Cities,Status,Source Projects,Missed Shifts Count,Missed 3 Days In A Row,Missed Shifts Details\n';
        allDriversResult.forEach(d => {
            const nameEscaped = `"${(d.name || '').replace(/"/g, '""')}"`;
            const phone = `"${(d.phone || '').replace(/"/g, '""')}"`;
            const email = `"${(d.email || '').replace(/"/g, '""')}"`;
            const pn = `"${(d.pn || '').replace(/"/g, '""')}"`;
            const companies = `"${(d.companies || []).join(', ').replace(/"/g, '""')}"`;
            const cities = `"${(d.cities || []).join(', ').replace(/"/g, '""')}"`;
            const status = d.missedThreeDaysInARow ? 'Fireable' : d.status;
            const projects = `"${(d.projects || []).join(', ').replace(/"/g, '""')}"`;
            const missedCount = d.missedShifts.length;
            const threeDays = d.missedThreeDaysInARow ? 'YES' : 'NO';
            const shiftsEscaped = `"${d.missedShifts.join(' | ').replace(/"/g, '""')}"`;
            csvContent += `${nameEscaped},${phone},${email},${pn},${companies},${cities},${status},${projects},${missedCount},${threeDays},${shiftsEscaped}\n`;
        });

        fs.writeFileSync(path.join(__dirname, 'absent_drivers_last_3_days.csv'), csvContent, 'utf8');
        fs.writeFileSync(path.join(__dirname, 'absent_drivers_last_3_days.json'), JSON.stringify(allDriversResult, null, 2), 'utf8');
        fs.writeFileSync(path.join(__dirname, 'absent_drivers_data.js'), `window.ABSENT_DRIVERS_DATA = ${JSON.stringify(allDriversResult, null, 2)};\n`, 'utf8');

        console.log("Success! Timeline parsing complete.");
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
