const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Increase padding-top of .header-section
content = content.replace(/padding-top: 35px;/g, "padding-top: 65px;");

// 2. Align table th and td to the right
content = content.replace(/\.receipt-table th \{\n[\s\S]*?\}/, 
`.receipt-table th {
          background: #b8860b !important;
          background-color: #b8860b !important;
          color: white !important;
          padding: \${isPurchase ? '12px 12px 4px 12px' : '10px 10px 2px 10px'};
          text-align: right;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: \${isPurchase ? '14px' : '12px'};
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          line-height: 1.2;
        }`);

content = content.replace(/\.receipt-table td \{\n[\s\S]*?\}/, 
`.receipt-table td {
          padding: \${isPurchase ? '8px 12px 2px 12px' : '6px 10px 1px 10px'};
          text-align: right;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: \${isPurchase ? '14px' : '12px'};
          color: #333;
          line-height: 1.2;
        }`);

fs.writeFileSync(path, content);
console.log('Fixed receipt styles V5');
