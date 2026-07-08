const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\.receipt-table td \{\n          padding: \$\{isPurchase \? '6px 8px' : '4px 6px'  vertical-align: middle;\n        \};\n          text-align: center;\n          border: 1px solid #ddd;\n          font-size: \$\{isPurchase \? '14px' : '12px'\};\n          color: #333;\n        \}/, 
`.receipt-table td {
          padding: \${isPurchase ? '6px 8px' : '4px 6px'};
          text-align: center;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: \${isPurchase ? '14px' : '12px'};
          color: #333;
        }`);

fs.writeFileSync(path, content);
console.log('Fixed receipt styles');
