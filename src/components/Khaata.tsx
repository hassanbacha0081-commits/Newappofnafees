import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type KhaataAccount, type KhaataEntry } from '../db';
import { translations, type Language } from '../translations';
import { formatDate, formatWhatsAppUrl, compressImage } from '../lib/utils';
import { 
  Plus, Check, Trash2, Camera, RotateCcw, MessageCircle, Printer, Edit, 
  X, Download, ArrowDown, ArrowUp, ChevronLeft, Search, Users, ClipboardList, BookOpen,
  Image as ImageIcon
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { html2canvasWithOklch as html2canvas } from '../lib/html2canvas-helper';
import jsPDF from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';
import ContactPickerModal from './ContactPickerModal';
import ImageLightbox from './ImageLightbox';
import { ConfirmModal } from './ConfirmModal';
import { APP_CONFIG } from '../config';
import { MultiSelectInput } from './MultiSelectInput';

interface KhaataProps {
  lang: Language;
}

export default function Khaata({ lang }: KhaataProps) {
  const t = translations[lang];
  const isRTL = lang === 'ur';

  // State Management
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  
  // Account Form
  const [accountForm, setAccountForm] = useState({
    name: '',
    phone: '',
    notes: ''
  });

  // Entry Form (Transactions)
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [entryForm, setEntryForm] = useState({
    date: formatDate(new Date(), 'ur-PK'),
    details: '',
    type: 'give' as 'give' | 'receive', // give = دیا / Out, receive = وصول / In
    mixWeight: 0,
    pakaye: 0,
    kaatRati: 0,
    pureWeight: 0,
    pasaDia: 0
  });

  // Delete Confirm States
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);

  // Print Ref and State
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Khaata_Statement`,
    onAfterPrint: () => {
      setIsPrinting(false);
    }
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && pdfUrl) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        await CapPrinter.printBase64({
          name: `Khaata_Statement`,
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

  const generatePDF = async (): Promise<string | null> => {
    if (!printRef.current) return null;
    setIsPrinting(true);
    try {
      window.scrollTo(0, 0);
      
      const element = printRef.current;
      const pageElements = element.querySelectorAll('.print-page');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'cm',
        format: 'a4'
      });
      
      const pdfWidth = 21.0; // A4 width in cm
      const pdfPageHeight = 29.7; // A4 height in cm
      
      if (pageElements.length > 0) {
        for (let i = 0; i < pageElements.length; i++) {
          const pageEl = pageElements[i] as HTMLElement;
          
          const canvas = await html2canvas(pageEl, {
            scale: 2.2, // Balanced for memory and quality
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            allowTaint: false,
            imageTimeout: 3000,
            windowWidth: 800,
            windowHeight: 1130,
            height: 1130,
            onclone: (clonedDoc) => {
              clonedDoc.body.style.margin = '0';
              clonedDoc.body.style.padding = '0';
              clonedDoc.body.style.backgroundColor = '#ffffff';
              clonedDoc.body.style.width = '800px';
              clonedDoc.body.style.height = '1130px';
              clonedDoc.body.style.overflow = 'hidden';
            }
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.85);
          
          if (i > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);
        }
      } else {
        // Fallback to single page capture if no print-page items found
        const canvas = await html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: false,
          imageTimeout: 3000,
          windowWidth: 800,
          windowHeight: 1130,
          height: 1130
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);
      }

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
        const fileName = `Khaata_${selectedAccount?.name || 'record'}_${Date.now()}.pdf`;
        const base64Data = pdfUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Khaata Statement',
          url: savedFile.uri,
        });
      } catch (e) {
        console.error('Error sharing PDF', e);
        alert(lang === 'ur' ? "فائل شیئر کرنے میں خرابی پیش آئی" : "Error sharing file");
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Khaata_${selectedAccount?.name || 'record'}.pdf`;
      link.click();
    }
  };

  // Live Query: Fetch accounts
  const accounts = useLiveQuery(() => {
    if (!db.khaataAccounts) return Promise.resolve([]);
    if (!searchTerm) return db.khaataAccounts.toArray();
    const term = searchTerm.toLowerCase();
    return db.khaataAccounts
      .filter(a => 
        a.name.toLowerCase().includes(term) || 
        a.phone.includes(searchTerm)
      )
      .toArray();
  }, [searchTerm]);

  // Live Query: Fetch entries for current account (if selected) or all entries for balances
  const allEntries = useLiveQuery(() => {
    if (!db.khaataEntries) return Promise.resolve([]);
    return db.khaataEntries.toArray();
  });

  const selectedAccount = useMemo(() => {
    if (selectedAccountId === null || !accounts) return null;
    return accounts.find(a => a.id === selectedAccountId) || null;
  }, [selectedAccountId, accounts]);

  const selectedEntries = useMemo(() => {
    if (selectedAccountId === null || !allEntries) return [];
    return allEntries
      .filter(e => e.accountId === selectedAccountId)
      .sort((a, b) => {
        return (a.id || 0) - (b.id || 0);
      });
  }, [selectedAccountId, allEntries]);

  // Calculate Running Balances for all accounts
  const accountSummary = useMemo(() => {
    const summary: Record<number, { gold: number; totalPasaDia: number; saafBaqaya: number }> = {};
    if (!allEntries || !accounts) return summary;

    // Initialize all accounts with 0
    accounts.forEach(a => {
      if (a.id) summary[a.id] = { gold: 0, totalPasaDia: 0, saafBaqaya: 0 };
    });

    allEntries.forEach(entry => {
      if (!summary[entry.accountId]) {
        summary[entry.accountId] = { gold: 0, totalPasaDia: 0, saafBaqaya: 0 };
      }
      
      const pure = entry.pureWeight || 0;
      const pasa = entry.pasaDia || 0;

      if (entry.type === 'give') {
        summary[entry.accountId].gold -= pure;
      } else {
        summary[entry.accountId].gold += pure;
      }
      summary[entry.accountId].totalPasaDia += pasa;
    });

    // Compute saafBaqaya = totalItemPasa - totalPasaDia
    Object.keys(summary).forEach(key => {
      const id = Number(key);
      summary[id].saafBaqaya = summary[id].gold - summary[id].totalPasaDia;
    });

    return summary;
  }, [allEntries, accounts]);

  // Running ledger for selected account (calculating balances sequentially)
  const ledgerWithRunningBalances = useMemo(() => {
    let runningGold = 0;
    return selectedEntries.map(e => {
      const pure = e.pureWeight || 0;
      const pasa = e.pasaDia || 0;

      if (e.type === 'give') {
        runningGold -= (pure + pasa);
      } else {
        runningGold += (pure - pasa);
      }

      return {
        ...e,
        runningGold
      };
    });
  }, [selectedEntries]);

  // Filter ledger entries by item name / details search term
  const filteredLedgerEntries = useMemo(() => {
    if (!itemSearchTerm) return ledgerWithRunningBalances;
    const term = itemSearchTerm.toLowerCase().trim();
    return ledgerWithRunningBalances.filter(e => 
      e.details && e.details.toLowerCase().includes(term)
    );
  }, [ledgerWithRunningBalances, itemSearchTerm]);

  // Handle auto calculations
  const calculatePure = (mix: number, kaat: number, pak: number) => {
    // Item pasa = ((mix weight)/96)*(96-(kaat in rati))
    const pure = (mix / 96) * (96 - kaat);
    return parseFloat((isNaN(pure) || !isFinite(pure)) ? '0.00' : pure.toFixed(2));
  };

  // Helper when form values change
  const handleFormValChange = (field: string, val: any) => {
    setEntryForm(prev => {
      const updated = { ...prev, [field]: val };
      
      // Auto compute pureWeight if mixWeight, kaatRati, or pakaye changed
      if (field === 'mixWeight' || field === 'kaatRati' || field === 'pakaye') {
        const mix = field === 'mixWeight' ? Number(val) : prev.mixWeight;
        const kaat = field === 'kaatRati' ? Number(val) : prev.kaatRati;
        const pak = field === 'pakaye' ? Number(val) : prev.pakaye;
        updated.pureWeight = calculatePure(mix, kaat, pak);
      }
      
      return updated;
    });
  };

  // Image upload
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

  // Save Account
  const handleSaveAccount = async () => {
    if (!accountForm.name) {
      alert(lang === 'ur' ? "نام لکھنا لازمی ہے!" : "Name is required!");
      return;
    }

    const newAccount: KhaataAccount = {
      name: accountForm.name,
      phone: accountForm.phone,
      date: formatDate(new Date(), 'ur-PK'),
      notes: accountForm.notes
    };

    try {
      await db.khaataAccounts.add(newAccount);
      setAccountForm({ name: '', phone: '', notes: '' });
      setIsAddingAccount(false);
      alert(lang === 'ur' ? "کھاتہ کامیابی سے بن گیا!" : "Account created successfully!");
    } catch (err) {
      console.error(err);
      alert(lang === 'ur' ? `کھاتہ بنانے میں خرابی: ${err instanceof Error ? err.message : String(err)}` : `Error creating account: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Save Transaction Entry
  const handleSaveEntry = async () => {
    if (selectedAccountId === null) return;
    if (!entryForm.details) {
      alert(lang === 'ur' ? "تفصیل درج کریں!" : "Details are required!");
      return;
    }

    const newEntry: KhaataEntry = {
      accountId: selectedAccountId,
      date: entryForm.date,
      details: entryForm.details,
      type: entryForm.type,
      mixWeight: Number(entryForm.mixWeight) || 0,
      pakaye: Number(entryForm.pakaye) || 0,
      kaatRati: Number(entryForm.kaatRati) || 0,
      pureWeight: Number(entryForm.pureWeight) || 0,
      pasaDia: Number(entryForm.pasaDia) || 0,
      img: currentImg
    };

    try {
      if (editingEntryId !== null) {
        newEntry.id = editingEntryId;
        await db.khaataEntries.put(newEntry);
      } else {
        await db.khaataEntries.add(newEntry);
      }

      setEntryForm({
        date: formatDate(new Date(), 'ur-PK'),
        details: '',
        type: 'give',
        mixWeight: 0,
        pakaye: 0,
        kaatRati: 0,
        pureWeight: 0,
        pasaDia: 0
      });
      setCurrentImg(null);
      setEditingEntryId(null);
      setIsAddingEntry(false);
      alert(lang === 'ur' ? "انٹری کامیابی سے محفوظ ہو گئی!" : "Entry saved successfully!");
    } catch (err) {
      console.error(err);
      alert(lang === 'ur' ? `انٹری محفوظ کرنے میں خرابی: ${err instanceof Error ? err.message : String(err)}` : `Error saving entry: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (id: number) => {
    try {
      await db.khaataAccounts.delete(id);
      const childEntries = await db.khaataEntries.where('accountId').equals(id).toArray();
      const deleteIds = childEntries.map(e => e.id).filter((id): id is number => id !== undefined);
      if (deleteIds.length > 0) {
        await db.khaataEntries.bulkDelete(deleteIds);
      }
      setSelectedAccountId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (id: number) => {
    try {
      await db.khaataEntries.delete(id);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Entry
  const handleEditEntry = (e: KhaataEntry) => {
    setEditingEntryId(e.id!);
    setEntryForm({
      date: e.date,
      details: e.details,
      type: e.type,
      mixWeight: e.mixWeight,
      pakaye: e.pakaye,
      kaatRati: e.kaatRati,
      pureWeight: e.pureWeight,
      pasaDia: e.pasaDia
    });
    setCurrentImg(e.img || null);
    setIsAddingEntry(true);
  };

  // WhatsApp Sharing
  const handleShareWhatsApp = (account: KhaataAccount, gold: number, totalPasaDia?: number, saafBaqaya?: number) => {
    let balanceStr = '';
    const actualGold = gold;
    const actualPasa = totalPasaDia || 0;
    const actualSaaf = saafBaqaya !== undefined ? saafBaqaya : (actualGold - actualPasa);

    balanceStr += `\nکُل آئٹم پاسا: ${actualGold.toFixed(2)}g`;
    balanceStr += `\nکُل پاسا دیا/ملا: ${actualPasa.toFixed(2)}g`;
    
    if (actualSaaf > 0.005) {
      balanceStr += `\nصاف بقایا (ہمارے ذمہ): ${actualSaaf.toFixed(2)}g`;
    } else if (actualSaaf < -0.005) {
      balanceStr += `\nصاف بقایا (ان کے ذمہ): ${Math.abs(actualSaaf).toFixed(2)}g`;
    } else {
      balanceStr += `\nصاف بقایا: حساب کلیئر (0.00g)`;
    }

    const msg = `السلام علیکم ${account.name}!\nتفصیل کھاتہ منجانب ${APP_CONFIG.shopNameUrdu}:${balanceStr}\nتاریخ خلاصہ: ${formatDate(new Date(), 'ur-PK')}`;
    const url = formatWhatsAppUrl(account.phone, msg);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="container mx-auto pb-20 px-2 sm:px-4">
      {selectedAccountId === null ? (
        // ==========================================
        // MAIN ACCOUNT LIST VIEW
        // ==========================================
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-sky-100">
            <h2 className="text-2xl font-black urdu-text text-sky-950 flex items-center gap-2">
              <BookOpen className="text-gold" size={26} />
              کھاتہ لیجر بک (Khaata Book)
            </h2>
            <button
              onClick={() => setIsAddingAccount(true)}
              className="px-6 py-3 bg-gold text-black font-bold rounded-xl shadow-md hover:bg-gold-light transition-all flex items-center justify-center gap-2 cursor-pointer urdu-text"
            >
              <Plus size={20} />
              نیا کھاتہ شامل کریں (New Account)
            </button>
          </div>

          {/* Add Account Panel */}
          {isAddingAccount && (
            <div className="bg-white p-6 rounded-2xl shadow-md border-2 border-gold/40 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-lg font-bold urdu-text text-sky-950">نیا کھاتہ کھولیں (Create Account)</h3>
                <button 
                  onClick={() => setIsAddingAccount(false)}
                  className="p-1.5 hover:bg-zinc-100 rounded-full text-zinc-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="نام (Name)"
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="موبائل نمبر (Mobile Number)"
                    value={accountForm.phone}
                    onChange={e => setAccountForm({ ...accountForm, phone: e.target.value })}
                    className="flex-1 p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setIsContactPickerOpen(true)}
                    className="px-4 bg-gold/10 hover:bg-gold/25 text-gold-dark border border-gold/30 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                    title="رابطہ منتخب کریں"
                  >
                    <Users size={18} />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="تفصیل / ریمارکس (Optional Notes)"
                  value={accountForm.notes}
                  onChange={e => setAccountForm({ ...accountForm, notes: e.target.value })}
                  className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center md:col-span-2"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsAddingAccount(false)}
                  className="px-5 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 font-bold urdu-text"
                >
                  کینسل
                </button>
                <button
                  onClick={handleSaveAccount}
                  className="px-6 py-2.5 bg-gold text-black rounded-xl hover:bg-gold-light font-bold urdu-text"
                >
                  کھاتہ بنائیں
                </button>
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="نام یا موبائل نمبر سے کھاتہ تلاش کریں..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full p-4 bg-white border border-sky-200 rounded-2xl outline-none focus:border-gold shadow-sm text-black text-right pr-12 pl-4 font-medium"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          </div>

          {/* Accounts Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts?.map(account => {
              const bal = accountSummary[account.id!] || { gold: 0, totalPasaDia: 0, saafBaqaya: 0 };
              const isCleared = Math.abs(bal.saafBaqaya) <= 0.005;

              return (
                <div
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id!)}
                  className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm hover:shadow-md hover:border-gold transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 left-0 h-1.5 bg-sky-200 group-hover:bg-gold transition-colors"></div>
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-black text-lg text-sky-950 group-hover:text-gold-dark transition-colors">{account.name}</h4>
                      <span className="text-[10px] text-zinc-400 font-bold font-mono">{account.date}</span>
                    </div>
                    {account.phone && (
                      <p className="text-xs font-semibold text-zinc-500 font-mono mb-4" dir="ltr">{account.phone}</p>
                    )}

                    {/* Balance Display */}
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 flex flex-col gap-1.5 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-400 urdu-text">کُل آئٹم پاسا (Item Pasa)</span>
                        <span className="text-xs font-black text-sky-950 font-mono">
                          {bal.gold.toFixed(2)}g
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-zinc-100/70 pt-1.5">
                        <span className="text-xs font-bold text-zinc-500 urdu-text">صاف بقایا (Saaf Baqaya)</span>
                        {isCleared ? (
                          <span className="text-xs font-bold text-zinc-400 font-mono">0.00g</span>
                        ) : bal.saafBaqaya > 0.005 ? (
                          <span className="text-sm font-black text-red-600 font-mono">+{bal.saafBaqaya.toFixed(2)}g (ہمارے ذمہ)</span>
                        ) : (
                          <span className="text-sm font-black text-emerald-600 font-mono">-{Math.abs(bal.saafBaqaya).toFixed(2)}g (ان کے ذمہ)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex gap-2 justify-end items-center mt-5 pt-3 border-t border-sky-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareWhatsApp(account, bal.gold, bal.totalPasaDia, bal.saafBaqaya);
                      }}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-center"
                      title="شیئر کریں"
                    >
                      <MessageCircle size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteAccountId(account.id!);
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                      title="حذف کریں"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
            {(!accounts || accounts.length === 0) && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-sky-100 text-zinc-400 urdu-text font-bold">
                کوئی کھاتہ ریکارڈ نہیں ملا۔
              </div>
            )}
          </div>
        </div>
      ) : (
        // ==========================================
        // DETAILED LEDGER VIEW FOR SINGLE ACCOUNT
        // ==========================================
        <div className="space-y-6">
          {/* Detailed Ledger Header */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-sky-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedAccountId(null);
                  setItemSearchTerm('');
                }}
                className="p-2.5 hover:bg-sky-50 rounded-xl transition-colors border border-sky-100 text-sky-950"
              >
                <ChevronLeft size={24} />
              </button>
              <div>
                <h2 className="text-2xl font-black text-sky-950 leading-tight">{selectedAccount?.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  {selectedAccount?.phone && (
                    <span className="text-xs font-bold text-zinc-500 font-mono" dir="ltr">{selectedAccount?.phone}</span>
                  )}
                  <span className="text-[10px] text-zinc-400 bg-zinc-100 px-2.5 py-0.5 rounded-full font-bold font-mono">شروع: {selectedAccount?.date}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setEntryForm({
                    date: formatDate(new Date(), 'ur-PK'),
                    details: '',
                    type: 'give',
                    mixWeight: 0,
                    pakaye: 0,
                    kaatRati: 0,
                    pureWeight: 0,
                    pasaDia: 0
                  });
                  setCurrentImg(null);
                  setEditingEntryId(null);
                  setIsAddingEntry(true);
                }}
                className="flex-1 md:flex-initial px-5 py-3 bg-gold text-black font-bold rounded-xl shadow-md hover:bg-gold-light transition-all flex items-center justify-center gap-2 cursor-pointer urdu-text text-sm"
              >
                <Plus size={18} />
                کھاتہ انٹری کریں (Add Transaction)
              </button>
              <button
                onClick={() => {
                  setShowPrintPreview(true);
                  setTimeout(async () => {
                    const url = await generatePDF();
                    if (url) {
                      setPdfUrl(url);
                    } else {
                      setShowPrintPreview(false);
                      alert(lang === 'ur' ? 'پی ڈی ایف بنانے میں خرابی پیش آئی۔' : 'PDF generation failed. Please try again.');
                    }
                  }, 400);
                }}
                className="px-4 py-3 bg-sky-50 text-sky-900 border border-sky-100 hover:bg-sky-100 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                title="پرنٹ کریں"
              >
                <Printer size={18} /> پرنٹ رپورٹ
              </button>
              {selectedAccount && (
                <button
                  onClick={() => {
                    const bal = accountSummary[selectedAccountId] || { gold: 0, totalPasaDia: 0, saafBaqaya: 0 };
                    handleShareWhatsApp(selectedAccount, bal.gold, bal.totalPasaDia, bal.saafBaqaya);
                  }}
                  className="px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs"
                >
                  <MessageCircle size={18} /> شیئر خلاصہ
                </button>
              )}
            </div>
          </div>

          {/* Detailed Summary Boxes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Item Pasa */}
            <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[90px]">
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-sky-900"></div>
              <span className="text-xs font-bold text-zinc-400 urdu-text block">کُل آئٹم پاسا (Total Item Pasa)</span>
              <span className="text-2xl font-black text-sky-950 font-mono mt-1">
                {(accountSummary[selectedAccountId]?.gold || 0).toFixed(2)}g
              </span>
            </div>

            {/* Total Pasa Gold */}
            <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[90px]">
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-amber-500"></div>
              <span className="text-xs font-bold text-zinc-400 urdu-text block">کُل پاسا دیا / ملا (Total Pasa Gold)</span>
              <span className="text-2xl font-black text-gold-dark font-mono mt-1">
                {(accountSummary[selectedAccountId]?.totalPasaDia || 0).toFixed(2)}g
              </span>
            </div>

            {/* Saaf Baqaya */}
            <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[90px]">
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-gold"></div>
              <div className="flex justify-between items-center w-full">
                <div>
                  <span className="text-xs font-bold text-zinc-500 urdu-text block">صاف بقایا (Saaf Baqaya)</span>
                  <span className="text-2xl font-black text-sky-950 font-mono mt-1 block">
                    {(accountSummary[selectedAccountId]?.saafBaqaya || 0).toFixed(2)}g
                  </span>
                </div>
                <div className="text-right font-bold text-xs">
                  {(accountSummary[selectedAccountId]?.saafBaqaya || 0) > 0.005 ? (
                    <span className="text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full urdu-text block text-center font-bold">ہمارے ذمہ</span>
                  ) : (accountSummary[selectedAccountId]?.saafBaqaya || 0) < -0.005 ? (
                    <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full urdu-text block text-center font-bold">ان کے ذمہ</span>
                  ) : (
                    <span className="text-zinc-400 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-full urdu-text block text-center font-medium">حساب صاف</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Add / Edit Entry Form Panel */}
          {isAddingEntry && (
            <div className="bg-white p-6 rounded-2xl shadow-md border-2 border-gold/40 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-lg font-bold urdu-text text-sky-950">
                  {editingEntryId !== null ? "ترمیم انٹری (Edit Transaction)" : "کھاتہ میں انٹری کریں (Add Transaction)"}
                </h3>
                <button 
                  onClick={() => {
                    setIsAddingEntry(false);
                    setEditingEntryId(null);
                  }}
                  className="p-1.5 hover:bg-zinc-100 rounded-full text-zinc-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Entry inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">تاریخ (Date)</label>
                  <input
                    type="text"
                    value={entryForm.date}
                    onChange={e => handleFormValChange('date', e.target.value)}
                    className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-bold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">تفصیل اشیاء (Items Details)</label>
                  <MultiSelectInput
                    value={entryForm.details}
                    onChange={val => handleFormValChange('details', val)}
                    options={t.itemDetailsList || []}
                    lang={lang}
                    placeholder="مثال: مکس لاکٹ جڑاؤ، بالیاں پالش"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">نوعیت (Type)</label>
                  <select
                    value={entryForm.type}
                    onChange={e => handleFormValChange('type', e.target.value)}
                    className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black bg-white font-bold text-center"
                  >
                    <option value="give">بنام / دیا (Gold Out - Give)</option>
                    <option value="receive">جمع / ملا (Gold In - Receive)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">مکس وزن (Mix Weight)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00g"
                    value={entryForm.mixWeight || ''}
                    onChange={e => handleFormValChange('mixWeight', Number(e.target.value))}
                    className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">پکائی (Pakaye / Wastage)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00 R"
                    value={entryForm.pakaye || ''}
                    onChange={e => handleFormValChange('pakaye', Number(e.target.value))}
                    className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">کاٹ رتی (Kaat in Rati)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0 rati"
                    value={entryForm.kaatRati || ''}
                    onChange={e => handleFormValChange('kaatRati', Number(e.target.value))}
                    className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1 text-sky-900">آئٹم پاسا (Item Pasa)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00g"
                    value={entryForm.pureWeight || ''}
                    onChange={e => handleFormValChange('pureWeight', Number(e.target.value))}
                    className="w-full p-4 border border-sky-300 rounded-xl outline-none focus:border-gold text-sky-950 text-center font-mono font-black bg-sky-50/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 urdu-text block mb-1 text-right pr-1">پاسا دیا / ملا (Pasa Gold)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00g"
                    value={entryForm.pasaDia || ''}
                    onChange={e => handleFormValChange('pasaDia', Number(e.target.value))}
                    className="w-full p-4 border border-sky-200 rounded-xl outline-none focus:border-gold text-black text-center font-mono font-bold text-gold-dark"
                  />
                </div>
              </div>

              {/* Photo Upload Access (Camera & Gallery) */}
              <div className="mt-4 space-y-3">
                <label className="text-sm font-bold text-zinc-500 urdu-text block text-right pr-1">منسلک تصویر (Attached Picture)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Camera Direct Access */}
                  <div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                      id="khaataCameraInput"
                    />
                    <label 
                      htmlFor="khaataCameraInput"
                      className="w-full min-h-[75px] flex items-center justify-center gap-3 p-4 border-2 border-dashed border-sky-200 rounded-xl text-zinc-500 cursor-pointer hover:border-gold hover:text-gold transition-all bg-sky-50/20"
                    >
                      <Camera size={24} className="text-gold-dark" />
                      <span className="urdu-text text-base font-bold text-sky-950">کیمرہ سے تصویر کھینچیں (Camera)</span>
                    </label>
                  </div>

                  {/* Gallery Access */}
                  <div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="hidden"
                      id="khaataGalleryInput"
                    />
                    <label 
                      htmlFor="khaataGalleryInput"
                      className="w-full min-h-[75px] flex items-center justify-center gap-3 p-4 border-2 border-dashed border-sky-200 rounded-xl text-zinc-500 cursor-pointer hover:border-gold hover:text-gold transition-all bg-sky-50/20"
                    >
                      <ImageIcon size={24} className="text-emerald-600" />
                      <span className="urdu-text text-base font-bold text-sky-950">گیلری سے منتخب کریں (Gallery)</span>
                    </label>
                  </div>
                </div>

                {currentImg && (
                  <div className="flex items-center gap-4 p-3 bg-zinc-50 border rounded-xl w-fit relative animate-in zoom-in-95">
                    <img src={currentImg} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-zinc-200 shadow-sm" />
                    <button
                      type="button"
                      onClick={() => setCurrentImg(null)}
                      className="absolute -top-2.5 -right-2.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-md transition-all cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                    <span className="text-xs font-semibold text-emerald-700 urdu-text bg-emerald-50 px-2 py-1 rounded-md">تصویر کامیابی سے منسلک ہو گئی</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setIsAddingEntry(false);
                    setEditingEntryId(null);
                  }}
                  className="px-5 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 font-bold urdu-text"
                >
                  کینسل
                </button>
                <button
                  onClick={handleSaveEntry}
                  className="px-6 py-2.5 bg-gold text-black rounded-xl hover:bg-gold-light font-bold urdu-text"
                >
                  انٹری محفوظ کریں
                </button>
              </div>
            </div>
          )}

          {/* LEDGER TRANSACTIONS TABLE */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-50 border-b flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-black urdu-text text-base">تفصیلی لیجر بک (Running Ledger Statement)</h3>
                {itemSearchTerm && (
                  <span className="bg-gold/10 text-gold-dark border border-gold/30 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                    {lang === 'ur' ? `${filteredLedgerEntries.length} آئٹمز ملے` : `${filteredLedgerEntries.length} items found`}
                  </span>
                )}
              </div>
              
              {/* Item Search Bar */}
              <div className="relative w-full sm:w-72" dir={isRTL ? "rtl" : "ltr"}>
                <input
                  type="text"
                  placeholder={lang === 'ur' ? "آئٹم تلاش کریں (جیسے انگوٹھی، کانٹا)..." : "Search item (e.g. angoti, kanta)..."}
                  value={itemSearchTerm}
                  onChange={e => setItemSearchTerm(e.target.value)}
                  className={`w-full py-2 border border-zinc-200 rounded-xl outline-none focus:border-gold text-xs text-black font-semibold bg-white ${isRTL ? 'text-right pr-10 pl-8' : 'text-left pl-10 pr-8'}`}
                />
                <Search className={`absolute top-1/2 -translate-y-1/2 text-zinc-400 ${isRTL ? 'right-3' : 'left-3'}`} size={16} />
                {itemSearchTerm && (
                  <button
                    onClick={() => setItemSearchTerm('')}
                    className={`absolute top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer ${isRTL ? 'left-3' : 'right-3'}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs min-w-[850px]">
                <thead>
                  <tr className="bg-zinc-100 text-black font-bold urdu-text text-center border-b border-zinc-200">
                    <th className="p-4 border border-zinc-200 w-[11%]">تاریخ</th>
                    <th className="p-4 border border-zinc-200 w-[18%]">تفصیل اشیاء</th>
                    <th className="p-4 border border-zinc-200">پکائی</th>
                    <th className="p-4 border border-zinc-200">مکس وزن</th>
                    <th className="p-4 border border-zinc-200">کاٹ رتی</th>
                    <th className="p-4 border border-zinc-200">آئٹم پاسا</th>
                    <th className="p-4 border border-zinc-200">پاسا دیا</th>
                    <th className="p-4 border border-zinc-200">بقایا</th>
                    <th className="p-4 border border-zinc-200 w-[8%]">تصویر</th>
                    <th className="p-4 border border-zinc-200 w-[10%]">کارروائیاں</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedgerEntries.map((e, index) => {
                    const isGive = e.type === 'give';
                    return (
                      <tr 
                        key={e.id} 
                        className="border-b border-zinc-100 text-center font-medium hover:bg-zinc-50 transition-colors"
                      >
                        <td className="p-3 font-bold font-mono text-black">{e.date}</td>
                        <td className="p-3 font-bold urdu-text text-right px-4 text-black">{e.details}</td>
                        <td className="p-3 font-mono font-bold text-black">{e.pakaye > 0 ? `${parseFloat(e.pakaye.toFixed(2))} R` : '-'}</td>
                        <td className="p-3 font-mono font-bold text-black">{e.mixWeight > 0 ? `${e.mixWeight.toFixed(2)}g` : '-'}</td>
                        <td className="p-3 font-mono font-bold text-black">{e.kaatRati > 0 ? `${e.kaatRati} R` : '-'}</td>
                        <td className="p-3 font-mono font-bold text-black">{e.pureWeight > 0 ? `${e.pureWeight.toFixed(2)}g` : '-'}</td>
                        <td className="p-3 font-mono font-bold text-black">{e.pasaDia > 0 ? `${e.pasaDia.toFixed(2)}g` : '-'}</td>
                        <td className="p-3 font-mono font-bold text-black">{e.runningGold.toFixed(2)}g</td>
                        <td className="p-3">
                          {e.img ? (
                            <button
                              onClick={() => setLightboxImage(e.img!)}
                              className="p-1 hover:scale-105 active:scale-95 transition-transform"
                              title="تصویر دکھائیں"
                            >
                              <img src={e.img} alt="" className="h-10 w-10 object-cover rounded-md border border-sky-200 shadow-sm" />
                            </button>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-1.5 items-center">
                            <button
                              onClick={() => handleEditEntry(e)}
                              className="p-1.5 bg-white text-sky-900 rounded-lg hover:bg-sky-50 border border-sky-100 transition-all shadow-sm"
                              title="ایڈٹ"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteEntryId(e.id!)}
                              className="p-1.5 bg-white text-red-600 rounded-lg hover:bg-red-50 border border-red-100 transition-all shadow-sm cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLedgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-zinc-400 font-bold urdu-text">
                        {itemSearchTerm 
                          ? (lang === 'ur' ? "اس آئٹم کا کوئی ریکارڈ نہیں ملا۔" : "No records found for this item.")
                          : (lang === 'ur' ? "کھاتہ میں اب تک کوئی انٹری نہیں ہوئی۔ انٹری کرنے کے لیے اوپر \"کھاتہ انٹری کریں\" پر کلک کریں۔" : "No transactions found yet. Click 'Add Transaction' to start.")
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          OFF-SCREEN CAPTURE AREA FOR PDF/PRINT
          ========================================== */}
      <div data-print-container className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        <div ref={printRef} className="print-pages-container">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 portrait !important;
                margin: 0 !important;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              .print-pages-container {
                width: 100% !important;
                height: auto !important;
              }
              .print-page {
                page-break-after: always !important;
                page-break-inside: avoid !important;
                margin: 0 !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                width: 210mm !important;
                height: 297mm !important;
                box-sizing: border-box !important;
              }
            }
          ` }} />
          {(() => {
            const chunkLedger = (entries: typeof ledgerWithRunningBalances) => {
              const pages: (typeof ledgerWithRunningBalances)[] = [];
              if (entries.length === 0) {
                pages.push([]);
                return pages;
              }
              const firstPageLimit = 12;
              const subsequentPageLimit = 18;
              pages.push(entries.slice(0, firstPageLimit));
              let index = firstPageLimit;
              while (index < entries.length) {
                pages.push(entries.slice(index, index + subsequentPageLimit));
                index += subsequentPageLimit;
              }
              return pages;
            };
            const pages = chunkLedger(filteredLedgerEntries);
            return pages.map((pageEntries, pageIndex) => (
              <div
                key={pageIndex}
                className="print-page bg-white relative p-8 w-[800px] h-[1130px] border-[6px] double border-gold rounded-lg mb-6"
                style={{ fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
                dir="rtl"
              >
                <div className="absolute inset-4 border border-dashed border-gold rounded pointer-events-none"></div>
                
                {/* Print Title */}
                {pageIndex === 0 ? (
                  <div className="text-center border-b-2 border-gold pb-4 mb-6">
                    <h1 className="text-4xl font-black urdu-text text-gold-dark mb-1">{translations.ur.shopName}</h1>
                    <p className="text-sm font-bold text-zinc-500 font-nastaliq">{translations.ur.shopAddress}</p>
                    <p className="text-xs font-mono mt-1" dir="ltr">{translations.ur.shopPhone}</p>
                    <div className="inline-block bg-zinc-100 px-4 py-1 rounded-full font-bold urdu-text text-xs border border-zinc-200 mt-3">
                      تفصیلی سونا کھاتہ رپورٹ (Khaata Statement)
                      {itemSearchTerm && ` - فلٹر: ${itemSearchTerm}`}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center border-b-2 border-gold pb-2 mb-4">
                    <h2 className="text-xl font-bold urdu-text text-gold-dark">{translations.ur.shopName}</h2>
                    <div className="text-xs text-zinc-500 font-bold urdu-text">
                      تفصیلی رپورٹ کھاتہ دار: <span className="text-zinc-900 font-black">{selectedAccount?.name}</span> (صفحہ {pageIndex + 1} از {pages.length})
                    </div>
                  </div>
                )}

                {/* Account Overview table */}
                {pageIndex === 0 && (
                  <table className="w-full border-collapse text-right text-xs mb-6">
                    <tbody>
                      <tr className="border-b border-zinc-200">
                        <th className="p-2 urdu-text font-bold text-black w-[20%]">نام کھاتہ دار:</th>
                        <td className="p-2 font-bold text-black text-sm w-[30%]">{selectedAccount?.name}</td>
                        <th className="p-2 urdu-text font-bold text-black w-[20%]">فون نمبر:</th>
                        <td className="p-2 font-mono font-bold text-black w-[30%]">{selectedAccount?.phone || '-'}</td>
                      </tr>
                      <tr className="border-b border-zinc-200">
                        <th className="p-2 urdu-text font-bold text-black">تاریخ پرنٹ:</th>
                        <td className="p-2 font-mono font-bold text-black">{formatDate(new Date(), 'ur-PK')}</td>
                        <th className="p-2 urdu-text font-bold text-black">کُل آئٹم پاسا:</th>
                        <td className="p-2 font-mono font-bold text-black">
                          {(accountSummary[selectedAccountId || 0]?.gold || 0).toFixed(2)}g
                        </td>
                      </tr>
                      <tr className="border-b border-zinc-200">
                        <th className="p-2 urdu-text font-bold text-black">کُل پاسا دیا/ملا:</th>
                        <td className="p-2 font-mono font-bold text-black">
                          {(accountSummary[selectedAccountId || 0]?.totalPasaDia || 0).toFixed(2)}g
                        </td>
                        <th className="p-2 urdu-text font-bold text-black">صاف بقایا:</th>
                        <td className="p-2 font-bold text-black text-sm">
                          {Math.abs(accountSummary[selectedAccountId || 0]?.saafBaqaya || 0).toFixed(2)}g (سونا) {
                            (accountSummary[selectedAccountId || 0]?.saafBaqaya || 0) > 0.005 ? '(ہمارے ذمہ)' : (accountSummary[selectedAccountId || 0]?.saafBaqaya || 0) < -0.005 ? '(ان کے ذمہ)' : '(حساب صاف)'
                          }
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Ledger table */}
                <table className="w-full border border-zinc-300 border-collapse text-right text-xs">
                  <thead>
                    <tr className="bg-zinc-100 font-bold text-center text-black border-b border-zinc-300">
                      <th className="p-2 border border-zinc-300 urdu-text">تاریخ</th>
                      <th className="p-2 border border-zinc-300 urdu-text">تفصیل اشیاء</th>
                      <th className="p-2 border border-zinc-300 urdu-text">پکائی</th>
                      <th className="p-2 border border-zinc-300 urdu-text">مکس وزن</th>
                      <th className="p-2 border border-zinc-300 urdu-text">کاٹ رتی</th>
                      <th className="p-2 border border-zinc-300 urdu-text">آئٹم پاسا</th>
                      <th className="p-2 border border-zinc-300 urdu-text">پاسا دیا</th>
                      <th className="p-2 border border-zinc-300 urdu-text">بقایا</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageEntries.map((e) => (
                      <tr key={e.id} className="border-b border-zinc-200 text-center hover:bg-zinc-50 transition-colors">
                        <td className="p-2 border border-zinc-300 font-bold font-mono text-black">{e.date}</td>
                        <td className="p-2 border border-zinc-300 urdu-text font-bold text-black">{e.details}</td>
                        <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.pakaye > 0 ? `${parseFloat(e.pakaye.toFixed(2))} R` : '-'}</td>
                        <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.mixWeight > 0 ? `${e.mixWeight.toFixed(2)}g` : '-'}</td>
                        <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.kaatRati > 0 ? `${e.kaatRati} R` : '-'}</td>
                        <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.pureWeight > 0 ? `${e.pureWeight.toFixed(2)}g` : '-'}</td>
                        <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.pasaDia > 0 ? `${e.pasaDia.toFixed(2)}g` : '-'}</td>
                        <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.runningGold.toFixed(2)}g</td>
                      </tr>
                    ))}
                    {pageEntries.length === 0 && pageIndex === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-zinc-400 font-bold urdu-text">
                          کھاتہ میں اب تک کوئی انٹری نہیں ہوئی۔ انٹری کرنے کے لیے اوپر "کھاتہ انٹری کریں" پر کلک کریں۔
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Statement Terms Footer */}
                <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center text-[10px] text-zinc-500 border-t pt-4">
                  <span>{translations.ur.shopName} - تصدیق شدہ کھاتہ تفصیل</span>
                  <span>صفحہ {pageIndex + 1} از {pages.length}</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* ==========================================
          PRINT PREVIEW MODAL
          ========================================== */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-zinc-50">
              <h3 className="text-xl font-bold urdu-text text-black">پرنٹ خلاصہ (Print Preview)</h3>
              <button 
                type="button"
                onClick={() => {
                  setShowPrintPreview(false);
                  setPdfUrl(null);
                }}
                className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-black cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-zinc-100 flex flex-col items-center gap-10 scrollbar-thin scrollbar-thumb-zinc-400">
              {(() => {
                const chunkLedger = (entries: typeof ledgerWithRunningBalances) => {
                  const pages: (typeof ledgerWithRunningBalances)[] = [];
                  if (entries.length === 0) {
                    pages.push([]);
                    return pages;
                  }
                  const firstPageLimit = 12;
                  const subsequentPageLimit = 18;
                  pages.push(entries.slice(0, firstPageLimit));
                  let index = firstPageLimit;
                  while (index < entries.length) {
                    pages.push(entries.slice(index, index + subsequentPageLimit));
                    index += subsequentPageLimit;
                  }
                  return pages;
                };
                const pages = chunkLedger(filteredLedgerEntries);
                return pages.map((pageEntries, pageIndex) => (
                  <div 
                    key={pageIndex}
                    className="w-[320px] h-[452px] sm:w-[480px] sm:h-[678px] md:w-[600px] md:h-[848px] lg:w-[800px] lg:h-[1130px] overflow-hidden relative shadow-2xl rounded-xl bg-white border border-zinc-200"
                  >
                    <div 
                      className="absolute top-0 left-0 origin-top-left scale-[0.4] sm:scale-[0.6] md:scale-[0.75] lg:scale-100 bg-white p-8 w-[800px] h-[1130px] border-[6px] double border-gold rounded-lg relative"
                      style={{ fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
                      dir="rtl"
                    >
                      <div className="absolute inset-4 border border-dashed border-gold rounded pointer-events-none"></div>
                      
                      {/* Print Title */}
                      {pageIndex === 0 ? (
                        <div className="text-center border-b-2 border-gold pb-4 mb-6">
                          <h1 className="text-4xl font-black urdu-text text-gold-dark mb-1">{translations.ur.shopName}</h1>
                          <p className="text-sm font-bold text-zinc-500 font-nastaliq">{translations.ur.shopAddress}</p>
                          <p className="text-xs font-mono mt-1" dir="ltr">{translations.ur.shopPhone}</p>
                          <div className="inline-block bg-zinc-100 px-4 py-1 rounded-full font-bold urdu-text text-xs border border-zinc-200 mt-3">
                            تفصیلی سونا کھاتہ رپورٹ (Khaata Statement)
                            {itemSearchTerm && ` - فلٹر: ${itemSearchTerm}`}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center border-b-2 border-gold pb-2 mb-4">
                          <h2 className="text-xl font-bold urdu-text text-gold-dark">{translations.ur.shopName}</h2>
                          <div className="text-xs text-zinc-500 font-bold urdu-text">
                            تفصیلی رپورٹ کھاتہ دار: <span className="text-zinc-900 font-black">{selectedAccount?.name}</span> (صفحہ {pageIndex + 1} از {pages.length})
                          </div>
                        </div>
                      )}

                      {/* Account Overview table */}
                      {pageIndex === 0 && (
                        <table className="w-full border-collapse text-right text-xs mb-6">
                          <tbody>
                            <tr className="border-b border-zinc-200">
                              <th className="p-2 urdu-text font-bold text-black w-[20%]">نام کھاتہ دار:</th>
                              <td className="p-2 font-bold text-black text-sm w-[30%]">{selectedAccount?.name}</td>
                              <th className="p-2 urdu-text font-bold text-black w-[20%]">فون نمبر:</th>
                              <td className="p-2 font-mono font-bold text-black w-[30%]">{selectedAccount?.phone || '-'}</td>
                            </tr>
                            <tr className="border-b border-zinc-200">
                              <th className="p-2 urdu-text font-bold text-black">تاریخ پرنٹ:</th>
                              <td className="p-2 font-mono font-bold text-black">{formatDate(new Date(), 'ur-PK')}</td>
                              <th className="p-2 urdu-text font-bold text-black">کُل آئٹم پاسا:</th>
                              <td className="p-2 font-mono font-bold text-black">
                                {(accountSummary[selectedAccountId || 0]?.gold || 0).toFixed(2)}g
                              </td>
                            </tr>
                            <tr className="border-b border-zinc-200">
                              <th className="p-2 urdu-text font-bold text-black">کُل پاسا دیا/ملا:</th>
                              <td className="p-2 font-mono font-bold text-black">
                                {(accountSummary[selectedAccountId || 0]?.totalPasaDia || 0).toFixed(2)}g
                              </td>
                              <th className="p-2 urdu-text font-bold text-black">صاف بقایا:</th>
                              <td className="p-2 font-bold text-black text-sm">
                                {Math.abs(accountSummary[selectedAccountId || 0]?.saafBaqaya || 0).toFixed(2)}g (سونا) {
                                  (accountSummary[selectedAccountId || 0]?.saafBaqaya || 0) > 0.005 ? '(ہمارے ذمہ)' : (accountSummary[selectedAccountId || 0]?.saafBaqaya || 0) < -0.005 ? '(ان کے ذمہ)' : '(حساب صاف)'
                                }
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      )}

                      {/* Ledger table */}
                      <table className="w-full border border-zinc-300 border-collapse text-right text-xs">
                        <thead>
                          <tr className="bg-zinc-100 font-bold text-center text-black border-b border-zinc-300">
                            <th className="p-2 border border-zinc-300 urdu-text">تاریخ</th>
                            <th className="p-2 border border-zinc-300 urdu-text">تفصیل اشیاء</th>
                            <th className="p-2 border border-zinc-300 urdu-text">پکائی</th>
                            <th className="p-2 border border-zinc-300 urdu-text">مکس وزن</th>
                            <th className="p-2 border border-zinc-300 urdu-text">کاٹ رتی</th>
                            <th className="p-2 border border-zinc-300 urdu-text">آئٹم پاسا</th>
                            <th className="p-2 border border-zinc-300 urdu-text">پاسا دیا</th>
                            <th className="p-2 border border-zinc-300 urdu-text">بقایا</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageEntries.map((e) => (
                            <tr key={e.id} className="border-b border-zinc-200 text-center hover:bg-zinc-50 transition-colors">
                              <td className="p-2 border border-zinc-300 font-bold font-mono text-black">{e.date}</td>
                              <td className="p-2 border border-zinc-300 urdu-text font-bold text-black">{e.details}</td>
                              <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.pakaye > 0 ? `${parseFloat(e.pakaye.toFixed(2))} R` : '-'}</td>
                              <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.mixWeight > 0 ? `${e.mixWeight.toFixed(2)}g` : '-'}</td>
                              <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.kaatRati > 0 ? `${e.kaatRati} R` : '-'}</td>
                              <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.pureWeight > 0 ? `${e.pureWeight.toFixed(2)}g` : '-'}</td>
                              <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.pasaDia > 0 ? `${e.pasaDia.toFixed(2)}g` : '-'}</td>
                              <td className="p-2 border border-zinc-300 font-mono font-bold text-black">{e.runningGold.toFixed(2)}g</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Statement Terms Footer */}
                      <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center text-[10px] text-zinc-500 border-t pt-4">
                        <span>{translations.ur.shopName} - تصدیق شدہ کھاتہ تفصیل</span>
                        <span>صفحہ {pageIndex + 1} از {pages.length}</span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
              
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
                className="flex-[2] min-w-[200px] bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg cursor-pointer"
              >
                <Printer size={24} />
                <span className="urdu-text text-xl">پرنٹ کریں (Print)</span>
              </button>

              <button 
                type="button"
                disabled={!pdfUrl}
                onClick={downloadPDF}
                className="flex-1 min-w-[150px] bg-gold hover:bg-gold-light text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
              >
                <Download size={24} />
                <span className="urdu-text text-xl text-black">PDF خلاصہ ڈاؤن لوڈ</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  setShowPrintPreview(false);
                  setPdfUrl(null);
                }}
                className="flex-1 min-w-[100px] bg-zinc-100 text-zinc-600 font-bold py-4 rounded-xl hover:bg-zinc-200 transition-all urdu-text text-xl cursor-pointer"
              >
                بند کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          DELETE CONFIRMATION MODALS
          ========================================== */}
      <ConfirmModal 
        isOpen={deleteAccountId !== null}
        onClose={() => setDeleteAccountId(null)}
        onConfirm={() => deleteAccountId && handleDeleteAccount(deleteAccountId)}
        title={lang === 'ur' ? 'کھاتہ ڈیلیٹ کریں؟' : 'Delete Account?'}
        message={lang === 'ur' ? 'کیا آپ واقعی اس کھاتہ اور اس کی تمام ٹرانزیکشنز کو حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this account and all of its transactions?'}
        lang={lang}
      />

      <ConfirmModal 
        isOpen={deleteEntryId !== null}
        onClose={() => setDeleteEntryId(null)}
        onConfirm={() => deleteEntryId && handleDeleteEntry(deleteEntryId)}
        title={lang === 'ur' ? 'انٹری ڈیلیٹ کریں؟' : 'Delete Entry?'}
        message={lang === 'ur' ? 'کیا آپ واقعی یہ کھاتہ انٹری حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this entry?'}
        lang={lang}
      />

      <ContactPickerModal
        isOpen={isContactPickerOpen}
        onClose={() => setIsContactPickerOpen(false)}
        onSelect={(contact) => {
          setAccountForm(prev => ({
            ...prev,
            name: contact.name || prev.name,
            phone: contact.phone || prev.phone
          }));
        }}
        lang={lang}
      />

      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} title={lang === 'ur' ? 'کھاتہ دستاویز' : 'Khaata Document'} />
      )}
    </div>
  );
}
