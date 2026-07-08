const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\.receipt-table th \{\n          background: #b8860b !important;\n          background-color: #b8860b !important;\n          color: white !important;\n          padding: \$\{isPurchase \? '8px' : '5px'  vertical-align: middle;\n          text-align: center;\n        \};\n          border: 1px solid #ddd;\n          font-size: \$\{isPurchase \? '14px' : '12px'\};\n          font-weight: bold;\n          -webkit-print-color-adjust: exact;\n          print-color-adjust: exact;\n        \}/, 
`.receipt-table th {
          background: #b8860b !important;
          background-color: #b8860b !important;
          color: white !important;
          padding: \${isPurchase ? '8px' : '5px'};
          text-align: center;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: \${isPurchase ? '14px' : '12px'};
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }`);

fs.writeFileSync(path, content);
console.log('Fixed receipt styles');
