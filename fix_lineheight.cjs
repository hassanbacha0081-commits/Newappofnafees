const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/line-height: 1\.2;\s*\}\s*\.receipt-table td \{/g, "line-height: 1.6;\n        }\n        .receipt-table td {");
content = content.replace(/color: #333;\s*line-height: 1\.2;\s*\}/g, "color: #333;\n          line-height: 1.6;\n        }");

fs.writeFileSync(path, content);
console.log("Replaced line height");
