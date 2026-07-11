import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Order } from '../db';
import { translations, type Language } from '../translations';
import { formatCurrency, formatDate, formatWhatsAppUrl, compressImage } from '../lib/utils';
import { Plus, Check, Trash2, Camera, RotateCcw, MessageCircle, Printer, X, Download, AlertCircle, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

interface OrdersProps {
  lang: Language;
}

import ImageLightbox from './ImageLightbox';

export default function Orders({ lang }: OrdersProps) {
  const t = translations[lang];
  const [isAdding, setIsAdding] = useState(false);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    date: new Date().toISOString().split('T')[0],
    due: '',
    item: '',
    measurements: '',
    pricePerTola: '',
    karigar: '',
    oldWt: '',
    readyWt: '',
    price: 0,
    mazdori: 0,
    total: 0,
    recAmt: 0,
    status: 'pending',
    makingCharges: '',
    weightPolish: '',
    totalWt: '',
    payments: [] as {amt: number, date: string}[]
  });

  const [printData, setPrintData] = useState<{ data: Order, id: number } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order_${printData?.id || 'new'}`,
    onAfterPrint: () => {
      setIsPrinting(false);
    }
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && pdfUrl) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        await CapPrinter.printBase64({
          name: `Order_${printData?.id || 'new'}`,
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

  const generatePDF = async (data: Order, id: number): Promise<string | null> => {
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
        const fileName = `Order_${printData?.id || Date.now()}.pdf`;
        const base64Data = pdfUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Order Receipt',
          url: savedFile.uri,
        });
      } catch (e) {
        console.error('Error sharing PDF', e);
        alert(lang === 'ur' ? "فائل شیئر کرنے میں خرابی پیش آئی" : "Error sharing file");
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Order_${printData?.id || 'new'}.pdf`;
      link.click();
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [qistOrderId, setQistOrderId] = useState<number | null>(null);
  const [qistAmount, setQistAmount] = useState<string>('');
  const [selectedOrderForQist, setSelectedOrderForQist] = useState<Order | null>(null);

  const orders = useLiveQuery(async () => {
    if (!db.orders) return [];
    
    let result: Order[];
    if (!searchTerm) {
      result = await db.orders.orderBy('id').reverse().toArray();
    } else {
      const term = searchTerm.toLowerCase();
      result = await db.orders
        .filter(o => 
          o.name.toLowerCase().includes(term) || 
          o.phone.includes(searchTerm) ||
          o.karigar.toLowerCase().includes(term) ||
          o.id?.toString() === searchTerm
        )
        .reverse()
        .toArray();
    }

    const statusOrder: Record<string, number> = {
      'pending': 1,
      'progress': 2,
      'complete': 3,
      'delivered': 4
    };

    return result.sort((a, b) => {
      const valA = statusOrder[a.status] || 99;
      const valB = statusOrder[b.status] || 99;
      if (valA !== valB) return valA - valB;
      return (b.id || 0) - (a.id || 0); // Keep newest first within same status
    });
  }, [searchTerm]);

  const totalOrdersWeight = orders?.reduce((sum, o) => sum + (parseFloat(o.readyWt) || 0), 0) || 0;
  const totalOrdersPolish = orders?.reduce((sum, o) => sum + (parseFloat(o.makingCharges || '0') || 0), 0) || 0;
  const totalOrdersMazdori = orders?.reduce((sum, o) => sum + (o.mazdori || 0), 0) || 0;

  const updateRem = () => {
    if (editId) { return formData.total - formData.payments.reduce((s, p) => s + p.amt, 0); } return formData.total - formData.recAmt;
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
    if (!formData.name) return alert(lang === 'ur' ? "نام ضروری ہے!" : "Name is required!");
    
    const order: Order = {
      name: formData.name,
      phone: formData.phone,
      date: formData.date,
      due: formData.due,
      item: formData.item,
      measurements: formData.measurements,
      pricePerTola: formData.pricePerTola,
      karigar: formData.karigar,
      oldWt: formData.oldWt ? parseFloat(Number(formData.oldWt).toFixed(2)).toString() : '',
      readyWt: formData.readyWt ? parseFloat(Number(formData.readyWt).toFixed(2)).toString() : '',
      price: formData.price,
      mazdori: formData.mazdori,
      total: formData.total,
      payments: editId ? formData.payments : [{ amt: formData.recAmt, date: formatDate(new Date(), 'ur-PK') }],
      rem: updateRem(),
      status: formData.status,
      img: currentImg,
      makingCharges: formData.makingCharges ? parseFloat(Number(formData.makingCharges).toFixed(2)).toString() : '',
      weightPolish: formData.weightPolish,
      totalWt: formData.totalWt ? parseFloat(Number(formData.totalWt).toFixed(2)).toString() : ''
    };

    let id;
    if (editId) {
      await db.orders.put({ ...order, id: editId });
      id = editId;
    } else {
      id = await db.orders.add(order);
    }

    setPrintData({ data: order, id: id as number });
    setShowPrintPreview(true);
    
    // Generate PDF for preview faster with 100ms timeout
    setTimeout(async () => {
      const url = await generatePDF(order, id as number);
                      if (url) {
                        setPdfUrl(url);
                      } else {
                        setShowPrintPreview(false);
                        alert('PDF generation failed. Please try again or check the image format.');
                      }
    }, 400);

    setIsAdding(false);
    setEditId(null);
    setCurrentImg(null);
    setFormData({
      name: '',
      phone: '',
      date: new Date().toISOString().split('T')[0],
      due: '',
      item: '',
      measurements: '',
      pricePerTola: '',
      karigar: '',
      oldWt: '',
      readyWt: '',
      price: 0,
      mazdori: 0,
      total: 0,
      recAmt: 0,
      status: 'pending',
      makingCharges: '',
      weightPolish: '',
      totalWt: '',
    payments: [] as {amt: number, date: string}[]
    });
  };

  const handleEdit = (order: Order) => {
    setEditId(order.id!);
    setFormData({
      name: order.name,
      phone: order.phone,
      date: order.date,
      due: order.due,
      item: order.item,
      measurements: order.measurements || '',
      pricePerTola: order.pricePerTola || '',
      karigar: order.karigar,
      oldWt: order.oldWt,
      readyWt: order.readyWt,
      price: order.price || 0,
      mazdori: order.mazdori || 0,
      total: order.total,
      recAmt: order.total - order.rem,
      status: order.status,
      makingCharges: order.makingCharges || '',
      weightPolish: order.weightPolish || '',
      totalWt: order.totalWt || '',
      payments: order.payments || [{ amt: order.total - order.rem, date: order.date }]
    });
    setCurrentImg(order.img || null);
    setIsAdding(true);
    window.scrollTo(0, 0);
  };

  const getStatusColor = (s: string) => {
    return s === 'complete' ? '#2e7d32' : (s === 'progress' ? '#1565c0' : '#ef6c00');
  };

  const updateOrder = async (id: number) => {
    const order = await db.orders.get(id);
    if (order) {
      setSelectedOrderForQist(order);
      setQistOrderId(id);
      setQistAmount('');
    }
  };

  const handleQistSubmit = async () => {
    if (!qistOrderId || !qistAmount || !selectedOrderForQist) return;
    const amt = parseFloat(qistAmount);
    if (isNaN(amt) || amt <= 0) {
      alert(lang === 'ur' ? "براہ کرم درست رقم درج کریں۔" : "Please enter a valid amount.");
      return;
    }
    
    const newPayments = [...(selectedOrderForQist.payments || []), { amt, date: formatDate(new Date(), 'ur-PK') }];
    const newRem = selectedOrderForQist.rem - amt;
    
    await db.orders.update(qistOrderId, { payments: newPayments, rem: newRem });
    setQistOrderId(null);
    setQistAmount('');
    setSelectedOrderForQist(null);
  };

  const sendWS = (num: string, name: string, rem: number) => {
    const msg = `اسلام علیکم ${name}! ${APP_CONFIG.shopNameUrdu} سے آپ کا آرڈر تیار ہے۔ آپ کا بقایا ${rem} روپے ہے۔ شکریہ۔`;
    const url = formatWhatsAppUrl(num, msg);
    if (url) window.open(url, '_blank');
  };

  const handleDelete = async (id: number) => {
    await db.orders.delete(id);
    setDeleteId(null);
  };

  return (
    <div className="container mx-auto pb-20">
      <ConfirmModal 
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title={lang === 'ur' ? 'ڈیلیٹ کریں؟' : 'Confirm Delete'}
        message={lang === 'ur' ? 'کیا آپ واقعی اس آرڈر کو حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this order?'}
        lang={lang}
      />

      {/* Qist Modal */}
      <AnimatePresence>
        {qistOrderId !== null && selectedOrderForQist && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black-80 p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-sky-200"
            >
              <div className="p-4 border-b border-sky-100 bg-sky-50 flex justify-between items-center">
                <h3 className="text-xl font-bold urdu-text text-gold-dark">قسط کی وصولی (Installment)</h3>
                <button onClick={() => setQistOrderId(null)} className="text-zinc-500 hover:text-gold-dark">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-500 urdu-text">کسٹمر:</span>
                    <span className="font-bold text-zinc-900">{selectedOrderForQist.name}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-500 urdu-text">کل رقم:</span>
                    <span className="font-bold text-zinc-900">{formatCurrency(selectedOrderForQist.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500 urdu-text font-bold text-red-600">باقی رقم:</span>
                    <span className="font-bold text-red-600">{formatCurrency(selectedOrderForQist.rem)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-600 urdu-text">نئی وصول شدہ رقم:</label>
                  <input 
                    type="number" 
                    autoFocus
                    value={qistAmount}
                    onChange={e => setQistAmount(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-sky-200 rounded-xl outline-none focus:border-gold text-2xl font-bold text-center text-black"
                  />
                </div>

                {selectedOrderForQist.payments && selectedOrderForQist.payments.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider urdu-text">ادائیگیوں کی تاریخ:</label>
                    <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                      {selectedOrderForQist.payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs p-2 bg-sky-50 rounded-lg border border-sky-100">
                          <span className="text-zinc-500">{p.date}</span>
                          <span className="font-bold text-green-600">{formatCurrency(p.amt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-sky-50 border-t border-sky-100 flex gap-3">
                <button 
                  onClick={() => setQistOrderId(null)}
                  className="flex-1 py-3 px-4 bg-white border border-sky-200 text-zinc-500 font-bold rounded-xl hover:bg-sky-100 transition-all urdu-text"
                >
                  کینسل
                </button>
                <button 
                  onClick={handleQistSubmit}
                  disabled={!qistAmount}
                  className="flex-[2] py-3 px-4 bg-gold text-black font-bold rounded-xl hover:bg-gold-light transition-all shadow-lg shadow-gold-20 urdu-text disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  محفوظ کریں
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
                  type="order" 
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
                className="flex-1 min-w-[150px] bg-gold-600 bg-gold hover:bg-gold-light text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Download size={24} />
                <span className="urdu-text text-xl">PDFاؤن لوڈ</span>
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

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gold-dark urdu-text">{t.orders}</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-gold text-black font-bold px-6 py-3 rounded-xl hover:bg-gold-light transition-all shadow-lg shadow-gold-20"
        >
          <Plus size={20} />
          <span className="urdu-text">{isAdding ? t.cancel : t.add}</span>
        </button>
      </div>

      {/* Stats Block */}
      <div className="flex gap-6 p-4 bg-white border border-sky-200 rounded-xl shadow-sm overflow-x-auto mb-6">
        <div className="flex flex-col flex-shrink-0 min-w-32">
          <span className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'کل وزن:' : 'Total Weight:'}</span>
          <span className="text-2xl font-black text-gold-dark">{totalOrdersWeight.toFixed(3)}g</span>
        </div>
        <div className="flex flex-col flex-shrink-0 min-w-32 border-l border-sky-100 pl-6">
          <span className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'کل پالش:' : 'Total Polish:'}</span>
          <span className="text-2xl font-black text-sky-700">{totalOrdersPolish.toFixed(3)}g</span>
        </div>
        <div className="flex flex-col flex-shrink-0 min-w-32 border-l border-sky-100 pl-6">
          <span className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'کل مزدوری:' : 'Total Mazdori:'}</span>
          <span className="text-2xl font-black text-green-600">Rs. {Math.round(totalOrdersMazdori).toLocaleString()}</span>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-gold mb-6 animate-in fade-in slide-in-from-top-4 duration-300 border border-sky-200">
          <h3 className="text-xl font-bold mb-4 urdu-text text-gold-dark"><i className="fas fa-gem"></i> نیا آرڈر بکنگ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">نام کسٹمر:</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">فون نمبر:</label>
              <input 
                type="number" 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">تاریخ بکنگ:</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">ڈیلیوری تاریخ:</label>
              <input 
                type="date" 
                value={formData.due}
                onChange={e => setFormData({ ...formData, due: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">نام آئٹم:</label>
              <MultiSelectInput 
                options={t.itemDetailsList}
                value={formData.item}
                onChange={val => setFormData({ ...formData, item: val })}
                lang={lang}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{(t as any).measurements || 'پیمائش (Measurements)'}:</label>
              <input 
                type="text" 
                value={formData.measurements || ''}
                onChange={e => setFormData({ ...formData, measurements: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder={lang === 'ur' ? "مثلاً چوڑی کا سائز، انگوٹھی کا سائز..." : "e.g. Bangle size, Ring size..."}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{(t as any).pricePerTola || 'فی تولہ ریٹ (Price per Tola)'}:</label>
              <input 
                type="text" 
                value={formData.pricePerTola || ''}
                onChange={e => setFormData({ ...formData, pricePerTola: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder={lang === 'ur' ? "مثلاً 240,000..." : "e.g. 240,000..."}
              />
            </div>
            <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
              <h4 className="font-bold text-sm text-sky-900 urdu-text flex items-center gap-1.5 uppercase tracking-wide">
                <span className="w-1.5 h-3.5 bg-gold rounded-full inline-block"></span>
                {lang === 'ur' ? 'وزن (Weight)' : 'Weight'}
              </h4>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{lang === 'ur' ? 'کسٹمر گولڈ (g):' : 'Customer Gold (g):'}</label>
              <input 
                type="number" 
                step="any"
                value={formData.oldWt || ''}
                onChange={e => setFormData({ ...formData, oldWt: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder="e.g. 1.50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{lang === 'ur' ? 'وزن (g):' : 'Weight (g):'}</label>
              <input 
                type="number" 
                step="any"
                value={formData.readyWt || ''}
                onChange={e => {
                  const val = e.target.value;
                  const ready = parseFloat(val) || 0;
                  const polish = parseFloat(formData.makingCharges) || 0;
                  const calculatedTotal = (ready + polish) > 0 ? parseFloat((ready + polish).toFixed(2)).toString() : '';
                  setFormData({ 
                    ...formData, 
                    readyWt: val,
                    totalWt: calculatedTotal
                  });
                }}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder="e.g. 5.20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{lang === 'ur' ? 'پالش:' : 'Polish:'}</label>
              <input 
                type="number" 
                step="any"
                value={formData.makingCharges || ''}
                onChange={e => {
                  const val = e.target.value;
                  const ready = parseFloat(formData.readyWt) || 0;
                  const polish = parseFloat(val) || 0;
                  const calculatedTotal = (ready + polish) > 0 ? parseFloat((ready + polish).toFixed(2)).toString() : '';
                  setFormData({ 
                    ...formData, 
                    makingCharges: val,
                    totalWt: calculatedTotal
                  });
                }}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder={lang === 'ur' ? "مثلاً 1.50..." : "e.g. 1.50..."}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{lang === 'ur' ? 'ٹوٹل وزن (g):' : 'Total Wazan (g):'}</label>
              <input 
                type="number" 
                step="any"
                value={formData.totalWt || ''}
                onChange={e => setFormData({ ...formData, totalWt: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder="e.g. 6.70"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{lang === 'ur' ? 'اضافی وزن (Izafi Weight):' : 'Izafi Weight:'}</label>
              <input 
                type="number" 
                step="any"
                readOnly
                value={
                  (parseFloat(formData.totalWt || '0') - parseFloat(formData.oldWt || '0')) > 0 
                  ? Math.round(parseFloat(formData.totalWt || '0') - parseFloat(formData.oldWt || '0')).toString()
                  : ''
                }
                className="w-full p-3 bg-zinc-50 border border-sky-200 rounded-lg outline-none text-zinc-500 font-bold"
                placeholder="Auto Calculated"
              />
            </div>

            {/* Picture Upload / Camera Capture in sequence, spanning 2 cols */}
            <div className="col-span-1 md:col-span-2 space-y-1 mt-2">
              <label className="text-xs text-zinc-500 urdu-text font-bold">{lang === 'ur' ? 'آرڈر کی تصویر (Order Pic):' : 'Order Pic:'}</label>
              {currentImg ? (
                <div className="relative group cursor-pointer max-w-sm mx-auto" onClick={() => setLightboxImage(currentImg)}>
                  <img src={currentImg} alt="Preview" className="w-full h-52 object-contain border border-sky-200 rounded-lg group-hover:opacity-95 transition-opacity" />
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCurrentImg(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full z-10 hover:bg-red-700 transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              ) : (
                <div className="max-w-sm mx-auto flex gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="ordersCameraInput"
                  />
                  <label 
                    htmlFor="ordersCameraInput"
                    className="flex-1 p-3 border-2 border-dashed border-sky-200 rounded-lg text-zinc-500 flex items-center justify-center gap-2 cursor-pointer hover:border-gold hover:text-gold transition-all"
                  >
                    <Camera size={18} />
                    <span className="urdu-text text-sm">{lang === 'ur' ? 'کیمرہ' : 'Camera'}</span>
                  </label>

                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="hidden"
                    id="ordersGalleryInput"
                  />
                  <label 
                    htmlFor="ordersGalleryInput"
                    className="flex-1 p-3 border-2 border-dashed border-sky-200 rounded-lg text-zinc-500 flex items-center justify-center gap-2 cursor-pointer hover:border-gold hover:text-gold transition-all"
                  >
                    <ImageIcon size={18} />
                    <span className="urdu-text text-sm">{lang === 'ur' ? 'گیلری' : 'Gallery'}</span>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">نام کاریگر:</label>
              <input 
                type="text" 
                value={formData.karigar}
                onChange={e => setFormData({ ...formData, karigar: e.target.value })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder="e.g. Aslam"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{lang === 'ur' ? 'قیمت (Price):' : 'Price:'}</label>
              <input 
                type="number" 
                value={formData.price || ''}
                onChange={e => {
                  const p = Number(e.target.value);
                  setFormData({ ...formData, price: p, total: p + (formData.mazdori || 0) });
                }}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder="e.g. 45000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">{lang === 'ur' ? 'مزدوری (Mazdori):' : 'Mazdori:'}</label>
              <input 
                type="number" 
                value={formData.mazdori || ''}
                onChange={e => {
                  const m = Number(e.target.value);
                  setFormData({ ...formData, mazdori: m, total: (formData.price || 0) + m });
                }}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder="e.g. 5000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 urdu-text">کل رقم (Total Price):</label>
              <input 
                type="number" 
                value={formData.total || ''}
                onChange={e => setFormData({ ...formData, total: Number(e.target.value) })}
                className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                placeholder="e.g. 50,000"
              />
            </div>
            {!editId ? (
              <div className="space-y-1">
                <label className="text-xs text-zinc-500 urdu-text">وصول شدہ رقم (Advance):</label>
                <input 
                  type="number" 
                  value={formData.recAmt || ''}
                  onChange={e => setFormData({ ...formData, recAmt: Number(e.target.value) })}
                  className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                  placeholder="e.g. 10,000"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-zinc-500 urdu-text">ادائیگیاں (Payments):</label>
                {formData.payments && formData.payments.length > 0 ? (
                  <div className="space-y-2">
                    {formData.payments.map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="text-xs text-zinc-400 w-20">{p.date}</span>
                        <input 
                          type="number" 
                          value={p.amt || ''}
                          onChange={e => {
                            const newPayments = [...formData.payments];
                            newPayments[idx].amt = Number(e.target.value);
                            setFormData({ ...formData, payments: newPayments });
                          }}
                          className="flex-1 p-2 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black text-sm"
                        />
                        <button 
                          onClick={() => {
                            const newPayments = formData.payments.filter((_, i) => i !== idx);
                            setFormData({ ...formData, payments: newPayments });
                          }}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">کوئی ادائیگی موجود نہیں</p>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-6 p-4 bg-sky-50 rounded-xl border border-gold-20 flex justify-between items-center shadow-inner">
            <span className="text-zinc-600 urdu-text font-bold">{lang === 'ur' ? 'صاف بقایا:' : 'Net Remaining:'}</span>
            <span className="text-2xl font-black text-gold-dark">Rs. {updateRem().toLocaleString()}</span>
          </div>

          <select 
            value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value })}
            className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold mt-4 text-black"
          >
            <option value="pending">Pending (انتظار)</option>
            <option value="progress">In Progress (کام جاری)</option>
            <option value="complete">Complete (تیار ہے)</option>
            <option value="delivered">Delivered (حوالے کر دیا)</option>
          </select>

          <button 
            onClick={handleSave}
            className="w-full p-4 bg-gold text-black font-bold rounded-lg shadow-lg shadow-gold-20 mt-6 urdu-text"
          >
            آرڈر محفوظ کریں
          </button>
        </div>
      )}

      <div className="mb-6">
        <input 
          type="text" 
          className="w-full p-4 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold shadow-sm text-black"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders?.map((order) => (
          <div 
            key={order.id} 
            className="bg-white p-5 rounded-xl border border-sky-200 shadow-sm hover:border-gold-30 transition-all"
            style={{ borderRight: `8px solid ${getStatusColor(order.status)}` }}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-zinc-900">{order.name}</h3>
                  <div className="px-2 py-1 bg-sky-50 text-gold-dark rounded text-[10px] font-bold border border-gold-20">
                    #{order.id}
                  </div>
                </div>
                <p className="text-sm text-zinc-500">{order.phone}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase`} style={{ color: getStatusColor(order.status), backgroundColor: `${getStatusColor(order.status)}20` }}>
                {order.status}
              </span>
            </div>
            
            <div className="space-y-2 mb-4 text-sm">
              <p className="text-zinc-600 line-clamp-2">{order.item}</p>
              {order.measurements && (
                <div className="flex justify-between text-sky-800 bg-sky-50 px-2 py-1 rounded-md border border-sky-100">
                  <span className="urdu-text text-xs">{(t as any).measurements || 'پیمائش'}:</span>
                  <span className="font-bold text-xs">{order.measurements}</span>
                </div>
              )}
              {order.pricePerTola && (
                <div className="flex justify-between text-zinc-800 bg-zinc-50 px-2 py-1 rounded-md border border-zinc-100">
                  <span className="urdu-text text-xs">{(t as any).pricePerTola || 'فی تولہ ریٹ'}:</span>
                  <span className="font-bold text-xs">{order.pricePerTola}</span>
                </div>
              )}
              {order.oldWt && (
                <div className="flex justify-between text-sky-800 bg-sky-50 px-2 py-1 rounded-md border border-sky-100">
                  <span className="urdu-text text-xs">{lang === 'ur' ? 'کسٹمر گولڈ:' : 'Customer Gold:'}</span>
                  <span className="font-bold text-xs">{order.oldWt}g</span>
                </div>
              )}
              {order.readyWt && (
                <div className="flex justify-between text-zinc-800 bg-zinc-50 px-2 py-1 rounded-md border border-zinc-100">
                  <span className="urdu-text text-xs">{lang === 'ur' ? 'وزن:' : 'Weight:'}</span>
                  <span className="font-bold text-xs">{order.readyWt}g</span>
                </div>
              )}
              {order.makingCharges && (
                <div className="flex justify-between text-amber-800 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                  <span className="urdu-text text-xs">{lang === 'ur' ? 'پالش:' : 'Polish:'}</span>
                  <span className="font-bold text-xs">{order.makingCharges}</span>
                </div>
              )}
              {order.totalWt && (
                <div className="flex justify-between text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                  <span className="urdu-text text-xs">{lang === 'ur' ? 'ٹوٹل وزن:' : 'Total Wazan:'}</span>
                  <span className="font-bold text-xs">{order.totalWt}g</span>
                </div>
              )}
              {order.totalWt && order.oldWt && (parseFloat(order.totalWt) - parseFloat(order.oldWt) > 0) && (
                <div className="flex justify-between text-red-800 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                  <span className="urdu-text text-xs">{lang === 'ur' ? 'اضافی وزن:' : 'Izafi Wazan:'}</span>
                  <span className="font-bold text-xs">{Math.round(parseFloat(order.totalWt) - parseFloat(order.oldWt))}g</span>
                </div>
              )}
              {order.img && (
                <div className="flex justify-between text-sky-800 bg-sky-50 px-2 py-1 rounded-md border border-sky-100">
                  <span className="urdu-text text-xs">{lang === 'ur' ? 'تصویر' : 'Image'}:</span>
                  <button 
                    onClick={() => setLightboxImage(order.img!)}
                    className="p-0.5 px-2 bg-sky-200 text-sky-800 rounded font-bold text-xs hover:bg-sky-300 transition-colors"
                  >
                    {lang === 'ur' ? 'دیکھیں' : 'View'}
                  </button>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500 urdu-text">کاریگر:</span>
                <span className="font-bold text-zinc-700">{order.karigar}</span>
              </div>
              {order.price !== undefined && order.price > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500 urdu-text">قیمت (Price):</span>
                  <span className="font-bold text-zinc-700">{formatCurrency(order.price)}</span>
                </div>
              )}
              {order.mazdori !== undefined && order.mazdori > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500 urdu-text">مزدوری (Mazdori):</span>
                  <span className="font-bold text-zinc-700">{formatCurrency(order.mazdori)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500 urdu-text">واپسی:</span>
                <span className="font-bold text-zinc-700">{order.due}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 urdu-text">بقایا:</span>
                <span className="font-bold text-red-600">{formatCurrency(order.rem)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-sky-100">
              <button 
                onClick={() => handleEdit(order)}
                className="flex-1 p-2 bg-sky-50 text-gold-dark rounded-lg hover:bg-gold hover:text-black transition-all text-xs font-bold urdu-text border border-sky-100"
              >
                ایڈٹ
              </button>
              <button 
                onClick={() => order.id && updateOrder(order.id)}
                className="flex-1 p-2 bg-sky-50 text-zinc-600 rounded-lg hover:bg-sky-100 transition-all text-xs font-bold urdu-text border border-sky-100"
              >
                قسط
              </button>
              <button 
                onClick={() => {
                  if (order.id) {
                    setPrintData({ data: order, id: order.id });
                    setShowPrintPreview(true);
                    setTimeout(async () => {
                      const url = await generatePDF(order, order.id!);
                      if (url) {
                        setPdfUrl(url);
                      } else {
                        setShowPrintPreview(false);
                        alert('PDF generation failed. Please try again or check the image format.');
                      }
                    }, 400);
                  }
                }}
                className="flex-1 p-2 bg-sky-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all text-xs font-bold urdu-text border border-sky-100"
              >
                رسید
              </button>
              <button 
                onClick={() => sendWS(order.phone, order.name, order.rem)}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
              >
                <MessageCircle size={18} />
              </button>
              <button 
                onClick={() => order.id && setDeleteId(order.id)}
                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all border border-red-200"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} title={lang === 'ur' ? 'آرڈر تصویر' : 'Order Image'} />
      )}
    </div>
  );
}
