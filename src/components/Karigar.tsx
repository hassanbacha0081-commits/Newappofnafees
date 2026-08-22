import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type KarigarRecord } from '../db';
import { translations, type Language } from '../translations';
import { formatCurrency, formatDate, formatWhatsAppUrl, compressImage, shareImageToWhatsApp } from '../lib/utils';
import { Plus, Check, Trash2, Camera, RotateCcw, MessageCircle, Printer, Edit, Image as ImageIcon, AlertTriangle, X, Download, AlertCircle, Users, Search, Eye } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { html2canvasWithOklch as html2canvas } from '../lib/html2canvas-helper';
import jsPDF from 'jspdf';
import { PrintReceipt } from './PrintReceipt';
import { ConfirmModal } from './ConfirmModal';
import { MultiSelectInput } from './MultiSelectInput';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';

import { APP_CONFIG } from '../config';

interface KarigarProps {
  lang: Language;
}

import ImageLightbox from './ImageLightbox';
import ContactPickerModal from './ContactPickerModal';

export default function Karigar({ lang }: KarigarProps) {
  const t = translations[lang];
  const [editId, setEditId] = useState<number | null>(null);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [lightboxData, setLightboxData] = useState<{ src: string; title?: string; phone?: string; caption?: string } | null>(null);
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    task: '',
    given: 0,
    rec: 0,
    kaatIn: 0
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [baqayaFilter, setBaqayaFilter] = useState<'all' | 'pending' | 'cleared'>('all');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [settlementData, setSettlementData] = useState<{ record: KarigarRecord; amount: number; date: string } | null>(null);

  const [printData, setPrintData] = useState<{ data: KarigarRecord, id: number } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Karigar_${printData?.id || 'new'}`,
    onAfterPrint: () => setIsPrinting(false)
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && pdfUrl) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        await CapPrinter.printBase64({
          name: `Karigar_${printData?.id || 'new'}`,
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

  const generatePDF = async (data: KarigarRecord, id: number): Promise<string | null> => {
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
      console.error(error);
      return null;
    } finally {
      setIsPrinting(false);
    }
  };

  const downloadPDF = async () => {
    if (!pdfUrl) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `Karigar_${printData?.data.name || 'record'}_${Date.now()}.pdf`;
        const base64Data = pdfUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Karigar Receipt',
          url: savedFile.uri,
        });
      } catch (e) {
        console.error('Error sharing PDF', e);
        alert(lang === 'ur' ? "فائل شیئر کرنے میں خرابی پیش آئی" : "Error sharing file");
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Karigar_${printData?.data.name || 'record'}.pdf`;
      link.click();
    }
  };

  const rawKarigars = useLiveQuery(() => {
    if (!db.karigars) return Promise.resolve([]);
    return db.karigars.orderBy('id').reverse().toArray();
  }) || [];

  const karigars = useMemo(() => {
    let result = rawKarigars;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(k => 
        k.name.toLowerCase().includes(term) || 
        k.phone.includes(searchTerm) ||
        k.task.toLowerCase().includes(term) ||
        k.id?.toString() === searchTerm
      );
    }

    if (baqayaFilter === 'pending') {
      result = result.filter(k => (k.net - (k.receivedRemaining || 0)) > 0.005);
    } else if (baqayaFilter === 'cleared') {
      result = result.filter(k => (k.net - (k.receivedRemaining || 0)) <= 0.005);
    }

    return result;
  }, [rawKarigars, searchTerm, baqayaFilter]);

  const { totalGivenGold, totalReceivedGold, totalPendingGoldCount, totalPendingGoldWeight } = useMemo(() => {
    let given = 0;
    let rec = 0;
    let count = 0;
    let pendingWt = 0;
    rawKarigars.forEach(k => {
      given += (k.given || 0);
      rec += (k.rec || 0);
      const rem = (k.net || 0) - (k.receivedRemaining || 0);
      if (rem > 0.005) {
        count += 1;
        pendingWt += rem;
      }
    });
    return {
      totalGivenGold: given,
      totalReceivedGold: rec,
      totalPendingGoldCount: count,
      totalPendingGoldWeight: pendingWt
    };
  }, [rawKarigars]);

  const reCalc = () => {
    const g = formData.given || 0;
    const r = formData.rec || 0;
    const ki = formData.kaatIn || 0;
    const res = (r / 12.150) * ki;
    const net = (g - r) - res;
    return { res: res.toFixed(2), net: net.toFixed(2) };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        setCurrentImg(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return alert(lang === 'ur' ? "نام لکھیں!" : "Name is required!");
    
    const { res, net } = reCalc();
    const entry: KarigarRecord = {
      name: formData.name,
      phone: formData.phone,
      task: formData.task,
      given: formData.given,
      rec: formData.rec,
      kaat: parseFloat(res),
      net: parseFloat(net),
      img: currentImg,
      date: formatDate(new Date(), 'ur-PK')
    };

    if (editId) {
      entry.id = editId;
      const old = await db.karigars.get(editId);
      if (old) {
        if (!currentImg) entry.img = old.img;
        entry.receivedRemaining = old.receivedRemaining;
        entry.settledDate = old.settledDate;
      }
      await db.karigars.put(entry);
    } else {
      await db.karigars.add(entry);
    }

    setEditId(null);
    setCurrentImg(null);
    setFormData({
      name: '',
      phone: '',
      task: '',
      given: 0,
      rec: 0,
      kaatIn: 0
    });
  };

  const editE = (v: KarigarRecord) => {
    setEditId(v.id!);
    setFormData({
      name: v.name,
      phone: v.phone,
      task: v.task,
      given: v.given,
      rec: v.rec,
      kaatIn: 0 // KaatIn is not stored, but we can infer if needed or just reset
    });
    setCurrentImg(v.img || null);
    window.scrollTo(0, 0);
  };

  const delE = async (id: number) => {
    await db.karigars.delete(id);
    setDeleteId(null);
  };

  const sendW = (p: string, n: string, b: number) => {
    const msg = `السلام علیکم ${n}! ${APP_CONFIG.shopNameUrdu}: بقایا سونا ${parseFloat(b.toString()).toFixed(2)}g.`;
    const url = formatWhatsAppUrl(p, msg);
    if (url) window.open(url, '_blank');
  };

  const showImg = (src: string, name?: string, phone?: string) => {
    setLightboxData({
      src,
      title: name ? `${name} - ${lang === 'ur' ? 'لیبارٹری رپورٹ' : 'Lab Report'}` : (lang === 'ur' ? 'لیبارٹری رپورٹ' : 'Lab Report'),
      phone,
      caption: name ? `*نفیس جیولرز - کاریگر رپورٹ*\nکاریگر: ${name}` : undefined
    });
  };

  const { res, net } = reCalc();

  return (
    <div className="container mx-auto pb-20">
      {/* Print Preview Modal */}
      {showPrintPreview && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black-80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-zinc-50">
              <h3 className="text-xl font-bold urdu-text text-black">پرنٹ پریویو (Print Preview)</h3>
              <button 
                type="button"
                onClick={() => {
                  setShowPrintPreview(false);
                  setPrintData(null);
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
                  type="karigar" 
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
                className="flex-[2] min-w-[200px] bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg"
              >
                <Printer size={24} />
                <span className="urdu-text text-xl">پرنٹ کریں (Print)</span>
              </button>

              <button 
                type="button"
                disabled={!pdfUrl}
                onClick={downloadPDF}
                className="flex-1 min-w-[150px] bg-gold hover:bg-gold-light text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Download size={24} />
                <span className="urdu-text text-xl text-black">PDF ڈاؤن لوڈ</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  setShowPrintPreview(false);
                  setPrintData(null);
                  setPdfUrl(null);
                }}
                className="flex-1 min-w-[100px] bg-zinc-100 text-zinc-600 font-bold py-4 rounded-xl hover:bg-zinc-200 transition-all urdu-text text-xl"
              >
                بند کریں
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && delE(deleteId)}
        title={lang === 'ur' ? 'ڈیلیٹ کریں؟' : 'Confirm Delete'}
        message={lang === 'ur' ? 'کیا آپ واقعی اس ریکارڈ کو حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this record?'}
        lang={lang}
      />

      {/* Karigar Stats Block */}
      <div className="flex gap-6 p-4 bg-white border border-sky-200 rounded-xl shadow-sm overflow-x-auto mb-6">
        <div className="flex flex-col flex-shrink-0 min-w-32">
          <span className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'کُل دیا گیا سونا:' : 'Total Given Gold:'}</span>
          <span className="text-2xl font-black text-gold-dark font-mono">{totalGivenGold.toFixed(2)}g</span>
        </div>
        <div className="flex flex-col flex-shrink-0 min-w-32 border-l border-sky-100 pl-6">
          <span className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'کُل وصول سونا:' : 'Total Received Gold:'}</span>
          <span className="text-2xl font-black text-sky-700 font-mono">{totalReceivedGold.toFixed(2)}g</span>
        </div>
        {totalPendingGoldCount > 0 && (
          <div className="flex flex-col flex-shrink-0 min-w-40 border-l border-red-200 pl-6 bg-red-50/60 -my-4 py-4 pr-4 rounded-r-xl">
            <span className="text-xs text-red-600 urdu-text font-bold flex items-center gap-1">
              <AlertCircle size={12} />
              {lang === 'ur' ? 'کُل بقایا سونا (کاریگر):' : 'Total Outstanding Gold:'}
            </span>
            <span className="text-2xl font-black text-red-600 font-mono">
              {totalPendingGoldWeight.toFixed(2)}g
            </span>
            <span className="text-[10px] text-red-500 font-bold urdu-text">
              ({totalPendingGoldCount} {lang === 'ur' ? 'کاریگروں کے پاس سونا بقایا ہے' : 'karigars with pending gold'})
            </span>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-gold mb-6 border border-sky-200">
        <h3 className="text-xl font-bold mb-4 urdu-text text-gold-dark"><i className="fas fa-hammer"></i> کاریگر انٹری (V68)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            type="text" 
            placeholder={t.karigarLabels.name}
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-4 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center"
          />
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={t.karigarLabels.mobile}
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="flex-1 p-4 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-mono font-bold"
            />
            <button
              type="button"
              onClick={() => setIsContactPickerOpen(true)}
              className="px-4 bg-gold/10 hover:bg-gold/25 text-gold-dark border border-gold/30 rounded-xl flex items-center justify-center transition-all cursor-pointer"
              title={lang === 'ur' ? 'رابطہ منتخب کریں' : 'Browse Contacts'}
            >
              <Users size={18} />
            </button>
          </div>
          <MultiSelectInput 
            options={t.itemDetailsList}
            placeholder={t.karigarLabels.taskDetail}
            value={formData.task}
            onChange={val => setFormData({ ...formData, task: val })}
            lang={lang}
          />
          <input 
            type="number" 
            placeholder={t.karigarLabels.givenTotal}
            value={formData.given || ''}
            onChange={e => setFormData({ ...formData, given: Number(e.target.value) })}
            className="w-full p-4 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center"
          />
          <input 
            type="number" 
            placeholder={t.karigarLabels.returnRec}
            value={formData.rec || ''}
            onChange={e => setFormData({ ...formData, rec: Number(e.target.value) })}
            className="w-full p-4 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center"
          />
          <input 
            type="number" 
            placeholder={t.karigarLabels.kaatInput}
            value={formData.kaatIn || ''}
            onChange={e => setFormData({ ...formData, kaatIn: Number(e.target.value) })}
            className="w-full p-4 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center"
          />
          <div className="w-full p-4 bg-zinc-50 border border-transparent text-gold-dark font-bold rounded-xl flex justify-center items-center gap-2">
            <span className="urdu-text text-lg">{t.karigarLabels.kaatCalc}:</span>
            <span className="text-xl">{res}</span>
          </div>
          <div className="w-full p-4 bg-zinc-50 border border-transparent text-gold-dark font-bold rounded-xl md:col-span-2 flex justify-center items-center gap-2">
            <span className="urdu-text text-lg">{t.karigarLabels.pureBalance}:</span>
            <span className="text-2xl font-black">{net}g</span>
          </div>
        </div>
        
        <div className="mt-6 space-y-3">
          <label className="text-sm text-zinc-500 urdu-text block text-right pr-2">{t.karigarLabels.labReport}</label>
          <div className="flex flex-col gap-4">
            <div className="w-full flex gap-2">
              <div className="flex-1">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                  id="karigarCameraInput"
                />
                <label 
                  htmlFor="karigarCameraInput"
                  className="w-full min-h-[80px] flex items-center justify-center gap-3 p-4 border-2 border-dashed border-sky-200 rounded-xl text-zinc-400 cursor-pointer hover:border-gold hover:text-gold transition-all bg-white"
                >
                  <Camera size={26} />
                  <span className="urdu-text text-lg">
                    {lang === 'ur' ? 'کیمرہ' : 'Camera'}
                  </span>
                </label>
              </div>

              <div className="flex-1">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="hidden"
                  id="karigarGalleryInput"
                />
                <label 
                  htmlFor="karigarGalleryInput"
                  className="w-full min-h-[80px] flex items-center justify-center gap-3 p-4 border-2 border-dashed border-sky-200 rounded-xl text-zinc-400 cursor-pointer hover:border-gold hover:text-gold transition-all bg-white"
                >
                  <ImageIcon size={26} />
                  <span className="urdu-text text-lg">
                    {lang === 'ur' ? 'گیلری' : 'Gallery'}
                  </span>
                </label>
              </div>
            </div>

            {currentImg && (
              <div 
                className="relative w-full sm:w-64 h-64 rounded-xl overflow-hidden border-2 border-gold shadow-lg animate-in zoom-in-95 duration-200 cursor-pointer group" 
                onClick={() => setLightboxData({
                  src: currentImg,
                  title: formData.name ? `${formData.name} - ${lang === 'ur' ? 'کاریگر تصویر' : 'Karigar Image'}` : (lang === 'ur' ? 'کاریگر تصویر' : 'Karigar Image'),
                  phone: formData.phone,
                  caption: `*نفیس جیولرز - کاریگر حساب*\nکاریگر: ${formData.name || '-'}\nفون: ${formData.phone || '-'}\nکام: ${formData.task || '-'}\nدیا گیا سونا: ${formData.given || 0}g\nواپسی: ${formData.rec || 0}g`
                })}
              >
                <img src={currentImg} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <button 
                    type="button"
                    onClick={async (e) => { 
                      e.stopPropagation(); 
                      await shareImageToWhatsApp({
                        imageSrc: currentImg,
                        phone: formData.phone,
                        caption: `*نفیس جیولرز - کاریگر حساب*\nکاریگر: ${formData.name || '-'}\nفون: ${formData.phone || '-'}\nکام: ${formData.task || '-'}\nدیا گیا سونا: ${formData.given || 0}g\nواپسی: ${formData.rec || 0}g`,
                        title: `Karigar - ${formData.name}`
                      });
                    }}
                    className="p-2 bg-green-600 text-white rounded-full shadow-xl hover:bg-green-700 transition-colors"
                    title="WhatsApp Photo"
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCurrentImg(null); }}
                    className="p-2 bg-red-600 text-white rounded-full shadow-xl hover:bg-red-700 transition-colors"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="w-full p-4 bg-gold text-black font-bold rounded-lg shadow-lg shadow-gold-20 mt-6 urdu-text text-lg"
        >
          {editId ? (lang === 'ur' ? "اپ ڈیٹ کریں" : "Update") : (lang === 'ur' ? "محفوظ کریں" : "Save")}
        </button>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white p-4 rounded-xl border border-sky-200 shadow-sm">
        <div className="relative flex-1">
          <input 
            type="text" 
            className="w-full p-3.5 pl-11 pr-10 bg-zinc-50 border border-sky-200 rounded-xl outline-none focus:border-gold shadow-inner text-black font-semibold text-sm"
            value={searchTerm}
            placeholder={lang === 'ur' ? 'نام، موبائل یا کام کی تفصیل سے تلاش کریں...' : 'Search by name, mobile, or task detail...'}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
            <Search size={18} />
          </div>
          {searchTerm && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
              <X size={18} className="cursor-pointer hover:text-red-500" onClick={() => setSearchTerm('')} />
            </div>
          )}
        </div>

        {/* Baqaya Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setBaqayaFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all urdu-text ${
              baqayaFilter === 'all' 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-600 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            {lang === 'ur' ? 'تمام کاریگر (All)' : 'All Karigars'}
          </button>
          <button
            onClick={() => setBaqayaFilter('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 urdu-text ${
              baqayaFilter === 'pending' 
                ? 'bg-red-600 text-white shadow-sm' 
                : 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
            }`}
          >
            <AlertCircle size={14} />
            <span>{lang === 'ur' ? 'صرف بقایا سونا والے' : 'With Pending Gold'}</span>
            {totalPendingGoldCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                baqayaFilter === 'pending' ? 'bg-white text-red-700' : 'bg-red-600 text-white'
              }`}>
                {totalPendingGoldCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setBaqayaFilter('cleared')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 urdu-text ${
              baqayaFilter === 'cleared' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Check size={14} />
            <span>{lang === 'ur' ? 'مکمل کلیئر' : 'Cleared'}</span>
          </button>

          {searchTerm && (
            <span className="bg-gold/10 text-gold-dark border border-gold/30 px-3 py-2 rounded-xl text-xs font-bold font-mono whitespace-nowrap self-center text-center">
              {lang === 'ur' ? `${karigars?.length || 0} کاریگر ملے` : `${karigars?.length || 0} karigars found`}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {karigars?.map((v) => {
          const outstandingGold = v.net - (v.receivedRemaining || 0);
          const hasBaqaya = outstandingGold > 0.005;
          return (
            <div 
              key={v.id} 
              className={`bg-white p-4 rounded-xl shadow-sm transition-all ${
                hasBaqaya 
                  ? 'border-2 border-red-400 ring-2 ring-red-100 border-r-8 border-r-red-500' 
                  : 'border border-sky-200 border-r-8 border-r-emerald-500'
              }`}
            >
              <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold urdu-text text-zinc-500">کاریگر / تاریخ:</span>
                  <span className="text-sm text-zinc-900 font-bold">{v.name}</span>
                  <span className="text-xs text-zinc-500 font-mono">({v.date})</span>
                  {v.task && (
                    <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-[11px] font-bold border border-sky-100 urdu-text">
                      {v.task}
                    </span>
                  )}
                </div>
                {hasBaqaya ? (
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-black border border-red-300 flex items-center gap-1 urdu-text">
                    <AlertCircle size={12} className="text-red-600" />
                    بقایا سونا: {outstandingGold.toFixed(2)}g
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300 flex items-center gap-1 urdu-text">
                    <Check size={12} className="text-emerald-700" />
                    صاف کلیئر
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-xs">
                <div>
                  <span className="text-zinc-500 block urdu-text">دیا گیا:</span>
                  <span className="font-mono font-bold text-zinc-800">{v.given}g</span>
                </div>
                <div>
                  <span className="text-zinc-500 block urdu-text">واپسی وصول:</span>
                  <span className="font-mono font-bold text-green-700">{v.rec}g</span>
                </div>
                <div>
                  <span className="text-zinc-500 block urdu-text">کاٹ / کھاد:</span>
                  <span className="font-mono font-bold text-sky-700">{v.kaat}g</span>
                </div>
                <div>
                  <span className="text-zinc-500 block urdu-text">خالص بقایا سونا:</span>
                  <span className={`font-mono font-black text-sm ${hasBaqaya ? 'text-red-600' : 'text-emerald-600'}`}>
                    {outstandingGold.toFixed(2)}g
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t border-sky-100 flex-wrap">
                <button 
                  onClick={() => {
                    setPrintData({ data: v, id: v.id! });
                    setShowPrintPreview(true);
                    setTimeout(async () => {
                      const url = await generatePDF(v, v.id!);
                        if (url) {
                          setPdfUrl(url);
                        } else {
                          setShowPrintPreview(false);
                          alert('PDF generation failed. Please try again or check the image format.');
                        }
                    }, 400);
                  }}
                  className="flex-1 min-w-[80px] p-2 bg-sky-50 text-gold-dark rounded-lg hover:bg-gold hover:text-black transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-sky-100"
                >
                  <Printer size={14} /> رسید
                </button>
                {outstandingGold > 0.005 && (
                  <button 
                    onClick={() => setSettlementData({ record: v, amount: parseFloat(outstandingGold.toFixed(2)), date: formatDate(new Date(), 'ur-PK') })}
                    className="flex-1 min-w-[100px] p-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-emerald-100"
                  >
                    <Check size={14} /> وصول سونا
                  </button>
                )}
                <button 
                  onClick={() => editE(v)}
                  className="flex-1 min-w-[80px] p-2 bg-sky-50 text-zinc-600 rounded-lg hover:bg-sky-100 transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-sky-100"
                >
                  <Edit size={14} /> ایڈٹ
                </button>
                <button 
                  onClick={() => sendW(v.phone, v.name, outstandingGold)}
                  className="flex-1 min-w-[80px] p-2 bg-green-600-10 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-green-600-20"
                >
                  <MessageCircle size={14} /> واٹس ایپ
                </button>
                {v.img && (
                  <button 
                    onClick={() => setLightboxData({
                      src: v.img!,
                      title: `${v.name} - ${lang === 'ur' ? 'لیبارٹری رپورٹ' : 'Lab Report'}`,
                      phone: v.phone,
                      caption: `*نفیس جیولرز - کاریگر رپورٹ*\nکاریگر: ${v.name}\nفون: ${v.phone || '-'}\nکام: ${v.task || '-'}\nدیا گیا سونا: ${v.given}g\nواپسی: ${v.rec}g\nبقایا سونا: ${parseFloat(outstandingGold.toFixed(2))}g`
                    })}
                    className="flex-1 min-w-[80px] p-2 bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100 transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-sky-100"
                    title={lang === 'ur' ? 'رپورٹ / تصویر دیکھیں' : 'View Report / Image'}
                  >
                    <Eye size={14} /> رپورٹ
                  </button>
                )}
                {v.img && (
                  <button 
                    onClick={async () => {
                      await shareImageToWhatsApp({
                        imageSrc: v.img!,
                        phone: v.phone,
                        caption: `*نفیس جیولرز - کاریگر رپورٹ*\nکاریگر: ${v.name}\nفون: ${v.phone || '-'}\nکام: ${v.task || '-'}\nدیا گیا سونا: ${v.given}g\nواپسی: ${v.rec}g\nبقایا سونا: ${parseFloat(outstandingGold.toFixed(2))}g`,
                        title: `Karigar Report - ${v.name}`
                      });
                    }}
                    className="flex-1 min-w-[80px] p-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-emerald-100"
                    title={lang === 'ur' ? 'تصویر واٹس ایپ کریں' : 'WhatsApp Photo'}
                  >
                    <MessageCircle size={14} className="text-green-600" /> فوٹو
                  </button>
                )}
                <button 
                  onClick={() => v.id && setDeleteId(v.id)}
                  className="flex-1 min-w-[80px] p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-red-200"
                >
                  <Trash2 size={14} /> ختم
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ContactPickerModal
        isOpen={isContactPickerOpen}
        onClose={() => setIsContactPickerOpen(false)}
        onSelect={(contact) => {
          setFormData(prev => ({
            ...prev,
            name: contact.name || prev.name,
            phone: contact.phone || prev.phone
          }));
        }}
        lang={lang}
      />
      
      {/* Settle Remaining Gold Modal */}
      {settlementData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-sky-100">
            <div className="p-5 border-b flex justify-between items-center bg-sky-950/5">
              <h3 className="text-lg font-bold urdu-text text-sky-950">بقایا سونا وصول کریں (Receive Gold)</h3>
              <button 
                type="button"
                onClick={() => setSettlementData(null)}
                className="p-1.5 hover:bg-zinc-150 rounded-full text-zinc-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-right">
                <span className="text-xs font-bold text-zinc-400 urdu-text block mb-1">کاریگر کا نام</span>
                <p className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl text-zinc-800 font-bold text-sm text-center">{settlementData.record.name}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">تاریخ وصولی (Date)</label>
                <input 
                  type="text" 
                  value={settlementData.date}
                  onChange={e => setSettlementData({ ...settlementData, date: e.target.value })}
                  className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">وصول شدہ وزن - گرام (Gold Weight)</label>
                <input 
                  type="number" 
                  placeholder="0.00g"
                  value={settlementData.amount || ''}
                  onChange={e => setSettlementData({ ...settlementData, amount: Number(e.target.value) })}
                  className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-mono font-bold text-emerald-600 text-lg"
                />
              </div>
            </div>

            <div className="p-5 border-t bg-zinc-50 flex gap-3">
              <button 
                type="button"
                onClick={() => setSettlementData(null)}
                className="flex-1 py-3 bg-zinc-200 text-zinc-700 font-bold rounded-xl hover:bg-zinc-300 transition-all urdu-text text-base"
              >
                کینسل (Cancel)
              </button>
              <button 
                type="button"
                onClick={async () => {
                  if (settlementData.amount <= 0) {
                    alert(lang === 'ur' ? "براہ کرم درست وزن لکھیں!" : "Please enter a valid weight!");
                    return;
                  }
                  const updatedRecord: KarigarRecord = {
                    ...settlementData.record,
                    receivedRemaining: (settlementData.record.receivedRemaining || 0) + settlementData.amount,
                    settledDate: settlementData.date
                  };
                  await db.karigars.put(updatedRecord);
                  setSettlementData(null);
                }}
                className="flex-[2] py-3 bg-gold text-black font-bold rounded-xl hover:bg-gold-light transition-all urdu-text text-base shadow-md"
              >
                محفوظ کریں (Settle)
              </button>
            </div>
          </div>
        </div>
      )}
      {lightboxData && (
        <ImageLightbox 
          src={lightboxData.src} 
          onClose={() => setLightboxData(null)} 
          title={lightboxData.title || (lang === 'ur' ? 'لیبارٹری رپورٹ' : 'Lab Report')} 
          phone={lightboxData.phone}
          caption={lightboxData.caption}
        />
      )}
    </div>
  );
}
