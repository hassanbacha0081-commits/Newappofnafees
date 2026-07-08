const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/width: '14\.8cm',/g, "width: '100%',");
content = content.replace(/width: '21cm',/g, "width: '100%',");
content = content.replace(/minHeight: '21cm',/g, "minHeight: '100%',");
content = content.replace(/minHeight: '29\.7cm',/g, "minHeight: '100%',");

fs.writeFileSync(path, content);
console.log("Replaced inline sizes");
