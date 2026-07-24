import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { translations, type Language } from '../translations';
import { APP_CONFIG } from '../config';
import { COLOR_PALETTES, type ColorPalette } from '../lib/colors';
import { Save, Download, Upload, Languages, Trash2, AlertTriangle, BadgeDollarSign, History, ShoppingBag, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { SecurityModal } from './SecurityModal';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import PdfExportHidden, { PdfExportRef, PdfSection } from './PdfExportHidden';
import { 
  addAuthListener, 
  googleSignIn, 
  logoutGoogleDrive, 
  autoBackupToDrive, 
  findBackupOnDrive, 
  downloadBackupContent 
} from '../lib/googleDriveBackup';

interface SettingsProps {
  lang: Language;
  setGoldRate: (rate: number) => void;
  setLang: (lang: Language) => void;
  paletteId: string;
  setPaletteId: (id: string) => void;
}

export default function Settings({ lang, setGoldRate, setLang, paletteId, setPaletteId }: SettingsProps) {
  const t = translations[lang];
  const pdfRef = React.useRef<PdfExportRef>(null);
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

  // Google Drive states
  const [gUser, setGUser] = useState<any>(null);
  const [gToken, setGToken] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [lastDriveBackup, setLastDriveBackup] = useState<string | null>(null);
  const [driveStatusMessage, setDriveStatusMessage] = useState<string>('');

  useEffect(() => {
    const unsubscribe = addAuthListener(async (user, token) => {
      setGUser(user);
      setGToken(token);
      
      const lastDate = await db.settings.get('lastDriveBackupDate');
      if (lastDate) {
        setLastDriveBackup(lastDate.value);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleConnect = async () => {
    setIsGoogleLoading(true);
    setDriveStatusMessage('');
    try {
      const res = await googleSignIn();
      if (res) {
        setDriveStatusMessage(lang === 'ur' ? 'گوگل ڈرائیو کامیابی سے مربوط ہو گئی!' : 'Google Drive connected successfully!');
        // Trigger an immediate backup to keep Drive in sync
        await autoBackupToDrive();
        const lastDate = await db.settings.get('lastDriveBackupDate');
        if (lastDate) setLastDriveBackup(lastDate.value);
      }
    } catch (err: any) {
      const isPopupClosed = err && (
        err.code === 'auth/popup-closed-by-user' || 
        err.code === 'auth/cancelled-popup-request' ||
        err.message?.includes('popup-closed-by-user') ||
        err.message?.includes('cancelled-popup-request')
      );
      if (isPopupClosed) {
        console.warn('Google connection cancelled/blocked:', err);
        setDriveStatusMessage(lang === 'ur' 
          ? 'سائن ان منسوخ کر دیا گیا یا براؤزر نے پاپ اپ بلاک کر دیا۔ براہ کرم پاپ اپ کی اجازت دیں اور دوبارہ کوشش کریں۔' 
          : 'Sign-in cancelled or blocked by browser. Please allow popups and try again.');
      } else {
        console.error('Google connection failed:', err);
        setDriveStatusMessage(lang === 'ur' ? 'گوگل لاگ ان ناکام رہا۔' : 'Google connection failed.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (window.confirm(lang === 'ur' ? 'کیا آپ واقعی گوگل ڈرائیو کو منقطع کرنا چاہتے ہیں؟' : 'Are you sure you want to disconnect Google Drive?')) {
      await logoutGoogleDrive();
      setDriveStatusMessage(lang === 'ur' ? 'گوگل ڈرائیو منقطع ہو گئی۔' : 'Google Drive disconnected.');
      setLastDriveBackup(null);
    }
  };

  const handleManualDriveBackup = async () => {
    setIsGoogleLoading(true);
    setDriveStatusMessage(lang === 'ur' ? 'بیک اپ اپ لوڈ ہو رہا ہے...' : 'Uploading backup...');
    try {
      const success = await autoBackupToDrive();
      if (success) {
        setDriveStatusMessage(lang === 'ur' ? 'بیک اپ کامیابی سے اپ لوڈ ہو گیا!' : 'Backup uploaded successfully!');
        const lastDate = await db.settings.get('lastDriveBackupDate');
        if (lastDate) setLastDriveBackup(lastDate.value);
      } else {
        setDriveStatusMessage(lang === 'ur' ? 'بیک اپ اپ لوڈ کرنے میں ناکامی۔' : 'Failed to upload backup.');
      }
    } catch (err) {
      console.error(err);
      setDriveStatusMessage(lang === 'ur' ? 'بیک اپ اپ لوڈ کرنے میں خرابی۔' : 'Error uploading backup.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleManualDriveRestore = async () => {
    if (!gToken) return;
    const confirmRestore = window.confirm(
      lang === 'ur' 
        ? 'انتباہ: یہ عمل آپ کے موجودہ تمام ڈیٹا کو ختم کر کے گوگل ڈرائیو کے بیک اپ سے بحال کر دے گا۔ کیا آپ آگے بڑھنا چاہتے ہیں؟' 
        : 'Warning: This will clear ALL current data and restore from the Google Drive backup. Do you want to proceed?'
    );
    if (!confirmRestore) return;

    triggerSecurityCheck(
      'گوگل ڈرائیو سے ڈیٹا بحال کریں',
      'Restore Data from Google Drive',
      async () => {
        setIsGoogleLoading(true);
        setDriveStatusMessage(lang === 'ur' ? 'بیک اپ تلاش کیا جا رہا ہے...' : 'Searching for backup...');
        try {
          const backupFile = await findBackupOnDrive(gToken);
          if (!backupFile) {
            alert(lang === 'ur' ? 'ڈرائیو پر کوئی بیک اپ فائل نہیں ملی!' : 'No backup file found on Drive!');
            setDriveStatusMessage(lang === 'ur' ? 'کوئی بیک اپ نہیں ملا۔' : 'No backup found.');
            return;
          }

          setDriveStatusMessage(lang === 'ur' ? 'ڈیٹا ڈاؤن لوڈ ہو رہا ہے...' : 'Downloading backup data...');
          const data = await downloadBackupContent(gToken, backupFile.id);
          if (!data) {
            alert(lang === 'ur' ? 'بیک اپ ڈاؤن لوڈ کرنے میں ناکامی!' : 'Failed to download backup!');
            return;
          }

          // Clear database and bulkAdd
          await db.sales.clear();
          await db.orders.clear();
          await db.karigars.clear();
          await db.repairs.clear();
          await db.stock.clear();
          await db.settings.clear();
          await db.goldPurchases.clear();
          if (db.expenses) await db.expenses.clear();
          if (db.khaataAccounts) await db.khaataAccounts.clear();
          if (db.khaataEntries) await db.khaataEntries.clear();

          if (data.sales) await db.sales.bulkAdd(data.sales);
          if (data.orders) await db.orders.bulkAdd(data.orders);
          if (data.karigars) await db.karigars.bulkAdd(data.karigars);
          if (data.repairs) await db.repairs.bulkAdd(data.repairs);
          if (data.stock) await db.stock.bulkAdd(data.stock);
          if (data.settings) await db.settings.bulkAdd(data.settings);
          if (data.goldPurchases) await db.goldPurchases.bulkAdd(data.goldPurchases);
          if (data.expenses && db.expenses) await db.expenses.bulkAdd(data.expenses);
          if (data.khaataAccounts && db.khaataAccounts) await db.khaataAccounts.bulkAdd(data.khaataAccounts);
          if (data.khaataEntries && db.khaataEntries) await db.khaataEntries.bulkAdd(data.khaataEntries);

          // Re-set drive connected flag so it stays connected
          await db.settings.put({ key: 'googleDriveConnected', value: 'true' });

          alert(lang === 'ur' ? 'ڈیٹا گوگل ڈرائیو سے کامیابی سے بحال ہو گیا ہے!' : 'Data restored successfully from Google Drive!');
          window.location.reload();
        } catch (err) {
          console.error(err);
          alert(lang === 'ur' ? 'ڈیٹا بحال کرنے میں خرابی پیش آئی!' : 'Error restoring data!');
        } finally {
          setIsGoogleLoading(false);
        }
      }
    );
  };

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
    autoBackupFrequency: 'none',
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
      const backupFreqData = await db.settings.get('autoBackupFrequency');
      const appPinData = await db.settings.get('appPin');
      
      setCurrentSettings({
        goldRate: rateData?.value || 0,
        shopName: nameData?.value || translations[lang].shopName,
        shopAddress: addressData?.value || translations[lang].shopAddress,
        shopPhone: phoneData?.value || translations[lang].shopPhone,
        shopPhone2: phone2Data?.value || translations[lang].shopPhone2,
        printShiftX: shiftXData?.value || 0,
        printShiftY: shiftYData?.value || 0,
        autoBackupFrequency: backupFreqData?.value || 'none',
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

  const handleExportPDF = async (type: 'sales' | 'purchases' | 'all' = 'all') => {
    try {
      if (!pdfRef.current) return;
      setIsExportingPdf(true);
      
      const sections: PdfSection[] = [];
      const filename = `All_Data_Export_${new Date().toISOString().split('T')[0]}.pdf`;
      const title = lang === 'ur' ? "تمام ایپ کا ڈیٹا" : "All App Data Report";

      // 1. Sales
      const sales = await db.sales.toArray();
      sections.push({
        heading: lang === 'ur' ? "سیلز ریکارڈ" : "Sales Records",
        columns: lang === 'ur' ? ['رسید نمبر', 'تاریخ', 'گاہک کا نام', 'فون نمبر', 'کل رقم', 'وصول شدہ', 'بکایا', 'آئٹمز'] : ['Invoice #', 'Date', 'Customer Name', 'Phone', 'Total', 'Received', 'Remaining', 'Items'],
        data: sales.map(s => [
          s.id?.toString() || '', 
          s.date || '', 
          s.name || '', 
          s.phone || '', 
          s.total?.toLocaleString() || '0', 
          s.rec?.toLocaleString() || '0', 
          s.rem?.toLocaleString() || '0', 
          s.items?.map(i => `${i.n}(${i.w}g)`).join(' | ') || ''
        ])
      });

      // 2. Purchases
      const purchases = await db.goldPurchases.toArray();
      sections.push({
        heading: lang === 'ur' ? "خریداری ریکارڈ" : "Purchases Records",
        columns: lang === 'ur' ? ['تاریخ', 'فروخت کنندہ کا نام', 'فون نمبر', 'وزن (گرام)', 'ریٹ', 'کل رقم'] : ['Date', 'Seller Name', 'Phone', 'Weight(g)', 'Rate', 'Total'],
        data: purchases.map(p => [
          p.date || '', 
          p.name || '', 
          p.phone || '', 
          p.weight?.toString() || '0', 
          p.rate?.toLocaleString() || '0', 
          p.total?.toLocaleString() || '0'
        ])
      });

      // 3. Orders
      const orders = await db.orders.toArray();
      sections.push({
        heading: lang === 'ur' ? "آرڈرز" : "Orders",
        columns: lang === 'ur' ? ['تاریخ', 'واپسی کی تاریخ', 'گاہک کا نام', 'فون نمبر', 'کل رقم', 'سٹیٹس'] : ['Date', 'Due Date', 'Customer', 'Phone', 'Total', 'Status'],
        data: orders.map(o => [
          o.date || '', o.due || '', o.name || '', o.phone || '', o.total?.toLocaleString() || '0', 
          lang === 'ur' ? (o.status === 'completed' ? 'مکمل' : o.status === 'cancelled' ? 'منسوخ' : 'زیر التواء') : o.status || ''
        ])
      });

      // 4. Khaata Entries
      const khaataEntries = await db.khaataEntries.toArray();
      sections.push({
        heading: lang === 'ur' ? "کھاتہ تفصیلات" : "Khaata Entries",
        columns: lang === 'ur' ? ['تاریخ', 'کھاتہ ID', 'قسم', 'خالص وزن', 'پاسہ دیا', 'تفصیل'] : ['Date', 'Account ID', 'Type', 'Pure Wt', 'Pasa Gold', 'Details'],
        data: khaataEntries.map(k => [
          k.date || '', k.accountId?.toString() || '', 
          lang === 'ur' ? (k.type === 'give' ? 'بنام (دیا)' : 'جمع (وصول)') : k.type || '', 
          k.pureWeight?.toString() || '-', k.pasaDia?.toString() || '-', k.details || ''
        ])
      });

      // 5. Karigar
      const karigars = await db.karigars.toArray();
      sections.push({
        heading: lang === 'ur' ? "کاریگر کھاتہ" : "Karigar",
        columns: lang === 'ur' ? ['نام', 'کام', 'دیا (گرام)', 'وصول (گرام)', 'نیٹ (گرام)'] : ['Name', 'Task', 'Given(g)', 'Received(g)', 'Net(g)'],
        data: karigars.map(k => [
          k.name || '', k.task || '', k.given?.toString() || '0', k.rec?.toString() || '0', k.net?.toString() || '0'
        ])
      });

      // 6. Repairs
      const repairs = await db.repairs.toArray();
      sections.push({
        heading: lang === 'ur' ? "مرمت" : "Repairs",
        columns: lang === 'ur' ? ['گاہک کا نام', 'فون نمبر', 'آئٹم', 'مسئلہ', 'قیمت', 'سٹیٹس'] : ['Customer', 'Phone', 'Item', 'Issue', 'Cost', 'Status'],
        data: repairs.map(r => [
          r.customerName || '', r.customerPhone || '', r.item || '', r.issue || '', r.charges?.toLocaleString() || '0', 
          lang === 'ur' ? (r.status === 'Done' ? 'مکمل' : 'زیر التواء') : r.status || ''
        ])
      });

      // 7. Stock
      const stock = await db.stock.toArray();
      sections.push({
        heading: lang === 'ur' ? "اسٹاک" : "Stock",
        columns: lang === 'ur' ? ['آئٹم کا نام', 'قسم', 'مقدار', 'یونٹ', 'پیسز'] : ['Item Name', 'Type', 'Quantity', 'Unit', 'Pieces'],
        data: stock.map(s => [
          s.name || '', lang === 'ur' ? (s.type === 'Gold' ? 'سونا' : 'آئٹم') : s.type || '', 
          s.quantity?.toString() || '0', s.unit || '', s.pieces?.toString() || '0'
        ])
      });

      // 8. Expenses (if available)
      if (db.expenses) {
        const expenses = await db.expenses.toArray();
        if (expenses.length > 0) {
          sections.push({
            heading: lang === 'ur' ? "اخراجات" : "Expenses",
            columns: lang === 'ur' ? ['تاریخ', 'کیٹیگری', 'تفصیل', 'رقم'] : ['Date', 'Category', 'Description', 'Amount'],
            data: expenses.map(e => [
              e.date || '', e.category || '', e.description || '', e.amount?.toLocaleString() || '0'
            ])
          });
        }
      }

      await pdfRef.current.generatePDF(sections, filename, title);

    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExportingPdf(false);
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
      const khaataAccounts = db.khaataAccounts ? await db.khaataAccounts.toArray() : [];
      const khaataEntries = db.khaataEntries ? await db.khaataEntries.toArray() : [];

      const data = { sales, orders, karigars, repairs, stock, settings, goldPurchases, khaataAccounts, khaataEntries };
      const fileName = "nafees_jewellers_backup.json";
      const jsonString = JSON.stringify(data);

      await db.settings.put({ key: 'lastBackupDate', value: new Date().toISOString() });

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
            if (db.khaataAccounts) await db.khaataAccounts.clear();
            if (db.khaataEntries) await db.khaataEntries.clear();

            if (data.sales) await db.sales.bulkAdd(data.sales);
            if (data.orders) await db.orders.bulkAdd(data.orders);
            if (data.karigars) await db.karigars.bulkAdd(data.karigars);
            if (data.repairs) await db.repairs.bulkAdd(data.repairs);
            if (data.stock) await db.stock.bulkAdd(data.stock);
            if (data.settings) await db.settings.bulkAdd(data.settings);
            if (data.goldPurchases) await db.goldPurchases.bulkAdd(data.goldPurchases);
            if (data.khaataAccounts && db.khaataAccounts) await db.khaataAccounts.bulkAdd(data.khaataAccounts);
            if (data.khaataEntries && db.khaataEntries) await db.khaataEntries.bulkAdd(data.khaataEntries);

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
            db.goldPurchases.clear(),
            db.khaataAccounts ? db.khaataAccounts.clear() : Promise.resolve(),
            db.khaataEntries ? db.khaataEntries.clear() : Promise.resolve()
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

          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-4">
            <h3 className="text-sm font-bold text-zinc-500 uppercase urdu-text">
              {lang === 'ur' ? 'رنگوں کی تھیم' : 'Color Theme'}
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {lang === 'ur' ? 'ایپلی کیشن کا رنگ اور تھیم تبدیل کریں' : 'Change the colors and theme of the application'}
            </p>
            <div className="space-y-2">
              {COLOR_PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={async () => {
                    await db.settings.put({ key: 'colorPalette', value: p.id });
                    setPaletteId(p.id);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    paletteId === p.id 
                      ? 'bg-sky-50 border-sky-400 shadow-sm' 
                      : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex flex-col text-start items-start">
                    <span className="font-bold text-sm text-zinc-800">
                      {lang === 'ur' ? p.nameUr : p.nameEn}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div 
                      className="w-4 h-4 rounded-full border border-black/10 shadow-sm" 
                      style={{ backgroundColor: p.sky[500] }} 
                      title="Primary"
                    />
                    <div 
                      className="w-4 h-4 rounded-full border border-black/10 shadow-sm" 
                      style={{ backgroundColor: p.gold.base }} 
                      title="Accent"
                    />
                    {paletteId === p.id && (
                      <div className="w-1.5 h-1.5 bg-sky-600 rounded-full ml-1" />
                    )}
                  </div>
                </button>
              ))}
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

            {/* Google Drive Automated Backup Section */}
            <div className="p-6 bg-sky-50 rounded-2xl border border-sky-200/60 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="text-sky-600 animate-pulse" size={24} />
                  <div>
                    <h4 className="font-bold text-sky-900 urdu-text">
                      {lang === 'ur' ? 'گوگل ڈرائیو آٹو بیک اپ' : 'Google Drive Auto-Backup'}
                    </h4>
                    <p className="text-[11px] text-sky-600 urdu-text">
                      {lang === 'ur' ? 'ڈیٹا محفوظ اور خودکار طریقے سے گوگل ڈرائیو پر اپ لوڈ ہوتا رہے گا' : 'Secure background sync to Google Drive'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-200/50 text-sky-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {gUser ? 'Active' : 'Offline'}
                </div>
              </div>

              {gUser ? (
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-sky-100 text-xs text-zinc-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-semibold">{lang === 'ur' ? 'مربوط اکاؤنٹ:' : 'Connected Account:'}</span>
                      <span className="font-mono text-sky-700 font-medium">{gUser.email}</span>
                    </div>
                    {lastDriveBackup && (
                      <div className="flex justify-between">
                        <span className="font-semibold">{lang === 'ur' ? 'آخری خودکار بیک اپ:' : 'Last Backup Time:'}</span>
                        <span className="font-mono text-zinc-500">{new Date(lastDriveBackup).toLocaleString(lang === 'ur' ? 'ur-PK' : 'en-US')}</span>
                      </div>
                    )}
                    {driveStatusMessage && (
                      <p className="text-[11px] text-amber-700 mt-2 font-medium bg-amber-50 px-2.5 py-1.5 rounded border border-amber-100/50">{driveStatusMessage}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleManualDriveBackup}
                      disabled={isGoogleLoading}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-600 text-white text-xs font-bold rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={isGoogleLoading ? 'animate-spin' : ''} />
                      <span className="urdu-text">{lang === 'ur' ? 'ابھی بیک اپ کریں' : 'Backup Now'}</span>
                    </button>

                    <button
                      onClick={handleManualDriveRestore}
                      disabled={isGoogleLoading}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Cloud className="text-white" size={14} />
                      <span className="urdu-text">{lang === 'ur' ? 'بیک اپ سے بحال کریں' : 'Restore from Drive'}</span>
                    </button>
                  </div>

                  <button
                    onClick={handleGoogleDisconnect}
                    className="w-full text-center text-red-500 hover:text-red-700 text-[11px] font-bold underline"
                  >
                    {lang === 'ur' ? 'گوگل ڈرائیو منقطع کریں' : 'Disconnect Google Account'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-zinc-500 leading-relaxed urdu-text">
                    {lang === 'ur' 
                      ? 'اپنے ریکارڈز، بل، اور گاہکوں کے ڈیٹا کو خود بخود اپنے محفوظ گوگل ڈرائیو پر اپ لوڈ کریں۔ ایپ انسٹال کرنے پر آپ سارا ڈیٹا ایک کلک میں واپس لا سکیں گے۔' 
                      : 'Automatically back up your records, bills, and customer list securely to Google Drive. Keep your shop data safe and restore with a single click on reinstall.'}
                  </p>

                  <button
                    onClick={handleGoogleConnect}
                    disabled={isGoogleLoading}
                    className="gsi-material-button w-full flex items-center justify-center gap-3 py-2.5 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 text-xs font-medium text-zinc-700 shadow-sm"
                  >
                    <div className="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '20px', height: '20px' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents font-semibold">{lang === 'ur' ? 'گوگل اکاؤنٹ مربوط کریں' : 'Connect Google Account'}</span>
                  </button>
                  {driveStatusMessage && (
                    <p className="text-[11px] text-red-600 text-center">{driveStatusMessage}</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-sky-50 rounded-xl border border-sky-100 mt-4 mb-4">
              <div>
                <p className="font-bold text-sky-900 urdu-text">{lang === 'ur' ? 'آٹو بیک اپ سیٹنگ' : 'Auto Backup Setting'}</p>
                <p className="text-xs text-sky-600 urdu-text mt-1">{lang === 'ur' ? 'منتخب کردہ وقت کے بعد ایپ خودکار بیک اپ لے گی' : 'App will automatically backup data after the selected time'}</p>
              </div>
              <div className="mt-3">
                <select 
                  className="w-full p-3 bg-white border border-sky-200 rounded-lg outline-none focus:border-gold text-black"
                  value={currentSettings.autoBackupFrequency}
                  onChange={async (e) => {
                    const val = e.target.value;
                    await db.settings.put({ key: 'autoBackupFrequency', value: val });
                    // Also reset last backup date when changing frequency to start the timer from now
                    await db.settings.put({ key: 'lastBackupDate', value: new Date().toISOString() });
                    setCurrentSettings(prev => ({ ...prev, autoBackupFrequency: val }));
                  }}
                >
                  <option value="none">{lang === 'ur' ? 'کوئی نہیں (None)' : 'None'}</option>
                  <option value="7">{lang === 'ur' ? 'ہفتہ وار (Weekly)' : 'Weekly'}</option>
                  <option value="15">{lang === 'ur' ? '15 دن بعد (15 Days)' : '15 Days'}</option>
                  <option value="30">{lang === 'ur' ? 'ماہانہ (Monthly)' : 'Monthly'}</option>
                </select>
              </div>
            </div>

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

            {/* PDF Export Section */}
            <div className="pt-8 border-t border-sky-100 space-y-4">
              <div className="flex items-center gap-2 text-sky-900 font-bold urdu-text">
                <Download className="text-indigo-600" />
                {lang === 'ur' ? 'پی ڈی ایف رپورٹنگ (PDF Report)' : 'PDF Reporting'}
              </div>
              <div>
                <button 
                  onClick={() => handleExportPDF('all')}
                  disabled={isExportingPdf}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-bold shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                    <Download size={22} />
                  </div>
                  <span className="urdu-text text-base">
                    {isExportingPdf 
                      ? (lang === 'ur' ? 'تمام ڈیٹا پی ڈی ایف میں محفوظ ہو رہا ہے...' : 'Generating Complete PDF Report...') 
                      : (t.exportAllDataPdf || "Export All Data to PDF")}
                  </span>
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

            <div className="text-center pt-6 flex flex-col items-center justify-center gap-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-xs font-mono font-bold border border-sky-100/80 select-none">
                Version {APP_CONFIG.version}
              </span>
              <span className="text-[10px] text-zinc-400 select-none">
                {lang === 'ur' ? 'نفیس جیولرز ای آر پی • تمام حقوق محفوظ ہیں' : 'Nafees Jewellers ERP • All Rights Reserved'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <PdfExportHidden ref={pdfRef} />
    </div>
  );
}
