const fs = require('fs');

const html = fs.readFileSync('C:/Users/user/Desktop/oprisa ultimate crm/frontend/index.html', 'utf8');

const startMarker = '<div class="tab-view" id="view-fleetcap">';
const startIndex = html.indexOf(startMarker);

if (startIndex === -1) {
    console.error("Start marker not found");
    process.exit(1);
}

// Find the end of view-fleetcap div
let openDivs = 0;
let endIndex = -1;
let i = startIndex;

while (i < html.length) {
    if (html.substring(i, i + 4) === '<div') {
        openDivs++;
        i += 4;
    } else if (html.substring(i, i + 6) === '</div>') {
        openDivs--;
        if (openDivs === 0) {
            endIndex = i + 6;
            break;
        }
        i += 6;
    } else {
        i++;
    }
}

if (endIndex === -1) {
    console.error("End of div not found");
    process.exit(1);
}

const fleetCapHtml = html.substring(startIndex, endIndex);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FleetCap</title>
    <!-- Use local font awesome and fonts from parent if possible, but keep it isolated -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <!-- Local CSS -->
    <link rel="stylesheet" href="./fleetcap.css">
    <!-- SheetJS for Data Import -->
    <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: transparent;
        font-family: 'Outfit', sans-serif;
      }
      #view-fleetcap {
        display: block !important;
        position: relative;
        height: 100vh;
        overflow-y: auto;
      }
    </style>
</head>
<body>
    ${fleetCapHtml}
    
    <!-- Supabase JS Client for Data Sync -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <!-- Local JS -->
    <script src="./fleetcap.js"></script>
    <script>
      // Make sure switchTab works initially
      if (typeof switchTab === 'function') {
        switchTab('forecast');
      }
    </script>
</body>
</html>`;

fs.writeFileSync('C:/Users/user/Desktop/oprisa-clear-crm/public/fleetcap/index.html', fullHtml);
console.log("Extraction complete!");
