const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\.receipt-table th \{[\s\S]*?(?=\.receipt-table td)/;
content = content.replace(regex, 
`.receipt-table th {
          background: #b8860b !important;
          background-color: #b8860b !important;
          color: white !important;
          padding: \${isPurchase ? '12px' : '10px'};
          text-align: center;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: \${isPurchase ? '18px' : '16px'};
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          line-height: 1.2;
        }
        `);

const regex2 = /\.receipt-table td \{[\s\S]*?(?=\.summary-table)/;
content = content.replace(regex2,
`.receipt-table td {
          padding: \${isPurchase ? '8px 12px' : '6px 10px'};
          text-align: right;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: \${isPurchase ? '16px' : '14px'};
          color: #333;
          line-height: 1.2;
        }
        `);

fs.writeFileSync(path, content);
console.log('Fixed receipt styles V6');
