import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { translations, type Language } from '../translations';
import { Save, Download, Upload, Languages, Trash2, AlertTriangle, BadgeDollarSign, History, ShoppingBag } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { SecurityModal } from './SecurityModal';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface SettingsProps {
  lang: Language;
  setGoldRate: (rate: number) => void;
  setLang: (lang: Language) => void;
}

export default function Settings({ lang, setGoldRate, setLang }: SettingsProps) {
  const t = translations[lang];
  const [rateInput, setRateInput] = useState<string>('');
  const [shopNameInput, setShopNameInput] = useState<string>('');
  const [shopAddressInput, setShopAddressInput] = useState<string>('');
  const [shopPhoneInput, setShopPhoneInput] = useState<string>('');
  const [shopPhone2Input, setShopPhone2Input] = useState<string>('');
  const [shiftXInput, setShiftXInput] = useState<string>('');
  const [shiftYInput, setShiftYInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [securityAction, setSecurityAction] = useState<{ nameUr: string, nameEn: string, onVerify: () => void } | null>(null);

  const triggerSecurityCheck = (nameUr: string, nameEn: string, onVerify: () => void) => {
    if (currentSettings.appPin) {
      setSecurityAction({ nameUr, nameEn, onVerify });
    } else {
      onVerify();
    }
  };
  
  const [currentSettings, setCurrentSettings] = useState({
    goldRate: 0,
    shopName: translations.ur.shopName,
    shopAddress: translations.ur.shopAddress,
    shopPhone: translations.ur.shopPhone,
    shopPhone2: translations.ur.shopPhone2,
    printShiftX: 0,
    printShiftY: 0,
    appPin: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const rateData = await db.settings.get('goldRate');
      const nameData = await db.settings.get('shopName');
      const addressData = await db.settings.get('shopAddress');
      const phoneData = await db.settings.get('shopPhone');
      const phone2Data = await db.settings.get('shopPhone2');
      const shiftXData = await db.settings.get('printShiftX');
      const shiftYData = await db.settings.get('printShiftY');
      const appPinData = await db.settings.get('appPin');
      
      setCurrentSettings({
        goldRate: rateData?.value || 0,
        shopName: nameData?.value || translations[lang].shopName,
        shopAddress: addressData?.value || translations[lang].shopAddress,
        shopPhone: phoneData?.value || translations[lang].shopPhone,
        shopPhone2: phone2Data?.value || translations[lang].shopPhone2,
        printShiftX: shiftXData?.value || 0,
        printShiftY: shiftYData?.value || 0,
        appPin: appPinData?.value || ''
      });
    };
    fetchSettings();
  }, [lang]);

  const handleSaveRate = async () => {
    const newRate = Number(rateInput);
    if (isNaN(newRate) || rateInput === '') {
      alert(lang === 'ur' ? 'براہ کرم درست ریٹ درج کریں' : 'Please enter a valid rate');
      return;
    }
    triggerSecurityCheck(
      'سونے کا ریٹ تبدیل کریں',
      'Change Gold Rate',
      async () => {
        await db.settings.put({ key: 'goldRate', value: newRate });
        setGoldRate(newRate);
        setCurrentSettings(prev => ({ ...prev, goldRate: newRate }));
        setRateInput('');
        alert(lang === 'ur' ? 'سونے کا ریٹ محفوظ کر لیا گیا ہے' : 'Gold rate saved successfully');
      }
    );
  };

  const handleRemovePin = async () => {
    triggerSecurityCheck(
      'پاس ورڈ ختم کریں',
      'Remove Password',
      async () => {
        await db.settings.put({ key: 'appPin', value: '' });
        setCurrentSettings(prev => ({ ...prev, appPin: '' }));
        setPinInput('');
        alert(lang === 'ur' ? 'ایپ پاس ورڈ ختم کر دیا گیا ہے' : 'App password removed');
        window.location.reload();
      }
    );
  };

  const handleSaveShopDetails = async () => {
    triggerSecurityCheck(
      'تفصیلات تبدیل کریں',
      'Change Details & Settings',
      async () => {
        if (shopNameInput) {
          await db.settings.put({ key: 'shopName', value: shopNameInput });
          setCurrentSettings(prev => ({ ...prev, shopName: shopNameInput }));
        }
        if (shopAddressInput) {
          await db.settings.put({ key: 'shopAddress', value: shopAddressInput });
          setCurrentSettings(prev => ({ ...prev, shopAddress: shopAddressInput }));
        }
        if (shopPhoneInput) {
          await db.settings.put({ key: 'shopPhone', value: shopPhoneInput });
          setCurrentSettings(prev => ({ ...prev, shopPhone: shopPhoneInput }));
        }
        if (shopPhone2Input) {
          await db.settings.put({ key: 'shopPhone2', value: shopPhone2Input });
          setCurrentSettings(prev => ({ ...prev, shopPhone2: shopPhone2Input }));
        }
        
        // Save shifts if they are typed (even if 0)
        if (shiftXInput !== '') {
          await db.settings.put({ key: 'printShiftX', value: Number(shiftXInput) });
          setCurrentSettings(prev => ({ ...prev, printShiftX: Number(shiftXInput) }));
        }
        if (shiftYInput !== '') {
          await db.settings.put({ key: 'printShiftY', value: Number(shiftYInput) });
          setCurrentSettings(prev => ({ ...prev, printShiftY: Number(shiftYInput) }));
        }
        
        if (pinInput !== '') {
          await db.settings.put({ key: 'appPin', value: pinInput });
          setCurrentSettings(prev => ({ ...prev, appPin: pinInput }));
        }

        setShopNameInput('');
        setShopAddressInput('');
        setShopPhoneInput('');
        setShopPhone2Input('');
        setShiftXInput('');
        setShiftYInput('');
        alert(lang === 'ur' ? 'دکان اور پرنٹ کی تفصیلات محفوظ کر لی گئی ہیں' : 'Shop and print details saved successfully');
        window.location.reload(); // Reload to update App header
      }
    );
  };

  const handleExportCSV = async (type: 'sales' | 'purchases') => {
    try {
      let data: any[] = [];
      let filename = '';
      let headers = '';

      if (type === 'sales') {
        const sales = await db.sales.toArray();
        filename = `Sales_Export_${new Date().toISOString().split('T')[0]}.csv`;
        headers = 'Invoice #,Date,Customer Name,Phone,Total,Received,Remaining,Items\n';
        data = sales.map(s => {
          const itemsStr = s.items.map(i => `${i.n}(${i.w}g)`).join(' | ');
          return `${s.id},"${s.date}","${s.name}","${s.phone}",${s.total},${s.rec},${s.rem},"${itemsStr}"`;
        });
      } else {
        const purchases = await db.goldPurchases.toArray();
        filename = `Purchases_Export_${new Date().toISOString().split('T')[0]}.csv`;
        headers = 'Date,Seller Name,Phone,Weight(g),Rate,Total\n';
        data = purchases.map(p => {
          return `"${p.date}","${p.name}","${p.phone}",${p.weight},${p.rate},${p.total}`;
        });
      }

      const csvContent = headers + data.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed');
    }
  };

  const handleBackup = async () => {
    try {
      const sales = await db.sales.toArray();
      const orders = await db.orders.toArray();
      const karigars = await db.karigars.toArray();
      const repairs = await db.repairs.toArray();
      const stock = await db.stock.toArray();
      const settings = await db.settings.toArray();
      const goldPurchases = await db.goldPurchases.toArray();

      const data = { sales, orders, karigars, repairs, stock, settings, goldPurchases };
      const fileName = `nafees_jewellers_backup_${new Date().toISOString().split('T')[0]}.json`;
      const jsonString = JSON.stringify(data);

      if (Capacitor.isNativePlatform()) {
        // Mobile (Android/iOS)
        const result = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        await Share.share({
          title: 'Nafees Jewellers Backup',
          text: 'Backup of Nafees Jewellers application data',
          url: result.uri,
          dialogTitle: 'Save Backup',
        });
      } else {
        // Desktop/Web
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Backup error:', error);
      alert(lang === 'ur' ? 'بیک اپ بنانے میں خرابی پیش آئی' : 'Error creating backup');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerSecurityCheck(
      'ڈیٹا بحال کریں',
      'Restore Backup Data',
      () => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            await db.sales.clear();
            await db.orders.clear();
            await db.karigars.clear();
            await db.repairs.clear();
            await db.stock.clear();
            await db.settings.clear();
            await db.goldPurchases.clear();

            if (data.sales) await db.sales.bulkAdd(data.sales);
            if (data.orders) await db.orders.bulkAdd(data.orders);
            if (data.karigars) await db.karigars.bulkAdd(data.karigars);
            if (data.repairs) await db.repairs.bulkAdd(data.repairs);
            if (data.stock) await db.stock.bulkAdd(data.stock);
            if (data.settings) await db.settings.bulkAdd(data.settings);
            if (data.goldPurchases) await db.goldPurchases.bulkAdd(data.goldPurchases);

            alert(lang === 'ur' ? 'ڈیٹا کامیابی سے بحال ہو گیا ہے' : 'Data restored successfully');
            window.location.reload();
          } catch (err) {
            alert('Invalid backup file');
          }
        };
        reader.readAsText(file);
      }
    );
  };

  const clearAllData = async () => {
    triggerSecurityCheck(
      'تمام ڈیٹا حذف کریں',
      'Clear All Data Permanently',
      async () => {
        try {
          await Promise.all([
            db.sales.clear(),
            db.orders.clear(),
            db.karigars.clear(),
            db.repairs.clear(),
            db.stock.clear(),
            db.settings.clear(),
            db.goldPurchases.clear()
          ]);
          window.location.reload();
        } catch (err) {
          console.error("Clear data error:", err);
          alert("Error clearing data");
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12">
      <ConfirmModal 
        isOpen={showConfirmClear}
        onClose={() => setShowConfirmClear(false)}
        onConfirm={clearAllData}
        title={lang === 'ur' ? 'ڈیلیٹ کریں؟' : 'Confirm Clear'}
        message={lang === 'ur' ? 'کیا آپ واقعی تمام ڈیٹا حذف کرنا چاہتے ہیں؟ یہ عمل ناقابل واپسی ہے۔' : 'Are you sure you want to clear all data? This cannot be undone.'}
        lang={lang}
      />
      
      <SecurityModal
        isOpen={!!securityAction}
        onClose={() => setSecurityAction(null)}
        onVerifySuccess={() => {
          if (securityAction) {
            securityAction.onVerify();
          }
        }}
        correctPin={currentSettings.appPin}
        lang={lang}
        actionName={lang === 'ur' ? securityAction?.nameUr || '' : securityAction?.nameEn || ''}
      />
      
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-gold-dark urdu-text">{t.settings}</h2>
        <p className="text-zinc-500 text-sm">{lang === 'ur' ? 'ایپلی کیشن کی ترتیبات تبدیل کریں' : 'Configure application settings'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quick Stats & Language */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-4">
            <h3 className="text-sm font-bold text-zinc-500 uppercase urdu-text">{lang === 'ur' ? 'موجودہ ریٹ' : 'Current Rate'}</h3>
            <div className="text-center py-2">
              <p className="text-3xl font-bold text-gold-dark">Rs. {currentSettings.goldRate.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500 uppercase mt-1">Per Gram Gold</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-4">
            <h3 className="text-sm font-bold text-zinc-500 uppercase urdu-text">{t.language}</h3>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => setLang('ur')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                  lang === 'ur' ? 'bg-gold text-black border-gold shadow-md' : 'bg-sky-50 border-sky-100 text-zinc-600 hover:bg-sky-100'
                }`}
              >
                <span className="font-bold urdu-text">اردو</span>
                {lang === 'ur' && <div className="w-2 h-2 bg-black rounded-full" />}
              </button>
              <button 
                onClick={() => setLang('en')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                  lang === 'en' ? 'bg-gold text-black border-gold shadow-md' : 'bg-sky-50 border-sky-100 text-zinc-600 hover:bg-sky-100'
                }`}
              >
                <span className="font-bold">English</span>
                {lang === 'en' && <div className="w-2 h-2 bg-black rounded-full" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Configuration Forms */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-6">
            <h3 className="text-lg font-bold text-gold-dark border-b border-sky-100 pb-2 urdu-text">{lang === 'ur' ? 'دکان کی تفصیلات' : 'Shop Details'}</h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 urdu-text">{t.shopName}</label>
                <input 
                  type="text" 
                  value={shopNameInput}
                  onChange={e => setShopNameInput(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-black"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 urdu-text">{t.addressLabel}</label>
                <input 
                  type="text" 
                  value={shopAddressInput}
                  onChange={e => setShopAddressInput(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-black"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 urdu-text">{t.phoneNumber} 1</label>
                  <input 
                    type="text" 
                    value={shopPhoneInput}
                    onChange={e => setShopPhoneInput(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-black"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 urdu-text">{t.phoneNumber} 2</label>
                  <input 
                    type="text" 
                    value={shopPhone2Input}
                    onChange={e => setShopPhone2Input(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-black"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 urdu-text">{t.goldRate}</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={rateInput || ''}
                    onChange={e => setRateInput(e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none font-bold text-black"
                  />
                  <button 
                    onClick={handleSaveRate}
                    className="px-4 bg-gold text-black rounded-lg hover:bg-gold-light transition-colors shadow-lg shadow-gold-20"
                  >
                    <Save size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-1 pt-4 border-t border-sky-100">
                <label className="text-xs font-bold text-zinc-500 urdu-text flex items-center justify-between">
                  <span>{t.appSecurity}</span>
                  {currentSettings.appPin && (
                    <span className="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    placeholder={t.pinPlaceholder}
                    className="flex-1 px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-center tracking-widest text-black"
                    dir="ltr"
                  />
                  {currentSettings.appPin && (
                    <button 
                      onClick={handleRemovePin}
                      className="px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      title={t.removePin}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400">{lang === 'ur' ? 'ایپ کو کھولنے کے لیے پاس ورڈ سیٹ کریں' : 'Set a password to lock the application on startup.'}</p>
              </div>

              <button 
                onClick={handleSaveShopDetails}
                className="w-full py-3 bg-gold text-black rounded-lg font-bold hover:bg-gold-light transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gold-20"
              >
                <Save size={20} />
                <span className="urdu-text">{t.save}</span>
              </button>
            </div>
          </div>

          {/* PDF Print Calibration */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-4">
            <h3 className="text-lg font-bold text-gold-dark border-b border-sky-100 pb-2 urdu-text">
              {lang === 'ur' ? 'پہلے سے پرنٹ شدہ بل کیٹنگ (Pre-printed Calibration)' : 'Print Calibration'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1 urdu-text">{lang === 'ur' ? 'موجودہ شفٹ' : 'Current Shift'}</label>
                <p className="text-sm font-bold text-sky-600 font-mono" dir="ltr">
                  X: {currentSettings.printShiftX}mm, Y: {currentSettings.printShiftY}mm
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1 urdu-text">{lang === 'ur' ? 'افقی ایڈجسٹمنٹ (Shift X)' : 'Shift X (mm)'}</label>
                  <input
                    type="number"
                    value={shiftXInput}
                    onChange={(e) => setShiftXInput(e.target.value)}
                    placeholder="e.g. 5 or -5"
                    className="w-full p-2 border border-sky-200 rounded-lg outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1 urdu-text">{lang === 'ur' ? 'عمودی ایڈجسٹمنٹ (Shift Y)' : 'Shift Y (mm)'}</label>
                  <input
                    type="number"
                    value={shiftYInput}
                    onChange={(e) => setShiftYInput(e.target.value)}
                    placeholder="e.g. 5 or -5"
                    className="w-full p-2 border border-sky-200 rounded-lg outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
              <button 
                onClick={handleSaveShopDetails}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mt-2"
              >
                <Save size={20} />
                <span className="urdu-text">{lang === 'ur' ? 'کیلیبریشن محفوظ کریں' : 'Save Calibration'}</span>
              </button>
            </div>
          </div>

          {/* Data Management - HIGHLIGHTED */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-gold space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 bg-gold text-black text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
              Critical Actions
            </div>
            <h3 className="text-xl font-bold text-sky-900 border-b border-sky-100 pb-4 urdu-text flex items-center gap-3">
              <Download className="text-gold" />
              {lang === 'ur' ? 'بیک اپ اور ڈیٹا مینجمنٹ' : 'Backup & Data Management'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={handleBackup}
                className="flex flex-col items-center justify-center gap-3 p-8 bg-sky-600 text-white rounded-3xl hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 hover:-translate-y-1 active:translate-y-0"
              >
                <div className="p-4 bg-white/20 rounded-2xl">
                   <Download size={32} />
                </div>
                <div className="text-center">
                  <span className="block text-lg font-black urdu-text">{t.backup}</span>
                  <span className="text-[10px] opacity-70 uppercase font-bold tracking-widest">Download Data File</span>
                </div>
              </button>

              <label className="flex flex-col items-center justify-center gap-3 p-8 bg-sky-50 text-sky-600 border-2 border-dashed border-sky-200 rounded-3xl hover:bg-sky-100 hover:border-sky-400 transition-all cursor-pointer hover:-translate-y-1 active:translate-y-0">
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                   <Upload size={32} />
                </div>
                <div className="text-center">
                  <span className="block text-lg font-black urdu-text">{t.restore}</span>
                  <span className="text-[10px] text-sky-400 uppercase font-bold tracking-widest">Upload JSON Backup</span>
                </div>
                <input type="file" className="hidden" onChange={handleRestore} accept=".json" />
              </label>
            </div>

            {/* Excel Export Section */}
            <div className="pt-8 border-t border-sky-100 space-y-4">
              <div className="flex items-center gap-2 text-sky-900 font-bold urdu-text">
                <BadgeDollarSign className="text-emerald-500" />
                {lang === 'ur' ? 'ایکسل رپورٹنگ (Excel Sheets)' : 'Excel Reporting'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => handleExportCSV('sales')}
                  className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all font-bold group"
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                    <History size={20} />
                  </div>
                  <span className="urdu-text text-sm">{t.exportSalesExcel}</span>
                </button>
                <button 
                  onClick={() => handleExportCSV('purchases')}
                  className="flex items-center gap-3 p-4 bg-amber-50 text-amber-700 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-all font-bold group"
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                    <ShoppingBag size={20} />
                  </div>
                  <span className="urdu-text text-sm">{t.exportPurchasesExcel}</span>
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-sky-100 italic text-center">
              <p className="text-xs text-zinc-400">
                {lang === 'ur' 
                  ? 'نوٹ: اپنے قیمتی ڈیٹا کا باقاعدگی سے بیک اپ لیں تاکہ نقصان سے بچا جا سکے۔' 
                  : 'Important: Regularly back up your data to avoid accidental loss.'}
              </p>
            </div>

            <div className="pt-4">
              <button 
                onClick={() => setShowConfirmClear(true)}
                className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-600 hover:text-white transition-all font-bold group"
              >
                <Trash2 size={20} className="group-hover:animate-bounce" />
                <span className="urdu-text">{lang === 'ur' ? 'تمام ڈیٹا حذف کریں' : 'Clear All Data Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
