import React, { forwardRef, useImperativeHandle, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportRef {
  generatePDF: (sections: PdfSection[], filename: string, title: string) => Promise<void>;
}

export interface PdfSection {
  heading: string;
  columns: string[];
  data: any[][]; // array of rows
}

const PdfExportHidden = forwardRef<PdfExportRef, {}>((props, ref) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [sectionsData, setSectionsData] = useState<{ sections: PdfSection[], title: string } | null>(null);

  useImperativeHandle(ref, () => ({
    generatePDF: async (sections, filename, title) => {
      setSectionsData({ sections, title });
      setIsGenerating(true);
      
      // Wait for React to render the hidden elements (using a slightly longer delay for large data)
      await new Promise(r => setTimeout(r, 600));

      try {
        const container = document.getElementById('pdf-export-container');
        if (!container) throw new Error("Container not found");
        
        const pageElements = container.querySelectorAll('.pdf-page');
        if (pageElements.length === 0) throw new Error("No pages generated");

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'cm',
          format: 'a4'
        });
        const pdfWidth = 21.0;
        const pdfPageHeight = 29.7;

        for (let i = 0; i < pageElements.length; i++) {
          const pageEl = pageElements[i] as HTMLElement;
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            logging: true,
            backgroundColor: '#ffffff',
            windowWidth: 800,
            windowHeight: 1130
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.85);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);
        }
        
        pdf.save(filename);
      } catch (err) {
        console.error("PDF Export Error:", err);
      } finally {
        setIsGenerating(false);
        setSectionsData(null);
      }
    }
  }));

  if (!isGenerating || !sectionsData) return null;

  // Render the sections into pages
  const A4_WIDTH = '800px';
  const A4_HEIGHT = '1130px';
  const ROWS_PER_PAGE = 25; // Approximate rows per page

  const pages: React.ReactNode[] = [];
  
  // We need to chunk the data inside sections
  let currentPageIndex = 0;

  sectionsData.sections.forEach((section, sIdx) => {
    let rowIndex = 0;
    while (rowIndex < section.data.length || (rowIndex === 0 && section.data.length === 0)) {
      const pageData = section.data.slice(rowIndex, rowIndex + ROWS_PER_PAGE);
      
      pages.push(
        <div 
          key={`${sIdx}-${currentPageIndex}`} 
          className="pdf-page bg-white p-8 relative border-[6px] double border-gold rounded-lg mb-6"
          style={{ width: A4_WIDTH, height: A4_HEIGHT, boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
          dir="rtl"
        >
          {/* Header */}
          <div className="text-center border-b border-gold pb-4 mb-4">
            <h1 className="text-3xl font-black text-gold-dark urdu-text mb-1">{sectionsData.title}</h1>
            <h2 className="text-xl font-bold text-sky-900 urdu-text">{section.heading}</h2>
            <p className="text-xs text-zinc-500 font-bold mt-1">Page {currentPageIndex + 1}</p>
          </div>

          <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gold text-white">
                {section.columns.map((col, cIdx) => (
                  <th key={cIdx} className="border border-gold p-2 urdu-text font-bold text-center text-xs">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length > 0 ? pageData.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-zinc-200">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-zinc-200 p-2 text-center text-xs font-mono font-bold text-zinc-800 break-words">{cell}</td>
                  ))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={section.columns.length} className="p-4 text-center text-zinc-400 urdu-text font-bold">کوئی ریکارڈ نہیں ملا (No Data)</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
      
      rowIndex += ROWS_PER_PAGE;
      currentPageIndex++;
    }
  });

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, zIndex: -9999, pointerEvents: 'none', width: '800px', height: 'auto', opacity: 0.01 }} id="pdf-export-container">
      {pages}
    </div>
  );
});

PdfExportHidden.displayName = 'PdfExportHidden';
export default PdfExportHidden;
