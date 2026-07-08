const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/min-height: \$\{heightStr\} !important;/, "min-height: 100% !important;");

fs.writeFileSync(path, content);
console.log("Replaced heightStr");
