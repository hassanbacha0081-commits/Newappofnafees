import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Repair } from '../db';
import { translations, type Language } from '../translations';
import { formatCurrency, formatDate, formatWhatsAppUrl, compressImage } from '../lib/utils';
import { Plus, Check, Trash2, Clock, MessageCircle, Printer, Camera, RotateCcw, X, AlertTriangle, Download, AlertCircle, Search } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PrintReceipt } from './PrintReceipt';
import { MultiSelectInput } from './MultiSelectInput';
import { ConfirmModal } from './ConfirmModal';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';

import { APP_CONFIG } from '../config';

interface RepairsProps {
  lang: Language;
}

import ImageLightbox from './ImageLightbox';

export default function Repairs({ lang }: RepairsProps) {
  const t = translations[lang];
  const [isAdding, setIsAdding] = useState(false);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Repair>>({
    customerName: '',
    customerPhone: '',
    item: '',
    issue: '',
    charges: 0,
    status: 'Pending'
  });

  const [printData, setPrintData] = useState<{ data: Repair } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Repair_${printData?.data.customerName || 'new'}`,
    onAfterPrint: () => {
      setIsPrinting(false);
    }
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && pdfUrl) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        await CapPrinter.printBase64({
          name: `Repair_${printData?.data.customerName || 'new'}`,
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

  const generatePDF = async (data: Repair): Promise<string | null> => {
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
        const fileName = `Repair_${printData?.data.customerName || 'new'}_${Date.now()}.pdf`;
        const base64Data = pdfUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Repair Receipt',
          url: savedFile.uri,
        });
      } catch (e) {
        console.error('Error sharing PDF', e);
        alert(lang === 'ur' ? "فائل شیئر کرنے میں خرابی پیش آئی" : "Error sharing file");
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Repair_${printData?.data.customerName || 'new'}.pdf`;
      link.click();
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const repairs = useLiveQuery(() => {
    if (!db.repairs) return Promise.resolve([]);
    if (!searchTerm) return db.repairs.orderBy('date').reverse().toArray();
    
    const term = searchTerm.toLowerCase();
    return db.repairs
      .filter(r => 
        r.customerName.toLowerCase().includes(term) || 
        r.customerPhone.includes(searchTerm) ||
        r.issue.toLowerCase().includes(term) ||
        r.item.toLowerCase().includes(term) ||
        r.id?.toString() === searchTerm
      )
      .reverse()
      .toArray();
  }, [searchTerm]);

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
    if (!formData.customerName) return;
    const repair: Repair = {
      ...formData as Repair,
      date: new Date(),
      img: currentImg
    };
    await db.repairs.add(repair);
    setPrintData({ data: repair });
    setShowPrintPreview(true);
    
    // Generate PDF for preview fast (100ms timeout)
    setTimeout(async () => {
      const url = await generatePDF(repair);
                      if (url) {
                        setPdfUrl(url);
                      } else {
                        setShowPrintPreview(false);
                        alert('PDF generation failed. Please try again or check the image format.');
                      }
    }, 400);

    setIsAdding(false);
    setCurrentImg(null);
    setFormData({ customerName: '', customerPhone: '', item: '', issue: '', charges: 0, status: 'Pending' });
  };

  const handleStatusChange = async (id: number, status: 'Pending' | 'Done') => {
    await db.repairs.update(id, { status });
  };

  const handleDelete = async (id: number) => {
    await db.repairs.delete(id);
    setDeleteId(null);
  };

  const shareWhatsApp = (repair: Repair) => {
    const msg = `*${APP_CONFIG.shopNameUrdu}: مرمت رسید*\n` +
      `گاہک: ${repair.customerName}\n` +
      `آئٹم: ${repair.item}\n` +
      `مسئلہ: ${repair.issue}\n` +
      `چارجز: Rs. ${repair.charges.toLocaleString()}\n` +
      `حالت: ${repair.status === 'Done' ? 'تیار ہے' : 'زیر التواء'}\n` +
      `شکریہ!`;
    
    const url = formatWhatsAppUrl(repair.customerPhone, msg);
    if (url) window.open(url, '_blank');
  };

    return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title={lang === 'ur' ? 'ڈیلیٹ کریں؟' : 'Confirm Delete'}
        message={lang === 'ur' ? 'کیا آپ واقعی اس ریکارڈ کو حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this record?'}
        lang={lang}
      />
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
                  type="repair" 
                  data={printData.data} 
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

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-sky-200 shadow-sm gap-4">
        <div className="relative flex-1 max-w-md">
          <input 
            type="text" 
            className="w-full p-3 pl-10 bg-zinc-50 border border-sky-200 rounded-lg outline-none focus:border-gold text-black shadow-inner"
            value={searchTerm}
            placeholder={lang === 'ur' ? 'تلاش کریں...' : 'Search...'}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            {searchTerm ? (
              <X size={18} className="cursor-pointer hover:text-red-500" onClick={() => setSearchTerm('')} />
            ) : (
              <Search size={18} />
            )}
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-gold text-black font-bold px-6 py-3 rounded-xl hover:bg-gold-light transition-all shadow-lg shadow-gold-20 whitespace-nowrap"
        >
          <Plus size={20} />
          <span className="urdu-text">{t.add}</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-sky-200 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{t.customerName}</label>
              <input 
                type="text" 
                value={formData.customerName}
                onChange={e => setFormData({...formData, customerName: e.target.value})}
                className="w-full bg-white border border-sky-200 rounded-lg p-3 focus:border-gold outline-none text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{t.phoneNumber}</label>
              <input 
                type="text" 
                value={formData.customerPhone}
                onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                className="w-full bg-white border border-sky-200 rounded-lg p-3 focus:border-gold outline-none text-black"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{t.itemName}</label>
                <MultiSelectInput 
                  options={t.itemDetailsList}
                  value={formData.item}
                  onChange={val => setFormData({...formData, item: val})}
                  lang={lang}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{t.charges}</label>
                <input 
                  type="number" 
                  value={formData.charges || ''}
                  onChange={e => setFormData({...formData, charges: Number(e.target.value)})}
                  className="w-full bg-white border border-sky-200 rounded-lg p-3 focus:border-gold outline-none text-black"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{t.issue}</label>
              <input 
                type="text" 
                value={formData.issue}
                onChange={e => setFormData({...formData, issue: e.target.value})}
                className="w-full bg-white border border-sky-200 rounded-lg p-3 focus:border-gold outline-none text-black"
              />
            </div>
            <div className="mt-4 space-y-3">
              <label className="text-sm font-medium text-zinc-500 mb-1 urdu-text">تصویر (کیمرہ):</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="camera"
                    onChange={handleFileChange}
                    className="hidden"
                    id="repairsCameraInput"
                  />
                  <label 
                    htmlFor="repairsCameraInput"
                    className="w-full min-h-[50px] flex items-center justify-center gap-2 p-3 border-2 border-dashed border-sky-200 rounded-lg text-zinc-500 cursor-pointer hover:border-gold hover:text-gold transition-all bg-sky-50"
                  >
                    <Camera size={20} />
                    <span className="urdu-text">{currentImg ? (lang === 'ur' ? 'تصویر تبدیل کریں' : 'Change Image') : t.captureImage}</span>
                  </label>
                </div>

                {currentImg && (
                  <div className="relative w-full sm:w-48 h-48 rounded-xl overflow-hidden border-2 border-gold shadow-lg animate-in zoom-in-95 duration-200 cursor-pointer group" onClick={() => setLightboxImage(currentImg)}>
                    <img src={currentImg} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCurrentImg(null); }}
                      className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full shadow-xl hover:bg-red-700 transition-colors z-10"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-6">
              <button 
                onClick={handleSave}
                className="flex-1 bg-gold text-black font-bold py-3 rounded-lg hover:bg-gold-light transition-all urdu-text shadow-lg shadow-gold-20"
              >
                {t.save}
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 bg-sky-50 text-zinc-600 font-bold py-3 rounded-lg hover:bg-sky-100 transition-all urdu-text border border-sky-200"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {repairs?.map((repair) => (
          <div key={repair.id} className="bg-white p-5 rounded-xl border border-sky-200 hover:border-gold-30 transition-all group shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">{repair.customerName}</h3>
                <p className="text-sm text-zinc-500">{repair.customerPhone}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold urdu-text ${
                repair.status === 'Done' ? 'bg-green-600-20 text-green-600' : 'bg-yellow-600-20 text-yellow-600'
              }`}>
                {repair.status === 'Done' ? t.done : t.pending}
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="text-sm text-zinc-700"><span className="text-zinc-500 urdu-text">{t.itemName}:</span> {repair.item}</p>
              <p className="text-sm text-zinc-700"><span className="text-zinc-500 urdu-text">{t.issue}:</span> {repair.issue}</p>
              {repair.img && (
                <div className="flex justify-between text-sky-800 bg-sky-50 px-2 py-1 rounded-md border border-sky-100 text-sm">
                  <span className="urdu-text text-xs">{lang === 'ur' ? 'تصویر' : 'Image'}:</span>
                  <button 
                    onClick={() => setLightboxImage(repair.img!)}
                    className="p-0.5 px-2 bg-sky-200 text-sky-800 rounded font-bold text-xs hover:bg-sky-300 transition-colors"
                  >
                    {lang === 'ur' ? 'دیکھیں' : 'View'}
                  </button>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 urdu-text">{t.charges}:</span>
                <span className="font-bold text-gold-dark">{formatCurrency(repair.charges)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-sky-100">
              {repair.status === 'Pending' && (
                <button 
                  onClick={() => repair.id && handleStatusChange(repair.id, 'Done')}
                  className="p-2 bg-green-600-10 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all border border-green-600-20"
                  title={t.done}
                >
                  <Check size={18} />
                </button>
              )}
              <button 
                onClick={() => shareWhatsApp(repair)}
                className="p-2 bg-green-600-10 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all border border-green-600-20"
                title="WhatsApp"
              >
                <MessageCircle size={18} />
              </button>
              <button 
                onClick={() => {
                  setPrintData({ data: repair });
                  setShowPrintPreview(true);
                  setTimeout(async () => {
                    const url = await generatePDF(repair);
                      if (url) {
                        setPdfUrl(url);
                      } else {
                        setShowPrintPreview(false);
                        alert('PDF generation failed. Please try again or check the image format.');
                      }
                  }, 400);
                }}
                className="p-2 bg-sky-50 text-zinc-600 rounded-lg hover:bg-sky-100 transition-all border border-sky-100"
                title="Print"
              >
                <Printer size={18} />
              </button>
              <button 
                onClick={() => repair.id && setDeleteId(repair.id)}
                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all border border-red-200"
                title={t.delete}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} title={lang === 'ur' ? 'مرمت کی تصویر' : 'Repair Image'} />
      )}
    </div>
  );
}
