const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

// The replacement is a bit tricky since we just have "width: '100%'" and "minHeight: '100vh'" in several places.
// We can find the component blocks.
content = content.replace(/width: '100%',\s*minHeight: '100vh',/g, "width: isPurchase ? '21cm' : '14.8cm',\n        minHeight: isPurchase ? '29.7cm' : '21cm',");

fs.writeFileSync(path, content);
console.log("Restored preview sizes");
