const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/width: \$\{widthStr\} !important;/, "width: 100% !important;");

fs.writeFileSync(path, content);
console.log("Replaced widthStr");
