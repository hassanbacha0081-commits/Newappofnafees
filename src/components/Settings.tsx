import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { translations, type Language } from '../translations';
import { APP_CONFIG } from '../config';
import { COLOR_PALETTES, type ColorPalette } from '../lib/colors';
import { Save, Download, Upload, Languages, Trash2, AlertTriangle, BadgeDollarSign, History, ShoppingBag, Cloud, CloudOff, RefreshCw, Calendar, ExternalLink, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
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
  downloadBackupContent,
  ensureAccessToken
} from '../lib/googleDriveBackup';
import { useSyncStatus, runFullSync, getFirestoreQuotaUpgradeUrl } from '../lib/syncEngine';

interface SettingsProps {
  lang: Language;
  setGoldRate: (rate: number) => void;
  setLang: (lang: Language) => void;
  paletteId: string;
  setPaletteId: (id: string) => void;
}

// Helper to parse dates from various database record formats
const parseRecordDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }
  const str = String(dateVal).trim();
  if (!str) return null;

  if (str.includes('T')) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    if (slashParts[0].length === 4) {
      return new Date(Number(slashParts[0]), Number(slashParts[1]) - 1, Number(slashParts[2]));
    }
    return new Date(Number(slashParts[2]), Number(slashParts[1]) - 1, Number(slashParts[0]));
  }

  const dashParts = str.split('-');
  if (dashParts.length === 3) {
    if (dashParts[0].length === 4) {
      return new Date(Number(dashParts[0]), Number(dashParts[1]) - 1, Number(dashParts[2]));
    } else if (dashParts[2].length === 4) {
      return new Date(Number(dashParts[2]), Number(dashParts[1]) - 1, Number(dashParts[0]));
    }
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const isDateInRange = (dateVal: any, startDateStr: string, endDateStr: string): boolean => {
  if (!startDateStr && !endDateStr) return true;

  const recDate = parseRecordDate(dateVal);
  if (!recDate) return true;

  let start = startDateStr ? parseRecordDate(startDateStr) : null;
  let end = endDateStr ? parseRecordDate(endDateStr) : null;

  if (start && isNaN(start.getTime())) start = null;
  if (end && isNaN(end.getTime())) end = null;

  if (start && end && start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  if (start) {
    start.setHours(0, 0, 0, 0);
    if (recDate < start) return false;
  }

  if (end) {
    end.setHours(23, 59, 59, 999);
    if (recDate > end) return false;
  }

  return true;
};

export default function Settings({ lang, setGoldRate, setLang, paletteId, setPaletteId }: SettingsProps) {
  const t = translations[lang];
  const pdfRef = React.useRef<PdfExportRef>(null);
  const [rateInput, setRateInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [securityAction, setSecurityAction] = useState<{ nameUr: string, nameEn: string, onVerify: () => void } | null>(null);

  // PDF Date Filter states
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');

  // Google Drive states
  const [gUser, setGUser] = useState<any>(null);
  const [gToken, setGToken] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [lastDriveBackup, setLastDriveBackup] = useState<string | null>(null);
  const [driveStatusMessage, setDriveStatusMessage] = useState<string>('');

  // Live Cloud Sync Status
  const syncStatus = useSyncStatus();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [manualSyncFeedback, setManualSyncFeedback] = useState<string | null>(null);

  const handleManualCloudSync = async () => {
    setIsManualSyncing(true);
    setManualSyncFeedback(null);
    try {
      const res = await runFullSync(true);
      if (res.success) {
        setManualSyncFeedback(lang === 'ur' ? 'کلاؤڈ سنک کامیابی سے مکمل ہو گیا!' : 'Cloud sync completed successfully!');
      } else if (syncStatus.isQuotaExceeded) {
        setManualSyncFeedback(lang === 'ur' ? 'فائر بیس یومیہ کوٹہ عارضی طور پر مکمل ہے۔ ڈیٹا لوکل محفوظ ہے۔' : 'Firestore daily quota reached. Local data is 100% safe.');
      } else {
        setManualSyncFeedback(res.error || (lang === 'ur' ? 'سنک میں مسئلہ پیش آیا' : 'Sync encountered an issue'));
      }
    } catch (e: any) {
      setManualSyncFeedback(e.message || String(e));
    } finally {
      setIsManualSyncing(false);
    }
  };

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
      let token = gToken;
      if (!token) {
        token = await ensureAccessToken();
      }
      if (!token) {
        setDriveStatusMessage(lang === 'ur' ? 'گوگل ڈرائیو تک رسائی کی اجازت حاصل نہیں ہو سکی۔' : 'Could not obtain Google Drive access token.');
        return;
      }
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
    let token = gToken;
    if (!token) {
      token = await ensureAccessToken();
    }
    if (!token) {
      setDriveStatusMessage(lang === 'ur' ? 'گوگل ڈرائیو تک رسائی کی اجازت حاصل نہیں ہو سکی۔' : 'Could not obtain Google Drive access token.');
      return;
    }
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
          const backupFile = await findBackupOnDrive(token);
          if (!backupFile) {
            alert(lang === 'ur' ? 'ڈرائیو پر کوئی بیک اپ فائل نہیں ملی!' : 'No backup file found on Drive!');
            setDriveStatusMessage(lang === 'ur' ? 'کوئی بیک اپ نہیں ملا۔' : 'No backup found.');
            return;
          }

          setDriveStatusMessage(lang === 'ur' ? 'ڈیٹا ڈاؤن لوڈ ہو رہا ہے...' : 'Downloading backup data...');
          const data = await downloadBackupContent(token, backupFile.id);
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
    appPin: '',
    shopLogo: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const rateData = await db.settings.get('goldRate');
      const shiftXData = await db.settings.get('printShiftX');
      const shiftYData = await db.settings.get('printShiftY');
      const backupFreqData = await db.settings.get('autoBackupFrequency');
      const appPinData = await db.settings.get('appPin');
      const sName = await db.settings.get('shopName');
      const sAddr = await db.settings.get('shopAddress');
      const sPhone1 = await db.settings.get('shopPhone');
      const sPhone2 = await db.settings.get('shopPhone2');
      const sLogo = await db.settings.get('shopLogo');
      
      setCurrentSettings({
        goldRate: rateData?.value || 0,
        shopName: sName?.value || (lang === 'ur' ? APP_CONFIG.shopNameUrdu : APP_CONFIG.shopNameEnglish),
        shopAddress: sAddr?.value || (lang === 'ur' ? APP_CONFIG.shopAddressUrdu : APP_CONFIG.shopAddressEnglish),
        shopPhone: sPhone1?.value || APP_CONFIG.phone1,
        shopPhone2: sPhone2?.value || APP_CONFIG.phone2,
        printShiftX: shiftXData?.value || 0,
        printShiftY: shiftYData?.value || 0,
        autoBackupFrequency: backupFreqData?.value || 'none',
        appPin: appPinData?.value || '',
        shopLogo: sLogo?.value || ''
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

  const handleSavePin = async () => {
    if (!pinInput) {
      alert(lang === 'ur' ? 'براہ کرم پاس ورڈ درج کریں' : 'Please enter a PIN');
      return;
    }
    triggerSecurityCheck(
      'پاس ورڈ تبدیل کریں',
      'Set App Password',
      async () => {
        await db.settings.put({ key: 'appPin', value: pinInput });
        setCurrentSettings(prev => ({ ...prev, appPin: pinInput }));
        setPinInput('');
        alert(lang === 'ur' ? 'ایپ پاس ورڈ محفوظ کر لیا گیا ہے' : 'App password saved successfully');
      }
    );
  };

  const handleExportPDF = async (type: 'sales' | 'purchases' | 'all' = 'all') => {
    try {
      if (!pdfRef.current) return;
      setIsExportingPdf(true);
      
      const sections: PdfSection[] = [];

      let dateRangeLabel = "";
      if (exportStartDate || exportEndDate) {
        const startDisp = exportStartDate || '...';
        const endDisp = exportEndDate || '...';
        dateRangeLabel = lang === 'ur'
          ? ` (${startDisp} تا ${endDisp})`
          : ` (${startDisp} to ${endDisp})`;
      }

      const filenameDatePart = (exportStartDate || exportEndDate)
        ? `${exportStartDate || 'start'}_to_${exportEndDate || 'end'}`
        : new Date().toISOString().split('T')[0];

      const filename = `Data_Export_${filenameDatePart}.pdf`;
      const title = (lang === 'ur' ? "ایپ ڈیٹا رپورٹ" : "App Data Report") + dateRangeLabel;

      // 1. Sales
      let sales = await db.sales.toArray();
      if (exportStartDate || exportEndDate) {
        sales = sales.filter(s => isDateInRange(s.date, exportStartDate, exportEndDate));
      }
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
      let purchases = await db.goldPurchases.toArray();
      if (exportStartDate || exportEndDate) {
        purchases = purchases.filter(p => isDateInRange(p.date, exportStartDate, exportEndDate));
      }
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
      let orders = await db.orders.toArray();
      if (exportStartDate || exportEndDate) {
        orders = orders.filter(o => isDateInRange(o.date, exportStartDate, exportEndDate));
      }
      sections.push({
        heading: lang === 'ur' ? "آرڈرز" : "Orders",
        columns: lang === 'ur' ? ['تاریخ', 'واپسی کی تاریخ', 'گاہک کا نام', 'فون نمبر', 'کل رقم', 'سٹیٹس'] : ['Date', 'Due Date', 'Customer', 'Phone', 'Total', 'Status'],
        data: orders.map(o => [
          o.date || '', o.due || '', o.name || '', o.phone || '', o.total?.toLocaleString() || '0', 
          lang === 'ur' ? (o.status === 'completed' ? 'مکمل' : o.status === 'cancelled' ? 'منسوخ' : 'زیر التواء') : o.status || ''
        ])
      });

      // 4. Khaata Entries
      let khaataEntries = db.khaataEntries ? await db.khaataEntries.toArray() : [];
      if (exportStartDate || exportEndDate) {
        khaataEntries = khaataEntries.filter(k => isDateInRange(k.date, exportStartDate, exportEndDate));
      }
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
      let karigars = await db.karigars.toArray();
      if (exportStartDate || exportEndDate) {
        karigars = karigars.filter(k => isDateInRange(k.date, exportStartDate, exportEndDate));
      }
      sections.push({
        heading: lang === 'ur' ? "کاریگر کھاتہ" : "Karigar",
        columns: lang === 'ur' ? ['نام', 'کام', 'دیا (گرام)', 'وصول (گرام)', 'نیٹ (گرام)'] : ['Name', 'Task', 'Given(g)', 'Received(g)', 'Net(g)'],
        data: karigars.map(k => [
          k.name || '', k.task || '', k.given?.toString() || '0', k.rec?.toString() || '0', k.net?.toString() || '0'
        ])
      });

      // 6. Repairs
      let repairs = await db.repairs.toArray();
      if (exportStartDate || exportEndDate) {
        repairs = repairs.filter(r => isDateInRange(r.date, exportStartDate, exportEndDate));
      }
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
        let expenses = await db.expenses.toArray();
        if (exportStartDate || exportEndDate) {
          expenses = expenses.filter(e => isDateInRange(e.date, exportStartDate, exportEndDate));
        }
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

            
            {/* Independent Store Picture */}
            <div className="bg-gradient-to-br from-amber-50 to-sky-50 p-4 rounded-xl border border-amber-200/80 space-y-4">
              <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wide urdu-text">
                {lang === 'ur' ? 'دکان کی تصویر / لوگو' : 'Store Picture / Logo'}
              </h4>
              <div className="flex items-center gap-4">
                {currentSettings.shopLogo ? (
                  <img src={currentSettings.shopLogo} alt="Store Logo" className="w-20 h-20 object-contain rounded-lg border border-amber-300" />
                ) : (
                  <div className="w-20 h-20 bg-white rounded-lg border border-dashed border-amber-300 flex items-center justify-center text-amber-400">
                    <ShoppingBag size={24} />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="px-3 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors cursor-pointer text-xs font-bold urdu-text text-center">
                    {lang === 'ur' ? 'تصویر تبدیل کریں' : 'Change Picture'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const b64 = reader.result;
                          await db.settings.put({ key: 'shopLogo', value: b64 });
                          setCurrentSettings(prev => ({ ...prev, shopLogo: b64 }));
                          alert(lang === 'ur' ? 'تصویر کامیابی سے تبدیل ہو گئی' : 'Picture updated successfully');
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                  {currentSettings.shopLogo && (
                    <button onClick={async () => {
                      await db.settings.put({ key: 'shopLogo', value: '' });
                      setCurrentSettings(prev => ({ ...prev, shopLogo: '' }));
                      alert(lang === 'ur' ? 'تصویر حذف کر دی گئی' : 'Picture removed successfully');
                    }} className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-xs font-bold urdu-text">
                      {lang === 'ur' ? 'تصویر ہٹائیں' : 'Delete Picture'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Editable Store Information */}
            <div className="bg-gradient-to-br from-amber-50 to-sky-50 p-4 rounded-xl border border-amber-200/80 space-y-4">
              <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wide urdu-text">
                {lang === 'ur' ? 'دکان کی معلومات' : 'Store Information'}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text">{lang === 'ur' ? 'دکان کا نام' : 'Store Name'}</label>
                  <input type="text" value={currentSettings.shopName || ''} onChange={e => setCurrentSettings(prev => ({ ...prev, shopName: e.target.value }))} className="w-full px-3 py-2 bg-white border border-sky-200 rounded-lg outline-none focus:ring-2 focus:ring-gold urdu-text" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text">{lang === 'ur' ? 'پتہ' : 'Address'}</label>
                  <input type="text" value={currentSettings.shopAddress || ''} onChange={e => setCurrentSettings(prev => ({ ...prev, shopAddress: e.target.value }))} className="w-full px-3 py-2 bg-white border border-sky-200 rounded-lg outline-none focus:ring-2 focus:ring-gold urdu-text" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 urdu-text">{lang === 'ur' ? 'فون 1' : 'Phone 1'}</label>
                    <input type="text" value={currentSettings.shopPhone || ''} onChange={e => setCurrentSettings(prev => ({ ...prev, shopPhone: e.target.value }))} className="w-full px-3 py-2 bg-white border border-sky-200 rounded-lg outline-none focus:ring-2 focus:ring-gold font-mono text-sm" dir="ltr" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 urdu-text">{lang === 'ur' ? 'فون 2' : 'Phone 2'}</label>
                    <input type="text" value={currentSettings.shopPhone2 || ''} onChange={e => setCurrentSettings(prev => ({ ...prev, shopPhone2: e.target.value }))} className="w-full px-3 py-2 bg-white border border-sky-200 rounded-lg outline-none focus:ring-2 focus:ring-gold font-mono text-sm" dir="ltr" />
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    await db.settings.put({ key: 'shopName', value: currentSettings.shopName });
                    await db.settings.put({ key: 'shopAddress', value: currentSettings.shopAddress });
                    await db.settings.put({ key: 'shopPhone', value: currentSettings.shopPhone });
                    await db.settings.put({ key: 'shopPhone2', value: currentSettings.shopPhone2 });
                    alert(lang === 'ur' ? 'دکان کی معلومات محفوظ ہو گئیں' : 'Store Information saved successfully');
                    window.location.reload();
                  }}
                  className="w-full px-4 py-2 bg-gold text-black rounded-lg hover:bg-gold-light transition-colors shadow-lg font-bold flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  <span className="urdu-text text-sm">{lang === 'ur' ? 'معلومات محفوظ کریں' : 'Save Information'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 urdu-text">{t.goldRate}</label>
                <div className="flex gap-2">
                  <input 
                    type="number" step="any" 
                    value={rateInput || ''}
                    onChange={e => setRateInput(e.target.value)}
                    placeholder={lang === 'ur' ? 'نیا ریٹ درج کریں...' : 'Enter new rate...'}
                    className="flex-1 px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none font-bold text-black"
                  />
                  <button 
                    onClick={handleSaveRate}
                    className="px-4 bg-gold text-black rounded-lg hover:bg-gold-light transition-colors shadow-lg shadow-gold-20 font-bold flex items-center gap-1.5"
                    title={lang === 'ur' ? 'ریٹ محفوظ کریں' : 'Save Rate'}
                  >
                    <Save size={18} />
                    <span className="urdu-text text-xs">{t.save}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1 pt-4 border-t border-sky-100">
                <label className="text-xs font-bold text-zinc-500 urdu-text flex items-center justify-between">
                  <span>{t.appSecurity}</span>
                  {currentSettings.appPin && (
                    <span className="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded-full font-bold">Active</span>
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
                  <button 
                    onClick={handleSavePin}
                    className="px-4 bg-gold text-black rounded-lg hover:bg-gold-light transition-colors shadow-lg shadow-gold-20 font-bold flex items-center gap-1.5"
                    title={lang === 'ur' ? 'پاس ورڈ محفوظ کریں' : 'Save Password'}
                  >
                    <Save size={18} />
                    <span className="urdu-text text-xs">{t.save}</span>
                  </button>
                  {currentSettings.appPin && (
                    <button 
                      onClick={handleRemovePin}
                      className="px-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      title={t.removePin}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400">{lang === 'ur' ? 'ایپ کو کھولنے کے لیے پاس ورڈ سیٹ کریں' : 'Set a password to lock the application on startup.'}</p>
              </div>
            </div>
          </div>

          
          {/* Cloud Database Synchronization & Quota Status */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-sky-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-4">
              <h3 className="text-xl font-bold text-sky-900 urdu-text flex items-center gap-3">
                <Cloud className="text-sky-600" />
                <span>{lang === 'ur' ? 'کلاؤڈ ڈیٹا سنک (Firebase Cloud Sync)' : 'Cloud Data Sync (Firebase)'}</span>
              </h3>
              <div className="flex items-center gap-2">
                {syncStatus.isQuotaExceeded ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold urdu-text">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span>{lang === 'ur' ? 'یومیہ کوٹہ مکمل (لوکل محفوظ)' : 'Daily Quota Limit (Local Safe)'}</span>
                  </span>
                ) : syncStatus.isSyncing ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-100 text-sky-800 border border-sky-300 rounded-full text-xs font-bold urdu-text">
                    <RefreshCw size={14} className="animate-spin text-sky-600" />
                    <span>{lang === 'ur' ? 'سنک ہو رہا ہے...' : 'Syncing...'}</span>
                  </span>
                ) : syncStatus.pendingCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded-full text-xs font-bold urdu-text">
                    <RefreshCw size={14} className="text-blue-600" />
                    <span>{syncStatus.pendingCount} {lang === 'ur' ? 'تبدیلیاں قطار میں' : 'changes pending'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold urdu-text">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>{lang === 'ur' ? 'کامیابی سے منسلک' : 'Synced & Live'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quota Exceeded Notice Box */}
            {syncStatus.isQuotaExceeded && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="text-amber-700 flex-shrink-0 mt-0.5" size={22} />
                  <div className="space-y-1">
                    <h4 className="font-bold text-amber-900 text-sm urdu-text">
                      {lang === 'ur' ? 'آپ کا ڈیٹا 100% محفوظ ہے!' : 'Your Data is 100% Safe Locally!'}
                    </h4>
                    <p className="text-xs text-amber-800 leading-relaxed urdu-text">
                      {lang === 'ur' 
                        ? 'فائر بیس کلاؤڈ ڈیٹا بیس کا مفت یومیہ ریڈ کوٹہ عارضی طور پر مکمل ہو گیا ہے۔ تمام بل، خریداریاں، کسٹمرز اور کلاؤڈ تبدیلیاں اس ڈیوائس پر فوری محفوظ ہو چکی ہیں۔ جیسے ہی اگلے 24 گھنٹوں میں کوٹہ ری سیٹ ہوگا، بیک گراؤنڈ سنک خود بخود بحال ہو جائے گا۔'
                        : 'The Firebase Spark free tier daily read quota has been reached. All invoices, purchases, contacts, and transactions are completely preserved on this local device. Automatic background sync will resume when the quota resets.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  <a
                    href={getFirestoreQuotaUpgradeUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <ExternalLink size={14} />
                    <span className="urdu-text">{lang === 'ur' ? 'فائر بیس کنسول میں اپ گریڈ دیکھیں' : 'View in Firebase Console (Upgrade)'}</span>
                  </a>
                </div>
              </div>
            )}

            {/* Controls & Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-sky-50 rounded-xl border border-sky-100">
                <span className="text-[10px] text-sky-600 uppercase font-bold tracking-wider block">
                  {lang === 'ur' ? 'آخری سنک کا وقت' : 'Last Sync Time'}
                </span>
                <span className="text-sm font-black text-sky-950 font-mono mt-1 block">
                  {syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString() : (lang === 'ur' ? 'ابھی نہیں' : 'Never')}
                </span>
              </div>

              <div className="p-4 bg-sky-50 rounded-xl border border-sky-100">
                <span className="text-[10px] text-sky-600 uppercase font-bold tracking-wider block">
                  {lang === 'ur' ? 'قطار میں تبدیلیاں' : 'Pending Cloud Queue'}
                </span>
                <span className="text-sm font-black text-sky-950 font-mono mt-1 block">
                  {syncStatus.pendingCount} {lang === 'ur' ? 'آئٹمز' : 'items'}
                </span>
              </div>

              <div className="p-4 bg-sky-50 rounded-xl border border-sky-100">
                <span className="text-[10px] text-sky-600 uppercase font-bold tracking-wider block">
                  {lang === 'ur' ? 'انٹرنیٹ رابطہ' : 'Connection'}
                </span>
                <span className={`text-sm font-black font-mono mt-1 block ${syncStatus.isOnline ? 'text-emerald-700' : 'text-zinc-500'}`}>
                  {syncStatus.isOnline ? (lang === 'ur' ? 'آن لائن (Online)' : 'Online') : (lang === 'ur' ? 'آف لائن (Offline)' : 'Offline')}
                </span>
              </div>
            </div>

            {/* Manual Sync Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleManualCloudSync}
                disabled={isManualSyncing || !syncStatus.isOnline}
                className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm urdu-text flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                <RefreshCw size={16} className={isManualSyncing ? 'animate-spin' : ''} />
                <span>
                  {isManualSyncing 
                    ? (lang === 'ur' ? 'سنک ہو رہا ہے...' : 'Syncing...') 
                    : (lang === 'ur' ? 'ابھی سنک کریں (Sync Now)' : 'Sync Now')}
                </span>
              </button>

              {manualSyncFeedback && (
                <span className="text-xs text-sky-800 font-bold urdu-text">
                  {manualSyncFeedback}
                </span>
              )}
            </div>
          </div>

          {/* Data Backup & Recovery */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-sky-100 space-y-6">
            <h3 className="text-xl font-bold text-sky-900 border-b border-sky-100 pb-4 urdu-text flex items-center gap-3">
              <Download className="text-sky-600" />
              {lang === 'ur' ? 'مقامی بیک اپ اور بحالی' : 'Local Backup & Restore'}
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

            {/* PDF Export Section */}
            <div className="pt-8 border-t border-sky-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-900 font-bold urdu-text">
                  <Download className="text-indigo-600" />
                  {lang === 'ur' ? 'پی ڈی ایف رپورٹنگ (PDF Report)' : 'PDF Reporting'}
                </div>
                {(exportStartDate || exportEndDate) && (
                  <button
                    onClick={() => {
                      setExportStartDate('');
                      setExportEndDate('');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline urdu-text"
                  >
                    {lang === 'ur' ? 'تمام تاریخیں (Clear Filter)' : 'Clear Filter'}
                  </button>
                )}
              </div>

              {/* Date Filters */}
              <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 urdu-text">
                  <Calendar size={16} className="text-indigo-600" />
                  {lang === 'ur' ? 'تاریخ کا انتخاب (ڈیٹا فلٹر):' : 'Select Date Range for PDF Export:'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1 urdu-text">
                      {lang === 'ur' ? 'شروعاتی تاریخ (From Date)' : 'From Date'}
                    </label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm text-black outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1 urdu-text">
                      {lang === 'ur' ? 'آخری تاریخ (To Date)' : 'To Date'}
                    </label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm text-black outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {exportStartDate && exportEndDate && (
                  <p className="text-[11px] text-indigo-700 font-medium urdu-text text-center pt-1">
                    {lang === 'ur'
                      ? `منتخب تاریخیں: ${exportStartDate} سے ${exportEndDate} تک کا ڈیٹا پی ڈی ایف میں شامل ہوگا`
                      : `Selected Range: Data from ${exportStartDate} to ${exportEndDate} will be included in the PDF`}
                  </p>
                )}
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
                      ? (lang === 'ur' ? 'ڈیٹا پی ڈی ایف میں محفوظ ہو رہا ہے...' : 'Generating PDF Report...') 
                      : (exportStartDate || exportEndDate)
                        ? (lang === 'ur' ? 'منتخب تاریخوں کا پی ڈی ایف بنائیں' : 'Export Selected Dates to PDF')
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
      <PdfExportHidden ref={pdfRef} lang={lang} />
    </div>
  );
}
