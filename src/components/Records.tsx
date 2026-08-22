import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Sale, type GoldPurchase } from '../db';
import { translations, type Language } from '../translations';
import { Search, Printer, Trash2, Edit, MessageCircle, X, AlertTriangle, History, Download, AlertCircle, ShoppingCart, Tag, Eye, Check, Clock, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatWhatsAppUrl, shareImageToWhatsApp } from '../lib/utils';
import { useReactToPrint } from 'react-to-print';
import { html2canvasWithOklch as html2canvas } from '../lib/html2canvas-helper';
import jsPDF from 'jspdf';
import { PrintReceipt } from './PrintReceipt';
import { ConfirmModal } from './ConfirmModal';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';

import { APP_CONFIG } from '../config';

import ImageLightbox from './ImageLightbox';

interface RecordsProps {
  lang: Language;
  setActiveSection: (section: any) => void;
  setEditingSale: (sale: Sale | null) => void;
}

export default function Records({ lang, setActiveSection, setEditingSale }: RecordsProps) {
  const t = translations[lang];
  const isUrdu = lang === 'ur';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases'>('sales');
  const [baqayaFilter, setBaqayaFilter] = useState<'all' | 'pending' | 'cleared'>('all');

  const [printData, setPrintData] = useState<{ data: Sale | GoldPurchase, id: number, type: 'sale' | 'purchase' } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [lightboxData, setLightboxData] = useState<{ src: string; title?: string; phone?: string; caption?: string } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<{ id: number, type: 'sale' | 'purchase' } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${printData?.type === 'sale' ? 'Bill' : 'Purchase'}_${printData?.id || 'record'}`,
    onAfterPrint: () => {
      setIsPrinting(false);
    }
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && pdfUrl) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        await CapPrinter.printBase64({
          name: `${printData?.type === 'sale' ? 'Bill' : 'Purchase'}_${printData?.id || 'record'}`,
          data: base64Data,
          mimeType: 'application/pdf',
        });
      } catch (e) {
        console.error('Error with native print', e);
        handlePrint();
      }
    } else {
      handlePrint();
    }
  };

  const generatePDF = async (data: any, id: number, type: 'sale' | 'purchase'): Promise<string | null> => {
    if (!printRef.current) return null;
    setIsPrinting(true);
    const isPurchase = type === 'purchase';
    const widthStr = isPurchase ? '1000px' : '800px';
    const heightStr = isPurchase ? '1414px' : '1135px';
    const pdfWidth = isPurchase ? 21.0 : 14.8;
    const windowWidthVal = isPurchase ? 1000 : 800;

    try {
      window.scrollTo(0, 0);
      
      const canvas = await html2canvas(printRef.current, {
        scale: 3.0, // 1.0x avoids sub-pixel scaling calculations and is faster
        useCORS: true, // Disable CORS to avoid hanging on stylesheet downloads/fonts
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: false,
        imageTimeout: 2000, // No timeout latency for image rendering
        windowWidth: windowWidthVal, // Explicitly set viewport width to prevent narrow responsive wrapping
        onclone: (clonedDoc) => {
          clonedDoc.body.style.margin = '0';
          clonedDoc.body.style.padding = '0';
          clonedDoc.body.style.backgroundColor = '#ffffff';
          clonedDoc.body.style.width = widthStr;
          const el = clonedDoc.querySelector('.print-receipt-container') as HTMLElement;
          if (el) {
            clonedDoc.body.innerHTML = '';
            clonedDoc.body.appendChild(el);
            el.style.margin = '0';
            el.style.padding = '0.8cm';
            el.style.width = widthStr;
            el.style.minHeight = heightStr;
            el.style.height = 'auto';
            el.style.display = 'block';
            el.style.position = 'relative';
          }
        }
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.8); // JPEG encoding is significantly faster than PNG

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const pdfHeight = (canvasHeight / canvasWidth) * pdfWidth;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'cm',
        format: [pdfWidth, pdfHeight]
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight); // JPEG embedding is instantaneous in jsPDF
      return pdf.output('datauristring');
    } catch (error) {
      console.error("PDF Error:", error);
      return null;
    } finally {
      setIsPrinting(false);
    }
  };

  const downloadPDF = async () => {
    if (!pdfUrl) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `${printData?.type === 'sale' ? 'Bill' : 'Purchase'}_${printData?.id || Date.now()}.pdf`;
        const base64Data = pdfUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: printData?.type === 'sale' ? 'Bill Receipt' : 'Purchase Receipt',
          url: savedFile.uri,
        });
      } catch (e) {
        console.error('Error sharing PDF', e);
        alert(lang === 'ur' ? "فائل شیئر کرنے میں خرابی پیش آئی" : "Error sharing file");
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${printData?.type === 'sale' ? 'Bill' : 'Purchase'}_${printData?.id || 'record'}.pdf`;
      link.click();
    }
  };

  const rawSales = useLiveQuery(() => {
    if (!db.sales) return Promise.resolve([]);
    return db.sales.orderBy('id').reverse().toArray();
  }) || [];

  const rawPurchases = useLiveQuery(() => {
    if (!db.goldPurchases) return Promise.resolve([]);
    return db.goldPurchases.orderBy('id').reverse().toArray();
  }) || [];

  const sales = useMemo(() => {
    let result = rawSales;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(sale => 
        sale.name.toLowerCase().includes(term) || 
        sale.phone.includes(searchTerm) ||
        sale.id?.toString() === searchTerm ||
        sale.items.some(item => item.n.toLowerCase().includes(term))
      );
    }
    if (baqayaFilter === 'pending') {
      result = result.filter(sale => (sale.rem || 0) > 0);
    } else if (baqayaFilter === 'cleared') {
      result = result.filter(sale => (sale.rem || 0) <= 0);
    }
    return result;
  }, [rawSales, searchTerm, baqayaFilter]);

  const { totalBaqayaCount, totalBaqayaAmount } = useMemo(() => {
    let count = 0;
    let amount = 0;
    rawSales.forEach(s => {
      if ((s.rem || 0) > 0) {
        count += 1;
        amount += (s.rem || 0);
      }
    });
    return { totalBaqayaCount: count, totalBaqayaAmount: amount };
  }, [rawSales]);

  const purchases = useMemo(() => {
    if (!searchTerm.trim()) return rawPurchases;
    const term = searchTerm.toLowerCase();
    return rawPurchases.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.phone.includes(searchTerm) ||
      p.id?.toString() === searchTerm
    );
  }, [rawPurchases, searchTerm]);

  const handleDelete = async () => {
    if (!deleteId) return;
    if (deleteId.type === 'sale') {
      await db.sales.delete(deleteId.id);
    } else {
      await db.goldPurchases.delete(deleteId.id);
    }
    setDeleteId(null);
  };

  const handleUpdate = (sale: Sale) => {
    setEditingSale(sale);
    setActiveSection('billing');
  };

  const shareWhatsApp = (data: Sale) => {
    const message = `*${APP_CONFIG.shopNameUrdu}: سیل بل*\n` +
      `گاہک: ${data.name}\n` +
      `تاریخ: ${data.date}\n` +
      `کل رقم: Rs. ${data.total.toLocaleString()}\n` +
      `وصول شدہ: Rs. ${data.rec.toLocaleString()}\n` +
      `باقی رقم: Rs. ${data.rem.toLocaleString()}\n` +
      `شکریہ!`;
    
    const url = formatWhatsAppUrl(data.phone, message);
    if (url) window.open(url, '_blank');
  };

  const sharePurchaseWhatsApp = (p: GoldPurchase) => {
    const msg = `*${APP_CONFIG.shopNameUrdu}: خریداری رسید*\n` +
      `بیچنے والا: ${p.name}\n` +
      `وزن: ${p.weight}g\n` +
      `ریٹ: ${p.rate.toLocaleString()}\n` +
      `کل رقم: Rs. ${p.total.toLocaleString()}\n` +
      `تاریخ: ${p.date}\n` +
      `شکریہ!`;
    const url = formatWhatsAppUrl(p.phone, msg);
    if (url) window.open(url, '_blank');
  };

  const totalSalesWeight = sales?.reduce((acc, sale) => {
    return acc + sale.items.reduce((sum, item) => {
      if (item.t > 0) {
        return sum + (Number(item.w) || 0);
      }
      return sum;
    }, 0);
  }, 0) || 0;

  const totalPolishWeight = sales?.reduce((acc, sale) => {
    return acc + sale.items.reduce((sum, item) => {
      if (item.t > 0) {
        return sum + (Number(item.mk) || 0);
      }
      return sum;
    }, 0);
  }, 0) || 0;

  const totalMazdoriReceived = sales?.reduce((acc, sale) => {
    return acc + sale.items.reduce((sum, item) => {
      if (item.t > 0) {
        const goldValue = (Number(item.w) + Number(item.mk)) * Number(item.r);
        const mazdori = item.t - goldValue;
        return sum + (mazdori > 0 ? mazdori : 0);
      }
      return sum;
    }, 0);
  }, 0) || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Image Modal */}
      {lightboxData && (
        <ImageLightbox 
          src={lightboxData.src} 
          onClose={() => setLightboxData(null)} 
          title={lightboxData.title || (lang === 'ur' ? 'تصویر ریکارڈ' : 'Record Image')} 
          phone={lightboxData.phone}
          caption={lightboxData.caption}
        />
      )}

      <ConfirmModal 
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={lang === 'ur' ? 'ڈیلیٹ کریں؟' : 'Confirm Delete'}
        message={lang === 'ur' ? 'کیا آپ واقعی اس ریکارڈ کو حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this record?'}
        lang={lang}
      />
      
      {/* Print Preview Modal */}
      {showPrintPreview && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black-80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-zinc-50">
              <h3 className="text-xl font-bold urdu-text text-black">
                {printData.type === 'sale' ? 'بل کی تفصیل (Bill Preview)' : 'خریداری کی تفصیل (Purchase Preview)'}
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowPrintPreview(false);
                  setPrintData(null);
                  setPdfUrl(null);
                }}
                className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-black"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-200 flex justify-center scrollbar-thin scrollbar-thumb-zinc-400">
              <div className="bg-white shadow-2xl origin-top transition-transform duration-300 transform scale-[0.6] sm:scale-[0.75] md:scale-[0.85] lg:scale-100">
                <PrintReceipt 
                  ref={printRef}
                  type={printData.type} 
                  data={printData.data} 
                  id={printData.id} 
                  lang={lang}
                />
              </div>
              
              {!pdfUrl && (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] font-bold text-zinc-600 urdu-text">پی ڈی ایف تیار ہو رہا ہے...</span>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-white flex flex-wrap gap-3">
              <button 
                type="button"
                onClick={executePrint}
                className="flex-1 min-w-[140px] bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg"
              >
                <Printer size={24} />
                <span className="urdu-text text-xl">پرنٹ کریں (Print)</span>
              </button>

              <button 
                type="button"
                disabled={!pdfUrl}
                onClick={downloadPDF}
                className="flex-1 min-w-[200px] bg-gold hover:bg-gold-light text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg disabled:opacity-50"
              >
                <Download size={24} />
                <span className="urdu-text text-xl text-black">پی ڈی ایف (Download PDF)</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  setShowPrintPreview(false);
                  setPrintData(null);
                  setPdfUrl(null);
                }}
                className="px-6 bg-zinc-100 text-zinc-600 font-bold py-4 rounded-xl hover:bg-zinc-200 transition-all urdu-text text-xl"
              >
                بند کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gold-dark urdu-text">{t.records}</h2>
            <p className="text-zinc-500 text-sm">{lang === 'ur' ? 'تمام ریکارڈز یہاں دیکھیں' : 'View all records here'}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={lang === 'ur' ? 'نام، فون یا آئٹم تلاش کریں...' : 'Search by name, phone, or item...'}
                className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 border border-sky-200 rounded-xl outline-none focus:border-gold transition-all text-black font-semibold text-sm shadow-inner"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            {searchTerm && (
              <span className="bg-gold/10 text-gold-dark border border-gold/30 px-3 py-1.5 rounded-lg text-xs font-bold font-mono whitespace-nowrap">
                {activeTab === 'sales' ? (
                  lang === 'ur' ? `${sales?.length || 0} سیلز ریکارڈز ملے` : `${sales?.length || 0} sales records found`
                ) : (
                  lang === 'ur' ? `${purchases?.length || 0} خریداری ریکارڈز ملے` : `${purchases?.length || 0} purchase records found`
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex p-1 bg-sky-100 rounded-xl w-fit shadow-inner">
            <button
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all urdu-text ${activeTab === 'sales' ? "bg-white text-gold-dark shadow-md" : "text-sky-600 hover:bg-white-50"}`}
            >
              <ShoppingCart size={18} />
              سیلز (Sales)
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all urdu-text ${activeTab === 'purchases' ? "bg-white text-gold-dark shadow-md" : "text-sky-600 hover:bg-white-50"}`}
            >
              <Tag size={18} />
              خریداری (Purchases)
            </button>
          </div>

          {activeTab === 'sales' && (
            <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-xl border border-sky-200 shadow-sm">
              <button
                onClick={() => setBaqayaFilter('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all urdu-text ${
                  baqayaFilter === 'all' 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {lang === 'ur' ? 'تمام بل (All)' : 'All Invoices'}
              </button>
              <button
                onClick={() => setBaqayaFilter('pending')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 urdu-text ${
                  baqayaFilter === 'pending' 
                    ? 'bg-red-600 text-white shadow-sm' 
                    : 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                }`}
              >
                <AlertCircle size={14} />
                <span>{lang === 'ur' ? 'صرف بقایا والے بل' : 'With Baqaya Balance'}</span>
                {totalBaqayaCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    baqayaFilter === 'pending' ? 'bg-white text-red-700' : 'bg-red-600 text-white'
                  }`}>
                    {totalBaqayaCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setBaqayaFilter('cleared')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 urdu-text ${
                  baqayaFilter === 'cleared' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <Check size={14} />
                <span>{lang === 'ur' ? 'مکمل ادا شدہ' : 'Paid / Cleared'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Records List */}
      <AnimatePresence mode="wait">
        {activeTab === 'sales' ? (
          <motion.div 
            key="sales"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Stats Block */}
            <div className="flex gap-6 p-4 bg-white border border-sky-200 rounded-xl shadow-sm overflow-x-auto">
              <div className="flex flex-col flex-shrink-0 min-w-32">
                <span className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'کل سیلز وزن:' : 'Total Sales Wt:'}</span>
                <span className="text-2xl font-black text-gold-dark">{totalSalesWeight.toFixed(3)}g</span>
              </div>
              <div className="flex flex-col flex-shrink-0 min-w-32 border-l border-sky-100 pl-6">
                <span className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'کل پالش وزن:' : 'Total Polish Wt:'}</span>
                <span className="text-2xl font-black text-sky-700">{totalPolishWeight.toFixed(3)}g</span>
              </div>
              <div className="flex flex-col flex-shrink-0 min-w-32 border-l border-sky-100 pl-6">
                <span className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'کل مزدوری:' : 'Total Mazdori Received:'}</span>
                <span className="text-2xl font-black text-green-600">Rs. {Math.round(totalMazdoriReceived).toLocaleString()}</span>
              </div>
              {totalBaqayaCount > 0 && (
                <div className="flex flex-col flex-shrink-0 min-w-36 border-l border-red-200 pl-6 bg-red-50/50 -m-4 p-4 rounded-r-xl">
                  <span className="text-xs text-red-600 urdu-text font-bold flex items-center gap-1">
                    <AlertCircle size={12} />
                    {lang === 'ur' ? 'کل بقایا رقم:' : 'Total Pending Baqaya:'}
                  </span>
                  <span className="text-2xl font-black text-red-600 font-mono">
                    Rs. {totalBaqayaAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-red-500 font-bold urdu-text">
                    ({totalBaqayaCount} {lang === 'ur' ? 'بلز پر بقایا ہے' : 'invoices unpaid'})
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sales?.map((sale) => {
              const hasBaqaya = (sale.rem || 0) > 0;
              return (
                <div
                  key={sale.id}
                  className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all ${
                    hasBaqaya 
                      ? 'border-2 border-red-400 ring-2 ring-red-100' 
                      : 'border border-sky-200'
                  }`}
                >
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-zinc-900 urdu-text">{sale.name}</h3>
                          {hasBaqaya ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-black border border-red-300 flex items-center gap-0.5 urdu-text">
                              <AlertCircle size={10} className="text-red-600" />
                              بقایا
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold border border-emerald-300 flex items-center gap-0.5 urdu-text">
                              <Check size={10} className="text-emerald-700" />
                              صاف
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500" dir="ltr">{sale.phone}</p>
                      </div>
                      <div className="px-2 py-1 bg-sky-50 text-gold-dark rounded text-[10px] font-bold border border-gold-20 font-mono">
                        #{sale.id}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">{t.date}</p>
                        <p className="font-medium text-zinc-700">{sale.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">{t.totalAmount}</p>
                        <p className="font-bold text-gold-dark font-mono">Rs. {sale.total.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between p-2.5 rounded-lg text-xs border ${
                      hasBaqaya 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-sky-50 border-sky-100'
                    }`}>
                      <div>
                        <span className="text-zinc-600 urdu-text">{t.receivedAmount}: </span>
                        <span className="font-bold text-green-700 font-mono">Rs. {sale.rec.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-600 urdu-text">{t.remainingAmount}: </span>
                        <span className={`font-black font-mono text-sm ${hasBaqaya ? 'text-red-600 font-bold' : 'text-zinc-400'}`}>
                          Rs. {sale.rem.toLocaleString()}
                        </span>
                      </div>
                    </div>

                  {/* Items List inside the Record Card */}
                  {sale.items && sale.items.length > 0 && (
                    <div className="border-t border-sky-100 pt-3 mt-1 space-y-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider urdu-text">
                        {lang === 'ur' ? 'اشیاء کی تفصیل:' : 'Items Details:'}
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-zinc-50 rounded-xl border border-zinc-100 text-xs">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {item.img ? (
                                <div className="relative group/recimg flex-shrink-0">
                                  <div 
                                    onClick={() => setLightboxData({
                                      src: item.img!,
                                      title: `${item.n} - ${sale.name} (#${sale.id})`,
                                      phone: sale.phone,
                                      caption: `*نفیس جیولرز - سیل ریکارڈ*\nبل نمبر: #${sale.id}\nگاہک: ${sale.name}\nآئٹم: ${item.n}\nوزن: ${item.w}g\nقیمت: Rs. ${item.t.toLocaleString()}\nتاریخ: ${sale.date}`
                                    })}
                                    className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 shadow-sm cursor-pointer hover:border-gold transition-colors"
                                    title={lang === 'ur' ? 'تصویر دیکھیں' : 'View Image'}
                                  >
                                    <img src={item.img} alt={item.n} className="w-full h-full object-cover" />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await shareImageToWhatsApp({
                                        imageSrc: item.img!,
                                        phone: sale.phone,
                                        caption: `*نفیس جیولرز - سیل ریکارڈ*\nبل نمبر: #${sale.id}\nگاہک: ${sale.name}\nآئٹم: ${item.n}\nوزن: ${item.w}g\nقیمت: Rs. ${item.t.toLocaleString()}\nتاریخ: ${sale.date}`,
                                        title: item.n
                                      });
                                    }}
                                    className="absolute -bottom-1 -right-1 p-0.5 bg-green-600 hover:bg-green-700 text-white rounded-full shadow transition-colors"
                                    title="WhatsApp Photo"
                                  >
                                    <MessageCircle size={10} />
                                  </button>
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0 text-[10px] text-zinc-400 font-bold font-nastaliq">
                                  -
                                </div>
                              )}
                              <div className="truncate">
                                <p className="font-bold text-zinc-800 truncate urdu-text">{item.n}</p>
                                <p className="text-[10px] text-zinc-400 font-mono">
                                  {item.w}g | {item.p || 1} Qty
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-gold-dark font-mono">Rs. {item.t.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => {
                        if (sale.id) {
                          setPrintData({ data: sale, id: sale.id, type: 'sale' });
                          setShowPrintPreview(true);
                          setTimeout(async () => {
                            const url = await generatePDF(sale, sale.id!, 'sale');
                      if (url) {
                        setPdfUrl(url);
                      } else {
                        setShowPrintPreview(false);
                        alert('PDF generation failed. Please try again or check the image format.');
                      }
                          }, 400);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 p-2 bg-sky-50 text-gold-dark rounded-lg hover:bg-gold hover:text-black transition-colors border border-gold-20"
                    >
                      <Printer size={16} />
                      <span className="text-xs font-bold urdu-text">{t.print}</span>
                    </button>
                    {sale.items.some(i => i.img) && (
                      <button
                        onClick={() => {
                          const firstImgItem = sale.items.find(i => i.img);
                          if (firstImgItem?.img) {
                            setLightboxData({
                              src: firstImgItem.img,
                              title: `${firstImgItem.n} - ${sale.name} (#${sale.id})`,
                              phone: sale.phone,
                              caption: `*نفیس جیولرز - سیل ریکارڈ*\nبل نمبر: #${sale.id}\nگاہک: ${sale.name}\nفون: ${sale.phone || '-'}\nکل رقم: Rs. ${sale.total.toLocaleString()}\nوصول: Rs. ${sale.rec.toLocaleString()}\nبقایا: Rs. ${sale.rem.toLocaleString()}`
                            });
                          }
                        }}
                        className="p-2 bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white rounded-lg transition-colors border border-sky-200"
                        title={lang === 'ur' ? 'تصویر دیکھیں' : 'View Image'}
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    {sale.items.some(i => i.img) && (
                      <button
                        onClick={async () => {
                          const firstImgItem = sale.items.find(i => i.img);
                          if (firstImgItem?.img) {
                            await shareImageToWhatsApp({
                              imageSrc: firstImgItem.img,
                              phone: sale.phone,
                              caption: `*نفیس جیولرز - سیل ریکارڈ*\nبل نمبر: #${sale.id}\nگاہک: ${sale.name}\nفون: ${sale.phone || '-'}\nکل رقم: Rs. ${sale.total.toLocaleString()}\nوصول: Rs. ${sale.rec.toLocaleString()}\nبقایا: Rs. ${sale.rem.toLocaleString()}`,
                              title: `Bill #${sale.id} - ${sale.name}`
                            });
                          }
                        }}
                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors border border-emerald-200"
                        title={lang === 'ur' ? 'تصویر واٹس ایپ کریں' : 'WhatsApp Photo'}
                      >
                        <MessageCircle size={16} className="text-green-600" />
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdate(sale)}
                      className="p-2 bg-sky-50 text-zinc-600 hover:bg-gold hover:text-black rounded-lg transition-colors border border-sky-200"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => shareWhatsApp(sale)}
                      className="p-2 bg-green-600-10 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-colors border border-green-600-20"
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button
                      onClick={() => sale.id && setDeleteId({ id: sale.id, type: 'sale' })}
                      className="p-2 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors border border-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
            </div>
            {sales?.length === 0 && <EmptyState lang={lang} />}
          </motion.div>
        ) : (
          <motion.div 
            key="purchases"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {purchases?.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl shadow-sm border border-sky-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 urdu-text">{p.name}</h3>
                      <p className="text-xs text-zinc-500" dir="ltr">{p.phone}</p>
                    </div>
                    <div className="px-2 py-1 bg-gold-10 text-gold-dark rounded text-[10px] font-bold border border-gold-20">
                      #{p.id}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold">{t.date}</p>
                      <p className="font-medium text-zinc-700">{p.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold text-gold-dark">خریداری رقم</p>
                      <p className="font-bold text-gold-dark">Rs. {p.total.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-sky-50 rounded-lg text-xs border border-sky-100">
                    <div>
                      <span className="text-zinc-500 urdu-text">وزن (Wt): </span>
                      <span className="font-bold text-zinc-700">{p.weight}g</span>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-500 urdu-text">ریٹ (Rate): </span>
                      <span className="font-bold text-zinc-700">{p.rate.toLocaleString()}</span>
                    </div>
                  </div>

                    <div className="flex items-center gap-2 pt-2">
                    {p.img && (
                      <button
                        onClick={() => setLightboxData({
                          src: p.img!,
                          title: `${p.name} (#${p.id}) - ${lang === 'ur' ? 'خریداری' : 'Purchase'}`,
                          phone: p.phone,
                          caption: `*نفیس جیولرز - سونا خریداری رسید*\nرسید نمبر: #${p.id}\nبیچنے والے کا نام: ${p.name}\nفون: ${p.phone || '-'}\nوزن: ${p.weight}g\nریٹ: Rs. ${p.rate.toLocaleString()}\nکل رقم: Rs. ${p.total.toLocaleString()}\nتاریخ: ${p.date}`
                        })}
                        className="p-2 bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white rounded-lg transition-colors border border-sky-200"
                        title={lang === 'ur' ? 'تصویر دیکھیں' : 'View Image'}
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    {p.img && (
                      <button
                        onClick={async () => {
                          await shareImageToWhatsApp({
                            imageSrc: p.img!,
                            phone: p.phone,
                            caption: `*نفیس جیولرز - سونا خریداری رسید*\nرسید نمبر: #${p.id}\nبیچنے والے کا نام: ${p.name}\nفون: ${p.phone || '-'}\nوزن: ${p.weight}g\nریٹ: Rs. ${p.rate.toLocaleString()}\nکل رقم: Rs. ${p.total.toLocaleString()}\nتاریخ: ${p.date}`,
                            title: `Purchase #${p.id} - ${p.name}`
                          });
                        }}
                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors border border-emerald-200"
                        title={lang === 'ur' ? 'تصویر واٹس ایپ کریں' : 'WhatsApp Photo'}
                      >
                        <MessageCircle size={16} className="text-green-600" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (p.id) {
                          setPrintData({ data: p, id: p.id, type: 'purchase' });
                          setShowPrintPreview(true);
                          setTimeout(async () => {
                            const url = await generatePDF(p, p.id!, 'purchase');
                      if (url) {
                        setPdfUrl(url);
                      } else {
                        setShowPrintPreview(false);
                        alert('PDF generation failed. Please try again or check the image format.');
                      }
                          }, 400);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 p-2 bg-sky-50 text-gold-dark rounded-lg hover:bg-gold hover:text-black transition-colors border border-gold-20"
                    >
                      <Printer size={16} />
                      <span className="text-xs font-bold urdu-text">{t.print}</span>
                    </button>
                    <button
                      onClick={() => sharePurchaseWhatsApp(p)}
                      className="p-2 bg-green-600-10 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-colors border border-green-600-20"
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button
                      onClick={() => p.id && setDeleteId({ id: p.id, type: 'purchase' })}
                      className="p-2 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors border border-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {purchases?.length === 0 && <EmptyState lang={lang} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ lang }: { lang: Language }) {
  return (
    <div className="col-span-full py-24 text-center space-y-4">
      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto text-sky-200 shadow-sm border border-sky-100">
        <History size={40} />
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-bold text-zinc-600 urdu-text">{lang === 'ur' ? 'کوئی ریکارڈ نہیں ملا' : 'No records found'}</h3>
        <p className="text-zinc-500 text-xs uppercase tracking-widest">{lang === 'ur' ? 'اپنی تلاش تبدیل کریں' : 'Try adjusting your search'}</p>
      </div>
    </div>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
