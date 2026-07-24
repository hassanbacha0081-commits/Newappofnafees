import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { html2canvasWithOklch as html2canvas } from '../lib/html2canvas-helper';
import { db } from '../db';
import { translations } from '../translations';

const WHATSAPP_ICON = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22448%22%20height%3D%22512%22%20viewBox%3D%220%200%20448%20512%22%3E%3Cpath%20fill%3D%22%2325D366%22%20d%3D%22M380.9%2097.1C339%2055.1%20283.2%2032%20223.9%2032c-122.4%200-222%2099.6-222%20222%200%2039.1%2010.2%2077.3%2029.6%20111L0%20480l117.7-30.9c32.4%2017.7%2068.9%2027%20106.1%2027h.1c122.3%200%20224.1-99.6%20224.1-222%200-59.3-25.2-115-67.1-157zm-157%20341.6c-33.1%200-65.6-8.9-94-25.7l-6.7-4-69.8%2018.3L72%20359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2%200-101.7%2082.8-184.5%20184.6-184.5%2049.3%200%2095.6%2019.2%20130.4%2054.1%2034.8%2034.9%2056.2%2081.2%2056.1%20130.5%200%20101.8-84.9%20184.6-186.6%20184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5%202.8-3.7%205.6-14.3%2018-17.6%2021.8-3.2%203.7-6.5%204.2-12%201.4-5.5-2.8-23.4-8.6-44.6-27.6-16.5-14.7-27.6-32.8-30.8-38.4-3.2-5.6-.3-8.6%202.5-11.4%202.5-2.5%205.5-6.5%208.3-9.7%202.8-3.2%203.7-5.5%205.6-9.2%201.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7%200-9.7%201.4-14.8%206.9-5.1%205.6-19.4%2019-19.4%2046.3%200%2027.3%2019.9%2053.7%2022.6%2057.4%202.8%203.7%2039.1%2059.7%2094.8%2083.8%2013.3%205.7%2023.7%209.1%2031.7%2011.7%2013.3%204.2%2025.5%203.6%2035.1%202.2%2010.7-1.6%2032.8-13.4%2037.4-26.4%204.6-13%204.6-24.1%203.2-26.4-1.3-2.5-5-3.9-10.5-6.6z%22%20%2F%3E%3C%2Fsvg%3E";

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
  
  const [shopSettings, setShopSettings] = useState({
    name: translations.ur.shopName,
    address: translations.ur.shopAddress,
    phone: translations.ur.shopPhone,
    phone2: translations.ur.shopPhone2
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const name = await db.settings.get('shopName');
      const address = await db.settings.get('shopAddress');
      const phone = await db.settings.get('shopPhone');
      const phone2 = await db.settings.get('shopPhone2');
      
      setShopSettings({
        name: name?.value || translations.ur.shopName,
        address: address?.value || translations.ur.shopAddress,
        phone: phone?.value || translations.ur.shopPhone,
        phone2: phone2?.value || translations.ur.shopPhone2
      });
    };
    fetchSettings();
  }, []);

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
  
  const printStyles = (
    <style>
      {`
        @import url('https://fonts.cdnfonts.com/css/jameel-noori-nastaleeq');
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@400;700&display=swap');
        
        .receipt-border-decor {
          position: absolute !important;
          top: 12px !important;
          bottom: 12px !important;
          left: 12px !important;
          right: 12px !important;
          border: 4px double #b8860b !important;
          outline: 1px solid #b8860b !important;
          outline-offset: -6px !important;
          border-radius: 6px !important;
          pointer-events: none !important;
          z-index: 99 !important;
        }
        .urdu-text {
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
          line-height: 1.6;
        }
        .header-section {
          text-align: center;
          border-bottom: 3px double #b8860b;
          padding-bottom: 10px;
          margin-bottom: 20px;
          padding-top: 20px;
        }
        .shop-name {
          font-size: 74px;
          font-weight: 900;
          color: #b8860b;
          margin: 0;
          margin-bottom: 6px;
          font-family: 'Jameel Noori Nastaleeq', serif !important;
          line-height: 1.2;
        }
        .header-phone {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          width: 100%;
          flex-wrap: wrap;
        }
        .phone-brand-box, .phone-brand-box-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #f0fdf4;
          padding: 6px 12px;
          border-radius: 4px;
          border: 1.2px solid #22c55e;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          line-height: normal;
        }
        .phone-brand-box-secondary {
          background: #fffafa;
          border-color: #b8860b;
        }
        .brand-icon {
          width: 26px;
          height: 26px;
          object-fit: contain;
          display: block;
        }
        .phone-number {
          color: #166534;
          font-weight: 900;
          font-size: 20px;
        }
        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          font-size: 13px;
        }
        .receipt-table th, .receipt-table td {
          border: 1px solid #e4e4e7;
          padding: 8px 6px;
          text-align: center;
        }
        .receipt-table th {
          background-color: #b8860b;
          color: white;
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
          font-size: 14px;
          font-weight: normal;
        }
        .receipt-footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          border-top: 1px dashed #e4e4e7;
          padding-top: 20px;
          margin-top: 30px;
        }
        .footer-brand-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
        }
        .footer-icon {
          width: 14px;
          height: 14px;
        }
      `}
    </style>
  );

  // We need to chunk the data inside sections
  let currentPageIndex = 0;
  sectionsData.sections.forEach((section, sIdx) => {
    let rowIndex = 0;
    while (rowIndex < section.data.length || (rowIndex === 0 && section.data.length === 0)) {
      const pageData = section.data.slice(rowIndex, rowIndex + ROWS_PER_PAGE);
      
      pages.push(
        <div 
          key={`${sIdx}-${currentPageIndex}`} 
          className="pdf-page bg-white p-12 relative"
          style={{ width: A4_WIDTH, height: A4_HEIGHT, boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
          dir="rtl"
        >
          {printStyles}
          <div className="receipt-border-decor" />
          
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <p className="text-xl font-bold m-1 urdu-text">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-lg m-1 urdu-text text-zinc-600">{shopSettings.address}</p>
            
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                <span className="phone-number">{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                  <span className="phone-number" style={{ color: '#b8860b' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            
            <div className="bg-zinc-100 px-4 py-2 mt-4 font-bold rounded-lg text-gold text-xl urdu-text border border-gold/20 inline-block">
              {sectionsData.title}
            </div>
            <div className="text-zinc-600 mt-2 urdu-text text-lg">{section.heading} - صفحہ {currentPageIndex + 1}</div>
          </div>

          <table className="receipt-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {section.columns.map((col, cIdx) => (
                  <th key={cIdx}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length > 0 ? pageData.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="font-mono font-bold text-zinc-800 break-words">{cell}</td>
                  ))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={section.columns.length} className="p-4 text-center text-zinc-400 urdu-text font-bold">کوئی ریکارڈ نہیں ملا (No Data)</td>
                </tr>
              )}
            </tbody>
          </table>
          
          <div className="receipt-footer" style={{ position: 'absolute', bottom: '40px', left: 0, right: 0 }}>
            <div className="footer-brand-box" dir="ltr">
              <img src={WHATSAPP_ICON} className="footer-icon" alt="WhatsApp" />
              <span className="font-mono text-xs text-zinc-600 font-bold">{shopSettings.phone}</span>
            </div>
            <div className="mt-4 text-[14px] text-zinc-400 italic font-sans">
              Software developed by Nafees Jewellers Management System
            </div>
          </div>
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
