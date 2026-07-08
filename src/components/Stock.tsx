import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type StockItem } from '../db';
import { translations, type Language } from '../translations';
import { Plus, Trash2, Edit2, Package, Coins, Camera, RotateCcw, Image as ImageIcon, AlertTriangle, Printer, X, Download, AlertCircle, Search } from 'lucide-react';
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

interface StockProps {
  lang: Language;
}

import ImageLightbox from './ImageLightbox';

export default function Stock({ lang }: StockProps) {
  const t = translations[lang];
  const [isAdding, setIsAdding] = useState(false);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<StockItem>>({
    name: '',
    type: 'Gold',
    quantity: 0,
    unit: 'g',
    pieces: 0
  });

  const [printData, setPrintData] = useState<{ data: StockItem, id: number } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Stock_${printData?.id || 'new'}`,
    onAfterPrint: () => setIsPrinting(false)
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && pdfUrl) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        await CapPrinter.printBase64({
          name: `Stock_${printData?.id || 'new'}`,
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

  const generatePDF = async (data: StockItem, id: number): Promise<string | null> => {
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
        const fileName = `Stock_${printData?.data.name || 'item'}_${Date.now()}.pdf`;
        const base64Data = pdfUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Stock Report',
          url: savedFile.uri,
        });
      } catch (e) {
        console.error('Error sharing PDF', e);
        alert(lang === 'ur' ? "فائل شیئر کرنے میں خرابی پیش آئی" : "Error sharing file");
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Stock_${printData?.data.name || 'item'}.pdf`;
      link.click();
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const stock = useLiveQuery(() => {
    if (!db.stock) return Promise.resolve([]);
    if (!searchTerm) return db.stock.toArray();
    
    const term = searchTerm.toLowerCase();
    return db.stock
      .filter(s => 
        s.name.toLowerCase().includes(term) || 
        s.type.toLowerCase().includes(term) ||
        s.id?.toString() === searchTerm
      )
      .toArray();
  }, [searchTerm]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCurrentImg(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return;
    
    try {
      const existing = await db.stock
        .where('[name+type]')
        .equals([formData.name, formData.type || 'Gold'])
        .first();

      const record: StockItem = {
        name: formData.name,
        type: formData.type as 'Gold' | 'Item',
        quantity: formData.quantity || 0,
        unit: formData.unit || 'g',
        pieces: formData.pieces || 0,
        img: currentImg || (existing?.img)
      };

      let finalId: number;
      if (existing && existing.id) {
        record.quantity += existing.quantity;
        record.pieces = (record.pieces || 0) + (existing.pieces || 0);
        await db.stock.update(existing.id, record);
      } else {
        await db.stock.add(record);
      }

      setIsAdding(false);
      setCurrentImg(null);
      setFormData({ name: '', type: 'Gold', quantity: 0, unit: 'g', pieces: 0 });
    } catch (err) {
      console.error("Error saving stock:", err);
      // Fallback if index [name+type] is missing or error
      const record = {
        ...formData as StockItem,
        img: currentImg
      };
      await db.stock.add(record);
      setIsAdding(false);
      setCurrentImg(null);
      setFormData({ name: '', type: 'Gold', quantity: 0, unit: 'g', pieces: 0 });
    }
  };

  const handleDelete = async (id: number) => {
    await db.stock.delete(id);
    setDeleteId(null);
  };

  const showImg = (src: string) => {
    setLightboxImage(src);
  };

    return (
    <div className="space-y-6 pb-20">
      {/* PDF Preview Modal */}
      {showPrintPreview && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black-80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-zinc-50">
              <h3 className="text-xl font-bold urdu-text text-black">اسٹاک رسید (Stock Preview)</h3>
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
                  type="stock" 
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
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title={lang === 'ur' ? 'ڈیلیٹ کریں؟' : 'Confirm Delete'}
        message={lang === 'ur' ? 'کیا آپ واقعی اس آئٹم کو حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this item?'}
        lang={lang}
      />
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

      {/* Stock Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <div className="bg-gradient-to-r from-gold/20 to-gold/5 border border-gold border-opacity-30 p-6 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-zinc-600 font-bold urdu-text text-sm mb-1">{lang === 'ur' ? 'کل سونے کا وزن' : 'Total Gold Weight'}</p>
            <h4 className="text-3xl font-black text-gold-dark">
              {parseFloat((stock?.filter(s => s.unit !== 'pcs').reduce((sum, item) => sum + item.quantity, 0) || 0).toFixed(2))}
              <span className="text-lg font-normal text-gold-80 ml-1">g</span>
            </h4>
          </div>
          <div className="w-14 h-14 bg-gold-20 rounded-full flex items-center justify-center text-gold-dark">
            <Coins size={28} />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-sky-100/80 to-sky-50 border border-sky-200 p-6 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-zinc-600 font-bold urdu-text text-sm mb-1">{lang === 'ur' ? 'کل آئٹمز کی تعداد' : 'Total Items Count'}</p>
            <h4 className="text-3xl font-black text-sky-800">
              {stock?.reduce((sum, item) => sum + (item.pieces || (item.unit === 'pcs' ? item.quantity : 0)), 0) || 0}
              <span className="text-lg font-normal text-sky-600 ml-1">pcs</span>
            </h4>
          </div>
          <div className="w-14 h-14 bg-sky-200 rounded-full flex items-center justify-center text-sky-700">
            <Package size={28} />
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-sky-200 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{t.itemName}</label>
              <MultiSelectInput 
                options={t.itemDetailsList}
                value={formData.name}
                onChange={val => setFormData({...formData, name: val})}
                lang={lang}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{t.workType}</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as any, unit: e.target.value === 'Gold' ? 'g' : 'pcs'})}
                className="w-full bg-white border border-sky-200 rounded-lg p-3 focus:border-gold outline-none text-black"
              >
                <option value="Gold">{t.goldStock}</option>
                <option value="Item">{t.itemStock}</option>
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{lang === 'ur' ? 'وزن (Grams)' : 'Weight (g)'}</label>
                <input 
                  type="number" 
                  value={formData.quantity || ''}
                  onChange={e => setFormData({...formData, quantity: Number(e.target.value), unit: 'g'})}
                  className="w-full bg-white border border-sky-200 rounded-lg p-3 focus:border-gold outline-none text-black"
                  placeholder="0.000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1 urdu-text">{lang === 'ur' ? 'تعداد (Pieces)' : 'Pieces (Qty)'}</label>
                <input 
                  type="number" 
                  value={formData.pieces || ''}
                  onChange={e => setFormData({...formData, pieces: Number(e.target.value)})}
                  className="w-full bg-white border border-sky-200 rounded-lg p-3 focus:border-gold outline-none text-black"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {currentImg ? (
                <div className="relative group cursor-pointer" onClick={() => setLightboxImage(currentImg)}>
                  <img src={currentImg} alt="Preview" className="w-full h-48 object-contain border border-sky-200 rounded-lg group-hover:opacity-95 transition-opacity" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCurrentImg(null); }}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full z-10"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="camera"
                    onChange={handleFileChange}
                    className="hidden"
                    id="stockCameraInput"
                  />
                  <label 
                    htmlFor="stockCameraInput"
                    className="w-full p-3 border-2 border-dashed border-sky-200 rounded-lg text-zinc-500 flex items-center justify-center gap-2 cursor-pointer hover:border-gold hover:text-gold transition-all"
                  >
                    <Camera size={20} />
                    <span className="urdu-text">{t.captureImage}</span>
                  </label>
                </>
              )}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stock?.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-xl border border-sky-200 flex items-center gap-4 group hover:border-gold-30 transition-all shadow-sm">
            <div className={`p-3 rounded-lg ${item.type === 'Gold' ? 'bg-gold-10 text-gold-dark' : 'bg-sky-50 text-zinc-500'}`}>
              {item.type === 'Gold' ? <Coins size={24} /> : <Package size={24} />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-zinc-900 line-clamp-1">{item.name}</h3>
              <div className="flex flex-col mt-1 gap-0.5">
                {item.unit !== 'pcs' && item.quantity > 0 && (
                  <p className="text-xl font-black text-gold-dark">{item.quantity}<span className="text-xs font-normal ml-1 text-zinc-500">g</span></p>
                )}
                {((item.pieces !== undefined && item.pieces > 0) || item.unit === 'pcs') && (
                  <p className="text-lg font-bold text-sky-700">{item.unit === 'pcs' ? item.quantity : item.pieces}<span className="text-xs font-normal ml-1 text-zinc-500">pcs</span></p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  setPrintData({ data: item, id: item.id! });
                  setShowPrintPreview(true);
                  setTimeout(async () => {
                    const url = await generatePDF(item, item.id!);
                      if (url) {
                        setPdfUrl(url);
                      } else {
                        setShowPrintPreview(false);
                        alert('PDF generation failed. Please try again or check the image format.');
                      }
                  }, 400);
                }}
                className="p-2 text-gold-dark hover:text-gold transition-colors"
                title="Print"
              >
                <Printer size={18} />
              </button>
              {item.img && (
                <button 
                  onClick={() => showImg(item.img!)}
                  className="p-2 text-zinc-500 hover:text-gold-dark transition-colors"
                >
                  <ImageIcon size={18} />
                </button>
              )}
              <button 
                onClick={() => item.id && setDeleteId(item.id)}
                className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} title={lang === 'ur' ? 'سٹاک تصویر' : 'Stock Image'} />
      )}
    </div>
  );
}
