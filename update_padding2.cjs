const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/padding: '0.4cm 1cm 1cm 1cm',/g, "padding: '0.5cm 1cm 1cm 1cm',");
content = content.replace(/padding: '0.3cm 0.6cm 0.6cm 0.6cm',/g, "padding: '0.4cm 0.6cm 0.6cm 0.6cm',");

fs.writeFileSync(path, content);
console.log('Padding updated again');
