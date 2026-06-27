const fs = require('fs');

const htmlContent = fs.readFileSync('c:/Users/user/Desktop/temp-clone/oprisa-ultimate-crm/frontend/index.html', 'utf8');

// The section starts with `<div class="tab-view" id="view-api-tester">`
// Since it's the last view, we can just split at that point, or use regex.
const startMarker = '<div class="tab-view" id="view-api-tester">';
const startIndex = htmlContent.indexOf(startMarker);

// Find the end of this div. We can just take everything from startIndex up to `<div id="context-menu"` or something similar at the end of the file.
let apiWorkspaceHtml = htmlContent.substring(startIndex);

// The view-api-tester ends before `</main>`
const endMarker = '</main>';
const endIndex = apiWorkspaceHtml.indexOf(endMarker);
if (endIndex !== -1) {
    apiWorkspaceHtml = apiWorkspaceHtml.substring(0, endIndex);
}

// Remove the `display: none` from tab-view if any
apiWorkspaceHtml = apiWorkspaceHtml.replace('class="tab-view" id="view-api-tester"', 'id="view-api-tester" style="padding: 2rem; background: var(--bg-main); min-height: 100vh;"');

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Developer Workspace</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="./style.css">
</head>
<body>
    ${apiWorkspaceHtml}
    <script src="./app.js"></script>
</body>
</html>`;

fs.writeFileSync('c:/Users/user/Desktop/oprisa-clear-crm/public/api-workspace/index.html', fullHtml);
console.log('Successfully extracted index.html');
