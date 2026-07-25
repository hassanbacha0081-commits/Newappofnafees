import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { html2canvasWithOklch as html2canvas } from '../lib/html2canvas-helper';
import { db } from '../db';
import { translations } from '../translations';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileText, X } from 'lucide-react';

const WHATSAPP_ICON = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22448%22%20height%3D%22512%22%20viewBox%3D%220%200%20448%20512%22%3E%3Cpath%20fill%3D%22%2325D366%22%20d%3D%22M380.9%2097.1C339%2055.1%20283.2%2032%20223.9%2032c-122.4%200-222%2099.6-222%20222%200%2039.1%2010.2%2077.3%2029.6%20111L0%20480l117.7-30.9c32.4%2017.7%2068.9%2027%20106.1%2027h.1c122.3%200%20224.1-99.6%20224.1-222%200-59.3-25.2-115-67.1-157zm-157%20341.6c-33.1%200-65.6-8.9-94-25.7l-6.7-4-69.8%2018.3L72%20359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2%200-101.7%2082.8-184.5%20184.6-184.5%2049.3%200%2095.6%2019.2%20130.4%2054.1%2034.8%2034.9%2056.2%2081.2%2056.1%20130.5%200%20101.8-84.9%20184.6-186.6%20184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5%202.8-3.7%205.6-14.3%2018-17.6%2021.8-3.2%203.7-6.5%204.2-12%201.4-5.5-2.8-23.4-8.6-44.6-27.6-16.5-14.7-27.6-32.8-30.8-38.4-3.2-5.6-.3-8.6%202.5-11.4%202.5-2.5%205.5-6.5%208.3-9.7%202.8-3.2%203.7-5.5%205.6-9.2%201.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7%200-9.7%201.4-14.8%206.9-5.1%205.6-19.4%2019-19.4%2046.3%200%2027.3%2019.9%2053.7%2022.6%2057.4%202.8%203.7%2039.1%2059.7%2094.8%2083.8%2013.3%205.7%2023.7%209.1%2031.7%2011.7%2013.3%204.2%2025.5%203.6%2035.1%202.2%2010.7-1.6%2032.8-13.4%2037.4-26.4%204.6-13%204.6-24.1%203.2-26.4-1.3-2.5-5-3.9-10.5-6.6z%22%20%2F%3E%3C%2Fsvg%3E";

import { Language } from '../translations';

export interface PdfExportRef {
  generatePDF: (sections: PdfSection[], filename: string, title: string) => Promise<void>;
}

export interface PdfSection {
  heading: string;
  columns: string[];
  data: any[][]; // array of rows
}

interface PdfExportHiddenProps {
  lang?: Language;
}

const PdfExportHidden = forwardRef<PdfExportRef, PdfExportHiddenProps>((props, ref) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [sectionsData, setSectionsData] = useState<{ sections: PdfSection[], title: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState({ ur: '', en: '' });
  const [appLang, setAppLang] = useState<Language>(props.lang || 'ur');
  const [isCancelling, setIsCancelling] = useState(false);
  const cancelledRef = React.useRef(false);

  const handleCancel = () => {
    cancelledRef.current = true;
    setIsCancelling(true);
    setProgressStatus({
      ur: 'ایکسپورٹ منسوخ کی جا رہی ہے...',
      en: 'Cancelling export...'
    });
  };

  useEffect(() => {
    if (props.lang) {
      setAppLang(props.lang);
    }
  }, [props.lang]);
  
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
      const langSetting = await db.settings.get('appLanguage');
      
      const currentLang: Language = props.lang || (langSetting?.value as Language) || (localStorage.getItem('app_language') as Language) || 'ur';
      setAppLang(currentLang);

      const t = translations[currentLang] || translations.ur;
      
      setShopSettings({
        name: name?.value || t.shopName,
        address: address?.value || t.shopAddress,
        phone: phone?.value || t.shopPhone,
        phone2: phone2?.value || t.shopPhone2
      });
    };
    fetchSettings();
  }, [props.lang]);

  useImperativeHandle(ref, () => ({
    generatePDF: async (sections, filename, title) => {
      cancelledRef.current = false;
      setIsCancelling(false);
      setSectionsData({ sections, title });
      setIsGenerating(true);
      setProgress(5);
      setProgressStatus({
        ur: 'ڈیٹا کا معائنہ کیا جا رہا ہے...',
        en: 'Inspecting data and building pages...'
      });

      // Wait for React to render the hidden DOM elements
      await new Promise(r => setTimeout(r, 600));

      if (cancelledRef.current) {
        setIsGenerating(false);
        setSectionsData(null);
        setProgress(0);
        setIsCancelling(false);
        return;
      }

      try {
        const container = document.getElementById('pdf-export-container');
        if (!container) throw new Error("PDF export container element not found");
        
        const pageElements = container.querySelectorAll('.pdf-page');
        if (pageElements.length === 0) throw new Error("No PDF pages generated");

        const totalPages = pageElements.length;
        
        setProgress(15);
        setProgressStatus({
          ur: `کل ${totalPages} صفحات کی پروسیسنگ شروع ہو رہی ہے...`,
          en: `Starting processing for ${totalPages} pages...`
        });

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'cm',
          format: 'a4'
        });

        const pdfWidth = 21.0;
        const pdfPageHeight = 29.7;

        for (let i = 0; i < totalPages; i++) {
          if (cancelledRef.current) {
            throw new Error("EXPORT_CANCELLED");
          }

          const currentPageNum = i + 1;
          const pct = Math.round(15 + ((i + 0.5) / totalPages) * 75);
          setProgress(pct);
          setProgressStatus({
            ur: `صفحہ ${currentPageNum} از ${totalPages} کی تصویر بنوائی جا رہی ہے...`,
            en: `Rendering page ${currentPageNum} of ${totalPages}...`
          });

          await new Promise(r => setTimeout(r, 50));

          if (cancelledRef.current) {
            throw new Error("EXPORT_CANCELLED");
          }

          const pageEl = pageElements[i] as HTMLElement;
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800,
            windowHeight: 1130
          });

          if (cancelledRef.current) {
            throw new Error("EXPORT_CANCELLED");
          }
          
          const imgData = canvas.toDataURL('image/jpeg', 0.85);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);

          const donePct = Math.round(15 + ((i + 1) / totalPages) * 75);
          setProgress(donePct);
        }
        
        if (cancelledRef.current) {
          throw new Error("EXPORT_CANCELLED");
        }

        setProgress(95);
        setProgressStatus({
          ur: 'پی ڈی ایف فائل تیار کی جا رہی ہے...',
          en: 'Finalizing PDF file download...'
        });

        await new Promise(r => setTimeout(r, 300));

        if (cancelledRef.current) {
          throw new Error("EXPORT_CANCELLED");
        }

        if (Capacitor.isNativePlatform()) {
          const pdfBase64 = pdf.output('datauristring').split(',')[1];
          const savedFile = await Filesystem.writeFile({
            path: filename,
            data: pdfBase64,
            directory: Directory.Cache
          });

          if (cancelledRef.current) {
            throw new Error("EXPORT_CANCELLED");
          }

          await Share.share({
            title: title || 'All Data Export',
            url: savedFile.uri,
            dialogTitle: 'Save or Share PDF'
          });
        } else {
          pdf.save(filename);
        }

        setProgress(100);
        setProgressStatus({
          ur: 'پی ڈی ایف مکمل طور پر تیار ہو چکی ہے!',
          en: 'PDF report generated successfully!'
        });
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        if (err instanceof Error && err.message === "EXPORT_CANCELLED") {
          console.log("PDF Export cancelled by user");
        } else {
          console.error("PDF Export Error:", err);
          alert(translations.ur ? "پی ڈی ایف فائل محفوظ کرنے میں خرابی پیش آئی" : "Error saving PDF file");
          throw err;
        }
      } finally {
        setIsGenerating(false);
        setSectionsData(null);
        setProgress(0);
        setIsCancelling(false);
        cancelledRef.current = false;
      }
    }
  }));

  if (!isGenerating || !sectionsData) return null;

  // Render the sections into pages
  const A4_WIDTH = '800px';
  const A4_HEIGHT = '1130px';

  interface PageDescriptor {
    globalPageNum: number;
    sectionHeading: string;
    sectionPageNum: number;
    sectionTotalPages: number;
    columns: string[];
    pageData: any[][];
    isFirstPageOfSection: boolean;
  }

  const pageDescriptors: PageDescriptor[] = [];

  sectionsData.sections.forEach((section) => {
    const totalRows = section.data.length;
    
    // Determine row capacities based on section type (Sales rows are taller due to multi-line items)
    const isSalesSection = section.heading.includes('سیلز') || section.heading.toLowerCase().includes('sale') || section.columns.includes('آئٹمز');
    const firstPageRows = isSalesSection ? 13 : 17;
    const subsequentPageRows = isSalesSection ? 18 : 24;

    let sectionPages = 1;

    if (totalRows > firstPageRows) {
      sectionPages = 1 + Math.ceil((totalRows - firstPageRows) / subsequentPageRows);
    }

    for (let pageIdx = 0; pageIdx < sectionPages; pageIdx++) {
      const isFirstPage = (pageIdx === 0);
      const startRow = isFirstPage ? 0 : firstPageRows + (pageIdx - 1) * subsequentPageRows;
      const rowCount = isFirstPage ? firstPageRows : subsequentPageRows;
      const pageData = section.data.slice(startRow, startRow + rowCount);

      pageDescriptors.push({
        globalPageNum: pageDescriptors.length + 1,
        sectionHeading: section.heading,
        sectionPageNum: pageIdx + 1,
        sectionTotalPages: sectionPages,
        columns: section.columns,
        pageData: pageData,
        isFirstPageOfSection: isFirstPage,
      });
    }
  });

  const totalGlobalPages = pageDescriptors.length;
  
  const printStyles = (
    <style>
      {`
        @import url('https://fonts.cdnfonts.com/css/jameel-noori-nastaleeq');
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@400;700&display=swap');
        
        .receipt-border-decor {
          position: absolute !important;
          top: 10px !important;
          bottom: 10px !important;
          left: 10px !important;
          right: 10px !important;
          border: 4px double #b8860b !important;
          outline: 1px solid #b8860b !important;
          outline-offset: -5px !important;
          border-radius: 6px !important;
          pointer-events: none !important;
          z-index: 99 !important;
        }
        .urdu-text {
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
          line-height: 1.5;
        }
        .header-section {
          text-align: center;
          border-bottom: 3px double #b8860b;
          padding-bottom: 8px;
          margin-bottom: 12px;
          padding-top: 4px;
        }
        .shop-name {
          font-size: 56px;
          font-weight: 900;
          color: #b8860b;
          margin: 0;
          margin-bottom: 2px;
          font-family: 'Jameel Noori Nastaleeq', serif !important;
          line-height: 1.1;
        }
        .header-phone {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
          width: 100%;
          flex-wrap: wrap;
        }
        .phone-brand-box, .phone-brand-box-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #f0fdf4;
          padding: 3px 8px;
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
          width: 20px;
          height: 20px;
          object-fit: contain;
          display: block;
        }
        .phone-number {
          color: #166534;
          font-weight: 900;
          font-size: 16px;
        }
        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
          margin-bottom: 6px;
          font-size: 12px;
        }
        .receipt-table th, .receipt-table td {
          border: 1px solid #d4d4d8;
          padding: 5px 4px;
          text-align: center;
          vertical-align: middle;
        }
        .receipt-table th {
          background-color: #b8860b;
          color: white;
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
          font-size: 13px;
          font-weight: bold;
        }
        .receipt-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          border-top: 1px dashed #e4e4e7;
          padding-top: 8px;
          margin-top: auto;
        }
        .footer-brand-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          padding: 3px 8px;
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

  const isUrdu = appLang === 'ur';

  const renderedPages = pageDescriptors.map((page, pIdx) => (
    <div 
      key={`page-${pIdx}`} 
      className="pdf-page bg-white p-8 relative flex flex-col justify-between"
      style={{ 
        width: A4_WIDTH, 
        height: A4_HEIGHT, 
        boxSizing: 'border-box', 
        fontFamily: isUrdu ? "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', Inter, sans-serif" : 'Inter, sans-serif',
        overflow: 'hidden'
      }}
      dir={isUrdu ? "rtl" : "ltr"}
    >
      {printStyles}
      <div className="receipt-border-decor" />
      
      <div className="flex-1 flex flex-col justify-start overflow-hidden">
        {page.isFirstPageOfSection ? (
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <p className={`text-base font-bold m-0 ${isUrdu ? 'urdu-text' : ''}`}>
              {isUrdu ? 'ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔' : 'Singapore & Dubai Variety Available Here.'}
            </p>
            <p className={`text-sm m-0 text-zinc-600 ${isUrdu ? 'urdu-text' : ''}`}>{shopSettings.address}</p>
            
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
            
            <div className={`bg-zinc-100 px-4 py-1 mt-2 font-bold rounded-lg text-gold text-base border border-gold/20 inline-block ${isUrdu ? 'urdu-text' : ''}`}>
              {sectionsData.title}
            </div>
            <div className={`text-zinc-700 mt-1 text-sm font-bold ${isUrdu ? 'urdu-text' : ''}`}>
              {page.sectionHeading} {page.sectionTotalPages > 1 ? (isUrdu ? `- (حصہ ${page.sectionPageNum} از ${page.sectionTotalPages})` : `- (Part ${page.sectionPageNum} of ${page.sectionTotalPages})`) : ''}
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center border-b-2 border-gold pb-1.5 mb-3 pt-1">
            <div className={isUrdu ? "text-right" : "text-left"}>
              <h2 className={`text-2xl font-black text-gold m-0 ${isUrdu ? 'urdu-text' : ''}`} style={{ color: '#b8860b' }}>{shopSettings.name}</h2>
              <div className={`text-[11px] text-zinc-500 font-bold ${isUrdu ? 'urdu-text' : ''}`}>{sectionsData.title}</div>
            </div>
            <div className={`bg-amber-50 px-3 py-1 rounded-md border border-amber-200 text-amber-900 font-bold text-xs ${isUrdu ? 'urdu-text' : ''}`}>
              {page.sectionHeading} {page.sectionTotalPages > 1 ? (isUrdu ? `- (حصہ ${page.sectionPageNum} از ${page.sectionTotalPages})` : `- (Part ${page.sectionPageNum} of ${page.sectionTotalPages})`) : ''}
            </div>
          </div>
        )}

        <div className="overflow-hidden flex-1">
          <table className="receipt-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {page.columns.map((col, cIdx) => (
                  <th key={cIdx} className={isUrdu ? 'urdu-text' : ''}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.pageData.length > 0 ? page.pageData.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className={`font-mono font-bold text-zinc-800 break-words ${isUrdu ? 'urdu-text' : ''}`}>{cell}</td>
                  ))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={page.columns.length} className={`p-4 text-center text-zinc-400 font-bold ${isUrdu ? 'urdu-text' : ''}`}>
                    {isUrdu ? 'کوئی ریکارڈ نہیں ملا (No Data)' : 'No records found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="receipt-footer pb-1">
        <div className="flex items-center justify-between w-full px-2 text-[11px] font-bold text-zinc-600 mb-1 border-t border-zinc-200 pt-1">
          <span className={isUrdu ? "urdu-text" : "font-mono"}>
            {isUrdu ? `صفحہ ${page.globalPageNum} از ${totalGlobalPages}` : `Page ${page.globalPageNum} of ${totalGlobalPages}`}
          </span>
          <span className="font-mono text-[10px] text-zinc-500">
            {shopSettings.name}
          </span>
        </div>
        <div className="footer-brand-box" dir="ltr">
          <img src={WHATSAPP_ICON} className="footer-icon" alt="WhatsApp" />
          <span className="font-mono text-[11px] text-zinc-600 font-bold">{shopSettings.phone}</span>
        </div>
        <div className="mt-1 text-[11px] text-zinc-400 italic font-sans text-center">
          Software developed by Nafees Jewellers Management System
        </div>
      </div>
    </div>
  ));

  return (
    <>
      {/* Visual Progress Modal */}
      {isGenerating && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200/80 p-6 max-w-md w-full text-center space-y-4 animate-in fade-in zoom-in-95 duration-200" dir={isUrdu ? "rtl" : "ltr"}>
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-amber-100 border-t-amber-600 animate-spin" />
              <FileText className="text-amber-600 w-7 h-7" />
            </div>

            <div>
              <h3 className={`text-xl font-extrabold text-slate-800 ${isUrdu ? 'urdu-text' : ''}`}>
                {isUrdu ? 'پی ڈی ایف رپورٹ تیار ہو رہی ہے' : 'Generating PDF Report'}
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                {isUrdu ? 'Generating PDF Document' : 'Please wait while pages are rendered'}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 px-1">
                <span className={`text-amber-900 ${isUrdu ? 'urdu-text' : ''}`}>
                  {isUrdu ? progressStatus.ur : progressStatus.en}
                </span>
                <span className="font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-xs">{progress}%</span>
              </div>
              <div className="w-full bg-slate-150 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200 bg-slate-100">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-amber-600 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className={`bg-amber-50/80 rounded-xl p-2.5 border border-amber-200/60 text-[12px] text-amber-900 ${isUrdu ? 'urdu-text' : ''}`}>
              {isUrdu ? 'براہ کرم چند سیکنڈ انتظار فرمائیں، پی ڈی ایف کی کوالٹی اور صفحات کی ترتيب مکمل کی جا رہی ہے۔' : 'Please wait a moment while PDF quality and page layout are being finalized.'}
            </div>

            {/* Cancel Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 font-bold py-2.5 px-4 rounded-xl border border-slate-200 hover:border-red-300 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <X className="w-4 h-4 text-red-600" />
                <span className={isUrdu ? 'urdu-text' : ''}>
                  {isCancelling
                    ? (isUrdu ? 'منسوخ ہو رہا ہے...' : 'Cancelling...')
                    : (isUrdu ? 'منسوخ کریں (Cancel Export)' : 'Cancel Export')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden PDF container for html2canvas */}
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: '-9999px', 
          zIndex: -9999, 
          pointerEvents: 'none', 
          width: '800px', 
          height: 'auto', 
          opacity: 1, 
          backgroundColor: '#ffffff' 
        }} 
        id="pdf-export-container"
      >
        {renderedPages}
      </div>
    </>
  );
});

PdfExportHidden.displayName = 'PdfExportHidden';
export default PdfExportHidden;
