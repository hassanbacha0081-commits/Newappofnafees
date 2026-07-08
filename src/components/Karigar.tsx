import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type KarigarRecord } from '../db';
import { translations, type Language } from '../translations';
import { formatCurrency, formatDate, formatWhatsAppUrl, compressImage } from '../lib/utils';
import { Plus, Check, Trash2, Camera, RotateCcw, MessageCircle, Printer, Edit, Image as ImageIcon, AlertTriangle, X, Download, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
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

export default function Karigar({ lang }: KarigarProps) {
  const t = translations[lang];
  const [editId, setEditId] = useState<number | null>(null);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    task: '',
    given: 0,
    rec: 0,
    kaatIn: 0
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

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

  const karigars = useLiveQuery(() => {
    if (!db.karigars) return Promise.resolve([]);
    if (!searchTerm) return db.karigars.orderBy('id').reverse().toArray();
    
    const term = searchTerm.toLowerCase();
    return db.karigars
      .filter(k => 
        k.name.toLowerCase().includes(term) || 
        k.phone.includes(searchTerm) ||
        k.task.toLowerCase().includes(term) ||
        k.id?.toString() === searchTerm
      )
      .reverse()
      .toArray();
  }, [searchTerm]);

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
      // If editing and no new image, keep old image
      if (!currentImg) {
        const old = await db.karigars.get(editId);
        if (old) entry.img = old.img;
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

  const showImg = (src: string) => {
    setLightboxImage(src);
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
          <input 
            type="number" 
            placeholder={t.karigarLabels.mobile}
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            className="w-full p-4 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center"
          />
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
            <div className="w-full">
              <input 
                type="file" 
                accept="image/*" 
                capture="camera"
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
                  {currentImg ? (lang === 'ur' ? 'تصویر تبدیل کریں' : 'Change Image') : t.captureImage}
                </span>
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

        <button 
          onClick={handleSave}
          className="w-full p-4 bg-gold text-black font-bold rounded-lg shadow-lg shadow-gold-20 mt-6 urdu-text text-lg"
        >
          {editId ? (lang === 'ur' ? "اپ ڈیٹ کریں" : "Update") : (lang === 'ur' ? "محفوظ کریں" : "Save")}
        </button>
      </div>

      <div className="mb-6">
        <input 
          type="text" 
          placeholder={t.karigarLabels.searchKarigar}
          className="w-full p-4 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold shadow-sm text-black text-right pr-6"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {karigars?.map((v) => (
          <div 
            key={v.id} 
            className="bg-white p-4 rounded-xl border border-sky-200 shadow-sm border-r-8 border-gold"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold urdu-text text-zinc-500">نام / تاریخ:</span>
              <span className="text-sm text-zinc-900"><b>{v.name}</b> ({v.date})</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold urdu-text text-zinc-500">بقایا:</span>
              <b className="text-red-600 text-lg">{v.net.toFixed(2)}g</b>
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
              <button 
                onClick={() => editE(v)}
                className="flex-1 min-w-[80px] p-2 bg-sky-50 text-zinc-600 rounded-lg hover:bg-sky-100 transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-sky-100"
              >
                <Edit size={14} /> ایڈٹ
              </button>
              <button 
                onClick={() => sendW(v.phone, v.name, v.net)}
                className="flex-1 min-w-[80px] p-2 bg-green-600-10 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-green-600-20"
              >
                <MessageCircle size={14} /> واٹس ایپ
              </button>
              {v.img && (
                <button 
                  onClick={() => showImg(v.img!)}
                  className="flex-1 min-w-[80px] p-2 bg-sky-50 text-zinc-600 rounded-lg hover:bg-sky-100 transition-all text-xs font-bold urdu-text flex items-center justify-center gap-1 border border-sky-100"
                >
                  <ImageIcon size={14} /> رپورٹ
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
        ))}
      </div>

      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} title={lang === 'ur' ? 'لیبارٹری رپورٹ' : 'Lab Report'} />
      )}
    </div>
  );
}
