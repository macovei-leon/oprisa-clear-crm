
    }
};
// ==========================================
// API DEVELOPER WORKSPACE (NEW LIGHT UI) LOGIC
// ==========================================

let apiLiveStatuses = [];
let apiLiveSchedules = [];
let apiLiveLinks = [];
let apiLiveState = { drivers: [] };
let apiFilteredDriversList = [];
let apiSelectedDriverId = null;
let apiActivePostmanRawJson = null;

window.switchApiTab = function(tabId, btnElement) {
    document.querySelectorAll('.api-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.api-tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).style.display = 'block';
    btnElement.classList.add('active');
};

window.updatePostmanUrl = function() {
    const endpoint = document.getElementById('postman-endpoint-select').value;
    const urlBar = document.getElementById('postman-url-bar');
    if (endpoint === 'status') urlBar.innerText = "GET " + document.getElementById('cfg-status-url').innerText;
    else if (endpoint === 'schedules') urlBar.innerText = "POST " + document.getElementById('cfg-schedule-url').innerText;
    else if (endpoint === 'links') urlBar.innerText = "GET " + document.getElementById('cfg-links-url').innerText;
    else if (endpoint === 'state') urlBar.innerText = "GET /api/state (Aggregated Worker Cache)";
};

window.fetchApiDirectories = async function() {
    try {
        const host = window.location.hostname;
        const protocol = window.location.protocol;
        
        const statusRes = await fetch(`${protocol}//${host}:3050/api/proxy/status`);
        const statusData = await statusRes.json();
        apiLiveStatuses = statusData.data || statusData || [];

        const schedRes = await fetch(`${protocol}//${host}:3050/api/proxy/schedules`);
        const schedData = await schedRes.json();
        apiLiveSchedules = schedData.data || schedData || [];

        const linkRes = await fetch(`${protocol}//${host}:3050/api/proxy/links`);
        const linkData = await linkRes.json();
        apiLiveLinks = linkData.data || linkData || [];

        const stateRes = await fetch(`${protocol}//${host}:3050/api/state`);
        const stateData = await stateRes.json();
        apiLiveState = stateData || { drivers: [] };

        window.renderApiDriverList();
    } catch (err) {
        console.error("API Workspace Fetch Error:", err);
    }
};

window.renderApiDriverList = function() {
    const searchInput = document.getElementById('api-search-input');
    if (!searchInput) return;
    const query = searchInput.value.toLowerCase().trim();
    const listing = document.getElementById('api-driver-listing');
    listing.innerHTML = '';

    const driverMap = new Map();

    apiLiveStatuses.forEach(d => {
        const id = d.driver_id || d.id;
        if (id) {
            driverMap.set(Number(id), {
                id: Number(id),
                name: d.name || `Driver #${id}`,
                status: d.status || 'offline',
                phone: d.phone || '',
                email: d.email || ''
            });
        }
    });

    if (apiLiveState.drivers && Array.isArray(apiLiveState.drivers)) {
        apiLiveState.drivers.forEach(d => {
            const id = d.id || d.driver_id;
            if (id && !driverMap.has(id)) {
                driverMap.set(id, {
                    id: id,
                    name: d.name || `Driver #${id}`,
                    status: d.status || 'offline',
                    phone: d.phone || '',
                    email: d.email || ''
                });
            }
        });
    }

    const allDrivers = Array.from(driverMap.values());
    
    apiFilteredDriversList = allDrivers.filter(d => {
        return String(d.id).includes(query) || d.name.toLowerCase().includes(query) || d.phone.toLowerCase().includes(query) || d.email.toLowerCase().includes(query);
    });

    document.getElementById('api-directory-count').innerText = `${apiFilteredDriversList.length} of ${allDrivers.length} matched`;

    apiFilteredDriversList.forEach(driver => {
        const activeClass = apiSelectedDriverId === driver.id ? 'active' : '';
        let badgeClass = 'api-badge-offline';
        if (driver.status === 'online') badgeClass = 'api-badge-online';
        if (driver.status === 'on_trip') badgeClass = 'api-badge-trip';
        
        const card = document.createElement('div');
        card.className = `api-driver-card ${activeClass}`;
        card.onclick = () => window.selectApiDriver(driver.id);
        card.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:2px;">
                <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">${driver.name}</span>
                <span style="font-size:0.7rem; color:#00adb5; font-family:monospace;">ID: #${driver.id}</span>
            </div>
            <span class="${badgeClass}">${driver.status.replace('_', ' ')}</span>
        `;
        listing.appendChild(card);
    });
};

window.selectApiDriver = function(driverId) {
    apiSelectedDriverId = driverId;
    window.renderApiDriverList();

    const rawStatus = apiLiveStatuses.find(d => (d.driver_id || d.id) == driverId) || null;
    const rawSchedule = apiLiveSchedules.find(d => d.driver_id == driverId) || null;
    
    let rawLink = null;
    if (Array.isArray(apiLiveLinks)) rawLink = apiLiveLinks.find(d => d.driver_id == driverId) || null;
    else if (apiLiveLinks && Array.isArray(apiLiveLinks.data)) rawLink = apiLiveLinks.data.find(d => d.driver_id == driverId) || null;
    
    const stateDriver = (apiLiveState.drivers || []).find(d => (d.id || d.driver_id) == driverId) || null;

    window.renderComparatorColumn('json-pane-status', rawStatus);
    window.renderComparatorColumn('json-pane-schedule', rawSchedule);
    window.renderComparatorColumn('json-pane-links', rawLink);
    window.renderComparatorColumn('json-pane-state', stateDriver);
};

window.renderComparatorColumn = function(paneId, data) {
    const pane = document.getElementById(paneId);
    if (!data) {
        pane.innerHTML = `<div style="color:var(--color-danger); border:1px dashed rgba(255,75,75,0.2); border-radius:6px; padding:1.5rem; text-align:center; margin-top:2rem;">No record returned for Driver #${apiSelectedDriverId}.</div>`;
        return;
    }
    window.renderApiJsonTree(data, pane);
};

window.renderApiJsonTree = function(data, container) {
    container.innerHTML = '';
    const tree = window.createApiNode(data, true);
    container.appendChild(tree);
};

window.createApiNode = function(val, isRoot = false) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'json-node';

    if (val === null) {
        nodeEl.innerHTML = `<span class="json-null">null</span>`;
        return nodeEl;
    }

    const type = typeof val;

    if (type === 'string') {
        nodeEl.innerHTML = `<span class="json-string">"${window.escapeApiHtml(val)}"</span>`;
    } else if (type === 'number') {
        nodeEl.innerHTML = `<span class="json-number">${val}</span>`;
    } else if (type === 'boolean') {
        nodeEl.innerHTML = `<span class="json-boolean">${val}</span>`;
    } else if (Array.isArray(val)) {
        if (val.length === 0) {
            nodeEl.innerHTML = '<span class="json-bracket">[]</span>';
        } else {
            const wrapper = document.createElement('div');
            const header = document.createElement('span');
            header.className = 'json-toggle expanded';
            header.innerHTML = `<span class="json-bracket">[</span><span class="json-summary">${val.length} items</span>`;
            
            const body = document.createElement('div');
            body.className = 'json-collapsible-body';
            
            val.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'json-row';
                row.appendChild(window.createApiNode(item));
                if (index < val.length - 1) {
                    const comma = document.createElement('span');
                    comma.className = 'json-comma';
                    comma.innerText = ',';
                    row.appendChild(comma);
                }
                body.appendChild(row);
            });

            const footer = document.createElement('span');
            footer.className = 'json-bracket';
            footer.innerText = ']';
            
            header.onclick = (e) => {
                e.stopPropagation();
                body.classList.toggle('collapsed');
                header.classList.toggle('expanded');
            };

            wrapper.appendChild(header);
            wrapper.appendChild(body);
            wrapper.appendChild(footer);
            nodeEl.appendChild(wrapper);
        }
    } else if (type === 'object') {
        const keys = Object.keys(val);
        if (keys.length === 0) {
            nodeEl.innerHTML = '<span class="json-bracket">{}</span>';
        } else {
            const wrapper = document.createElement('div');
            const header = document.createElement('span');
            header.className = 'json-toggle expanded';
            header.innerHTML = `<span class="json-bracket">{</span><span class="json-summary">${keys.length} keys</span>`;
            
            const body = document.createElement('div');
            body.className = 'json-collapsible-body';
            
            keys.forEach((key, index) => {
                const row = document.createElement('div');
                row.className = 'json-row';
                
                const keySpan = document.createElement('span');
                keySpan.className = 'json-key';
                keySpan.innerHTML = `"${window.escapeApiHtml(key)}": `;
                row.appendChild(keySpan);
                
                row.appendChild(window.createApiNode(val[key]));
                
                if (index < keys.length - 1) {
                    const comma = document.createElement('span');
                    comma.className = 'json-comma';
                    comma.innerText = ',';
                    row.appendChild(comma);
                }
                body.appendChild(row);
            });

            const footer = document.createElement('span');
            footer.className = 'json-bracket';
            footer.innerText = '}';
            
            header.onclick = (e) => {
                e.stopPropagation();
                body.classList.toggle('collapsed');
                header.classList.toggle('expanded');
            };

            wrapper.appendChild(header);
            wrapper.appendChild(body);
            wrapper.appendChild(footer);
            nodeEl.appendChild(wrapper);
        }
    }
    return nodeEl;
};

window.escapeApiHtml = function(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

window.sendPostmanRequest = async function() {
    const endpoint = document.getElementById('postman-endpoint-select').value;
    const container = document.getElementById('postman-json-viewer');
    
    container.innerHTML = `<div style="text-align:center; margin-top:2rem; font-style:italic; color:var(--text-muted);">Fetching full response from Oprisa...</div>`;
    document.getElementById('postman-meta').style.display = 'none';

    const startTime = performance.now();
    try {
        const host = window.location.hostname;
        const protocol = window.location.protocol;
        let targetUrl = `${protocol}//${host}:3050/api/proxy/${endpoint}`;
        
        if (endpoint === 'state') targetUrl = `${protocol}//${host}:3050/api/state`;
        
        const response = await fetch(targetUrl);
        const latency = Math.round(performance.now() - startTime);

        const data = await response.json();
        apiActivePostmanRawJson = data;

        document.getElementById('postman-meta-status').innerText = `${response.status} ${response.statusText || 'OK'}`;
        document.getElementById('postman-meta-latency').innerText = `${latency}ms`;
        document.getElementById('postman-meta-status').style.color = response.ok ? 'var(--color-success)' : 'var(--color-danger)';

        document.getElementById('postman-meta').style.display = 'flex';
        window.applyPostmanFilter();

    } catch (err) {
        container.innerHTML = `<div style="color:var(--color-danger); border:1px dashed rgba(255,75,75,0.2); border-radius:6px; padding:1.5rem; text-align:center; margin-top:2rem;">Call failed: ${err.message}</div>`;
    }
};

window.applyPostmanFilter = function() {
    if (!apiActivePostmanRawJson) return;
    const input = document.getElementById('postman-filter');
    if (!input) return;
    const query = input.value.toLowerCase().trim();
    const container = document.getElementById('postman-json-viewer');

    if (!query) {
        window.renderApiJsonTree(apiActivePostmanRawJson, container);
        return;
    }

    if (Array.isArray(apiActivePostmanRawJson)) {
        const filtered = apiActivePostmanRawJson.filter(item => JSON.stringify(item).toLowerCase().includes(query));
        window.renderApiJsonTree(filtered, container);
    } else if (apiActivePostmanRawJson && Array.isArray(apiActivePostmanRawJson.data)) {
        const filteredData = apiActivePostmanRawJson.data.filter(item => JSON.stringify(item).toLowerCase().includes(query));
        const copy = {...apiActivePostmanRawJson, data: filteredData};
        window.renderApiJsonTree(copy, container);
    } else {
        window.renderApiJsonTree(apiActivePostmanRawJson, container);
    }
};

window.copyApiPaneText = function(paneId, btnElement) {
    const pane = document.getElementById(paneId);
    let textToCopy = pane.innerText;
    
    if (paneId === 'postman-json-viewer' && apiActivePostmanRawJson) {
        textToCopy = JSON.stringify(apiActivePostmanRawJson, null, 2);
    } else if (paneId === 'json-pane-status' && apiSelectedDriverId) {
        const rawStatus = apiLiveStatuses.find(d => (d.driver_id || d.id) == apiSelectedDriverId);
        if (rawStatus) textToCopy = JSON.stringify(rawStatus, null, 2);
    } else if (paneId === 'json-pane-schedule' && apiSelectedDriverId) {
        const rawSchedule = apiLiveSchedules.find(d => d.driver_id == apiSelectedDriverId);
        if (rawSchedule) textToCopy = JSON.stringify(rawSchedule, null, 2);
    } else if (paneId === 'json-pane-links' && apiSelectedDriverId) {
        let rawLink = null;
        if (Array.isArray(apiLiveLinks)) rawLink = apiLiveLinks.find(d => d.driver_id == apiSelectedDriverId);
        else if (apiLiveLinks && Array.isArray(apiLiveLinks.data)) rawLink = apiLiveLinks.data.find(d => d.driver_id == apiSelectedDriverId);
        if (rawLink) textToCopy = JSON.stringify(rawLink, null, 2);
    } else if (paneId === 'json-pane-state' && apiSelectedDriverId) {
        const stateDriver = (apiLiveState.drivers || []).find(d => (d.id || d.driver_id) == apiSelectedDriverId);
        if (stateDriver) textToCopy = JSON.stringify(stateDriver, null, 2);
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        if (btnElement) {
            const originalText = btnElement.innerText;
            btnElement.innerText = 'Copied!';
            btnElement.style.background = 'var(--color-success)';
            btnElement.style.color = '#ffffff';
            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.style.background = '';
                btnElement.style.color = '';
            }, 1500);
        }
    }).catch(err => alert("Failed to copy JSON: " + err));
};

window.downloadPostmanJson = function() {
    if (!apiActivePostmanRawJson) return;
    const endpoint = document.getElementById('postman-endpoint-select').value;
    const blob = new Blob([JSON.stringify(apiActivePostmanRawJson, null, 2)], {type : 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oprisa_raw_${endpoint}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

setTimeout(() => {
    const apiSearch = document.getElementById('api-search-input');
    if (apiSearch) apiSearch.addEventListener('input', window.renderApiDriverList);
    
    const postmanSearch = document.getElementById('postman-filter');
    if (postmanSearch) postmanSearch.addEventListener('input', window.applyPostmanFilter);
}, 2000);

// Initialize when tab is opened
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if (originalSwitchTab) originalSwitchTab(tabId);
    if (tabId === 'view-api-tester') {
        window.fetchApiDirectories();
        window.updatePostmanUrl();
    }
};

// ================= CONTROL CENTER & WEBHOOK CONFIGURATION =================
let currentWebhookRules = [];

window.switchCcTab = function(tabId, btnElement) {
    document.querySelectorAll('.cc-tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    document.querySelectorAll('.cc-tab-btn').forEach(el => {
        el.classList.remove('active');
        el.style.borderBottomColor = 'transparent';
    });
    
    const targetEl = document.getElementById(tabId);
    if (targetEl) {
        targetEl.style.display = 'block';
        targetEl.classList.add('active');
    }
    
    if (btnElement) {
        btnElement.classList.add('active');
        const color = window.getComputedStyle(btnElement).color;
        btnElement.style.borderBottomColor = color;
    }
};

window.checkAndCreateSettingsTable = async function() {
    if (!currentProfile || currentProfile.role !== 'admin') return;
    try {
        const { data, error } = await supabase.from('crm_settings').select('id').eq('id', 1).maybeSingle();
        if (error) {
            console.log("crm_settings select error or table missing, attempting creation:", error);
            const createSql = `
                CREATE TABLE IF NOT EXISTS public.crm_settings (
                    id integer PRIMARY KEY DEFAULT 1,
                    violation_threshold_minutes integer NOT NULL DEFAULT 15,
                    webhooks jsonb NOT NULL DEFAULT '[]'::jsonb,
                    campaign_trigger_minutes integer NOT NULL DEFAULT 15,
                    campaign_states text NOT NULL DEFAULT 'First Call, Follow-up, Closed',
                    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
                );
                
                INSERT INTO public.crm_settings (id, violation_threshold_minutes, webhooks, campaign_trigger_minutes, campaign_states)
                VALUES (1, 15, '[]'::jsonb, 15, 'First Call, Follow-up, Closed')
                ON CONFLICT (id) DO NOTHING;
                
                ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;
                
                DROP POLICY IF EXISTS "Allow all users to read crm_settings" ON public.crm_settings;
                CREATE POLICY "Allow all users to read crm_settings" ON public.crm_settings FOR SELECT USING (true);
                
                DROP POLICY IF EXISTS "Allow authenticated users to modify crm_settings" ON public.crm_settings;
                CREATE POLICY "Allow authenticated users to modify crm_settings" ON public.crm_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
                
                NOTIFY pgrst, 'reload schema';
            `;
            const { error: ddlError } = await supabase.rpc('execute_ddl', { query_text: createSql });
            if (ddlError) {
                console.error("Error creating crm_settings table:", ddlError);
            } else {
                console.log("Successfully created and seeded crm_settings table.");
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else if (!data) {
            await supabase.from('crm_settings').insert({ id: 1, violation_threshold_minutes: 15, webhooks: [], campaign_trigger_minutes: 15, campaign_states: 'First Call, Follow-up, Closed' });
        }
    } catch (e) {
        console.error("Exception checking crm_settings table:", e);
    }
};

window.loadControlCenterConfig = async function() {
    if (!currentProfile || currentProfile.role !== 'admin') return;
    try {
        const { data, error } = await supabase.from('crm_settings').select('*').eq('id', 1).maybeSingle();
        if (error) {
            console.error("Error loading crm_settings:", error);
            return;
        }
        if (data) {
            const thresholdInput = document.getElementById('config-violation-threshold');
            if (thresholdInput) {
                thresholdInput.value = data.violation_threshold_minutes;
            }
            let rules = Array.isArray(data.webhooks) ? data.webhooks : [];
            if (rules.length === 0) {
                rules = [
                    {
                        id: "rule-default-15m",
                        trigger_minutes: 15,
                        url: "https://services.leadconnectorhq.com/hooks/5cZPTBMNFPf51DIOVhS6/webhook-trigger/a0fe7949-cd95-46dc-9a19-7fe6a2a992fe",
                        payload_template: "{\n  \"event\": \"violation_15m\",\n  \"driver_id\": \"{{driver_id}}\",\n  \"name\": \"{{name}}\",\n  \"email\": \"{{email}}\",\n  \"phone\": \"{{phone}}\",\n  \"status\": \"{{status}}\",\n  \"duration_minutes\": {{duration_minutes}},\n  \"detected_at\": \"{{detected_at}}\",\n  \"link\": \"{{link}}\"\n}",
                        is_active: true
                    },
                    {
                        id: "rule-default-20m",
                        trigger_minutes: 20,
                        url: "https://services.leadconnectorhq.com/hooks/5cZPTBMNFPf51DIOVhS6/webhook-trigger/a3d49fde-40a1-4be4-a4cc-952577851c0a",
                        payload_template: "{\n  \"event\": \"violation_20m\",\n  \"driver_id\": \"{{driver_id}}\",\n  \"name\": \"{{name}}\",\n  \"email\": \"{{email}}\",\n  \"phone\": \"{{phone}}\",\n  \"status\": \"{{status}}\",\n  \"duration_minutes\": {{duration_minutes}},\n  \"detected_at\": \"{{detected_at}}\",\n  \"link\": \"{{link}}\"\n}",
                        is_active: true
                    }
                ];
                supabase.from('crm_settings').update({ webhooks: rules }).eq('id', 1).then(() => {
                    console.log("Successfully seeded default webhook rules.");
                });
            }
            currentWebhookRules = rules;
            window.renderWebhookRules();
        }
    } catch (e) {
        console.error("Exception loading crm_settings:", e);
    }
};

window.renderWebhookRules = function() {
    const tbody = document.getElementById('config-webhooks-tbody');
    if (!tbody) return;
    
    if (currentWebhookRules.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nicio regulă definită. Adaugă una folosind butonul de mai sus.</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = currentWebhookRules.map((rule, idx) => {
        const actionType = rule.action_type || 'webhook';
        let actionBadge = '';
        let detailsHtml = '';
        
        if (actionType === 'webhook') {
            actionBadge = `<span style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-align: center; display: inline-block;">Webhook</span>`;
            const payloadStr = typeof rule.payload_template === 'string' ? rule.payload_template : JSON.stringify(rule.payload_template);
            detailsHtml = `
                <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); word-break: break-all;">${rule.url}</div>
                <div style="max-height: 50px; overflow-y: auto; font-family: monospace; font-size: 0.72rem; background: #f8fafc; padding: 0.25rem; border-radius: 4px; border: 1px solid var(--card-border); color: var(--text-secondary); white-space: pre-wrap; word-break: break-all; margin-top: 0.25rem;">
                    ${escapeHtml(payloadStr)}
                </div>
            `;
        } else if (actionType === 'campaign') {
            actionBadge = `<span style="background: rgba(20, 184, 166, 0.1); color: #14b8a6; border: 1px solid rgba(20, 184, 166, 0.2); padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-align: center; display: inline-block;">Campanie CRM</span>`;
            detailsHtml = `
                <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">Campanie: ${rule.campaign_title || 'Nespecificat'}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">Etape: ${rule.campaign_states || 'Nespecificat'}</div>
            `;
        }
        
        const isActiveBadge = rule.is_active 
            ? `<span style="background: rgba(16, 185, 129, 0.15); color: var(--color-success); border: 1px solid var(--color-success); padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Activ</span>`
            : `<span style="background: rgba(100, 116, 139, 0.15); color: var(--text-muted); border: 1px solid var(--text-muted); padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Inactiv</span>`;
            
        return `
            <tr>
                <td style="font-weight: 700; color: var(--text-primary); text-align: center;">${rule.trigger_minutes} min</td>
                <td style="text-align: center;">${actionBadge}</td>
                <td>${detailsHtml}</td>
                <td style="text-align: center;">${isActiveBadge}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" class="btn" style="background: var(--color-primary); color: white; padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 0.25rem; border: none; cursor: pointer;" onclick="window.showEditWebhookModal('${rule.id}')">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" class="btn" style="background: ${rule.is_active ? '#64748b' : 'var(--color-success)'}; color: white; padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 0.25rem; border: none; cursor: pointer;" onclick="window.toggleWebhookRule('${rule.id}')">
                        <i class="fa-solid ${rule.is_active ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <button type="button" class="btn" style="background: var(--color-danger); color: white; padding: 0.25rem 0.5rem; font-size: 0.75rem; border: none; cursor: pointer;" onclick="window.deleteWebhookRule('${rule.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.toggleRuleModalFields = function() {
    const actionTypeSelect = document.getElementById('rule-action-type');
    const webhookContainer = document.getElementById('webhook-fields-container');
    const campaignContainer = document.getElementById('campaign-fields-container');
    
    if (actionTypeSelect && webhookContainer && campaignContainer) {
        const actionType = actionTypeSelect.value;
        if (actionType === 'webhook') {
            webhookContainer.style.display = 'flex';
            campaignContainer.style.display = 'none';
        } else if (actionType === 'campaign') {
            webhookContainer.style.display = 'none';
            campaignContainer.style.display = 'flex';
        }
    }
};

window.showAddWebhookModal = function() {
    const modal = document.getElementById('webhook-rule-modal');
    if (modal && modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }
    document.getElementById('webhook-rule-modal-title').innerText = "Adaugă Regulă de Alertă / Campanie";
    document.getElementById('webhook-rule-id').value = "";
    document.getElementById('webhook-trigger-minutes').value = "5";
    document.getElementById('rule-action-type').value = "webhook";
    document.getElementById('webhook-url').value = "";
    document.getElementById('webhook-payload').value = "";
    document.getElementById('campaign-title-rule').value = "Violation Shift";
    document.getElementById('campaign-states-rule').value = "First Call, Follow-up, Closed";
    document.getElementById('webhook-active').checked = true;
    
    window.toggleRuleModalFields();
    document.getElementById('webhook-rule-modal').style.display = 'flex';
};

window.showEditWebhookModal = function(ruleId) {
    const modal = document.getElementById('webhook-rule-modal');
    if (modal && modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }
    const rule = currentWebhookRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    const actionType = rule.action_type || 'webhook';
    
    document.getElementById('webhook-rule-modal-title').innerText = "Editează Regulă de Alertă / Campanie";
    document.getElementById('webhook-rule-id').value = rule.id;
    document.getElementById('webhook-trigger-minutes').value = rule.trigger_minutes;
    document.getElementById('rule-action-type').value = actionType;
    
    if (actionType === 'webhook') {
        document.getElementById('webhook-url').value = rule.url || '';
        const payloadStr = typeof rule.payload_template === 'string' ? rule.payload_template : JSON.stringify(rule.payload_template, null, 2);
        document.getElementById('webhook-payload').value = payloadStr;
    } else {
        document.getElementById('webhook-url').value = '';
        document.getElementById('webhook-payload').value = '';
    }
    
    if (actionType === 'campaign') {
        document.getElementById('campaign-title-rule').value = rule.campaign_title || 'Violation Shift';
        document.getElementById('campaign-states-rule').value = rule.campaign_states || 'First Call, Follow-up, Closed';
    } else {
        document.getElementById('campaign-title-rule').value = 'Violation Shift';
        document.getElementById('campaign-states-rule').value = 'First Call, Follow-up, Closed';
    }
    
    document.getElementById('webhook-active').checked = !!rule.is_active;
    
    window.toggleRuleModalFields();
    document.getElementById('webhook-rule-modal').style.display = 'flex';
};

window.closeWebhookModal = function() {
    document.getElementById('webhook-rule-modal').style.display = 'none';
};

window.loadDefaultPayloadTemplate = function() {
    const defaultTemplate = {
        event: "driver_violation",
        driver_id: "{{driver_id}}",
        name: "{{name}}",
        email: "{{email}}",
        phone: "{{phone}}",
        status: "{{status}}",
        duration_minutes: "{{duration_minutes}}",
        detected_at: "{{detected_at}}",
        link: "{{link}}"
    };
    document.getElementById('webhook-payload').value = JSON.stringify(defaultTemplate, null, 2);
};

window.saveWebhookRule = function() {
    const id = document.getElementById('webhook-rule-id').value;
    const triggerMinutes = parseInt(document.getElementById('webhook-trigger-minutes').value, 10);
    const actionType = document.getElementById('rule-action-type').value;
    const isActive = document.getElementById('webhook-active').checked;
    
    if (isNaN(triggerMinutes) || triggerMinutes < 0) {
        alert("Te rugăm să introduci un timp de declanșare valid (minim 0 minute).");
        return;
    }
    
    let updatedRule = {
        id: id || generateUuid(),
        trigger_minutes: triggerMinutes,
        action_type: actionType,
        is_active: isActive
    };
    
    if (actionType === 'webhook') {
        const url = document.getElementById('webhook-url').value.trim();
        const payloadStr = document.getElementById('webhook-payload').value.trim();
        
        if (!url) {
            alert("Te rugăm să introduci URL-ul de destinație.");
            return;
        }
        
        try {
            JSON.parse(payloadStr);
        } catch (e) {
            alert("Eroare: Payload-ul trebuie să fie un JSON valid! " + e.message);
            return;
        }
        
        updatedRule.url = url;
        updatedRule.payload_template = payloadStr;
    } else if (actionType === 'campaign') {
        const campaignTitle = document.getElementById('campaign-title-rule').value.trim();
        const campaignStates = document.getElementById('campaign-states-rule').value.trim();
        
        if (!campaignTitle) {
            alert("Te rugăm să introduci un titlu pentru campania CRM.");
            return;
        }
        if (!campaignStates) {
            alert("Te rugăm să introduci etapele de workflow (separate prin virgulă).");
            return;
        }
        
        updatedRule.campaign_title = campaignTitle;
        updatedRule.campaign_states = campaignStates;
    }
    
    if (id) {
        const idx = currentWebhookRules.findIndex(r => r.id === id);
        if (idx !== -1) {
            currentWebhookRules[idx] = updatedRule;
        }
    } else {
        currentWebhookRules.push(updatedRule);
    }
    
    window.closeWebhookModal();
    window.renderWebhookRules();
};

window.toggleWebhookRule = function(ruleId) {
    const idx = currentWebhookRules.findIndex(r => r.id === ruleId);
    if (idx !== -1) {
        currentWebhookRules[idx].is_active = !currentWebhookRules[idx].is_active;
        window.renderWebhookRules();
    }
};

window.deleteWebhookRule = function(ruleId) {
    if (!confirm("Sigur dorești să ștergi această regulă?")) return;
    currentWebhookRules = currentWebhookRules.filter(r => r.id !== ruleId);
    window.renderWebhookRules();
};

window.saveControlCenterConfig = async function() {
    if (!currentProfile || currentProfile.role !== 'admin') return;
    
    const thresholdInput = document.getElementById('config-violation-threshold');
    if (!thresholdInput) return;
    
    const threshold = parseInt(thresholdInput.value, 10);
    if (isNaN(threshold) || threshold < 1) {
        alert("Te rugăm să introduci un prag valid (minim 1 minut).");
        return;
    }
    
    try {
        const { error } = await supabase
            .from('crm_settings')
            .upsert({
                id: 1,
                violation_threshold_minutes: threshold,
                webhooks: currentWebhookRules,
                updated_at: new Date().toISOString()
            });
            
        if (error) throw error;
        alert("Configurația a fost salvată cu succes!");
    } catch (e) {
        console.error("Error saving crm_settings:", e);
        alert("Eroare la salvarea configurației: " + e.message);
    }
};

function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function loadOnboardingDashboard() {
    try {
        const { data: leads, error } = await supabase
            .from('telegram_onboarding')
            .select('*');

        if (error) throw error;

        // Clear Kanban lists
        const lists = {
            'date-personale': document.getElementById('list-date-personale'),
            'semnare-contract': document.getElementById('list-semnare-contract'),
            'instruire-video': document.getElementById('list-instruire-video'),
            'test-evaluare': document.getElementById('list-test-evaluare'),
            'finalizat': document.getElementById('list-finalizat')
        };

        Object.keys(lists).forEach(key => {
            if (lists[key]) lists[key].innerHTML = '';
        });

        // Initialize counters
        const counts = {
            'date-personale': 0,
            'semnare-contract': 0,
            'instruire-video': 0,
            'test-evaluare': 0,
            'finalizat': 0
        };

        if (!leads || leads.length === 0) {
            updateOnboardingCounters(counts);
            return;
        }

        // Sort leads: latest activity first
        leads.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

        leads.forEach(row => {
            let colKey = 'date-personale';
            const step = row.current_step;

            if (['ask_name', 'ask_email', 'ask_phone', 'ask_oras', 'ask_iban'].includes(step)) {
                colKey = 'date-personale';
            } else if (step === 'sign_contract') {
                colKey = 'semnare-contract';
            } else if (step === 'watch_video') {
                colKey = 'instruire-video';
            } else if (['quiz_q1', 'quiz_q2', 'quiz_q3'].includes(step)) {
                colKey = 'test-evaluare';
            } else if (step === 'completed') {
                colKey = 'finalizat';
            }

            counts[colKey]++;

            const card = document.createElement('div');
            card.className = 'onboarding-card';
            card.style.cssText = `
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                transition: all 0.25s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.015);
            `;

            // Hover effects
            card.onmouseover = () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.04)';
                card.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            };
            card.onmouseout = () => {
                card.style.transform = 'none';
                card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.015)';
                card.style.borderColor = 'var(--card-border)';
            };

            const stepBadgeStyle = getStepBadgeStyle(step);
            const stepName = formatStepName(step);

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <span style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;">
                        ${row.nume || 'Lead Telegram'}
                    </span>
                    <span style="font-size: 0.72rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; ${stepBadgeStyle} white-space: nowrap;">
                        ${stepName}
                    </span>
                </div>
                
                <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                    ${row.telefon ? `<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><i class="fa-solid fa-phone" style="width: 16px; color: var(--text-muted);"></i> ${row.telefon}</div>` : ''}
                    ${row.email ? `<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><i class="fa-solid fa-envelope" style="width: 16px; color: var(--text-muted);" title="${row.email}"></i> ${row.email}</div>` : ''}
                    ${row.oras ? `<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><i class="fa-solid fa-location-dot" style="width: 16px; color: var(--text-muted);"></i> ${row.oras}</div>` : ''}
                    ${row.iban ? `<div style="font-family: monospace; font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.iban}"><i class="fa-solid fa-credit-card" style="width: 16px; color: var(--text-muted);"></i> ${row.iban}</div>` : ''}
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; border-top: 1px solid rgba(0,0,0,0.04); padding-top: 6px;">
                    <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${row.contract_signed ? 'background: rgba(34, 197, 94, 0.1); color: #22c55e;' : 'background: rgba(234, 179, 8, 0.1); color: #eab308;'}">
                        <i class="fa-solid fa-file-signature"></i> ${row.contract_signed ? 'Semnat' : 'Nesemnat'}
                    </span>
                    ${(row.quiz_score !== undefined && row.quiz_score !== null && step !== 'ask_name' && step !== 'ask_email' && step !== 'ask_phone' && step !== 'ask_oras' && step !== 'ask_iban' && step !== 'sign_contract' && step !== 'watch_video') ? `
                    <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${row.completed ? 'background: rgba(34, 197, 94, 0.1); color: #22c55e;' : 'background: rgba(239, 68, 68, 0.1); color: #ef4444;'}">
                        <i class="fa-solid fa-graduation-cap"></i> Scor: ${row.quiz_score}/3
                    </span>` : ''}
                </div>

                <div style="font-size: 0.68rem; color: var(--text-muted); text-align: right; margin-top: 2px;">
                    <i class="fa-regular fa-clock"></i> ${formatOnboardingTime(row.updated_at || row.created_at)}
                </div>
            `;

            if (lists[colKey]) {
                lists[colKey].appendChild(card);
            }
        });

        updateOnboardingCounters(counts);

    } catch (e) {
        console.error('Failed to load onboarding dashboard data:', e);
    }
}

function updateOnboardingCounters(counts) {
    Object.keys(counts).forEach(key => {
        const badge = document.getElementById(`count-${key}`);
        if (badge) badge.textContent = counts[key];
    });
}

function getStepBadgeStyle(step) {
    switch (step) {
        case 'ask_name':
        case 'ask_email':
        case 'ask_phone':
        case 'ask_oras':
        case 'ask_iban':
            return 'background: rgba(59, 130, 246, 0.1); color: #3b82f6;';
        case 'sign_contract':
            return 'background: rgba(234, 179, 8, 0.1); color: #eab308;';
        case 'watch_video':
            return 'background: rgba(168, 85, 247, 0.1); color: #a855f7;';
        case 'quiz_q1':
        case 'quiz_q2':
        case 'quiz_q3':
            return 'background: rgba(249, 115, 22, 0.1); color: #f97316;';
        case 'completed':
            return 'background: rgba(34, 197, 94, 0.1); color: #22c55e;';
        default:
            return 'background: rgba(100, 116, 139, 0.1); color: #64748b;';
    }
}

function formatStepName(step) {
    switch (step) {
        case 'ask_name': return 'Nume';
        case 'ask_email': return 'Email';
        case 'ask_phone': return 'Telefon';
        case 'ask_oras': return 'Oraș';
        case 'ask_iban': return 'IBAN';
        case 'sign_contract': return 'Contract';
        case 'watch_video': return 'Video';
        case 'quiz_q1': return 'Quiz 1/3';
        case 'quiz_q2': return 'Quiz 2/3';
        case 'quiz_q3': return 'Quiz 3/3';
        case 'completed': return 'Finalizat';
        default: return step;
    }
}

function formatOnboardingTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('ro-RO') + ' ' + date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
// ==========================================
// INSOLVENCY RISK ANALYSIS & RESTORE LOGIC
// ==========================================

window.checkAndCreateInsolvencyTables = async function() {
    try {
        const { error: checkErr } = await supabase.from('insolvency_receivables').select('id').limit(1);
        if (checkErr && (checkErr.code === 'PGRST116' || (checkErr.message && checkErr.message.includes('does not exist')))) {
            console.log("Insolvency tables do not exist. Creating them via execute_ddl...");
            const createSql = `
                CREATE TABLE IF NOT EXISTS public.insolvency_receivables (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT NOT NULL,
                    amount NUMERIC NOT NULL,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
                );

                ALTER TABLE public.insolvency_receivables ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Allow all users to read insolvency_receivables" ON public.insolvency_receivables;
                CREATE POLICY "Allow all users to read insolvency_receivables" ON public.insolvency_receivables FOR SELECT USING (true);
                DROP POLICY IF EXISTS "Allow authenticated users to modify insolvency_receivables" ON public.insolvency_receivables;
                CREATE POLICY "Allow authenticated users to modify insolvency_receivables" ON public.insolvency_receivables FOR ALL TO authenticated USING (true) WITH CHECK (true);

                CREATE TABLE IF NOT EXISTS public.insolvency_decisions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    description TEXT NOT NULL,
                    responsible TEXT NOT NULL,
                    deadline DATE,
                    status TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
                );

                ALTER TABLE public.insolvency_decisions ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Allow all users to read insolvency_decisions" ON public.insolvency_decisions;
                CREATE POLICY "Allow all users to read insolvency_decisions" ON public.insolvency_decisions FOR SELECT USING (true);
                DROP POLICY IF EXISTS "Allow authenticated users to modify insolvency_decisions" ON public.insolvency_decisions;
                CREATE POLICY "Allow authenticated users to modify insolvency_decisions" ON public.insolvency_decisions FOR ALL TO authenticated USING (true) WITH CHECK (true);

                NOTIFY pgrst, 'reload schema';
            `;
            const { error: ddlError } = await supabase.rpc('execute_ddl', { query_text: createSql });
            if (ddlError) {
                console.error("execute_ddl failed:", ddlError);
            } else {
                console.log("Insolvency tables successfully created.");
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
    } catch (e) {
        console.error("Exception checking/creating insolvency tables:", e);
    }
};

window.loadInsolvencyData = async function() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        const textEl = document.querySelector('.loading-text');
        if (textEl) textEl.innerHTML = currentLang === 'ro' ? 'Se încarcă analiza de insolvență...' : 'Loading insolvency analysis...';
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '1';
    }

    try {
        await window.checkAndCreateInsolvencyTables();

        const { data: reports, error: reportError } = await supabase
            .from('raport_numar_curse_trip_activity')
            .select('cost_ore_angajat_total, taxe_total, costuri_total, total_fare_uber, profit_real_total');

        if (reportError) throw reportError;

        let totalSalaries = 0;
        let totalTaxes = 0;
        let totalUberRevenue = 0;

        if (reports && reports.length > 0) {
            reports.forEach(row => {
                totalSalaries += parseFloat(row.cost_ore_angajat_total) || 0;
                totalTaxes += parseFloat(row.taxe_total) || 0;
                totalUberRevenue += parseFloat(row.total_fare_uber) || 0;
            });
        }

        window.insolvencySalariesDue = totalSalaries;
        window.insolvencyTaxesDue = totalTaxes;
        window.insolvencyInitialDeficit = totalSalaries + totalTaxes;
        window.insolvencyTotalUberRevenue = totalUberRevenue;

        await window.fetchInsolvencyReceivables();
        await window.fetchInsolvencyDecisions();
        window.recalculateInsolvencyMetrics();

    } catch (err) {
        console.error("Error loading insolvency data:", err);
        showToast(currentLang === 'ro' ? 'Eroare la încărcarea datelor de insolvență!' : 'Error loading insolvency data!', 'danger');
    } finally {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
};

window.fetchInsolvencyReceivables = async function() {
    try {
        const { data, error } = await supabase
            .from('insolvency_receivables')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        window.insolvencyReceivables = data || [];
    } catch (err) {
        console.error("Error fetching receivables:", err);
        window.insolvencyReceivables = [];
    }
};

window.fetchInsolvencyDecisions = async function() {
    try {
        const { data, error } = await supabase
            .from('insolvency_decisions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        window.insolvencyDecisions = data || [];
    } catch (err) {
        console.error("Error fetching decisions:", err);
        window.insolvencyDecisions = [];
    }
};

window.recalculateInsolvencyMetrics = function() {
    let totalReceived = 0;
    let totalPending = 0;

    window.insolvencyReceivables.forEach(r => {
        const amt = parseFloat(r.amount) || 0;
        if (r.status === 'received') {
            totalReceived += amt;
        } else if (r.status === 'pending') {
            totalPending += amt;
        }
    });

    const netGap = Math.max(0, window.insolvencyInitialDeficit - totalReceived - totalPending);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    document.getElementById('insolvency-stat-salaries').innerText = formatCurrency(window.insolvencySalariesDue);
    document.getElementById('insolvency-stat-taxes').innerText = formatCurrency(window.insolvencyTaxesDue);
    document.getElementById('insolvency-stat-initial-deficit').innerText = formatCurrency(window.insolvencyInitialDeficit);
    
    const gapEl = document.getElementById('insolvency-stat-net-gap');
    if (gapEl) {
        gapEl.innerText = formatCurrency(netGap);
        const gapCard = gapEl.closest('.stat-card');
        if (gapCard) {
            if (netGap === 0) {
                gapCard.style.borderLeftColor = 'var(--color-success)';
                gapEl.style.color = 'var(--color-success)';
            } else if (netGap < window.insolvencyInitialDeficit * 0.5) {
                gapCard.style.borderLeftColor = 'var(--color-warning)';
                gapEl.style.color = 'var(--color-warning)';
            } else {
                gapCard.style.borderLeftColor = 'var(--color-danger)';
                gapEl.style.color = 'var(--color-danger)';
            }
        }
    }

    window.renderInsolvencyReceivables();
    window.renderInsolvencyDecisions();
};

window.renderInsolvencyReceivables = function() {
    const tbody = document.getElementById('insolvency-receivables-tbody');
    if (!tbody) return;

    if (!window.insolvencyReceivables || window.insolvencyReceivables.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Nicio sursă înregistrată. Adăugați una din formular.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.insolvencyReceivables.map(r => {
        let typeText = r.type;
        if (currentLang === 'ro') {
            if (r.type === 'receivable') typeText = 'Creanță';
            else if (r.type === 'loan') typeText = 'Credit / Împrumut';
            else if (r.type === 'factoring') typeText = 'Factorizare';
            else typeText = 'Altă Sursă';
        } else {
            if (r.type === 'receivable') typeText = 'Receivable';
            else if (r.type === 'loan') typeText = 'Loan / Credit';
            else if (r.type === 'factoring') typeText = 'Factoring';
            else typeText = 'Other';
        }

        let statusClass = '';
        let statusText = r.status;
        if (r.status === 'received') {
            statusClass = 'cell-profit';
            statusText = currentLang === 'ro' ? 'Încasat' : 'Received';
        } else if (r.status === 'pending') {
            statusClass = 'cell-warning';
            statusText = currentLang === 'ro' ? 'În așteptare' : 'Pending';
        } else {
            statusClass = 'cell-loss';
            statusText = currentLang === 'ro' ? 'Disputat' : 'Disputed';
        }

        return `
            <tr>
                <td style="font-weight:600; color:var(--text-primary);">${r.name}</td>
                <td>${typeText}</td>
                <td style="font-weight:600;">${new Intl.NumberFormat('de-DE').format(r.amount)} EUR</td>
                <td class="${statusClass}">${statusText}</td>
                <td style="text-align:center;">
                    <button class="btn" style="background:var(--color-primary); color:white; padding:0.25rem 0.5rem; font-size:0.75rem; margin-right:0.25rem; border:none; cursor:pointer;" onclick="window.toggleReceivableStatus('${r.id}', '${r.status}')" title="${currentLang==='ro'?'Schimbă Status':'Toggle Status'}">
                        <i class="fa-solid fa-arrows-spin"></i>
                    </button>
                    <button class="btn" style="background:var(--color-danger); color:white; padding:0.25rem 0.5rem; font-size:0.75rem; border:none; cursor:pointer;" onclick="window.deleteReceivable('${r.id}')" title="${currentLang==='ro'?'Șterge':'Delete'}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

window.renderInsolvencyDecisions = function() {
    const tbody = document.getElementById('insolvency-decisions-tbody');
    if (!tbody) return;

    if (!window.insolvencyDecisions || window.insolvencyDecisions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Nicio decizie înregistrată. Adăugați una mai jos.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.insolvencyDecisions.map(d => {
        let statusClass = '';
        let statusText = d.status;
        
        if (d.status === 'completed') {
            statusClass = 'cell-profit';
            statusText = currentLang === 'ro' ? 'Finalizată' : 'Completed';
        } else if (d.status === 'in_progress') {
            statusClass = 'cell-warning';
            statusText = currentLang === 'ro' ? 'În Curs' : 'In Progress';
        } else {
            statusClass = 'cell-loss';
            statusText = currentLang === 'ro' ? 'Planificată' : 'Draft';
        }

        const deadlineFormatted = d.deadline ? new Date(d.deadline).toLocaleDateString('ro-RO') : '-';

        return `
            <tr>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: normal; color:var(--text-primary); font-weight:500;">${d.description}</td>
                <td>${d.responsible}</td>
                <td>${deadlineFormatted}</td>
                <td class="${statusClass}">${statusText}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button class="btn" style="background:var(--color-success); color:white; padding:0.25rem 0.5rem; font-size:0.75rem; margin-right:0.25rem; border:none; cursor:pointer;" onclick="window.toggleDecisionStatus('${d.id}', '${d.status}')" title="${currentLang==='ro'?'Schimbă Status':'Toggle Status'}">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="btn" style="background:var(--color-danger); color:white; padding:0.25rem 0.5rem; font-size:0.75rem; border:none; cursor:pointer;" onclick="window.deleteDecision('${d.id}')" title="${currentLang==='ro'?'Șterge':'Delete'}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

window.addNewReceivable = async function() {
    const name = document.getElementById('rec-name').value.trim();
    const type = document.getElementById('rec-type').value;
    const amount = parseFloat(document.getElementById('rec-amount').value);
    const status = document.getElementById('rec-status').value;

    if (!name || isNaN(amount) || amount <= 0) return;

    try {
        const { error } = await supabase
            .from('insolvency_receivables')
            .insert([{ name, type, amount, status }]);

        if (error) throw error;
        
        document.getElementById('add-receivable-form').reset();
        showToast(currentLang === 'ro' ? 'Sursă de venit adăugată!' : 'Revenue source added!', 'success');
        await window.fetchInsolvencyReceivables();
        window.recalculateInsolvencyMetrics();
    } catch (err) {
        console.error("Error inserting receivable:", err);
        showToast(err.message, 'danger');
    }
};

window.toggleReceivableStatus = async function(id, currentStatus) {
    const nextStatus = currentStatus === 'pending' ? 'received' : (currentStatus === 'received' ? 'disputed' : 'pending');
    try {
        const { error } = await supabase
            .from('insolvency_receivables')
            .update({ status: nextStatus })
            .eq('id', id);

        if (error) throw error;
        
        showToast(currentLang === 'ro' ? 'Status actualizat!' : 'Status updated!', 'success');
        await window.fetchInsolvencyReceivables();
        window.recalculateInsolvencyMetrics();
    } catch (err) {
        console.error("Error updating status:", err);
    }
};

window.deleteReceivable = async function(id) {
    if (!confirm(currentLang === 'ro' ? 'Sigur doriți să ștergeți această sursă?' : 'Are you sure you want to delete this source?')) return;
    try {
        const { error } = await supabase
            .from('insolvency_receivables')
            .delete()
            .eq('id', id);

        if (error) throw error;
        
        showToast(currentLang === 'ro' ? 'Sursă ștearsă!' : 'Source deleted!', 'success');
        await window.fetchInsolvencyReceivables();
        window.recalculateInsolvencyMetrics();
    } catch (err) {
        console.error("Error deleting receivable:", err);
    }
};

window.autoLoadUberReceivables = async function() {
    const name = currentLang === 'ro' ? 'Sold estimat de încasat Uber' : 'Estimated Uber Outstanding Balance';
    const amount = window.insolvencyTotalUberRevenue || 50000;
    
    const alreadyExists = window.insolvencyReceivables.some(r => r.name.toLowerCase().includes('uber') && Math.abs(r.amount - amount) < 1);
    if (alreadyExists) {
        alert(currentLang === 'ro' ? 'Creanța Uber estimată a fost deja importată!' : 'Estimated Uber receivables have already been imported!');
        return;
    }

    try {
        const { error } = await supabase
            .from('insolvency_receivables')
            .insert([{ name, type: 'receivable', amount, status: 'pending', description: 'Generated automatically from database reports' }]);

        if (error) throw error;
        
        showToast(currentLang === 'ro' ? 'Creanțe Uber importate automat!' : 'Uber receivables imported automatically!', 'success');
        await window.fetchInsolvencyReceivables();
        window.recalculateInsolvencyMetrics();
    } catch (err) {
        console.error("Error autoloading Uber receivables:", err);
    }
};

window.addNewDecision = async function() {
    const description = document.getElementById('dec-text').value.trim();
    const responsible = document.getElementById('dec-resp').value.trim();
    const deadline = document.getElementById('dec-deadline').value;

    if (!description || !responsible || !deadline) return;

    try {
        const { error } = await supabase
            .from('insolvency_decisions')
            .insert([{ description, responsible, deadline, status: 'draft' }]);

        if (error) throw error;
        
        document.getElementById('add-decision-form').reset();
        showToast(currentLang === 'ro' ? 'Decizie adăugată!' : 'Decision added!', 'success');
        await window.fetchInsolvencyDecisions();
        window.recalculateInsolvencyMetrics();
    } catch (err) {
        console.error("Error inserting decision:", err);
        showToast(err.message, 'danger');
    }
};

window.toggleDecisionStatus = async function(id, currentStatus) {
    const nextStatus = currentStatus === 'draft' ? 'in_progress' : (currentStatus === 'in_progress' ? 'completed' : 'draft');
    try {
        const { error } = await supabase
            .from('insolvency_decisions')
            .update({ status: nextStatus })
            .eq('id', id);

        if (error) throw error;
        
        showToast(currentLang === 'ro' ? 'Status decizie actualizat!' : 'Decision status updated!', 'success');
        await window.fetchInsolvencyDecisions();
        window.recalculateInsolvencyMetrics();
    } catch (err) {
        console.error("Error updating decision status:", err);
    }
};

window.deleteDecision = async function(id) {
    if (!confirm(currentLang === 'ro' ? 'Ștergeți această decizie?' : 'Delete this decision?')) return;
    try {
        const { error } = await supabase
            .from('insolvency_decisions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        
        showToast(currentLang === 'ro' ? 'Decizie ștearsă!' : 'Decision deleted!', 'success');
        await window.fetchInsolvencyDecisions();
        window.recalculateInsolvencyMetrics();
    } catch (err) {
        console.error("Error deleting decision:", err);
    }
};

window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    
    if (!sidebar || !mainContent) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded', isCollapsed);
    
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            if (isCollapsed) {
                icon.className = 'fa-solid fa-angles-right';
            } else {
                icon.className = 'fa-solid fa-bars';
            }
        }
    }
};

window.toggleCampaignsMenu = function() {
    const submenu = document.getElementById('campaigns-submenu');
    const chevron = document.getElementById('campaigns-chevron');
    if (!submenu) return;
    
    if (submenu.style.display === 'none' || submenu.style.display === '') {
        submenu.style.display = 'flex';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        submenu.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

// ================= DEPARTMENT WORKSPACE ENGINE =================
window.activeDeptKey = '';
window.activeDeptName = '';
window.activeDeptId = '';
window.activeDeptProfiles = [];
window.activeDeptTasks = [];
window.activeDeptTaskNotesId = '';

window.loadDepartmentWorkspace = async function(deptKey) {
    const deptNameMap = {
        'dsp': 'DSP',
        'hr': 'HR',
        'payments': 'Payments',
        'support': 'Suport',
        'recruiting': 'Recruiting',
        'marketing': 'Marketing and Ads'
    };
    const deptName = deptNameMap[deptKey];
    if (!deptName) return;

    window.activeDeptKey = deptKey;
    window.activeDeptName = deptName;

    // Set page title and subtitle
    const titleEl = document.getElementById('dept-workspace-title');
    const subtitleEl = document.getElementById('dept-workspace-subtitle');
    if (titleEl) titleEl.textContent = `Workspace ${deptName}`;
    if (subtitleEl) subtitleEl.textContent = `Administrare și obiective specifice departamentului ${deptName}.`;

    const isAdmin = currentProfile && currentProfile.role === 'admin';
    const adminControls = document.getElementById('dept-admin-controls');
    if (adminControls) {
        adminControls.style.display = isAdmin ? 'flex' : 'none';
    }

    try {
        // Resolve department ID and load department profiles
        const { data: dept, error: deptErr } = await supabase
            .from('departments')
            .select('id')
            .eq('name', deptName)
            .single();

        if (deptErr || !dept) {
            console.error('Error fetching department details:', deptErr);
            showToast('Eroare la identificarea departamentului', 'danger');
            return;
        }

        window.activeDeptId = dept.id;

        // Fetch department profiles
        const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('department_id', dept.id)
            .eq('status', 'approved');

        if (profErr) {
            console.error('Error fetching department profiles:', profErr);
        }

        window.activeDeptProfiles = profiles || [];

        // Populate dropdowns if admin
        if (isAdmin) {
            const userSelect = document.getElementById('dept-user-select');
            const modalUserSelect = document.getElementById('dept-individual-task-user');
            
            if (userSelect) {
                userSelect.innerHTML = `<option value="">Toți utilizatorii (Individual)...</option>` +
                    window.activeDeptProfiles.map(p => `<option value="${p.id}">${p.name || p.email}</option>`).join('');
                userSelect.onchange = () => window.renderDepartmentIndividualTasks();
            }
            if (modalUserSelect) {
                modalUserSelect.innerHTML = window.activeDeptProfiles.map(p => `<option value="${p.id}">${p.name || p.email}</option>`).join('');
            }
        }

        // Fetch tasks
        const { data: tasks, error: taskErr } = await supabase
            .from('crm_tasks')
            .select('*')
            .eq('target_role', deptKey);

        if (taskErr) {
            console.error('Error fetching tasks:', taskErr);
            showToast('Eroare la încărcarea sarcinilor', 'danger');
            return;
        }

        window.activeDeptTasks = tasks || [];
        window.renderDepartmentGeneralTasks();
        window.renderDepartmentIndividualTasks();

    } catch (err) {
        console.error('Workspace load failed:', err);
        showToast('Eroare la încărcarea spațiului de lucru', 'danger');
    }
};

window.renderDepartmentGeneralTasks = function() {
    const tbody = document.getElementById('dept-general-tasks-tbody');
    if (!tbody) return;

    const generalTasks = window.activeDeptTasks.filter(t => t.trigger_type === 'general');
    const isAdmin = currentProfile && currentProfile.role === 'admin';

    if (generalTasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">Niciun obiectiv general definit.</td></tr>`;
        return;
    }

    tbody.innerHTML = generalTasks.map(t => {
        let parsedDesc = {};
        try {
            parsedDesc = JSON.parse(t.description);
        } catch (e) {
            parsedDesc = { instructions: t.description || '' };
        }

        const instructions = parsedDesc.instructions || '';
        const createdBy = parsedDesc.created_by || 'Admin';
        const deleteBtn = isAdmin 
            ? `<button class="btn btn-sm" onclick="window.deleteDeptTask('${t.id}')" style="background-color: var(--color-danger); color: white; padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: var(--border-radius-sm);"><i class="fa-solid fa-trash"></i></button>`
            : '';

        return `
            <tr>
                <td style="text-align: center; vertical-align: middle;">
                    <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="window.toggleDeptTaskState('${t.id}', this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
                </td>
                <td style="white-space: normal; line-height: 1.4;">
                    <div style="font-weight: 600; color: var(--text-primary);">${t.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">${instructions}</div>
                </td>
                <td style="vertical-align: middle;">${createdBy}</td>
                <td style="text-align: center; vertical-align: middle;">${deleteBtn}</td>
            </tr>
        `;
    }).join('');
};

window.renderDepartmentIndividualTasks = function() {
    const tbody = document.getElementById('dept-individual-tasks-tbody');
    if (!tbody) return;

    const isAdmin = currentProfile && currentProfile.role === 'admin';
    let filteredTasks = window.activeDeptTasks.filter(t => t.trigger_type !== 'general');

    const labelEl = document.getElementById('dept-individual-user-label');

    if (!isAdmin) {
        // Non-admin can only see tasks assigned to them
        filteredTasks = filteredTasks.filter(t => t.assigned_to === currentUser.id);
        if (labelEl) labelEl.textContent = '— Sarcinile Mele';
    } else {
        // Admin can filter by selected user
        const userSelect = document.getElementById('dept-user-select');
        const selectedUserId = userSelect ? userSelect.value : '';
        
        if (selectedUserId) {
            filteredTasks = filteredTasks.filter(t => t.assigned_to === selectedUserId);
            const userProfile = window.activeDeptProfiles.find(p => p.id === selectedUserId);
            if (labelEl && userProfile) {
                labelEl.textContent = `— ${userProfile.name || userProfile.email}`;
            }
        } else {
            if (labelEl) labelEl.textContent = '— Toți utilizatorii';
        }
    }

    if (filteredTasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">Nicio sarcină individuală găsită.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredTasks.map(t => {
        let parsedDesc = {};
        try {
            parsedDesc = JSON.parse(t.description);
        } catch (e) {
            parsedDesc = { instructions: t.description || '' };
        }

        const instructions = parsedDesc.instructions || '';
        const comments = parsedDesc.comments || [];
        const commentsCount = comments.length;

        // Resolve assigned profile
        let assignedName = 'Nespecificat';
        if (t.assigned_to) {
            const prof = window.activeDeptProfiles.find(p => p.id === t.assigned_to) || 
                         (typeof allProfiles !== 'undefined' ? allProfiles.find(p => p.id === t.assigned_to) : null);
            if (prof) assignedName = prof.name || prof.email;
        }

        const deleteBtn = isAdmin 
            ? `<button class="btn btn-sm" onclick="window.deleteDeptTask('${t.id}')" style="background-color: var(--color-danger); color: white; padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: var(--border-radius-sm);"><i class="fa-solid fa-trash"></i></button>`
            : '';

        return `
            <tr>
                <td style="text-align: center; vertical-align: middle;">
                    <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="window.toggleDeptTaskState('${t.id}', this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
                </td>
                <td style="white-space: normal; line-height: 1.4;">
                    <div style="font-weight: 600; color: var(--text-primary);">${t.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">${instructions}</div>
                </td>
                <td style="vertical-align: middle;">${assignedName}</td>
                <td style="vertical-align: middle;">
                    <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
                        <button class="btn btn-sm" onclick="window.openDeptTaskNotesModal('${t.id}')" style="background-color: var(--color-primary); color: white; padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: var(--border-radius-sm);"><i class="fa-solid fa-comment-dots"></i> Note (${commentsCount})</button>
                        ${deleteBtn}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.openAddGeneralTaskModal = function() {
    document.getElementById('dept-general-task-form').reset();
    document.getElementById('dept-general-task-modal').classList.add('active');
};

window.closeDeptGeneralTaskModal = function() {
    document.getElementById('dept-general-task-modal').classList.remove('active');
};

window.submitDeptGeneralTask = async function() {
    const title = document.getElementById('dept-general-task-title').value.trim();
    const desc = document.getElementById('dept-general-task-desc').value.trim();
    if (!title || !desc) return;

    const parsedDesc = {
        instructions: desc,
        created_by: currentProfile ? (currentProfile.name || currentUser.email) : 'Admin',
        created_at: new Date().toISOString(),
        comments: []
    };

    try {
        const { data, error } = await supabase
            .from('crm_tasks')
            .insert([{
                title,
                description: JSON.stringify(parsedDesc),
                trigger_type: 'general',
                target_role: window.activeDeptKey,
                completed: false
            }])
            .select();

        if (error) throw error;

        showToast(currentLang === 'ro' ? 'Obiectiv general adăugat!' : 'General objective added!', 'success');
        window.closeDeptGeneralTaskModal();
        
        // Refresh local tasks
        if (data && data[0]) {
            window.activeDeptTasks.push(data[0]);
            window.renderDepartmentGeneralTasks();
        } else {
            await window.loadDepartmentWorkspace(window.activeDeptKey);
        }
    } catch (err) {
        console.error('Error inserting general task:', err);
        showToast(err.message, 'danger');
    }
};

window.openAssignIndividualTaskModal = function() {
    document.getElementById('dept-individual-task-form').reset();
    
    // Auto-select current selected filter user if any
    const userSelect = document.getElementById('dept-user-select');
    const modalUserSelect = document.getElementById('dept-individual-task-user');
    if (userSelect && modalUserSelect && userSelect.value) {
        modalUserSelect.value = userSelect.value;
    }
    
    document.getElementById('dept-individual-task-modal').classList.add('active');
};

window.closeDeptIndividualTaskModal = function() {
    document.getElementById('dept-individual-task-modal').classList.remove('active');
};

window.submitDeptIndividualTask = async function() {
    const userId = document.getElementById('dept-individual-task-user').value;
    const title = document.getElementById('dept-individual-task-title').value.trim();
    const desc = document.getElementById('dept-individual-task-desc').value.trim();
    
    if (!userId || !title || !desc) return;

    const parsedDesc = {
        instructions: desc,
        created_by: currentProfile ? (currentProfile.name || currentUser.email) : 'Admin',
        created_at: new Date().toISOString(),
        comments: []
    };

    try {
        const { data, error } = await supabase
            .from('crm_tasks')
            .insert([{
                title,
                description: JSON.stringify(parsedDesc),
                trigger_type: 'manual',
                target_role: window.activeDeptKey,
                assigned_to: userId,
                completed: false
            }])
            .select();

        if (error) throw error;

        showToast(currentLang === 'ro' ? 'Sarcină individuală atribuită!' : 'Individual task assigned!', 'success');
        window.closeDeptIndividualTaskModal();

        // Refresh local tasks
        if (data && data[0]) {
            window.activeDeptTasks.push(data[0]);
            window.renderDepartmentIndividualTasks();
        } else {
            await window.loadDepartmentWorkspace(window.activeDeptKey);
        }
    } catch (err) {
        console.error('Error inserting individual task:', err);
        showToast(err.message, 'danger');
    }
};

window.openDeptTaskNotesModal = function(taskId) {
    const task = window.activeDeptTasks.find(t => t.id === taskId);
    if (!task) return;

    window.activeDeptTaskNotesId = taskId;

    let parsedDesc = {};
    try {
        parsedDesc = JSON.parse(task.description);
    } catch (e) {
        parsedDesc = { instructions: task.description || '', comments: [] };
    }

    const titleEl = document.getElementById('dept-notes-modal-title');
    const subtitleEl = document.getElementById('dept-notes-modal-subtitle');
    const instructionsEl = document.getElementById('dept-notes-task-instructions');
    const historyContainer = document.getElementById('dept-notes-history-container');
    const commentInput = document.getElementById('dept-task-new-comment');

    if (titleEl) titleEl.textContent = task.title;
    if (subtitleEl) {
        const dateStr = parsedDesc.created_at ? new Date(parsedDesc.created_at).toLocaleString() : 'Nespecificat';
        subtitleEl.textContent = `Creat de ${parsedDesc.created_by || 'Admin'} la ${dateStr}`;
    }
    if (instructionsEl) instructionsEl.textContent = parsedDesc.instructions || 'Fără instrucțiuni.';
    if (commentInput) commentInput.value = '';

    const comments = parsedDesc.comments || [];
    if (historyContainer) {
        if (comments.length === 0) {
            historyContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 0.5rem 0;">Niciun comentariu adăugat.</div>`;
        } else {
            historyContainer.innerHTML = comments.map(c => {
                const dateStr = c.timestamp ? new Date(c.timestamp).toLocaleString() : '';
                return `
                    <div style="background-color: #ffffff; border: 1px solid var(--card-border); padding: 0.6rem; border-radius: var(--border-radius-sm); font-size: 0.82rem; margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">
                            <span>${c.author}</span>
                            <span style="font-weight: normal; color: var(--text-muted); font-size: 0.72rem;">${dateStr}</span>
                        </div>
                        <div style="color: var(--text-secondary); line-height: 1.3; white-space: pre-wrap;">${c.text}</div>
                    </div>
                `;
            }).join('');
            // Scroll to bottom
            setTimeout(() => historyContainer.scrollTop = historyContainer.scrollHeight, 50);
        }
    }

    document.getElementById('dept-task-notes-modal').classList.add('active');
};

window.closeDeptTaskNotesModal = function() {
    document.getElementById('dept-task-notes-modal').classList.remove('active');
    window.activeDeptTaskNotesId = '';
};

window.submitDeptTaskComment = async function() {
    const commentInput = document.getElementById('dept-task-new-comment');
    const commentText = commentInput ? commentInput.value.trim() : '';
    if (!commentText || !window.activeDeptTaskNotesId) return;

    const task = window.activeDeptTasks.find(t => t.id === window.activeDeptTaskNotesId);
    if (!task) return;

    let parsedDesc = {};
    try {
        parsedDesc = JSON.parse(task.description);
    } catch (e) {
        parsedDesc = { instructions: task.description || '', comments: [] };
    }

    if (!parsedDesc.comments) parsedDesc.comments = [];
    
    parsedDesc.comments.push({
        author: currentProfile ? (currentProfile.name || currentUser.email) : 'Utilizator',
        text: commentText,
        timestamp: new Date().toISOString()
    });

    try {
        const { error } = await supabase
            .from('crm_tasks')
            .update({ description: JSON.stringify(parsedDesc) })
            .eq('id', task.id);

        if (error) throw error;

        task.description = JSON.stringify(parsedDesc);
        showToast(currentLang === 'ro' ? 'Comentariu adăugat!' : 'Comment added!', 'success');
        
        // Refresh notes modal list
        window.openDeptTaskNotesModal(task.id);
        
        // Refresh tables to update comments count
        window.renderDepartmentIndividualTasks();
    } catch (err) {
        console.error('Error adding comment:', err);
        showToast(err.message, 'danger');
    }
};

window.toggleDeptTaskState = async function(taskId, completed) {
    const task = window.activeDeptTasks.find(t => t.id === taskId);
    if (!task) return;

    try {
        const { error } = await supabase
            .from('crm_tasks')
            .update({ completed })
            .eq('id', taskId);

        if (error) throw error;

        task.completed = completed;
        showToast(currentLang === 'ro' ? 'Stare actualizată!' : 'Status updated!', 'success');
        
        // Re-render
        if (task.trigger_type === 'general') {
            window.renderDepartmentGeneralTasks();
        } else {
            window.renderDepartmentIndividualTasks();
        }
    } catch (err) {
        console.error('Error toggling task completion:', err);
        showToast(err.message, 'danger');
    }
};

window.deleteDeptTask = async function(taskId) {
    const confirmMsg = currentLang === 'ro' 
        ? 'Sigur doriți să ștergeți această sarcină/obiectiv definitiv?' 
        : 'Are you sure you want to delete this task/objective permanently?';
        
    if (!confirm(confirmMsg)) return;

    try {
        const { error } = await supabase
            .from('crm_tasks')
            .delete()
            .eq('id', taskId);

        if (error) throw error;

        showToast(currentLang === 'ro' ? 'Sarcină ștearsă!' : 'Task deleted!', 'success');
        
        // Remove locally
        window.activeDeptTasks = window.activeDeptTasks.filter(t => t.id !== taskId);
        
        // Re-render both since we don't know trigger_type without checking
        window.renderDepartmentGeneralTasks();
        window.renderDepartmentIndividualTasks();
    } catch (err) {
        console.error('Error deleting task:', err);
        showToast(err.message, 'danger');
    }
};



