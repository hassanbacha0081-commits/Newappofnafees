const fs = require('fs');
const glob = require('glob'); // Not available? I'll just use fs.readdirSync

const files = fs.readdirSync('./src/components').filter(f => f.endsWith('.tsx'));
files.forEach(file => {
  const path = `./src/components/${file}`;
  let content = fs.readFileSync(path, 'utf8');

  // Fix 1: Handle null return from generatePDF in the setTimeout callbacks
  // Pattern:
  // const url = await generatePDF(...);
  // setPdfUrl(url);
  // We want to replace it with:
  // const url = await generatePDF(...);
  // if (url) { setPdfUrl(url); } else { setShowPrintPreview(false); alert('PDF generation failed.'); }
  
  content = content.replace(/const url = await generatePDF([^;]+);\s*setPdfUrl\(url\);/g, 
    "const url = await generatePDF$1;\n                      if (url) {\n                        setPdfUrl(url);\n                      } else {\n                        setShowPrintPreview(false);\n                        alert('PDF generation failed. Please try again or check the image format.');\n                      }");
  
  fs.writeFileSync(path, content);
});
console.log('Fixed PDF generation error handling in all files');
