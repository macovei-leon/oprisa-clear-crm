const fs = require('fs');
let content = fs.readFileSync('public/driver-dashboard/admin.html', 'utf8');

content = content.replace(
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>'
);

content = content.replace(
    /<button onclick="deletePdf\(\)" class="btn btn-danger py-1\.5 px-3 text-sm"><i class="fa-solid fa-trash"><\/i><\/button>/,
    `<button onclick="deletePdf()" class="btn btn-danger py-1.5 px-3 text-sm"><i class="fa-solid fa-trash"></i></button>
                            <button id="edit-pdf-btn" onclick="openPdfEditor()" class="btn btn-info py-1.5 px-3 text-sm hidden" style="background-color: #3b82f6; color: white;" title="Edit PDF Layout"><i class="fa-solid fa-pen-to-square"></i> Edit Layout</button>`
);

content = content.replace(
    /status\.innerHTML = data\.exists \? '<span class="text-emerald-600 font-bold"><i class="fa-solid fa-check mr-1"><\/i> Attached<\/span>' : 'No PDF attached';/,
    `status.innerHTML = data.exists ? '<span class="text-emerald-600 font-bold"><i class="fa-solid fa-check mr-1"></i> Attached</span>' : 'No PDF attached';
                if (data.exists) {
                    document.getElementById('edit-pdf-btn').classList.remove('hidden');
                } else {
                    document.getElementById('edit-pdf-btn').classList.add('hidden');
                }`
);

content = content.replace(
    /status\.textContent = 'Error checking PDF';/,
    `status.textContent = 'Error checking PDF';
            document.getElementById('edit-pdf-btn').classList.add('hidden');`
);

const editorHTML = `
<!-- PDF Editor Modal -->
<div id="pdf-editor-modal" class="fixed inset-0 bg-slate-900/80 z-[100] hidden flex flex-col">
    <div class="flex items-center justify-between p-4 bg-slate-800 text-white">
        <h2 class="text-xl font-bold"><i class="fa-solid fa-pen-to-square mr-2"></i> PDF Template Layout</h2>
        <div class="flex gap-3">
            <button onclick="closePdfEditor()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors">Cancel</button>
            <button onclick="savePdfLayout()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"><i class="fa-solid fa-save mr-2"></i> Save Layout</button>
        </div>
    </div>
    <div class="flex-1 flex overflow-hidden">
        <div class="w-64 bg-slate-100 p-4 border-r border-slate-300 flex flex-col gap-3 shrink-0">
            <p class="text-sm font-bold text-slate-700 mb-2">Available Fields</p>
            <p class="text-xs text-slate-500 mb-4">Click a field below to add it to the PDF, then drag to position.</p>
            <div id="pdf-fields-list" class="flex flex-col gap-2">
                <button onclick="addPdfField('[Driver Name]')" class="p-2 bg-white border border-slate-300 rounded text-sm text-left hover:border-blue-500 transition-colors shadow-sm"><i class="fa-solid fa-user text-slate-400 w-5"></i> [Driver Name]</button>
                <button onclick="addPdfField('[Driver PN]')" class="p-2 bg-white border border-slate-300 rounded text-sm text-left hover:border-blue-500 transition-colors shadow-sm"><i class="fa-solid fa-id-card text-slate-400 w-5"></i> [Driver PN]</button>
                <button onclick="addPdfField('[Phone]')" class="p-2 bg-white border border-slate-300 rounded text-sm text-left hover:border-blue-500 transition-colors shadow-sm"><i class="fa-solid fa-phone text-slate-400 w-5"></i> [Phone]</button>
                <button onclick="addPdfField('[Email]')" class="p-2 bg-white border border-slate-300 rounded text-sm text-left hover:border-blue-500 transition-colors shadow-sm"><i class="fa-solid fa-envelope text-slate-400 w-5"></i> [Email]</button>
                <button onclick="addPdfField('[Company]')" class="p-2 bg-white border border-slate-300 rounded text-sm text-left hover:border-blue-500 transition-colors shadow-sm"><i class="fa-solid fa-building text-slate-400 w-5"></i> [Company]</button>
                <button onclick="addPdfField('[Contract Type]')" class="p-2 bg-white border border-slate-300 rounded text-sm text-left hover:border-blue-500 transition-colors shadow-sm"><i class="fa-solid fa-file-contract text-slate-400 w-5"></i> [Contract Type]</button>
                <button onclick="addPdfField('[Today\\'s Date]')" class="p-2 bg-white border border-slate-300 rounded text-sm text-left hover:border-blue-500 transition-colors shadow-sm"><i class="fa-solid fa-calendar-day text-slate-400 w-5"></i> [Today's Date]</button>
            </div>
            <button onclick="clearPdfFields()" class="mt-auto px-4 py-2 bg-slate-200 hover:bg-red-100 hover:text-red-600 rounded text-sm font-medium transition-colors border border-slate-300">Clear All Fields</button>
        </div>
        <div class="flex-1 bg-slate-300 overflow-auto relative p-8 flex justify-center items-start" id="pdf-scroll-container">
            <div id="pdf-canvas-container" class="relative shadow-2xl bg-white select-none">
                <canvas id="pdf-canvas"></canvas>
                <div id="pdf-overlays" class="absolute inset-0 overflow-hidden pointer-events-none"></div>
            </div>
        </div>
    </div>
</div>

<script>
    let pdfDoc = null;
    let pdfPage = null;
    let currentFields = [];

    async function openPdfEditor() {
        const category = document.getElementById('template-category').value;
        const modal = document.getElementById('pdf-editor-modal');
        modal.classList.remove('hidden');
        
        const resConfig = await fetch('/api/admin/email-templates/' + encodeURIComponent(category) + '/pdf-config');
        if (resConfig.ok) {
            const data = await resConfig.json();
            currentFields = data.config || [];
        } else {
            currentFields = [];
        }
        
        const url = '/api/admin/email-templates/' + encodeURIComponent(category) + '/attachment';
        const loadingTask = pdfjsLib.getDocument(url);
        try {
            pdfDoc = await loadingTask.promise;
            pdfPage = await pdfDoc.getPage(1);
            renderPdfPage();
        } catch (err) {
            alert("Error loading PDF preview. Make sure PDF is valid.");
            closePdfEditor();
        }
    }

    function closePdfEditor() {
        document.getElementById('pdf-editor-modal').classList.add('hidden');
    }

    function renderPdfPage() {
        const scale = 1.5;
        const viewport = pdfPage.getViewport({ scale: scale });
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = { canvasContext: ctx, viewport: viewport };
        pdfPage.render(renderContext);
        
        renderOverlays();
    }

    function renderOverlays() {
        const container = document.getElementById('pdf-overlays');
        container.innerHTML = '';
        
        currentFields.forEach((field, index) => {
            const el = document.createElement('div');
            el.className = 'absolute bg-blue-500/20 border-2 border-blue-600 text-blue-900 font-bold px-2 py-1 cursor-move select-none whitespace-nowrap text-sm pointer-events-auto rounded shadow-sm flex items-center gap-2';
            el.innerHTML = '<span>' + field.tag + '</span>';
            
            el.style.left = field.x + '%';
            el.style.top = field.y + '%';
            
            const delBtn = document.createElement('span');
            delBtn.innerHTML = '&times;';
            delBtn.className = 'text-red-600 cursor-pointer hover:text-red-800 bg-white rounded-full w-4 h-4 flex items-center justify-center text-xs';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                currentFields.splice(index, 1);
                renderOverlays();
            };
            el.appendChild(delBtn);
            
            let isDragging = false;
            let startX, startY;
            
            el.onmousedown = (e) => {
                if(e.target === delBtn) return;
                isDragging = true;
                startX = e.clientX - el.offsetLeft;
                startY = e.clientY - el.offsetTop;
            };
            
            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                let nx = e.clientX - startX;
                let ny = e.clientY - startY;
                
                const pWidth = container.clientWidth;
                const pHeight = container.clientHeight;
                
                nx = Math.max(0, Math.min(nx, pWidth - el.offsetWidth));
                ny = Math.max(0, Math.min(ny, pHeight - el.offsetHeight));
                
                field.x = (nx / pWidth) * 100;
                field.y = (ny / pHeight) * 100;
                
                el.style.left = field.x + '%';
                el.style.top = field.y + '%';
            });
            
            window.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            container.appendChild(el);
        });
    }

    function addPdfField(tag) {
        currentFields.push({ tag: tag, x: 5, y: 5 });
        renderOverlays();
    }

    function clearPdfFields() {
        if(confirm('Are you sure you want to clear all fields?')) {
            currentFields = [];
            renderOverlays();
        }
    }

    async function savePdfLayout() {
        const category = document.getElementById('template-category').value;
        const res = await fetch('/api/admin/email-templates/' + encodeURIComponent(category) + '/pdf-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: currentFields })
        });
        if (res.ok) {
            alert('PDF Layout saved!');
            closePdfEditor();
        } else {
            alert('Failed to save layout.');
        }
    }
</script>
</body>
`;

content = content.replace(/<\/body>/, editorHTML);

fs.writeFileSync('public/driver-dashboard/admin.html', content);
console.log('Done!');
