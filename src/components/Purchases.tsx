import React, { useState, useRef, useEffect } from 'react';
import { db, type GoldPurchase } from '../db';
import { translations, type Language } from '../translations';
import { Save, Printer, Camera, RotateCcw } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { PrintReceipt } from './PrintReceipt';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';

interface PurchasesProps {
  lang: Language;
}

import ImageLightbox from './ImageLightbox';

export default function Purchases({ lang }: PurchasesProps) {
  const t = translations[lang];
  const isUrdu = lang === 'ur';

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [weight, setWeight] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [img, setImg] = useState<string | null>(null);
  
  const [printItem, setPrintItem] = useState<GoldPurchase | null>(null);

  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopPhone2, setShopPhone2] = useState('');

  const componentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence to handle page reloads during image capture on mobile
  useEffect(() => {
    const draft = localStorage.getItem('gold_purchase_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setName(parsed.name || '');
        setPhone(parsed.phone || '');
        setWeight(parsed.weight || '');
        setRate(parsed.rate || '');
      } catch (e) {
        console.error("Error parsing draft", e);
      }
    }
  }, []);

  useEffect(() => {
    const draft = { name, phone, weight, rate };
    localStorage.setItem('gold_purchase_draft', JSON.stringify(draft));
  }, [name, phone, weight, rate]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Purchase_${printItem?.name || name || 'new'}`,
    onAfterPrint: () => setPrintItem(null)
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform()) {
      if (!componentRef.current) return;
      try {
        const canvas = await html2canvas(componentRef.current, {
          scale: 3.0,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: false,
          imageTimeout: 2000,
          windowWidth: 1000,
          onclone: (clonedDoc) => {
            clonedDoc.body.style.margin = '0';
            clonedDoc.body.style.padding = '0';
            clonedDoc.body.style.backgroundColor = '#ffffff';
            clonedDoc.body.style.width = '1000px';
            const el = clonedDoc.querySelector('.print-receipt-container') as HTMLElement;
            if (el) {
              clonedDoc.body.innerHTML = '';
              clonedDoc.body.appendChild(el);
              el.style.margin = '0';
              el.style.padding = '0.8cm';
              el.style.width = '1000px';
              el.style.minHeight = '1414px';
              el.style.height = 'auto';
              el.style.display = 'block';
              el.style.position = 'relative';
            }
          }
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'cm',
          format: 'a4'
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, 21.0, 29.7);
        const pdfUrlString = pdf.output('datauristring');
        const base64Data = pdfUrlString.split(',')[1];
        
        await CapPrinter.printBase64({
          name: `Purchase_${printItem?.name || name || 'new'}`,
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

  useEffect(() => {
    if (printItem) {
      executePrint();
    }
  }, [printItem]);

  useEffect(() => {
    fetchShopSettings();
  }, []);

  const fetchShopSettings = async () => {
    const sName = await db.settings.get('shopName');
    const sAddr = await db.settings.get('shopAddress');
    const sPhone = await db.settings.get('shopPhone');
    const sPhone2 = await db.settings.get('shopPhone2');
    if (sName) setShopName(sName.value);
    if (sAddr) setShopAddress(sAddr.value);
    if (sPhone) setShopPhone(sPhone.value);
    if (sPhone2) setShopPhone2(sPhone2.value);
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImg(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateTotal = () => {
    const w = parseFloat(weight) || 0;
    const r = parseFloat(rate) || 0;
    return w * r;
  };

  const handleSave = async () => {
    try {
      if (!name.trim()) {
        alert("Please enter seller name.");
        return;
      }
      const w = parseFloat(weight);
      const r = parseFloat(rate);
      
      if (isNaN(w) || w <= 0 || isNaN(r) || r <= 0) {
        alert("Please enter valid weight and rate.");
        return;
      }

      const tAmount = calculateTotal();

      const newId = await db.goldPurchases.add({
        name: name.trim(),
        phone: phone.trim(),
        weight: w,
        rate: r,
        total: tAmount,
        date,
        img
      });

      console.log("Purchase saved with ID:", newId);
      
      localStorage.removeItem('gold_purchase_draft');
      handleClear();
      
      alert(isUrdu ? "ریکارڈ محفوظ ہو گیا ہے!" : "Purchase Saved Successfully!");
    } catch (error) {
      console.error("Failed to save purchase:", error);
      alert("Error saving record. Please ensure you have enough storage or try refreshing.");
    }
  };

  const handleClear = () => {
    setName('');
    setPhone('');
    setWeight('');
    setRate('');
    setImg(null);
    localStorage.removeItem('gold_purchase_draft');
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-sky-100">
        <div>
          <h2 className={`text-3xl font-black text-sky-900 tracking-tight ${isUrdu ? 'urdu-text' : ''}`}>
            {t.purchaseGold}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">{isUrdu ? 'نئی خریداری کا اندراج کریں' : 'Register a new gold purchase'}</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-gold outline-none font-bold text-sky-700 shadow-inner" 
          />
        </div>
      </div>

      <form 
        onSubmit={(e) => e.preventDefault()}
        className="grid grid-cols-1 xl:grid-cols-3 gap-8"
      >
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-sky-100 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-gold"></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className={`text-sm font-bold text-zinc-700 ml-1 ${isUrdu ? 'urdu-text' : ''}`}>{t.sellerName}</label>
                  <input 
                    type="text" 
                    required
                    placeholder={isUrdu ? 'نام درج کریں' : 'Enter name'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-sky-50 border border-sky-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-gold outline-none transition-all hover:bg-white focus:bg-white text-lg font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-bold text-zinc-700 ml-1 ${isUrdu ? 'urdu-text' : ''}`}>{t.phoneNumber}</label>
                  <input 
                    type="text" 
                    placeholder="03xx xxxxxxx"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    dir="ltr"
                    className="w-full bg-sky-50 border border-sky-100 rounded-2xl px-5 py-4 text-right focus:ring-2 focus:ring-gold outline-none transition-all hover:bg-white focus:bg-white text-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className={`text-sm font-bold text-zinc-700 ml-1 ${isUrdu ? 'urdu-text' : ''}`}>{t.goldWeight}</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required
                      min="0.001"
                      step="0.001"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                      dir="ltr"
                      className="w-full bg-sky-50 border border-sky-100 rounded-2xl px-5 py-4 text-right focus:ring-2 focus:ring-gold outline-none transition-all hover:bg-white focus:bg-white text-xl font-mono font-bold pr-16"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-zinc-400">GRAM</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-bold text-zinc-700 ml-1 ${isUrdu ? 'urdu-text' : ''}`}>{t.buyingRate}</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={rate}
                      onChange={e => setRate(e.target.value)}
                      dir="ltr"
                      className="w-full bg-sky-50 border border-sky-100 rounded-2xl px-5 py-4 text-right focus:ring-2 focus:ring-gold outline-none transition-all hover:bg-white focus:bg-white text-xl font-mono font-bold pr-12"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-zinc-400">RS</span>
                  </div>
                </div>
              </div>

              <div className="bg-sky-900 p-8 rounded-3xl border border-sky-800 flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl relative group">
                <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <span className={`text-sky-400 font-bold uppercase tracking-widest text-xs ${isUrdu ? 'urdu-text' : ''}`}>{t.totalAmount}</span>
                </div>
                <div className="relative z-10 flex items-baseline gap-2">
                  <span className="text-gold text-sm font-bold">PKR</span>
                  <span className="text-4xl font-black text-white tracking-tight">
                    {calculateTotal().toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <label className={`text-sm font-bold text-zinc-700 ml-1 ${isUrdu ? 'urdu-text' : ''}`}>{t.captureImage}</label>
                </div>
                <div className="flex flex-col sm:flex-row gap-6">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-40 h-40 border-2 border-dashed border-sky-100 rounded-3xl flex flex-col items-center justify-center text-sky-400 hover:text-gold hover:border-gold hover:bg-gold/5 transition-all group shrink-0"
                  >
                    <div className="bg-white p-4 rounded-2xl group-hover:bg-gold group-hover:text-black transition-colors">
                      <Camera size={32} />
                    </div>
                    <span className={`text-xs font-bold mt-3 ${isUrdu ? 'urdu-text' : ''}`}>{img ? t.retakeImage : t.captureImage}</span>
                  </button>
                  {img && (
                    <div 
                      onClick={() => setLightboxImage(img)}
                      className="h-40 flex-1 rounded-3xl bg-sky-50 overflow-hidden border border-sky-100 shadow-inner group relative cursor-pointer"
                      title={isUrdu ? 'بڑی تصویر دیکھیں' : 'View Large Image'}
                    >
                      <img src={img} alt="Gold Image" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 hover:opacity-95" />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleImageCapture}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-sky-100">
                <button 
                  type="button"
                  onClick={handleSave}
                  className={`flex-[2] bg-sky-600 hover:bg-sky-700 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-sky-100 hover:-translate-y-1 active:translate-y-0 ${isUrdu ? 'urdu-text text-xl' : ''}`}
                >
                  <Save size={24} className="text-gold" />
                  {t.save}
                </button>

                <button 
                  type="button"
                  onClick={executePrint}
                  className={`flex-1 bg-gold hover:bg-gold-light text-black py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-gold/20 hover:-translate-y-1 active:translate-y-0 ${isUrdu ? 'urdu-text text-xl' : ''}`}
                >
                  <Printer size={24} />
                  {t.print}
                </button>

                <button 
                  type="button"
                  onClick={handleClear}
                  className="w-full sm:w-16 bg-sky-50 hover:bg-sky-100 text-sky-600 py-5 rounded-2xl font-bold flex items-center justify-center transition-all hover:-translate-y-1 active:translate-y-0 border border-sky-100 shadow-sm"
                  title="Clear / New"
                >
                  <RotateCcw size={24} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-sky-100 relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-0 right-0 p-3 bg-sky-50 border-bl border-sky-100 rounded-bl-2xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Live Preview</span>
              </div>
              
              <h3 className={`text-sm font-bold text-sky-400 mb-8 mt-4 ${isUrdu ? 'urdu-text' : ''}`}>Receipt Breakdown</h3>
              
              <div className="border-2 border-sky-100 rounded-2xl p-6 w-full shadow-inner bg-sky-50/50" style={{ maxWidth: '320px' }}>
                <div className="text-center mb-6">
                   <h2 className="font-black text-xl urdu-text text-sky-800">{shopName || 'Nafees Jewellers'}</h2>
                   <p className="text-[10px] font-bold text-gold-dark border border-gold/20 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-tighter">{t.purchaseGold}</p>
                   <div className="border-b-2 border-dashed border-sky-100 my-6"></div>
                </div>
                
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center text-sky-500">
                    <span className="font-bold">SELLER</span>
                    <span className="font-black text-sky-900 bg-white px-2 py-1 rounded border border-sky-100">{name || '---'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sky-500">
                    <span className="font-bold">WEIGHT</span>
                    <span className="font-black text-sky-900">{weight || '0'}g</span>
                  </div>
                  <div className="flex justify-between items-center text-sky-500">
                    <span className="font-bold">RATE</span>
                    <span className="font-black text-sky-900">{rate || '0'}</span>
                  </div>
                  <div className="border-b border-sky-100 py-1"></div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-black text-sky-900 tracking-widest">TOTAL</span>
                    <span className="text-lg font-black text-gold-dark">Rs. {calculateTotal().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

      {/* Hidden Printable Receipt */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <PrintReceipt
          ref={componentRef}
          type="purchase"
          data={printItem || {
            name,
            phone,
            weight: parseFloat(weight) || 0,
            rate: parseFloat(rate) || 0,
            total: calculateTotal(),
            date,
            img
          }}
          id={printItem?.id}
        />
      </div>

      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} title={lang === 'ur' ? 'خریداری کی تصویر' : 'Purchase Image'} />
      )}
    </div>
  );
}
