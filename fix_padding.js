const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/padding: '3px'/g, "padding: '6px'");
content = content.replace(/padding: '4px'/g, "padding: '8px'");
content = content.replace(/padding: '5px'/g, "padding: '10px'");
content = content.replace(/padding: '5px 10px'/g, "padding: '10px 10px'");

fs.writeFileSync(path, content);
console.log("Replaced inline padding");
