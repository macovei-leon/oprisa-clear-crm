const fs = require('fs');

function normalizeName(name) {
    if (!name) return '';
    return name.replace(/^[-\u2013\u2014\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const LEAVE_NAMES = {
    '#6366f1': 'Concediu medical copil',
    '#78716c': 'Somaj tehnic',
    '#1e3a8a': 'Concediu medical',
    '#3b82f6': 'Concediu de odihna',
    '#a855f7': 'Concediu parental',
    '#bfdbfe': 'Concediu fara plata'
};

const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

async function processTimelineData(jsonFilePath, supabaseData) {
    const excelMapByPn = new Map();
    const excelMapByName = new Map();
    
    // Map data from Supabase
    supabaseData.forEach(row => {
        const pn = row['PN'] ? String(row['PN']).trim() : (row['pn'] ? String(row['pn']).trim() : '');
        const rawName = row['Nume'] ? String(row['Nume']).trim() : (row['nume'] ? String(row['nume']).trim() : '');
        const normalizedName = normalizeName(rawName);
        const info = {
            email: row['Email'] ? String(row['Email']).trim() : (row['email'] ? String(row['email']).trim() : ''),
            phone: row['Telefon'] ? String(row['Telefon']).trim() : (row['telefon'] ? String(row['telefon']).trim() : ''),
            company: row['Companie'] ? String(row['Companie']).trim() : (row['companie'] ? String(row['companie']).trim() : ''),
            city: row['Orase'] ? String(row['Orase']).trim() : (row['orase'] ? String(row['orase']).trim() : ''),
            contractType: row['Tip Contract'] ? String(row['Tip Contract']).trim() : (row['tip_contract'] ? String(row['tip_contract']).trim() : '')
        };
        if (pn) excelMapByPn.set(pn, info);
        if (normalizedName) excelMapByName.set(normalizedName, info);
    });

    console.log("Loading JSON data file...");
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    if (Array.isArray(jsonData) || jsonData.settings) {
        console.log("Detected already-processed format. Re-mapping driver fields from Supabase...");
        let driverArray = Array.isArray(jsonData) ? jsonData : (jsonData.drivers || []);
        let settings = Array.isArray(jsonData) ? null : jsonData.settings;
        
        driverArray.forEach(driver => {
            const pn = String(driver.pn || '');
            const normalizedDriverName = normalizeName(driver.name || '');
            let matchedInfo = null;
            if (pn && excelMapByPn.has(pn)) matchedInfo = excelMapByPn.get(pn);
            else if (normalizedDriverName && excelMapByName.has(normalizedDriverName)) matchedInfo = excelMapByName.get(normalizedDriverName);
            
            if (matchedInfo) {
                if (matchedInfo.phone) driver.phone = matchedInfo.phone;
                if (matchedInfo.email) driver.email = matchedInfo.email;
                if (matchedInfo.company) driver.companies = [matchedInfo.company];
                if (matchedInfo.city) driver.cities = [matchedInfo.city];
                if (matchedInfo.contractType) driver.contractType = matchedInfo.contractType;
            }
        });
        return { settings, drivers: driverArray };
    }

    const soferi = jsonData.data ? jsonData.data.soferi : [];
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    const processTimeStr = (tStr) => {
        if (!tStr) return;
        let str = tStr;
        if (!str.includes('+') && !str.includes('Z')) str += '+02:00';
        const t = new Date(str).getTime();
        if (!isNaN(t)) {
            if (t < minTime) minTime = t;
            if (t > maxTime) maxTime = t;
        }
    };
    
    soferi.forEach(sofer => {
        if (sofer.timeline) sofer.timeline.forEach(t => { processTimeStr(t.dataOraStart); processTimeStr(t.dataOraEnd); });
    });
    
    if (minTime === Infinity) {
        minTime = new Date('2026-06-19T00:00:00+02:00').getTime();
        maxTime = minTime + 5 * 24 * 3600000;
    }

    const getBerlinDateParts = (dateObj) => {
        const str = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateObj); // YYYY-MM-DD
        const parts = str.split('-');
        return { yyyy: parts[0], mm: parts[1], dd: parts[2] };
    };

    const bParts = getBerlinDateParts(new Date(minTime));
    const baseDateStr = `${bParts.yyyy}-${bParts.mm}-${bParts.dd}T00:00:00+02:00`;
    const BASE_DATE = new Date(baseDateStr);

    let endMaxDateObj = new Date(maxTime);
    const eParts = getBerlinDateParts(endMaxDateObj);
    let END_DATE = new Date(`${eParts.yyyy}-${eParts.mm}-${eParts.dd}T00:00:00+02:00`);
    if (END_DATE.getTime() <= maxTime) {
        END_DATE = new Date(END_DATE.getTime() + 24 * 3600000); // add one full day to envelope everything
    }
    
    let totalDays = Math.max(1, Math.round((END_DATE.getTime() - BASE_DATE.getTime()) / (24 * 3600000)));

    const getHoursSinceBase = (dateStr) => {
        let dStr = dateStr;
        if (!dStr.includes('+') && !dStr.includes('Z')) dStr += '+02:00';
        const d = new Date(dStr);
        return (d.getTime() - BASE_DATE.getTime()) / 3600000;
    };

    const formatHourToDateTime = (t) => {
        const timeInMs = t * 60 * 60 * 1000;
        const d = new Date(BASE_DATE.getTime() + timeInMs);
        const parts = getBerlinDateParts(d);
        const timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
        return `${parts.dd}.${parts.mm}.${parts.yyyy} ${timeStr}`;
    };

    const dataStartStr = `${bParts.yyyy}-${bParts.mm}-${bParts.dd}`;
    const dataEndStr = `${eParts.yyyy}-${eParts.mm}-${eParts.dd}`;

    console.log(`Fetching Ture Programate from API... (${dataStartStr} to ${dataEndStr}) | totalDays: ${totalDays}`);
    
    let scheduledShiftsMap = new Map();
    try {
        const apiRes = await fetch('https://oprisa.fluxer.io/rest/Oprisa/getTureProgramateRest', {
            method: 'POST',
            headers: { 'X-API-KEY': '2f4f26ea80e689ae2b54138ac45f859cf360871236636819e832fb91938e13ff', 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataStart: dataStartStr, dataEnd: dataEndStr })
        });
        const apiData = await apiRes.json();
        if (apiData.success && apiData.data) {
            apiData.data.forEach(d => {
                const angajatId = String(d.driver_id).trim();
                const s = d.schedules || [];
                scheduledShiftsMap.set(angajatId, s);
            });
        }
    } catch (e) {
        console.error("Failed to fetch scheduled shifts", e);
    }
    
    const dayMappingList = [];
    const timelineDaysMeta = [];
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(BASE_DATE.getTime() + i * 24 * 3600000);
        const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'long' }).format(d).toLowerCase();
        const monthDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', month: 'short', day: 'numeric' }).format(d);
        dayMappingList.push({
            offset: i * 24,
            dayName: weekday,
            dayIndex: i
        });
        timelineDaysMeta.push({
            label: monthDay,
            start: i * 24,
            end: (i + 1) * 24
        });
    }

    const settings = {
        baseDateStr: baseDateStr,
        totalDays: totalDays,
        days: timelineDaysMeta
    };

    const allDriversResult = [];

    soferi.forEach(sofer => {
        const name = sofer.nume;
        const pn = String(sofer.pn || '');
        const angajatId = String(sofer.id || '');
        
        const shifts = [];
        const activities = [];
        const scheduledShifts = [];
        const leaveSegments = [];
        const disponibilitate = [];
        const forecast = [];
        
        if (angajatId && scheduledShiftsMap.has(angajatId)) {
            const apiSchedules = scheduledShiftsMap.get(angajatId);
            let currentMapIdx = 0;
            let prevDayName = null;
            
            apiSchedules.forEach(s => {
                const sDay = s.day.toLowerCase();
                if (sDay !== prevDayName && prevDayName !== null) {
                    currentMapIdx++;
                    while (currentMapIdx < dayMappingList.length && dayMappingList[currentMapIdx].dayName !== sDay) {
                        currentMapIdx++;
                    }
                } else if (prevDayName === null) {
                    while (currentMapIdx < dayMappingList.length && dayMappingList[currentMapIdx].dayName !== sDay) {
                        currentMapIdx++;
                    }
                }
                prevDayName = sDay;
                
                if (currentMapIdx < dayMappingList.length) {
                    const dayOffset = dayMappingList[currentMapIdx].offset;
                    const [startH, startM] = s.start.split(':').map(Number);
                    const [endH, endM] = s.end.split(':').map(Number);
                    let start = dayOffset + startH + startM / 60;
                    let end = dayOffset + endH + endM / 60;
                    if (end < start) end += 24; 
                    shifts.push({ type: 'HR App Shift', start: formatHourToDateTime(start), end: formatHourToDateTime(end), startHour: start, endHour: end });
                    scheduledShifts.push({ start, end, type: 'HR App Shift', dayIndex: dayMappingList[currentMapIdx].dayIndex });
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
            const day = s.dayIndex;

            let hasLeaveOnSameDay = false;
            const dayStartOffset = day * 24;
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

        let missedConsecutiveStr = 0;
        let maxConsecutiveStr = 0;
        for (let i = 0; i < totalDays; i++) {
            if (missedShifts.some(m => m.day === i && m.violationType === 'Missed Shift')) {
                missedConsecutiveStr++;
                if (missedConsecutiveStr > maxConsecutiveStr) maxConsecutiveStr = missedConsecutiveStr;
            } else {
                missedConsecutiveStr = 0;
            }
        }
        const missedThreeDaysInARow = maxConsecutiveStr >= 3;

        let phone = '';
        let email = '';
        let companies = [];
        let cities = [];
        let contractType = '';

        const normalizedDriverName = normalizeName(name);
        let matchedInfo = null;
        if (pn && excelMapByPn.has(pn)) matchedInfo = excelMapByPn.get(pn);
        else if (normalizedDriverName && excelMapByName.has(normalizedDriverName)) matchedInfo = excelMapByName.get(normalizedDriverName);

        if (matchedInfo) {
            phone = matchedInfo.phone;
            email = matchedInfo.email;
            if (matchedInfo.company) companies = [matchedInfo.company];
            if (matchedInfo.city) cities = [matchedInfo.city];
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
            forecast: forecast,
            foundInDB: !!matchedInfo
        });
    });

    return { settings, drivers: allDriversResult };
}

module.exports = {
    processTimelineData
};
