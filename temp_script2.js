const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
        const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';
        window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

        let allDrivers = [];
        let dailyStatuses = {}; // pn -> status
        let displayLimit = 100;
        let sortByShifts = false;
        let activeDriverPn = null;
        let currentUserRole = null;
        let currentTab = 'To Call';

        document.addEventListener('DOMContentLoaded', async () => {
            try {
                // In iframe, auth is handled by the parent React app.
                // We'll just assume admin for the dashboard logic if needed.
                currentUserRole = 'admin';
                

                // Fetch today's statuses from Supabase
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const { data: rows, error: statusError } = await window.supabase
                    .from('driver_daily_actions')
                    .select('driver_pn, status')
                    .gte('created_at', today.toISOString())
                    .order('created_at', { ascending: false });

                if (!statusError && rows) {
                    rows.forEach(row => {
                        if (!dailyStatuses[row.driver_pn]) {
                            dailyStatuses[row.driver_pn] = row.status;
                        }
                    });
                }

                // Load assigned data from Supabase
                const { data, error } = await window.supabase
                    .from('driver_dashboard_data')
                    .select('data')
                    .eq('id', 'default')
                    .single();

                if (error) throw error;
                
                allDrivers = data.data;
                initDashboard();
            } catch (err) {
                console.error("Failed to load driver data:", err);
                document.getElementById('drivers-grid').innerHTML = `
                    <div class="no-results">
                        <i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-coral)"></i>
                        <h3>Data Loading Error</h3>
                        <p>Could not load the driver timeline database. Please verify your connection.</p>
                    </div>
                `;
            }
        });

        function initDashboard() {
            populateFilterOptions();
            renderStats();
            renderCards(getActiveDriversState());
            setupEventListeners();
        }

        function populateFilterOptions() {
            const companies = new Set();
            const cities = new Set();
            const projects = new Set();
            const contractTypes = new Set();
            
            allDrivers.forEach(d => {
                if (d.companies) d.companies.forEach(c => { if (c) companies.add(c.trim()); });
                if (d.cities) d.cities.forEach(c => { if (c) cities.add(c.trim()); });
                if (d.projects) d.projects.forEach(p => { if (p) projects.add(p.trim()); });
                if (d.contractType) contractTypes.add(d.contractType.trim());
            });

            const companySelect = document.getElementById('filter-company');
            Array.from(companies).sort().forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                companySelect.appendChild(opt);
            });

            const citySelect = document.getElementById('filter-city');
            Array.from(cities).sort().forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                citySelect.appendChild(opt);
            });

            const projectSelect = document.getElementById('filter-project');
            Array.from(projects).sort().forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                projectSelect.appendChild(opt);
            });

            const contractContainer = document.getElementById('filter-contract-type');
            Array.from(contractTypes).sort().forEach(c => {
                if (!c) return;
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '0.5rem';
                label.style.fontSize = '0.85rem';
                label.style.cursor = 'pointer';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = c;
                cb.className = 'contract-type-cb';
                cb.addEventListener('change', () => {
                    displayLimit = 100;
                    renderCards(getActiveDriversState());
                });
                label.appendChild(cb);
                label.appendChild(document.createTextNode(c));
                contractContainer.appendChild(label);
            });
        }

        function renderStats() {
            const total = allDrivers.length;
            const ok = allDrivers.filter(d => d.status === 'OK').length;
            const late = allDrivers.filter(d => d.status === 'Started Late').length;
            const gaps = allDrivers.filter(d => d.status === 'Left Early / Big Gaps').length;
            const noActivate = allDrivers.filter(d => d.status === 'No Shifts').length;
            const absentCount = allDrivers.filter(d => d.status === 'Absent').length;
            const concediuCount = allDrivers.filter(d => d.status === 'Concediu').length;
            const fireable = allDrivers.filter(d => d.missedThreeDaysInARow).length;

            document.getElementById('stat-total-drivers').textContent = total;
            document.getElementById('stat-total-ok').textContent = ok;
            document.getElementById('stat-total-late').textContent = late;
            document.getElementById('stat-total-gaps').textContent = gaps;
            document.getElementById('stat-total-no-shifts').textContent = noActivate;
            document.getElementById('stat-total-absent').textContent = absentCount;
            document.getElementById('stat-total-concediu').textContent = concediuCount;
            document.getElementById('stat-total-fireable').textContent = fireable;
        }

        function generateVisualTimeline(d, isModal = false) {
            const days = [
                { label: 'Jun 19', start: 0, end: 24 },
                { label: 'Jun 20', start: 24, end: 48 },
                { label: 'Jun 21', start: 48, end: 72 },
                { label: 'Jun 22', start: 72, end: 96 },
                { label: 'Jun 23', start: 96, end: 120 }
            ];

            const hasShifts = d.timelineShifts && d.timelineShifts.some(s => s.type === 'HR App Shift');
            const hasActivities = d.timelineActivities && d.timelineActivities.some(act => act.type !== 'Inactive');
            const hasMissed = d.missedShiftsRaw && d.missedShiftsRaw.length > 0;

            if (!hasShifts && !hasActivities && !hasMissed) {
                if (isModal) {
                    return `
                        <div class="card-timeline-container" style="justify-content:center; align-items:center; min-height:120px; background:rgba(255, 255, 255, 0.02); border-radius:12px; border:1px dashed var(--border-color); padding:2rem; margin-top:0.75rem; width:100%;">
                            <div style="text-align:center; color:var(--text-secondary); font-size:0.95rem;">
                                <i class="fa-solid fa-calendar-minus" style="font-size:2rem; margin-bottom:0.75rem; color:var(--text-muted); display:block;"></i>
                                No scheduled shifts, worked activities, or leave logs were recorded for this driver during the 5-day window (June 19 - June 23, 2026).
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="card-timeline-container" style="justify-content:center; align-items:center; min-height:100px; background:rgba(255, 255, 255, 0.02); border-radius:10px; border:1px dashed var(--border-color); padding:1rem; margin-top:0.75rem;">
                            <div style="text-align:center; color:var(--text-muted); font-size:0.85rem;">
                                <i class="fa-solid fa-calendar-minus" style="font-size:1.5rem; margin-bottom:0.5rem; color:var(--text-muted); display:block;"></i>
                                No scheduled shifts or activities recorded for this period.
                            </div>
                        </div>
                    `;
                }
            }

            let html = '<div class="card-timeline-container" style="gap: ' + (isModal ? '0.75rem' : '0.4rem') + ';">';

            days.forEach(day => {
                const gridLines = `
                    <div style="position:absolute; left:25%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.06); z-index:2; pointer-events:none;"></div>
                    <div style="position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.06); z-index:2; pointer-events:none;"></div>
                    <div style="position:absolute; left:75%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.06); z-index:2; pointer-events:none;"></div>
                `;

                // 1. Top track: Scheduled Shifts (Blue)
                let schedSegmentsHtml = '';
                if (d.timelineShifts) {
                    d.timelineShifts.forEach(s => {
                        if (s.type === 'HR App Shift') {
                            const overlapStart = Math.max(s.startHour, day.start);
                            const overlapEnd = Math.min(s.endHour, day.end);
                            if (overlapEnd > overlapStart) {
                                const leftPct = ((overlapStart - day.start) / 24) * 100;
                                const widthPct = Math.max(((overlapEnd - overlapStart) / 24) * 100, 0.8);
                                const color = '#3b82f6';
                                
                                const durHours = overlapEnd - overlapStart;
                                const durationStr = durHours.toFixed(1) + " hrs";
                                const formattedTime = s.start.split(' ')[1] + " - " + s.end.split(' ')[1];
                                
                                schedSegmentsHtml += `
                                    <div class="timeline-bar-segment" 
                                         style="left:${leftPct}%; width:${widthPct}%; background:${color}; top:0; height:${isModal ? '10px' : '6px'}; border-radius:1px; cursor:pointer;" 
                                         data-category="Scheduled Shift"
                                         data-type="${s.type}"
                                         data-start="${s.start}"
                                         data-end="${s.end}"
                                         data-duration="${durationStr} (${formattedTime})"
                                         title="${s.type}: ${s.start} - ${s.end} (${durationStr})">
                                    </div>
                                `;
                            }
                        }
                    });
                }

                // 2. Bottom track: Actual Activities (Green, Red, Purple, Yellow, Muted Gray)
                let actSegmentsHtml = '';
                
                if (d.timelineActivities) {
                    d.timelineActivities.forEach(act => {
                        const overlapStart = Math.max(act.startHour, day.start);
                        const overlapEnd = Math.min(act.endHour, day.end);
                        if (overlapEnd > overlapStart) {
                            const leftPct = ((overlapStart - day.start) / 24) * 100;
                            const widthPct = Math.max(((overlapEnd - overlapStart) / 24) * 100, 0.8);
                            
                            const durHours = overlapEnd - overlapStart;
                            const durationStr = durHours >= 1 ? durHours.toFixed(1) + " hrs" : Math.round(durHours * 60) + " mins";
                            const formattedTime = act.start.split(' ')[1] + " - " + act.end.split(' ')[1];
                            
                            if (act.type === 'Active') {
                                actSegmentsHtml += `
                                    <div class="timeline-bar-segment" 
                                         style="left:${leftPct}%; width:${widthPct}%; background:#22c55e; bottom:0; height:${isModal ? '22px' : '12px'}; border-radius:2px; z-index: 2; cursor:pointer;" 
                                         data-category="Activity"
                                         data-type="Active (Worked)"
                                         data-start="${act.start}"
                                         data-end="${act.end}"
                                         data-duration="${durationStr} (${formattedTime})"
                                         title="Worked: ${act.start} - ${act.end} (${durationStr})">
                                    </div>
                                `;
                            } else if (act.type === 'Break') {
                                actSegmentsHtml += `
                                    <div class="timeline-bar-segment" 
                                         style="left:${leftPct}%; width:${widthPct}%; background:#fbbf24; bottom:0; height:${isModal ? '22px' : '12px'}; border-radius:2px; z-index: 2; cursor:pointer;" 
                                         data-category="Activity"
                                         data-type="Break"
                                         data-start="${act.start}"
                                         data-end="${act.end}"
                                         data-duration="${durationStr} (${formattedTime})"
                                         title="Break: ${act.start} - ${act.end} (${durationStr})">
                                    </div>
                                `;
                            } else if (act.type === 'Missing') {
                                actSegmentsHtml += `
                                    <div class="timeline-bar-segment" 
                                         style="left:${leftPct}%; width:${widthPct}%; background:#ef4444; bottom:0; height:${isModal ? '22px' : '12px'}; border-radius:2px; z-index: 2; cursor:pointer;" 
                                         data-category="Activity"
                                         data-type="Missing (Unexcused Absence)"
                                         data-start="${act.start}"
                                         data-end="${act.end}"
                                         data-duration="${durationStr} (${formattedTime})"
                                         title="Missing: ${act.start} - ${act.end} (${durationStr})">
                                    </div>
                                `;
                            } else if (act.type.startsWith('Leave')) {
                                actSegmentsHtml += `
                                    <div class="timeline-bar-segment" 
                                         style="left:${leftPct}%; width:${widthPct}%; background:${act.color || '#a855f7'}; bottom:0; height:${isModal ? '22px' : '12px'}; border-radius:2px; z-index: 2; cursor:pointer;" 
                                         data-category="Activity"
                                         data-type="${act.type}"
                                         data-start="${act.start}"
                                         data-end="${act.end}"
                                         data-duration="${durationStr} (${formattedTime})"
                                         title="${act.type}: ${act.start} - ${act.end} (${durationStr})">
                                    </div>
                                `;
                            } else if (act.type === 'Inactive') {
                                actSegmentsHtml += `
                                    <div class="timeline-bar-segment" 
                                         style="left:${leftPct}%; width:${widthPct}%; background:rgba(148, 163, 184, 0.15); bottom:0; height:${isModal ? '22px' : '12px'}; border-radius:2px; z-index: 2; cursor:pointer;" 
                                         data-category="Activity"
                                         data-type="Inactive (Off-Duty)"
                                         data-start="${act.start}"
                                         data-end="${act.end}"
                                         data-duration="${durationStr} (${formattedTime})"
                                         title="Off-Duty: ${act.start} - ${act.end} (${durationStr})">
                                    </div>
                                `;
                            }
                        }
                    });
                }

                // Draw missed shift segments (Red)
                if (d.missedShiftsRaw) {
                    d.missedShiftsRaw.forEach(m => {
                        const overlapStart = Math.max(m.startHour, day.start);
                        const overlapEnd = Math.min(m.endHour, day.end);
                        if (overlapEnd > overlapStart) {
                            const leftPct = ((overlapStart - day.start) / 24) * 100;
                            const widthPct = Math.max(((overlapEnd - overlapStart) / 24) * 100, 0.8);
                            
                            const durHours = overlapEnd - overlapStart;
                            const durationStr = durHours >= 1 ? durHours.toFixed(1) + " hrs" : Math.round(durHours * 60) + " mins";
                            const formattedTime = m.start.split(' ')[1] + " - " + m.end.split(' ')[1];
                            
                            actSegmentsHtml += `
                                <div class="timeline-bar-segment" 
                                     style="left:${leftPct}%; width:${widthPct}%; background:#ef4444; bottom:0; height:${isModal ? '22px' : '12px'}; border-radius:2px; z-index: 1; cursor:pointer;" 
                                     data-category="Missed Shift"
                                     data-type="Missed Shift Violation"
                                     data-start="${m.start}"
                                     data-end="${m.end}"
                                     data-duration="${durationStr} (${formattedTime})"
                                     title="MISSED SHIFT: ${m.start} - ${m.end} (${durationStr})">
                                </div>
                            `;
                        }
                    });
                }

                html += `
                    <div class="day-timeline-row">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="day-timeline-label" style="width: ${isModal ? '70px' : '50px'}; font-size: ${isModal ? '0.9rem' : '0.75rem'};">${day.label}</span>
                            <div style="flex:1; display:flex; flex-direction:column; gap:0.15rem;">
                                <div class="day-timeline-track" style="height: ${isModal ? '32px' : '18px'};">
                                    ${gridLines}
                                    <div class="sub-track-scheduled" style="height: ${isModal ? '10px' : '6px'}; border-bottom-width: ${isModal ? '2px' : '1px'};">
                                        ${schedSegmentsHtml}
                                    </div>
                                    <div class="sub-track-activity" style="height: ${isModal ? '22px' : '12px'};">
                                        ${actSegmentsHtml}
                                    </div>
                                </div>
                                <div class="day-timeline-time-labels" style="height: ${isModal ? '16px' : '12px'}; font-size: ${isModal ? '0.7rem' : '0.6rem'};">
                                    <span style="left:0%;">00</span>
                                    <span style="left:25%; transform:translateX(-50%);">06</span>
                                    <span style="left:50%; transform:translateX(-50%);">12</span>
                                    <span style="left:75%; transform:translateX(-50%);">18</span>
                                    <span style="right:0%; transform:translateX(50%);">24</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            return html;
        }

        function closeDriverModal() {
            document.getElementById('modal-overlay').style.display = 'none';
        }

        function openDriverModal(index) {
            const d = allDrivers[index];
            if (!d) return;

            activeDriverPn = d.pn;
            
            document.getElementById('modal-driver-name').textContent = d.name || 'Unknown Driver';
            document.getElementById('modal-driver-pn').textContent = d.pn || '-';
            document.getElementById('modal-driver-phone').innerHTML = d.phone ? `<a href="tel:${d.phone}">${d.phone}</a>` : '-';
            document.getElementById('modal-driver-email').textContent = d.email || '-';
            document.getElementById('modal-driver-status').textContent = d.status || '-';
            document.getElementById('modal-driver-company').textContent = (d.companies || []).join(', ') || '-';
            document.getElementById('modal-driver-cities').textContent = (d.cities || []).join(', ') || '-';
            document.getElementById('modal-driver-contract').textContent = d.contractType || '-';

            // Visual Timeline
            document.getElementById('modal-visual-timeline-container').innerHTML = generateVisualTimeline(d, true);

            // Lists
            function renderList(containerId, list, typeClass) {
                const container = document.getElementById(containerId);
                if (!list || list.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:0.9rem;">None recorded</div>';
                    return;
                }
                container.innerHTML = list.map(item => `
                    <div class="shift-item">
                        <span class="shift-type ${typeClass}">${item.type || 'Log'}</span>
                        <span class="shift-time">${item.start} - ${item.end}</span>
                    </div>
                `).join('');
            }
            
            function renderMissedList(containerId, list) {
                const container = document.getElementById(containerId);
                if (!list || list.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:0.9rem;">No violations</div>';
                    return;
                }
                container.innerHTML = list.map(item => `
                    <div class="shift-item" style="border-left-color: var(--accent-coral); background: rgba(239, 68, 68, 0.05);">
                        <span class="shift-type" style="background:var(--accent-coral); color:white;">Violation</span>
                        <span class="shift-time" style="color:var(--text-primary);">${item}</span>
                    </div>
                `).join('');
            }

            renderList('modal-timeline-shifts', d.timelineShifts, '');
            renderList('modal-timeline-activities', d.timelineActivities, '');
            
            // Render disponibilitate if exists
            const dispoList = (d.timelineAvailability && d.timelineAvailability.length > 0) ? d.timelineAvailability : [];
            const forecastList = (d.timelineForecast && d.timelineForecast.length > 0) ? d.timelineForecast : [];
            
            if (dispoList.length === 0) {
                document.getElementById('modal-timeline-disponibilitate').innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:0.9rem;">None recorded</div>';
            } else {
                document.getElementById('modal-timeline-disponibilitate').innerHTML = dispoList.map(item => `
                    <div class="shift-item">
                        <span class="shift-type" style="background:#2dd4bf; color:white;">${item.type}</span>
                        <span class="shift-time">${item.start} - ${item.end}</span>
                    </div>
                `).join('');
            }

            if (forecastList.length === 0) {
                document.getElementById('modal-timeline-forecast').innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:0.9rem;">None recorded</div>';
            } else {
                document.getElementById('modal-timeline-forecast').innerHTML = forecastList.map(item => `
                    <div class="shift-item">
                        <span class="shift-type" style="background:#8b5cf6; color:white;">${item.type}</span>
                        <span class="shift-time">${item.start} - ${item.end}</span>
                    </div>
                `).join('');
            }

            renderMissedList('modal-timeline-tasks', d.missedShifts);

            document.getElementById('modal-overlay').style.display = 'flex';
        }

        function renderCards(drivers) {
            
            const grid = document.getElementById('drivers-grid');
            grid.innerHTML = '';

            if (drivers.length === 0) {
                grid.innerHTML = `
                    <div class="no-results">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <h3>No Drivers Found</h3>
                        <p>No drivers match the selected search terms or filters.</p>
                    </div>
                `;
                return;
            }

            const visibleDrivers = drivers.slice(0, displayLimit);

            visibleDrivers.forEach((d, idx) => {
                const card = document.createElement('div');
                
                let cardStatusClass = 'active';
                let statusLabel = 'OK';
                let leftBorderColor = 'var(--accent-emerald)';
                let missedText = 'No Violations';
                
                if (d.missedThreeDaysInARow) {
                    cardStatusClass = 'fireable';
                    statusLabel = 'FIREABLE';
                    leftBorderColor = 'var(--accent-amber)';
                    missedText = `${d.missedShifts.length} Violation${d.missedShifts.length > 1 ? 's' : ''} (Missed 3 Days)`;
                } else if (d.status === 'No Shifts') {
                    cardStatusClass = 'absent';
                    statusLabel = 'NO SHIFTS';
                    leftBorderColor = 'var(--accent-coral)';
                    missedText = 'No Shifts / 0 Hours Worked';
                } else if (d.status === 'Absent') {
                    cardStatusClass = 'absent';
                    statusLabel = 'ABSENT';
                    leftBorderColor = '#dc2626';
                    missedText = 'Scheduled Shifts Missed (0 Hours Worked)';
                } else if (d.status === 'Left Early / Big Gaps') {
                    cardStatusClass = 'absent';
                    statusLabel = 'LEFT EARLY / GAPS';
                    leftBorderColor = 'var(--accent-coral)';
                    missedText = `${d.missedShifts.length} Shift Violation${d.missedShifts.length > 1 ? 's' : ''}`;
                } else if (d.status === 'Started Late') {
                    cardStatusClass = 'fireable';
                    statusLabel = 'STARTED LATE';
                    leftBorderColor = 'var(--accent-amber)';
                    missedText = `${d.missedShifts.length} Lateness Violation${d.missedShifts.length > 1 ? 's' : ''}`;
                } else if (d.status === 'Concediu') {
                    cardStatusClass = 'active'; // We can reuse active styling but change color below
                    statusLabel = 'CONCEDIU';
                    leftBorderColor = '#a855f7'; // Purple for leave
                    missedText = 'On Leave / Concediu';
                }

                card.className = 'driver-card';
                card.style.borderLeft = `4px solid ${leftBorderColor}`;
                card.style.cursor = 'pointer';
                
                // Add event listener to open driver modal when clicking the card itself
                card.addEventListener('click', (e) => {
                    // Prevent opening modal if clicking a button, link, or visual timeline segment
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.timeline-bar-segment')) {
                        return;
                    }
                    openDriverModal(allDrivers.indexOf(d));
                });
                
                const pnDisplay = d.pn ? `PN: ${d.pn}` : 'No ID';
                const sourceBadges = d.projects.map(p => `<span class="project-badge">${p}</span>`).join(' ');
                
                const timelineHTML = generateVisualTimeline(d, false);

                let statusPill = '';
                if (currentUserRole === 'worker') {
                    const todayStatus = dailyStatuses[d.pn] || 'To Call';
                    let pillColor = '#6b7280'; // To Call default
                    if (todayStatus === 'In Progress') pillColor = '#f59e0b';
                    if (todayStatus === 'Finished') pillColor = '#22c55e';
                    statusPill = `<span style="background:${pillColor}22; color:${pillColor}; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.75rem; border:1px solid ${pillColor}44; margin-left:0.5rem;">${todayStatus}</span>`;
                }

                card.innerHTML = `
                    <div>
                        <div class="driver-card-header">
                            <div>
                                <span class="driver-name">${d.name} ${statusPill} ${d.hasConcediu ? '<span style="background:rgba(168, 85, 247, 0.15); color:#a855f7; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.75rem; border:1px solid rgba(168, 85, 247, 0.3); margin-left:0.5rem;" title="Has logged Concediu"><i class="fa-solid fa-umbrella-beach"></i> Also Concediu</span>' : ''}</span>
                                <span class="driver-pn">${pnDisplay}</span>
                            </div>
                            <span class="status-badge ${cardStatusClass}">${statusLabel}</span>
                        </div>
                        <div class="project-badges">
                            ${sourceBadges}
                        </div>
                        
                        ${timelineHTML}

                        <div class="driver-details">
                            <div class="detail-item">
                                <i class="fa-solid fa-phone"></i>
                                <span>${d.phone ? `<a href="tel:${d.phone}">${d.phone}</a>` : '<span style="color:var(--text-muted)">No Phone</span>'}</span>
                            </div>
                            <div class="detail-item">
                                <i class="fa-solid fa-building"></i>
                                <span>${d.companies.join(', ') || '<span style="color:var(--text-muted)">No Company</span>'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer">
                        <div class="missed-count-badge" style="color: ${leftBorderColor}; background: ${leftBorderColor}14; border-color: ${leftBorderColor}26;">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>${missedText}</span>
                        </div>
                        <div style="display:flex; gap:0.4rem;">
                            <button class="btn-view" onclick="openDriverModal(${allDrivers.indexOf(d)})">
                                <i class="fa-solid fa-clock-rotate-left"></i> Timeline
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });

            if (drivers.length > displayLimit) {
                const loadBtnContainer = document.createElement('div');
                loadBtnContainer.style.gridColumn = '1 / -1';
                loadBtnContainer.style.display = 'flex';
                loadBtnContainer.style.justifyContent = 'center';
                loadBtnContainer.style.marginTop = '2rem';
                
                const loadBtn = document.createElement('button');
                loadBtn.className = 'sort-btn';
                loadBtn.style.padding = '0.8rem 2rem';
                loadBtn.style.fontWeight = '600';
                loadBtn.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Load More (${drivers.length - displayLimit} remaining)`;
                loadBtn.addEventListener('click', () => {
                    displayLimit += 100;
                    renderCards(drivers);
                });
                
                loadBtnContainer.appendChild(loadBtn);
                grid.appendChild(loadBtnContainer);
            }
        }

        function getActiveDriversState() {
            const searchInput = document.getElementById('search-input').value.toLowerCase().trim();
            const filterProject = document.getElementById('filter-project').value;
            const filterAttendance = document.getElementById('filter-attendance').value;
            const filterCompany = document.getElementById('filter-company').value;
            const filterCity = document.getElementById('filter-city').value;
            const checkedContracts = Array.from(document.querySelectorAll('.contract-type-cb:checked')).map(cb => cb.value);

            let filtered = allDrivers.filter(d => {
                const searchMatch = !searchInput || 
                    d.name.toLowerCase().includes(searchInput) || 
                    d.pn.toLowerCase().includes(searchInput);
                const projectMatch = filterProject === 'all' || d.projects.includes(filterProject);
                
                let attendanceMatch = true;
                if (filterAttendance !== 'all') {
                    if (filterAttendance === 'fireable') {
                        attendanceMatch = d.missedThreeDaysInARow === true;
                    } else {
                        attendanceMatch = d.status === filterAttendance;
                    }
                }
                
                const companyMatch = filterCompany === 'all' || d.companies.includes(filterCompany);
                const cityMatch = filterCity === 'all' || d.cities.includes(filterCity);

                // Filter by Tab (To Call, In Progress, Finished)
                const todayStatus = dailyStatuses[d.pn] || 'To Call';
                const tabMatch = todayStatus === currentTab;

                const contractMatch = checkedContracts.length === 0 || checkedContracts.includes(d.contractType);

                return searchMatch && projectMatch && attendanceMatch && companyMatch && cityMatch && tabMatch && contractMatch;
            });

            if (sortByShifts) {
                filtered.sort((a, b) => b.missedShifts.length - a.missedShifts.length);
            } else {
                filtered.sort((a, b) => a.name.localeCompare(b.name));
            }
            return filtered;
        }

        function showSegmentTooltip(segment, event) {
            const category = segment.getAttribute('data-category');
            const type = segment.getAttribute('data-type');
            const start = segment.getAttribute('data-start');
            const end = segment.getAttribute('data-end');
            const duration = segment.getAttribute('data-duration');

            const tooltip = document.getElementById('segment-tooltip');
            if (!tooltip) return;
            
            let icon = '<i class="fa-solid fa-clock"></i>';
            let themeColor = 'var(--primary)';
            if (category === 'Scheduled Shift') {
                icon = '<i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>';
                themeColor = '#60a5fa';
            } else if (category === 'Activity') {
                if (type.includes('Active')) {
                    icon = '<i class="fa-solid fa-person-running" style="color:var(--accent-emerald)"></i>';
                    themeColor = 'var(--accent-emerald)';
                } else if (type === 'Break') {
                    icon = '<i class="fa-solid fa-mug-hot" style="color:var(--accent-amber)"></i>';
                    themeColor = 'var(--accent-amber)';
                } else if (type.includes('Inactive')) {
                    icon = '<i class="fa-solid fa-moon" style="color:#94a3b8"></i>';
                    themeColor = '#94a3b8';
                } else {
                    icon = '<i class="fa-solid fa-plane-departure" style="color:#c084fc"></i>';
                    themeColor = '#c084fc';
                }
            } else if (category === 'Missed Shift') {
                icon = '<i class="fa-solid fa-circle-exclamation" style="color:var(--accent-coral)"></i>';
                themeColor = 'var(--accent-coral)';
            }

            tooltip.innerHTML = `
                <div class="segment-tooltip-header">
                    ${icon}
                    <span style="color:${themeColor}; font-weight:700;">${category}</span>
                    <button class="segment-tooltip-close" onclick="hideSegmentTooltip()">&times;</button>
                </div>
                <div class="segment-tooltip-row">
                    <span class="segment-tooltip-label">Type:</span>
                    <span class="segment-tooltip-value">${type}</span>
                </div>
                <div class="segment-tooltip-row">
                    <span class="segment-tooltip-label">Start:</span>
                    <span class="segment-tooltip-value">${start}</span>
                </div>
                <div class="segment-tooltip-row">
                    <span class="segment-tooltip-label">End:</span>
                    <span class="segment-tooltip-value">${end}</span>
                </div>
                <div class="segment-tooltip-row">
                    <span class="segment-tooltip-label">Duration:</span>
                    <span class="segment-tooltip-value">${duration}</span>
                </div>
            `;

            tooltip.style.display = 'block';
            
            const tooltipWidth = tooltip.offsetWidth || 280;
            const tooltipHeight = tooltip.offsetHeight || 160;
            
            let left = event.pageX + 10;
            let top = event.pageY + 10;
            
            if (left + tooltipWidth > window.innerWidth + window.pageXOffset) {
                left = event.pageX - tooltipWidth - 10;
            }
            if (top + tooltipHeight > window.innerHeight + window.pageYOffset) {
                top = event.pageY - tooltipHeight - 10;
            }
            
            if (left < 10) left = 10;
            if (top < 10) top = 10;

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }

        function hideSegmentTooltip() {
            const tooltip = document.getElementById('segment-tooltip');
            if (tooltip) tooltip.style.display = 'none';
        }

        function setupEventListeners() {
            const searchInput = document.getElementById('search-input');
            const filterProject = document.getElementById('filter-project');
            const filterAttendance = document.getElementById('filter-attendance');
            const filterCompany = document.getElementById('filter-company');
            const filterCity = document.getElementById('filter-city');
            const sortBtnShifts = document.getElementById('sort-btn-shifts');

            const performFilter = () => {
                displayLimit = 100;
                renderCards(getActiveDriversState());
            };

            searchInput.addEventListener('input', performFilter);
            filterProject.addEventListener('change', performFilter);
            filterAttendance.addEventListener('change', performFilter);
            filterCompany.addEventListener('change', performFilter);
            filterCity.addEventListener('change', performFilter);
            
            sortBtnShifts.addEventListener('click', () => {
                sortByShifts = !sortByShifts;
                if (sortByShifts) {
                    sortBtnShifts.classList.add('active');
                    sortBtnShifts.innerHTML = `<i class="fa-solid fa-arrow-down-9-1"></i> Sorted by Absences`;
                } else {
                    sortBtnShifts.classList.remove('active');
                    sortBtnShifts.innerHTML = `<i class="fa-solid fa-arrow-down-9-1"></i> Sort by Absences`;
                }
                performFilter();
            });

            // Collapsible Help Banner listeners
            const helpToggle = document.getElementById('btn-help-toggle');
            const helpClose = document.getElementById('btn-help-close');
            const helpBanner = document.getElementById('help-banner');

            helpToggle.addEventListener('click', () => {
                if (helpBanner.style.display === 'none') {
                    helpBanner.style.display = 'flex';
                    helpToggle.classList.add('active');
                } else {
                    helpBanner.style.display = 'none';
                    helpToggle.classList.remove('active');
                }
            });

            helpClose.addEventListener('click', () => {
                helpBanner.style.display = 'none';
                helpToggle.classList.remove('active');
            });

            // Close tooltip on clicking outside segment
            document.addEventListener('click', (e) => {
                const segment = e.target.closest('.timeline-bar-segment');
                if (segment) {
                    e.stopPropagation();
                    showSegmentTooltip(segment, e);
                } else {
                    hideSegmentTooltip();
                }
            });

            // Close modal events
            const closeBtn = document.getElementById('modal-close-btn');
            const overlay = document.getElementById('modal-overlay');
            if(closeBtn) closeBtn.addEventListener('click', closeDriverModal);
            if(overlay) overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeDriverModal();
            });
            
            // Ensure modal is hidden on load
            if(overlay) overlay.style.display = 'none';
        }

        function switchTab(tabName) {
            currentTab = tabName;
            
            // Update UI tabs
            const tabs = document.querySelectorAll('.driver-tab');
            tabs.forEach(tab => {
                if (tab.textContent.includes(tabName)) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
            
            // Re-render
            displayLimit = 100;
            renderCards(getActiveDriversState());
        }

        function updateTabCounts() {
            let toCall = 0;
            let inProg = 0;
            let finished = 0;
            
            // We want to count based on the current SEARCH filters, so we apply all filters EXCEPT the tab filter.
            // But to keep it simple, we just count based on allDrivers
            allDrivers.forEach(d => {
                const s = dailyStatuses[d.pn] || 'To Call';
                if (s === 'To Call') toCall++;
                else if (s === 'In Progress') inProg++;
                else if (s === 'Finished') finished++;
            });
            
            document.getElementById('count-tocall').textContent = toCall;
            document.getElementById('count-inprogress').textContent = inProg;
            document.getElementById('count-finished').textContent = finished;
        }

        function updateActionButtons(status) {
            const toCall = document.getElementById('btn-action-tocall');
            const inProg = document.getElementById('btn-action-inprogress');
            const finished = document.getElementById('btn-action-finished');

            // Reset
            toCall.style.background = '#374151'; toCall.style.color = 'white';
            inProg.style.background = '#374151'; inProg.style.color = 'white';
            finished.style.background = '#374151'; finished.style.color = 'white';

            if (status === 'To Call') {
                toCall.style.background = 'var(--primary)';
            } else if (status === 'In Progress') {
                inProg.style.background = '#f59e0b';
            } else if (status === 'Finished') {
                finished.style.background = '#22c55e';
            }
        }

        function downloadFilteredExcel() {
            const drivers = getActiveDriversState();
            const data = drivers.map(d => ({
                'Driver Name': d.name || '',
                'Phone': d.phone || '',
                'Email': d.email || '',
                'Driver ID (PN)': d.pn || '',
                'Contract Type': d.contractType || '',
                'Companies': (d.companies || []).join(', '),
                'Cities': (d.cities || []).join(', '),
                'Status': d.status || '',
                'Source Projects': (d.projects || []).join(', '),
                'Missed Shifts Count': d.missedShifts.length,
                'Missed 3 Days In A Row': d.missedThreeDaysInARow ? 'YES' : 'NO',
                'Scheduled Shifts': d.timelineShifts ? d.timelineShifts.map(s => `[${s.type}] ${s.start} - ${s.end}`).join(' | ') : '',
                'Worked Activity & Leaves': d.timelineActivities ? d.timelineActivities.filter(a => a.type !== 'Inactive').map(a => `[${a.type}] ${a.start} - ${a.end}`).join(' | ') : '',
                'Missed Shifts Details': d.missedShifts.join(' | ')
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Filtered Drivers");
            XLSX.writeFile(wb, "filtered_drivers.xlsx");
        }
    
