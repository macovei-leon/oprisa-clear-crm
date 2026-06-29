const fs = require('fs');

let html = fs.readFileSync('public/driver-dashboard/admin.html', 'utf8');
const searchString = `<label class="custom-checkbox flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="email-category" value="Absent" class="hidden" checked>
                                <div class="w-5 h-5 rounded border border-slate-300 flex items-center justify-center bg-white transition-colors">
                                    <svg class="hidden w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <span class="text-sm font-medium text-slate-700">Absent</span>
                            </label>`;

if (html.includes(searchString)) {
    const replaceString = searchString + `
                            <label class="custom-checkbox flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="email-category" value="Test" class="hidden" checked>
                                <div class="w-5 h-5 rounded border border-slate-300 flex items-center justify-center bg-white transition-colors">
                                    <svg class="hidden w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <span class="text-sm font-medium text-slate-700">Test</span>
                            </label>`;

    html = html.replace(searchString, replaceString);
    fs.writeFileSync('public/driver-dashboard/admin.html', html);
    console.log('Patched HTML');
} else {
    console.log('Search string not found. Trying regex or fallback...');
    // fallback, just find Absent value and append Test
    const regex = /<input type="checkbox" name="email-category" value="Absent" class="hidden" checked>[\s\S]*?<\/label>/;
    const match = html.match(regex);
    if(match) {
        html = html.replace(regex, match[0] + `
                            <label class="custom-checkbox flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="email-category" value="Test" class="hidden" checked>
                                <div class="w-5 h-5 rounded border border-slate-300 flex items-center justify-center bg-white transition-colors">
                                    <svg class="hidden w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <span class="text-sm font-medium text-slate-700">Test</span>
                            </label>`);
        fs.writeFileSync('public/driver-dashboard/admin.html', html);
        console.log('Patched HTML via regex');
    }
}
