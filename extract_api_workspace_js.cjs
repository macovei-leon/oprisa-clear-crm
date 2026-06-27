const fs = require('fs');

const jsContent = fs.readFileSync('c:/Users/user/Desktop/temp-clone/oprisa-ultimate-crm/frontend/app.js', 'utf8');

const startMarker = '// API DEVELOPER WORKSPACE';
const startIndex = jsContent.indexOf(startMarker);

let apiWorkspaceJs = jsContent.substring(startIndex - 60);

// We should wrap the JS in an IIFE or similar to avoid global scope pollution, or just leave it as is if it relies on global scope.
// Looking at how it was written, it seems to attach everything to `window`.

// Wait, the API Workspace relies on fetch to 'http://localhost:8082'. We should replace it with port 3050 (new backend).
// Let's replace '8082' with '3050'.
apiWorkspaceJs = apiWorkspaceJs.replace(/8082/g, '3050');

// One issue: The old app fetched `/api/proxy/status`. Wait, I need to make sure we don't accidentally remove anything it needs.
// Let's write the JS to `public/api-workspace/app.js`
fs.writeFileSync('c:/Users/user/Desktop/oprisa-clear-crm/public/api-workspace/app.js', apiWorkspaceJs);
console.log('Successfully extracted app.js');
