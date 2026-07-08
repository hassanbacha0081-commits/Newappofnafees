const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update .shop-name
content = content.replace(/font-size: \$\{isPurchase \? '54px' : '44px'\};/g, "font-size: ${isPurchase ? '70px' : '57px'};");

// 2. Update .receipt-table th and .receipt-table td
content = content.replace(/\.receipt-table th \{([\s\S]*?)\}/g, (match, p1) => {
  if (!p1.includes('vertical-align: middle')) {
    return `.receipt-table th {${p1}  vertical-align: middle;\n          text-align: center;\n        }`;
  }
  return match;
});

content = content.replace(/\.receipt-table td \{([\s\S]*?)\}/g, (match, p1) => {
  if (!p1.includes('vertical-align: middle')) {
    return `.receipt-table td {${p1}  vertical-align: middle;\n        }`;
  }
  return match;
});

fs.writeFileSync(path, content);
console.log('Fixed receipt styles');
