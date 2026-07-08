const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update .header-section to have padding-top
content = content.replace(/\.header-section \{\n          text-align: center;\n          border-bottom: 3px double #b8860b;\n          padding-bottom: \$\{isPurchase \? '10px' : '6px'\};\n          margin-bottom: \$\{isPurchase \? '20px' : '10px'\};\n        \}/, 
`.header-section {
          text-align: center;
          border-bottom: 3px double #b8860b;
          padding-bottom: \${isPurchase ? '10px' : '6px'};
          margin-bottom: \${isPurchase ? '20px' : '10px'};
          padding-top: 35px;
        }`);

// 2. Update .shop-name (30% increase in size)
content = content.replace(/\.shop-name \{\n          font-size: \$\{isPurchase \? '70px' : '57px'\};\n          font-weight: 900;\n          color: #b8860b;\n          margin: 0;\n          margin-bottom: \$\{isPurchase \? '12px' : '6px'\};\n          font-family: 'Jameel Noori Nastaleeq', serif !important;\n          line-height: 1;\n        \}/, 
`.shop-name {
          font-size: \${isPurchase ? '91px' : '74px'};
          font-weight: 900;
          color: #b8860b;
          margin: 0;
          margin-bottom: \${isPurchase ? '12px' : '6px'};
          font-family: 'Jameel Noori Nastaleeq', serif !important;
          line-height: 1.2;
        }`);

// 3. Update .receipt-table th and td for better vertical centering
content = content.replace(/\.receipt-table th \{[\s\S]*?\}/, 
`.receipt-table th {
          background: #b8860b !important;
          background-color: #b8860b !important;
          color: white !important;
          padding: \${isPurchase ? '12px 8px 4px 8px' : '10px 5px 2px 5px'};
          text-align: center;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: \${isPurchase ? '14px' : '12px'};
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          line-height: 1.2;
        }`);

content = content.replace(/\.receipt-table td \{[\s\S]*?\}/, 
`.receipt-table td {
          padding: \${isPurchase ? '8px 8px 2px 8px' : '6px 6px 1px 6px'};
          text-align: center;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: \${isPurchase ? '14px' : '12px'};
          color: #333;
          line-height: 1.2;
        }`);

fs.writeFileSync(path, content);
console.log('Fixed receipt styles V4');
