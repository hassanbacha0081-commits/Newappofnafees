import React, { useState, useEffect, useRef } from 'react';
import { db, type Sale, type SalesItem } from '../db';
import { translations, type Language } from '../translations';
import { formatDate, compressImage } from '../lib/utils';
import { Camera, RotateCcw, Trash2, Printer, Plus, X, ShoppingBag, Download, AlertCircle, CheckCircle2, Users, ImageIcon } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { AnimatePresence, motion } from 'motion/react';
import { html2canvasWithOklch as html2canvas } from '../lib/html2canvas-helper';
import jsPDF from 'jspdf';
import { PrintReceipt } from './PrintReceipt';
import { MultiSelectInput } from './MultiSelectInput';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';
interface BillingProps {
  lang: Language;
  editingSale: Sale | null;
  setEditingSale: (sale: Sale | null) => void;
}

import ImageLightbox from './ImageLightbox';
import ContactPickerModal from './ContactPickerModal';

export default function Billing({ lang, editingSale, setEditingSale }: BillingProps) {
  const t = translations[lang];
  const [billItems, setBillItems] = useState<SalesItem[]>([]);
  const [lastImg, setLastImg] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    cName: '',
    cPhone: '',
    pricePerTola: 0,
    iRate: 0,
    iName: '',
    iWt: 0,
    iQty: 1,
    iMk: 0,
    iMazdori: 0,
    oTotalWt: 0,
    oNetWt: 0,
    recAmt: 0
  });

  const [printData, setPrintData] = useState<{ data: Sale, id: number } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Bill_${printData?.id || 'new'}`,
    onAfterPrint: () => {
      setIsPrinting(false);
    }
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && pdfUrl) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        await CapPrinter.printBase64({
          name: `Bill_${printData?.id || 'new'}`,
          data: base64Data,
          mimeType: 'application/pdf',
        });
      } catch (e) {
        console.error('Error with native print', e);
        handlePrint(); // fallback to standard browser print if error occurs
      }
    } else {
      handlePrint(); // Web fallback 
    }
  };

  const generatePDF = async (data: Sale, id: number): Promise<string | null> => {
    if (!printRef.current) return null;
    setIsPrinting(true);
    try {
      window.scrollTo(0, 0);
      
      const canvas = await html2canvas(printRef.current, {
        scale: 3.0, // 1.0x avoids sub-pixel scaling calculations and is faster
        useCORS: true, // Disable CORS to avoid hanging on stylesheet downloads/fonts
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: false,
        imageTimeout: 2000, // No timeout latency for image rendering
        windowWidth: 800, // Explicitly set viewport width to prevent narrow responsive wrapping
        onclone: (clonedDoc) => {
          clonedDoc.body.style.margin = '0';
          clonedDoc.body.style.padding = '0';
          clonedDoc.body.style.backgroundColor = '#ffffff';
          clonedDoc.body.style.width = '800px';
          const el = clonedDoc.querySelector('.print-receipt-container') as HTMLElement;
          if (el) {
            clonedDoc.body.innerHTML = '';
            clonedDoc.body.appendChild(el);
            el.style.margin = '0';
            el.style.padding = '0.8cm';
            el.style.width = '800px';
            el.style.minHeight = '1135px';
            el.style.height = 'auto';
            el.style.display = 'block';
            el.style.position = 'relative';
          }
        }
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.8); // JPEG encoding is significantly faster than PNG

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const pdfWidth = 14.8;
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
        const fileName = `Bill_${printData?.id || Date.now()}.pdf`;
        const base64Data = pdfUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Bill Receipt',
          url: savedFile.uri,
        });
      } catch (e) {
        console.error('Error sharing PDF', e);
        alert(lang === 'ur' ? "فائل شیئر کرنے میں خرابی پیش آئی" : "Error sharing file");
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Bill_${printData?.id || 'new'}.pdf`;
      link.click();
    }
  };

  useEffect(() => {
    if (editingSale) {
      const initialRate = editingSale.items[0]?.r || 0;
      setFormData({
        cName: editingSale.name,
        cPhone: editingSale.phone,
        pricePerTola: Math.round(initialRate * 12),
        iRate: initialRate,
        iName: '',
        iWt: 0,
        iQty: 1,
        iMk: 0,
        iMazdori: 0,
        oTotalWt: 0,
        oNetWt: 0,
        recAmt: editingSale.rec
      });
      setBillItems(editingSale.items);
    }
  }, [editingSale]);

  const resetForm = () => {
    setBillItems([]);
    setEditingSale(null);
    setFormData({
      cName: '',
      cPhone: '',
      pricePerTola: 0,
      iRate: 0,
      iName: '',
      iWt: 0,
      iQty: 1,
      iMk: 0,
      iMazdori: 0,
      oTotalWt: 0,
      oNetWt: 0,
      recAmt: 0
    });
  };

  const calcOldValue = () => {
    return Math.round(formData.oNetWt * formData.iRate);
  };

  const addItem = () => {
    if (formData.iName && formData.iWt && formData.iRate) {
      const newItem: SalesItem = {
        n: formData.iName,
        w: formData.iWt,
        p: formData.iQty || 1,
        mk: formData.iMk,
        r: formData.iRate,
        t: (formData.iWt + formData.iMk) * formData.iRate + formData.iMazdori,
        img: lastImg
      };
      setBillItems([...billItems, newItem]);
      setLastImg(null);
      setFormData({ ...formData, iName: '', iWt: 0, iQty: 1, iMk: 0, iMazdori: 0 });
    }
  };

  const addOldGold = () => {
    if (formData.oNetWt && formData.iRate) {
      const oldGoldItem: SalesItem = {
        n: lang === 'ur' ? "پرانا سونا (واپسی)" : "Old Gold (Return)",
        w: formData.oNetWt,
        p: 1,
        r: formData.iRate,
        mk: 0,
        t: (formData.oNetWt * formData.iRate * -1),
        img: null
      };
      setBillItems([...billItems, oldGoldItem]);
      setFormData({ ...formData, oTotalWt: 0, oNetWt: 0 });
    }
  };

  const removeItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const getGrandTotal = () => {
    return Math.round(billItems.reduce((sum, item) => sum + item.t, 0));
  };

  const getRemainingAmount = () => {
    return getGrandTotal() - formData.recAmt;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        setLastImg(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAndPrint = async () => {
    const total = getGrandTotal();
    const data: Sale = {
      name: formData.cName || (lang === 'ur' ? "کسٹمر" : "Customer"),
      phone: formData.cPhone || "-",
      items: [...billItems],
      total: total,
      rec: formData.recAmt,
      rem: total - formData.recAmt,
      date: editingSale ? editingSale.date : formatDate(new Date(), 'ur-PK')
    };

    let finalId = 0;
    try {
      if (editingSale?.id) {
        data.id = editingSale.id;
        await db.sales.put(data);
        finalId = editingSale.id;
      } else {
        finalId = await db.sales.add(data) as number;
        
        // --- NEW: Automatically Deduct Weight and Pieces from Stock ---
        try {
          const allStocks = await db.stock.toArray();
          
          for (const item of data.items) {
            // Find stock item by name
            let targetStock = allStocks.find(s => s.name === item.n);
            
            // If item has weight but no specific stock found, optional: subtract from a general gold bucket
            // Here we prioritize exact name match as requested
            
            if (targetStock && targetStock.id) {
              const isOldGold = item.t < 0; 
              
              // Updates
              const weightDiff = isOldGold ? item.w : -item.w;
              const pieceDiff = isOldGold ? (item.p || 0) : -(item.p || 1);
              
              const newQty = Number((targetStock.quantity + weightDiff).toFixed(2));
              const newPieces = (targetStock.pieces || 0) + pieceDiff;
              
              await db.stock.update(targetStock.id, { 
                quantity: Math.max(0, newQty), 
                pieces: Math.max(0, newPieces) 
              });
              
              // Update memory ref for consecutive items in same bill
              targetStock.quantity = newQty;
              targetStock.pieces = newPieces;
            }
          }
        } catch (stockErr) {
          console.error("Stock deduction error:", stockErr);
        }
      }
      
      setPrintData({ data, id: finalId });
      setShowPrintPreview(true);
      
      // Clear PDF URL first to show loading state
      setPdfUrl(null);

      // Reset the billing page form fields to blank
      resetForm();

      // Generate PDF for preview with an optimized 100ms delay to feel extremely responsive
      setTimeout(async () => {
        const url = await generatePDF(data, finalId);
                      if (url) {
                        setPdfUrl(url);
                      } else {
                        setShowPrintPreview(false);
                        alert('PDF generation failed. Please try again or check the image format.');
                      }
      }, 400);

    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleConfirmedSave = async () => {
    setShowConfirmModal(false);
    await handleSaveAndPrint();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gold/20"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mx-auto text-gold mb-2">
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold urdu-text text-zinc-900">
                    {lang === 'ur' ? 'بل محفوظ کریں؟' : 'Save Bill?'}
                  </h3>
                  <p className="text-zinc-500 mt-2 urdu-text leading-relaxed">
                    {lang === 'ur' 
                      ? `کیا آپ Rs. ${getGrandTotal().toLocaleString()} کا یہ بل محفوظ کر کے رسید پرنٹ کرنا چاہتے ہیں؟` 
                      : `Are you sure you want to save this bill of Rs. ${getGrandTotal().toLocaleString()} and generate the receipt?`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 font-bold">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="py-3 px-4 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-all urdu-text border border-zinc-200"
                  >
                    {lang === 'ur' ? 'کینسل' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleConfirmedSave}
                    className="py-3 px-4 rounded-xl bg-gold text-black hover:bg-gold-light transition-all urdu-text shadow-lg shadow-gold/20"
                  >
                    {lang === 'ur' ? 'ہاں، محفوظ کریں' : 'Yes, Save'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PDF Preview Modal */}
      {showPrintPreview && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-zinc-100 w-[95vw] h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold rounded-full flex items-center justify-center text-black shadow-md">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold urdu-text text-zinc-900 leading-none">پرنٹ پریویو (Print Preview)</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Full Page Document Inspection</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowPrintPreview(false);
                  setPrintData(null);
                  setPdfUrl(null);
                  resetForm();
                }}
                className="p-2 hover:bg-zinc-100 rounded-xl transition-all text-zinc-400 hover:text-red-500 border border-zinc-200"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-zinc-200 scrollbar-thin scrollbar-thumb-zinc-400">
              <div className="bg-white shadow-2xl origin-top transition-transform duration-300 transform scale-[0.6] sm:scale-[0.8] md:scale-[0.9] lg:scale-100">
                <PrintReceipt 
                  ref={printRef}
                  type="sale" 
                  data={printData.data} 
                  id={printData.id} 
                />
              </div>

              {!pdfUrl && (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] font-bold text-zinc-600 urdu-text">پی ڈی ایف تیار ہو رہا ہے...</span>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-white flex flex-wrap gap-4 items-center justify-center">
              <div className="flex-1 hidden lg:block">
                <p className="text-xs text-zinc-400 urdu-text">براہ کرم پرنٹ کرنے سے پہلے تمام تفصیلات چیک کر لیں۔</p>
              </div>
              
              <div className="flex gap-3 w-full lg:w-auto">
                <button 
                  type="button"
                  onClick={executePrint}
                  className="flex-1 lg:flex-none min-w-[180px] bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-xl"
                >
                  <Printer size={24} />
                  <span className="urdu-text text-xl">پرنٹ کریں (Print)</span>
                </button>

                <button 
                  type="button"
                  disabled={!pdfUrl}
                  onClick={downloadPDF}
                  className="flex-1 lg:flex-none min-w-[180px] bg-gold hover:bg-gold-light text-black font-bold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-xl disabled:opacity-50"
                >
                  <Download size={24} />
                  <span className="urdu-text text-xl text-black">پی ڈی ایف (Save PDF)</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShowPrintPreview(false);
                    setPrintData(null);
                    setPdfUrl(null);
                    resetForm();
                  }}
                  className="px-8 bg-zinc-100 text-zinc-600 font-bold py-4 rounded-xl hover:bg-zinc-200 transition-all urdu-text text-xl border border-zinc-200"
                >
                  بند کریں
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-sky-100">
        <div>
          <h2 className="text-3xl font-black text-sky-900 tracking-tight urdu-text">
            {editingSale ? (lang === 'ur' ? 'بل کی ترمیم' : 'Edit Bill') : t.billing}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">{lang === 'ur' ? 'نیا سیلز ریکارڈ بنائیں اور پرنٹ کریں' : 'Create and print new sales record'}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={resetForm}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100 transition-all font-bold border border-sky-200 shadow-sm"
          >
            <RotateCcw size={20} />
            <span className="urdu-text">{t.reset}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer & Rate Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-sky-100 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-gold"></div>
            <h3 className="text-xl font-bold text-sky-800 urdu-text flex items-center gap-2 mb-4">
              <Users className="text-gold" size={24} />
              {lang === 'ur' ? 'گاہک کی تفصیلات' : 'Customer Details'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text">{t.customerName}</label>
                <input
                  type="text"
                  placeholder={lang === 'ur' ? 'نام درج کریں' : 'Enter name'}
                  value={formData.cName}
                  onChange={e => setFormData({ ...formData, cName: e.target.value })}
                  className="w-full px-5 py-4 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-lg font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text">{t.phoneNumber}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="03xx xxxxxxx"
                    value={formData.cPhone}
                    onChange={e => setFormData({ ...formData, cPhone: e.target.value })}
                    className="flex-1 px-5 py-4 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-lg font-mono font-bold text-right"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setIsContactPickerOpen(true)}
                    className="px-4 bg-gold/10 hover:bg-gold/25 text-gold-dark border border-gold/30 rounded-2xl flex items-center justify-center transition-all cursor-pointer"
                    title={lang === 'ur' ? 'رابطہ منتخب کریں' : 'Browse Contacts'}
                  >
                    <Users size={22} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-sky-50 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 max-w-sm">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text">{lang === 'ur' ? 'قیمت فی تولہ' : 'Price per Tola'}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.pricePerTola || ''}
                    placeholder="0.00"
                    onChange={e => {
                      const val = Number(e.target.value);
                      setFormData({ ...formData, pricePerTola: val, iRate: Number((val / 12).toFixed(2)) });
                    }}
                    className="w-full pl-6 pr-12 py-5 bg-sky-900 text-gold border-none rounded-2xl focus:ring-4 focus:ring-gold/20 outline-none transition-all text-3xl font-black shadow-inner tracking-widest"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-zinc-500 text-xs">PKR</span>
                </div>
              </div>
              <div className="space-y-2 max-w-sm">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text">{lang === 'ur' ? 'ماشہ' : 'Masha'}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.iRate || ''}
                    placeholder="0.00"
                    onChange={e => setFormData({ ...formData, iRate: Number(e.target.value) })}
                    className="w-full pl-6 pr-12 py-5 bg-sky-50 text-sky-900 border border-sky-200 rounded-2xl focus:ring-4 focus:ring-gold/20 outline-none transition-all text-3xl font-black shadow-inner tracking-widest"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-zinc-500 text-xs">PKR</span>
                </div>
              </div>
            </div>
          </div>

          {/* Item Entry */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-sky-100 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-sky-400"></div>
            <h3 className="text-xl font-bold text-sky-800 urdu-text flex items-center gap-2 mb-4">
              <Plus className="text-sky-500" size={24} />
              {lang === 'ur' ? 'آئٹم شامل کریں (Sale Items)' : 'Add Items'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text">{t.itemName}</label>
                <MultiSelectInput
                  value={formData.iName}
                  onChange={val => setFormData({ ...formData, iName: val })}
                  options={t.itemDetailsList}
                  lang={lang}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text">{lang === 'ur' ? 'تعداد (Qty/Pieces)' : 'Pieces'}</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="1"
                    value={formData.iQty || ''}
                    onChange={e => setFormData({ ...formData, iQty: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-xl font-mono font-bold text-right pr-16"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-xs uppercase">Pcs</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text tracking-tighter">{lang === 'ur' ? 'وزن (Gram)' : 'Weight'}</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.000"
                    value={formData.iWt || ''}
                    onChange={e => setFormData({ ...formData, iWt: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-xl font-mono font-bold text-right pr-16"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-xs">GRAM</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text">{t.making}</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.iMk || ''}
                    onChange={e => setFormData({ ...formData, iMk: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-xl font-mono font-bold text-right"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1 urdu-text">{t.labor}</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.iMazdori || ''}
                    onChange={e => setFormData({ ...formData, iMazdori: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-xl font-mono font-bold text-right"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                <div className="flex-1 space-y-3">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="item-camera"
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border border-sky-200 text-sky-600 hover:border-gold hover:bg-gold/5 transition-all cursor-pointer bg-sky-50 font-bold urdu-text"
                  >
                    <Camera size={20} />
                    <span>{lang === 'ur' ? 'کیمرہ سے تصویر' : 'Camera'}</span>
                  </button>
                  
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="item-gallery"
                  />
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border border-sky-200 text-sky-600 hover:border-gold hover:bg-gold/5 transition-all cursor-pointer bg-sky-50 font-bold urdu-text"
                  >
                    <ImageIcon size={20} />
                    <span>{lang === 'ur' ? 'گیلری سے تصویر' : 'Gallery'}</span>
                  </button>
                </div>

                {lastImg && (
                  <div className="relative w-full sm:w-40 h-40 rounded-3xl overflow-hidden border border-sky-200 shadow-xl animate-in zoom-in-95 duration-500 group cursor-pointer" onClick={() => setLightboxImage(lastImg)}>
                    <img src={lastImg} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setLastImg(null); }}
                      className="absolute top-3 right-3 p-2 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-colors z-10"
                    >
                      <X size={18} />
                    </button>
                    <div className="absolute inset-0 bg-sky-900/10 group-hover:bg-transparent transition-colors"></div>
                  </div>
                )}
              </div>
              
              <button
                onClick={addItem}
                className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-sky-600 text-white rounded-2xl hover:bg-sky-700 transition-all shadow-xl shadow-sky-200 hover:-translate-y-1 active:translate-y-0"
              >
                <Plus size={24} className="text-gold" />
                <span className="font-bold urdu-text text-xl">{t.addItem}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary & Totals */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-sky-100 space-y-6 sticky top-24 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 bg-sky-50 border-bl border-sky-100 rounded-bl-2xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Invoice Draft</span>
              </div>
            <h3 className="text-xl font-bold text-sky-800 urdu-text flex items-center gap-2 mb-4 pt-4">
              <ShoppingBag className="text-gold" size={24} />
              {lang === 'ur' ? 'بل کی تفصیل (Invoice Summary)' : 'Bill Summary'}
            </h3>

            <div className="space-y-3">
              <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-sky-100">
                {billItems.map((item, idx) => (
                  <div key={idx} className="group p-4 bg-sky-50 rounded-2xl border border-sky-100 hover:bg-white hover:border-gold/30 hover:shadow-md transition-all mb-3 relative overflow-hidden">
                    {item.t < 0 && <div className="absolute top-0 right-0 bg-red-500 text-[8px] text-white px-2 py-0.5 rounded-bl font-black uppercase tracking-tighter">RETURN</div>}
                    <div className="flex gap-4">
                      {item.img && (
                        <div 
                          onClick={() => setLightboxImage(item.img!)}
                          className="w-14 h-14 rounded-xl overflow-hidden border border-sky-100 flex-shrink-0 shadow-sm cursor-pointer hover:border-gold duration-200 transition-colors"
                          title={lang === 'ur' ? 'تصویر دیکھیں' : 'View Image'}
                        >
                          <img src={item.img} alt={item.n} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-zinc-900 text-sm urdu-text line-clamp-1 truncate pr-2">{item.n}</h4>
                          <button onClick={() => removeItem(idx)} className="text-zinc-300 hover:text-red-500 transition-colors p-1">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] font-mono font-bold text-zinc-500 bg-white px-2 py-0.5 rounded border border-sky-100">{item.w}g @ {item.r.toLocaleString()}</span>
                          <span className={`font-black text-sm ${item.t < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                            {item.t < 0 ? '-' : ''}Rs. {Math.abs(item.t).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {billItems.length === 0 && (
                  <div className="py-12 text-center bg-sky-50 rounded-3xl border-2 border-dashed border-sky-100 group hover:border-gold/30 transition-colors">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-sky-200 group-hover:text-gold transition-colors shadow-sm">
                      <ShoppingBag size={24} />
                    </div>
                    <p className="text-sky-300 text-xs font-bold uppercase tracking-widest urdu-text">{lang === 'ur' ? 'کوئی آئٹم نہیں' : 'Cart is Empty'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Old Gold Section */}
            <div className="pt-6 border-t border-sky-100 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-sky-400 uppercase tracking-widest urdu-text">{t.oldGold}</h4>
                <div className="w-12 h-1 bg-sky-100 rounded-full"></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 ml-1 urdu-text">{t.totalWeight}</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.oTotalWt || ''}
                    onChange={e => setFormData({ ...formData, oTotalWt: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-sky-50 border border-sky-100 rounded-xl focus:bg-white text-sm font-bold text-zinc-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 ml-1 urdu-text">{t.netWeight}</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.oNetWt || ''}
                    onChange={e => setFormData({ ...formData, oNetWt: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-sky-50 border border-sky-100 rounded-xl focus:bg-white text-sm font-bold text-zinc-700"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center p-4 bg-sky-900 rounded-2xl text-gold text-xs border border-sky-800 shadow-inner">
                <span className="urdu-text font-bold">{lang === 'ur' ? 'پرانے سونے کی قیمت' : 'Current Value'}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px]">PKR</span>
                  <span className="font-black text-lg">{calcOldValue().toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={addOldGold}
                disabled={!formData.oNetWt || !formData.iRate}
                className="w-full py-3 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-600 hover:text-white transition-all disabled:opacity-30 urdu-text text-sm font-bold shadow-sm"
              >
                {lang === 'ur' ? 'واپسی بل میں شامل کریں' : 'Add Return to Bill'}
              </button>
            </div>

            {/* Final Totals */}
            <div className="pt-6 border-t-4 border-double border-sky-100 space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-zinc-500 font-bold urdu-text">{t.totalAmount}</span>
                <span className="text-xl font-bold text-zinc-900">Rs. {getGrandTotal().toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center bg-sky-50 p-4 rounded-2xl border border-sky-100">
                <span className="text-zinc-500 font-bold urdu-text">{t.receivedAmount}</span>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.recAmt || ''}
                    onChange={e => setFormData({ ...formData, recAmt: Number(e.target.value) })}
                    className="w-32 px-4 py-2 bg-white border border-sky-100 rounded-xl text-right font-black text-zinc-900 focus:ring-2 focus:ring-gold outline-none"
                  />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-gold"></span>
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center p-6 bg-gold text-black rounded-3xl shadow-xl shadow-gold/20 border-2 border-white/20">
                <span className="font-black urdu-text text-lg uppercase tracking-tight">{t.remainingAmount}</span>
                <span className="text-3xl font-black text-black tracking-tighter">Rs. {getRemainingAmount().toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={billItems.length === 0 || !formData.cName}
                className="w-full py-6 bg-sky-600 border-2 border-sky-500 text-white rounded-3xl font-black shadow-2xl hover:bg-sky-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 urdu-text text-2xl flex items-center justify-center gap-4 group"
              >
                <div className="p-2 bg-gold text-black rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-gold/40">
                  <CheckCircle2 size={28} />
                </div>
                <span>{lang === 'ur' ? 'بل مکمل کریں (Finish)' : 'Complete & Print'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ContactPickerModal
        isOpen={isContactPickerOpen}
        onClose={() => setIsContactPickerOpen(false)}
        onSelect={(contact) => {
          setFormData(prev => ({
            ...prev,
            cName: contact.name || prev.cName,
            cPhone: contact.phone || prev.cPhone
          }));
        }}
        lang={lang}
      />
      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} title={lang === 'ur' ? 'بل آئٹم تصویر' : 'Invoice Item Image'} />
      )}
    </div>
  );
}
