const fs = require('fs');
const path = './src/components/PrintReceipt.tsx';
let content = fs.readFileSync(path, 'utf8');

// Increase terms in repair receipt
content = content.replace(/text-\[12px\] font-nastaliq text-zinc-600/g, "text-[16px] font-nastaliq text-zinc-600");

// Increase terms in purchase receipt
content = content.replace(/text-\[14px\] leading-relaxed/g, "text-[16px] leading-relaxed");
content = content.replace(/text-\[13px\] leading-tight/g, "text-[14px] leading-tight");

fs.writeFileSync(path, content);
console.log('Fixed terms');
