const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/minHeight: '100%',/g, "minHeight: '100vh',");
content = content.replace(/min-height: 100% !important;/g, "min-height: 100vh !important;");

fs.writeFileSync(path, content);
console.log("Replaced minHeight with 100vh");
