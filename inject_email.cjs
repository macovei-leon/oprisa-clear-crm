const fs = require('fs');
let content = fs.readFileSync('backend/email_service.cjs', 'utf8');

// Insert stampPdf function and pdf-lib
content = content.replace(/const path = require\('path'\);/, "const path = require('path');\nconst { PDFDocument, rgb } = require('pdf-lib');");

const stampPdfCode = `
async function stampPdf(attachmentPath, configPath, driver) {
    if (!fs.existsSync(attachmentPath)) return null;
    if (!fs.existsSync(configPath)) {
        return { path: attachmentPath };
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config || config.length === 0) return { path: attachmentPath };

        const pdfBytes = fs.readFileSync(attachmentPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        const { width, height } = firstPage.getSize();

        for (const field of config) {
            let textToDraw = field.tag;
            // Replace placeholders
            textToDraw = textToDraw.replace(/\\[Driver Name\\]/g, driver.name || '');
            textToDraw = textToDraw.replace(/\\[Driver PN\\]/g, driver.pn || '');
            textToDraw = textToDraw.replace(/\\[Phone\\]/g, driver.phone || '');
            textToDraw = textToDraw.replace(/\\[Email\\]/g, driver.email || '');
            textToDraw = textToDraw.replace(/\\[Company\\]/g, (driver.companies || []).join(', ') || '');
            textToDraw = textToDraw.replace(/\\[Contract Type\\]/g, driver.contractType || '');
            textToDraw = textToDraw.replace(/\\[Today's Date\\]/g, new Date().toLocaleDateString('ro-RO'));
            
            const x = (field.x / 100) * width;
            const y = height - ((field.y / 100) * height) - 12; // offset for font height

            firstPage.drawText(textToDraw, {
                x: x,
                y: y,
                size: 12,
                color: rgb(0, 0, 0)
            });
        }

        const modifiedPdfBytes = await pdfDoc.save();
        return { buffer: Buffer.from(modifiedPdfBytes) };
    } catch (err) {
        console.error('Error stamping PDF:', err);
        return { path: attachmentPath };
    }
}
`;

content = content.replace(/let isProcessingQueue = false;/, stampPdfCode + '\n\nlet isProcessingQueue = false;');

// Replace processEmailQueue attachment logic
const oldAttachmentLogic = `                const catSafe = item.category.replace(/[^a-zA-Z0-9]/g, '_');
                const attachmentPath = path.join(__dirname, 'attachments', \`\${catSafe}.pdf\`);
                const attachments = fs.existsSync(attachmentPath) ? [{
                    filename: \`\${catSafe}.pdf\`,
                    path: attachmentPath,
                    contentType: 'application/pdf'
                }] : [];`;

const newAttachmentLogic = `                const catSafe = item.category.replace(/[^a-zA-Z0-9]/g, '_');
                const attachmentPath = path.join(__dirname, 'attachments', \`\${catSafe}.pdf\`);
                const configPath = path.join(__dirname, 'attachments', \`\${catSafe}_config.json\`);
                
                let attachments = [];
                const stamped = await stampPdf(attachmentPath, configPath, driver);
                if (stamped) {
                    if (stamped.buffer) {
                        attachments.push({ filename: \`\${catSafe}.pdf\`, content: stamped.buffer, contentType: 'application/pdf' });
                    } else if (stamped.path) {
                        attachments.push({ filename: \`\${catSafe}.pdf\`, path: stamped.path, contentType: 'application/pdf' });
                    }
                }`;

content = content.replace(oldAttachmentLogic, newAttachmentLogic);

// Replace sendSingleTestEmail attachment logic
const oldTestLogic = `async function sendSingleTestEmail(toEmail, subject, body, category = null) {
    try {
        let attachments = [];
        if (category) {
            const catSafe = category.replace(/[^a-zA-Z0-9]/g, '_');
            const attachmentPath = path.join(__dirname, 'attachments', \`\${catSafe}.pdf\`);
            if (fs.existsSync(attachmentPath)) {
                attachments.push({ filename: \`\${catSafe}.pdf\`, path: attachmentPath, contentType: 'application/pdf' });
            }
        }`;

const newTestLogic = `async function sendSingleTestEmail(toEmail, subject, body, category = null, driver = {}) {
    try {
        let attachments = [];
        if (category) {
            const catSafe = category.replace(/[^a-zA-Z0-9]/g, '_');
            const attachmentPath = path.join(__dirname, 'attachments', \`\${catSafe}.pdf\`);
            const configPath = path.join(__dirname, 'attachments', \`\${catSafe}_config.json\`);
            const stamped = await stampPdf(attachmentPath, configPath, driver || {});
            if (stamped) {
                if (stamped.buffer) {
                    attachments.push({ filename: \`\${catSafe}.pdf\`, content: stamped.buffer, contentType: 'application/pdf' });
                } else if (stamped.path) {
                    attachments.push({ filename: \`\${catSafe}.pdf\`, path: stamped.path, contentType: 'application/pdf' });
                }
            }
        }`;

content = content.replace(oldTestLogic, newTestLogic);

fs.writeFileSync('backend/email_service.cjs', content);
console.log('Done mapping email_service.cjs');
