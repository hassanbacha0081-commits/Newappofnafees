import React, { useState, useEffect } from 'react';
import { Search, User, Phone, X, Smartphone, Users, Upload, Clipboard, Trash2, CheckCircle2, HelpCircle } from 'lucide-react';
import { db } from '../db';
import { translations, type Language } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';

interface Contact {
  id?: number;
  name: string;
  phone: string;
  type: string;
  isCustom?: boolean;
}

interface ContactPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: { name: string; phone: string }) => void;
  lang: Language;
}

type ActiveTab = 'browse' | 'device' | 'import';

export default function ContactPickerModal({ isOpen, onClose, onSelect, lang }: ContactPickerModalProps) {
  const t = translations[lang];
  const isUrdu = lang === 'ur';

  const [activeTab, setActiveTab] = useState<ActiveTab>('browse');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceApiSupported, setDeviceApiSupported] = useState(false);
  
  // Custom contact imports state
  const [pasteText, setPasteText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; count: number; message: string } | null>(null);

  const isIframe = typeof window !== 'undefined' && window.self !== window.top && !Capacitor.isNativePlatform();

  useEffect(() => {
    // Check if either Device Contact Picker API or Capacitor Contacts is supported
    if (Capacitor.isNativePlatform()) {
      setDeviceApiSupported(true);
    } else if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'select' in (navigator as any).contacts) {
      setDeviceApiSupported(true);
    }
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const [sales, orders, karigars, repairs, goldPurchases, customContacts] = await Promise.all([
        db.sales.toArray(),
        db.orders.toArray(),
        db.karigars.toArray(),
        db.repairs.toArray(),
        db.goldPurchases.toArray(),
        db.contacts.toArray(),
      ]);

      const contactMap = new Map<string, Contact>();

      // 1. Process Custom Imported Contacts (highest priority)
      customContacts.forEach(c => {
        const phone = c.phone?.trim();
        if (phone) {
          const key = `${c.name.trim().toLowerCase()}_${phone}`;
          contactMap.set(key, {
            id: c.id,
            name: c.name.trim(),
            phone,
            type: isUrdu ? 'درآمد شدہ رابطہ' : 'Imported Contact',
            isCustom: true,
          });
        }
      });

      // 2. Process Sales
      sales.forEach(s => {
        const phone = s.phone?.trim();
        if (phone && phone !== '-' && phone !== '') {
          const key = `${s.name.trim().toLowerCase()}_${phone}`;
          if (!contactMap.has(key)) {
            contactMap.set(key, {
              name: s.name.trim(),
              phone,
              type: isUrdu ? 'گاہک' : 'Customer',
            });
          }
        }
      });

      // 3. Process Orders
      orders.forEach(o => {
        const phone = o.phone?.trim();
        if (phone && phone !== '-' && phone !== '') {
          const key = `${o.name.trim().toLowerCase()}_${phone}`;
          if (!contactMap.has(key)) {
            contactMap.set(key, {
              name: o.name.trim(),
              phone,
              type: isUrdu ? 'گاہک (آرڈر)' : 'Customer (Order)',
            });
          }
        }
      });

      // 4. Process Repairs
      repairs.forEach(r => {
        const phone = r.customerPhone?.trim();
        if (phone && phone !== '-' && phone !== '') {
          const key = `${r.customerName.trim().toLowerCase()}_${phone}`;
          if (!contactMap.has(key)) {
            contactMap.set(key, {
              name: r.customerName.trim(),
              phone,
              type: isUrdu ? 'مرمت گاہک' : 'Repair Customer',
            });
          }
        }
      });

      // 5. Process Karigars
      karigars.forEach(k => {
        const phone = k.phone?.trim();
        if (phone && phone !== '-' && phone !== '') {
          const key = `${k.name.trim().toLowerCase()}_${phone}`;
          if (!contactMap.has(key)) {
            contactMap.set(key, {
              name: k.name.trim(),
              phone,
              type: isUrdu ? 'کاریگر' : 'Karigar',
            });
          }
        }
      });

      // 6. Process Gold Purchases
      goldPurchases.forEach(g => {
        const phone = g.phone?.trim();
        if (phone && phone !== '-' && phone !== '') {
          const key = `${g.name.trim().toLowerCase()}_${phone}`;
          if (!contactMap.has(key)) {
            contactMap.set(key, {
              name: g.name.trim(),
              phone,
              type: isUrdu ? 'بیچنے والا' : 'Seller',
            });
          }
        }
      });

      const compiledList = Array.from(contactMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );

      setContacts(compiledList);
    } catch (err) {
      console.error('Error compiling contact list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadContacts();
      setImportStatus(null);
    }
  }, [isOpen, isUrdu]);

  const cleanPhoneNumber = (rawPhone: string): string => {
    let clean = rawPhone.replace(/\s+/g, '').replace(/[-()]/g, '');
    if (clean.startsWith('+92')) {
      clean = '0' + clean.substring(3);
    } else if (clean.startsWith('0092')) {
      clean = '0' + clean.substring(4);
    } else if (clean.startsWith('92')) {
      clean = '0' + clean.substring(2);
    }
    return clean;
  };

  const selectDeviceContact = async () => {
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Contacts.requestPermissions();
        if (permission.contacts !== 'granted') {
          alert(isUrdu 
            ? 'رابطوں تک رسائی کی اجازت نہیں ملی۔' 
            : 'Permission to access contacts was denied.'
          );
          setLoading(false);
          return;
        }

        const result = await Contacts.getContacts({
          projection: {
            name: true,
            phones: true
          }
        });

        if (result && result.contacts && result.contacts.length > 0) {
          let importedCount = 0;
          
          for (const deviceContact of result.contacts) {
            const rawName = (deviceContact.name as any)?.display || (deviceContact as any).displayName || '';
            const rawPhone = deviceContact.phones && deviceContact.phones[0] && deviceContact.phones[0].number
              ? deviceContact.phones[0].number
              : '';
            
            if (rawName && rawPhone) {
              const formattedPhone = cleanPhoneNumber(rawPhone);
              const existing = await db.contacts.where({ phone: formattedPhone }).first();
              if (!existing) {
                await db.contacts.add({
                  name: rawName,
                  phone: formattedPhone
                });
                importedCount++;
              }
            }
          }

          setImportStatus({
            success: true,
            count: importedCount,
            message: isUrdu 
              ? `${importedCount} نئے رابطے کامیابی سے موبائل سے Nafees ERP میں درآمد کر لیے گئے ہیں!`
              : `Successfully imported ${importedCount} new contacts from your device contacts book!`
          });

          await loadContacts();
          setActiveTab('browse');
        } else {
          alert(isUrdu 
            ? 'موبائل میں کوئی رابطہ نہیں ملا۔' 
            : 'No contacts found on your device.'
          );
        }
      } else if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'select' in (navigator as any).contacts) {
        if (isIframe) {
          alert(isUrdu
            ? 'پیش نظارہ (Iframe) کی وجہ سے براہ راست رابطوں تک رسائی بلاک ہے۔ براہ کرم اوپر دائیں کونے میں موجود "Open in New Tab" بٹن پر کلک کر کے ایپ کو نئے ٹیب میں کھولیں، یا VCF طریقہ استعمال کریں۔'
            : 'Direct contact picker is blocked because the app is running in a preview window (iframe). Please click the "Open in New Tab" button in the top-right corner to open the app directly and use this feature, or try importing via a VCF file.'
          );
          setLoading(false);
          return;
        }
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        const selected = await (navigator as any).contacts.select(props, opts);
        
        if (selected && selected.length > 0) {
          let importedCount = 0;
          
          for (const deviceContact of selected) {
            const rawName = deviceContact.name && deviceContact.name[0] ? deviceContact.name[0] : '';
            const rawPhone = deviceContact.tel && deviceContact.tel[0] ? deviceContact.tel[0] : '';
            
            if (rawName && rawPhone) {
              const formattedPhone = cleanPhoneNumber(rawPhone);
              const existing = await db.contacts.where({ phone: formattedPhone }).first();
              if (!existing) {
                await db.contacts.add({
                  name: rawName,
                  phone: formattedPhone
                });
                importedCount++;
              }
            }
          }

          setImportStatus({
            success: true,
            count: importedCount,
            message: isUrdu 
              ? `${importedCount} رابطے کامیابی سے موبائل سے درآمد کر لیے گئے ہیں!`
              : `Successfully imported ${importedCount} contacts from your device!`
          });

          await loadContacts();
          setActiveTab('browse');
        }
      } else {
        alert(isUrdu 
          ? 'موبائل رابطوں تک رسائی ناکام رہی۔ براہ کرم VCF فائل درآمد کرنے کا طریقہ آزمائیں۔' 
          : 'Failed to access device contacts. Please try importing via a VCF file.'
        );
      }
    } catch (err) {
      console.error('Error selecting from device contact picker:', err);
      alert(isUrdu 
        ? 'موبائل رابطوں تک رسائی ناکام رہی۔ براہ کرم VCF فائل درآمد کرنے کا طریقہ آزمائیں۔' 
        : 'Failed to access device contacts. Please try importing via a VCF file.'
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomContact = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!id) return;
    try {
      await db.contacts.delete(id);
      loadContacts();
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

  // VCF Parser
  const handleVcfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      let currentName = '';
      let currentPhone = '';
      let count = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('BEGIN:VCARD')) {
          currentName = '';
          currentPhone = '';
        } else if (trimmed.startsWith('FN:') || trimmed.startsWith('FN;')) {
          // Extract Full Name
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx !== -1) {
            currentName = trimmed.substring(colonIdx + 1).trim();
          }
        } else if (trimmed.startsWith('N:') || trimmed.startsWith('N;')) {
          if (!currentName) {
            const colonIdx = trimmed.indexOf(':');
            if (colonIdx !== -1) {
              const parts = trimmed.substring(colonIdx + 1).split(';');
              currentName = parts.filter(Boolean).reverse().join(' ').trim();
            }
          }
        } else if (trimmed.startsWith('TEL:') || trimmed.startsWith('TEL;')) {
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx !== -1) {
            currentPhone = trimmed.substring(colonIdx + 1).trim();
          }
        } else if (trimmed.startsWith('END:VCARD')) {
          if (currentName && currentPhone) {
            const formattedPhone = cleanPhoneNumber(currentPhone);
            // Check if exists
            const existing = await db.contacts.where({ phone: formattedPhone }).first();
            if (!existing) {
              await db.contacts.add({
                name: currentName,
                phone: formattedPhone
              });
              count++;
            }
          }
        }
      }

      setImportStatus({
        success: true,
        count,
        message: isUrdu 
          ? `مبارک ہو! VCF فائل سے ${count} نئے رابطے کامیابی کے ساتھ درآمد ہو گئے۔`
          : `Success! ${count} new contacts have been imported from the VCF file.`
      });

      loadContacts();
    };
    reader.readAsText(file);
  };

  // Raw Text paste parser
  const handlePasteImport = async () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split('\n');
    let count = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      let name = '';
      let phone = '';

      // Try different separator formats: Comma, Colon, Tab, Space
      if (line.includes(',')) {
        const parts = line.split(',');
        // Guess which one is phone (numeric)
        const part1IsNum = /^\+?\d+[-()\d\s]+$/.test(parts[0].trim());
        if (part1IsNum) {
          phone = parts[0].trim();
          name = parts.slice(1).join(',').trim();
        } else {
          name = parts[0].trim();
          phone = parts[1].trim();
        }
      } else if (line.includes(':')) {
        const parts = line.split(':');
        name = parts[0].trim();
        phone = parts[1].trim();
      } else {
        // Space separated. Let's find first or last numeric cluster
        const words = line.trim().split(/\s+/);
        const lastWord = words[words.length - 1];
        const firstWord = words[0];

        if (/^\+?\d+[-()\d\s]{7,}$/.test(lastWord)) {
          phone = lastWord;
          name = words.slice(0, words.length - 1).join(' ');
        } else if (/^\+?\d+[-()\d\s]{7,}$/.test(firstWord)) {
          phone = firstWord;
          name = words.slice(1).join(' ');
        } else {
          // Just treat whole line as number if it has numbers
          const numericOnly = line.replace(/\D/g, '');
          if (numericOnly.length >= 7) {
            phone = line.trim();
            name = isUrdu ? `رابطہ ${numericOnly.slice(-4)}` : `Contact ${numericOnly.slice(-4)}`;
          }
        }
      }

      if (phone) {
        const formattedPhone = cleanPhoneNumber(phone);
        const formattedName = name.trim() || (isUrdu ? `رابطہ ${formattedPhone}` : `Contact ${formattedPhone}`);
        
        const existing = await db.contacts.where({ phone: formattedPhone }).first();
        if (!existing) {
          await db.contacts.add({
            name: formattedName,
            phone: formattedPhone
          });
          count++;
        }
      }
    }

    setImportStatus({
      success: true,
      count,
      message: isUrdu 
        ? `${count} نئے رابطے کامیابی کے ساتھ ٹیکسٹ سے محفوظ کر لیے گئے۔`
        : `${count} new contacts successfully imported from pasted text.`
    });

    setPasteText('');
    loadContacts();
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative bg-white w-full max-w-lg rounded-3xl shadow-xl border border-sky-100 flex flex-col max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-sky-100 flex items-center justify-between bg-sky-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold/10 text-gold rounded-xl flex items-center justify-center">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-sky-900 urdu-text">
                    {isUrdu ? 'رابطہ منتخب کریں' : 'Select Contact'}
                  </h3>
                  <p className="text-xs text-zinc-500 urdu-text">
                    {isUrdu ? 'سابقہ ریکارڈ یا اپنے موبائل سے رابطہ منتخب کریں' : 'Select from ERP history or mobile contacts'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 hover:bg-sky-100 text-zinc-400 hover:text-zinc-600 rounded-xl flex items-center justify-center transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-sky-100 bg-sky-50/40 p-1 mx-6 mt-4 rounded-xl">
              <button
                onClick={() => { setActiveTab('browse'); setImportStatus(null); }}
                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all urdu-text ${
                  activeTab === 'browse' ? 'bg-white text-sky-900 shadow-sm border border-sky-100/50' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {isUrdu ? 'رابطے تلاش کریں' : 'Browse'}
              </button>
              <button
                onClick={() => { setActiveTab('device'); setImportStatus(null); }}
                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all urdu-text ${
                  activeTab === 'device' ? 'bg-white text-sky-900 shadow-sm border border-sky-100/50' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {isUrdu ? 'موبائل رابطے' : 'Phone Direct'}
              </button>
              <button
                onClick={() => { setActiveTab('import'); setImportStatus(null); }}
                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all urdu-text ${
                  activeTab === 'import' ? 'bg-white text-sky-900 shadow-sm border border-sky-100/50' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {isUrdu ? 'درآمد (VCF/متن)' : 'Import Contacts'}
              </button>
            </div>

            {/* Success Notifications */}
            {importStatus && (
              <div className="mx-6 mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                <div className="text-xs md:text-sm text-emerald-800 font-medium urdu-text">
                  {importStatus.message}
                </div>
              </div>
            )}

            {/* TAB 1: BROWSE AND SEARCH */}
            {activeTab === 'browse' && (
              <>
                <div className="p-6 pb-2">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                      type="text"
                      placeholder={isUrdu ? 'نام یا فون نمبر تلاش کریں...' : 'Search by name or phone...'}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-5 py-3.5 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-sm font-medium text-black"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 space-y-1 min-h-[300px]">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-400 space-y-3">
                      <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm urdu-text">{isUrdu ? 'لوڈنگ ہو رہی ہے...' : 'Compiling contacts...'}</span>
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-400 text-center">
                      <Users size={36} className="text-zinc-300 mb-2 animate-pulse" />
                      <span className="text-sm font-medium urdu-text">
                        {isUrdu ? 'کوئی رابطہ نہیں ملا' : 'No contacts found'}
                      </span>
                    </div>
                  ) : (
                    filteredContacts.map((contact, idx) => (
                      <button
                        key={`${contact.phone}-${idx}`}
                        onClick={() => {
                          onSelect({ name: contact.name, phone: contact.phone });
                          onClose();
                        }}
                        className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-sky-50/70 border border-transparent hover:border-sky-100 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-extrabold text-sm border border-sky-100 group-hover:bg-white transition-all">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-800 text-sm leading-tight text-left">
                              {contact.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 text-zinc-500 text-xs font-mono">
                              <Phone size={11} className="text-zinc-400" />
                              <span>{contact.phone}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full ${
                            contact.isCustom ? 'bg-gold/15 text-gold-dark border border-gold/20' : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {contact.type}
                          </span>
                          
                          {contact.isCustom && contact.id && (
                            <button
                              onClick={(e) => deleteCustomContact(contact.id!, e)}
                              className="p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title={isUrdu ? 'رابطہ حذف کریں' : 'Delete Contact'}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {/* TAB 2: DEVICE DIRECT API */}
            {activeTab === 'device' && (
              <div className="p-6 space-y-6 flex-1 flex flex-col justify-between overflow-y-auto min-h-[300px]">
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-sky-50 border border-sky-100 flex items-start gap-3">
                    <Smartphone className="text-gold shrink-0" size={24} />
                    <div className="space-y-1">
                      <h4 className="text-sm font-extrabold text-sky-950 urdu-text">
                        {isUrdu ? 'براہ راست موبائل رابطہ منتخب کار' : 'Direct Mobile Contact Selector'}
                      </h4>
                      <p className="text-xs text-zinc-600 leading-relaxed urdu-text">
                        {isUrdu 
                          ? 'یہ فیچر گوگل کروم موبائل براؤزر یا اینڈرائیڈ ایپ میں کام کرتا ہے۔ یہ آپ کے موبائل فون کی لسٹ کھولتا ہے جس سے آپ رابطے منتخب کر سکتے ہیں۔'
                          : 'This feature works on Google Chrome mobile browser or when running inside the Android APK. It loads your native system contacts securely.'}
                      </p>
                    </div>
                  </div>

                  {isIframe && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                        <span>⚠️ {isUrdu ? 'پیش نظارہ فریم کی حد' : 'Preview Frame Limitation'}</span>
                      </div>
                      <p className="text-xs leading-relaxed urdu-text">
                        {isUrdu 
                          ? 'موبائل رابطوں کا انتخاب پیش نظارہ فریم (Iframe) کے اندر مسدود ہے۔ براہ کرم اوپر دائیں کونے میں موجود "Open in New Tab" بٹن پر کلک کر کے ایپ کو نئے ٹیب میں کھولیں، یا VCF طریقہ استعمال کریں۔'
                          : 'Direct device contacts picker is blocked within the preview pane. Please click the "Open in New Tab" button in the top-right corner to use this feature, or try importing via a VCF file instead.'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <HelpCircle size={14} />
                      <span>{isUrdu ? 'مدد اور رہنمائی' : 'Troubleshooting / Support'}</span>
                    </h5>
                    <ul className="text-xs text-zinc-500 space-y-1.5 pl-1.5 urdu-text">
                      <li>• {isUrdu ? 'اگر موبائل لسٹ نہیں کھلتی، تو اپنے موبائل کا براؤزر استعمال کریں۔' : 'If the phone list does not trigger, please access this page on your actual phone browser.'}</li>
                      <li>• {isUrdu ? 'آئی فون پر صنفِ اول سفاری 14.5+ ورژن درکار ہے۔' : 'On iPhones, Safari version 14.5+ is required.'}</li>
                      <li>• {isUrdu ? 'آپ ایک وقت میں ایک یا ایک سے زائد رابطے منتخب کر کے محفوظ کر سکتے ہیں۔' : 'You can select multiple contacts at once to save them directly to Nafees ERP.'}</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-sky-50">
                  {deviceApiSupported ? (
                    <button
                      onClick={selectDeviceContact}
                      className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gold hover:bg-gold-dark text-white font-extrabold text-base transition-all shadow-md hover:shadow-lg cursor-pointer"
                    >
                      <Smartphone size={20} />
                      <span className="urdu-text">
                        {isUrdu ? 'فون کے رابطے منتخب کریں' : 'Open System Contact Book'}
                      </span>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-center py-4 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl urdu-text">
                        {isUrdu 
                          ? 'آپ کا موجودہ براؤزر براہ راست رابطوں تک رسائی کی اجازت نہیں دیتا۔ براہ کرم VCF درآمد آزمائیں!'
                          : 'Your current browser or layout does not support direct contact access. Please use the VCF Import tab instead!'}
                      </div>
                      <button
                        onClick={() => setActiveTab('import')}
                        className="w-full py-3 bg-sky-100 hover:bg-sky-200 text-sky-800 font-extrabold text-sm rounded-xl transition-all urdu-text"
                      >
                        {isUrdu ? 'VCF فائل درآمد کرنے پر جائیں' : 'Go to VCF / Text Import'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: VCF / TEXT IMPORTER */}
            {activeTab === 'import' && (
              <div className="p-6 space-y-6 flex-1 overflow-y-auto min-h-[300px]">
                {/* VCF Upload Area */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider urdu-text">
                    {isUrdu ? 'طریقہ ۱: موبائل کی بیک اپ فائل (VCF)' : 'Method 1: vCard File (.vcf)'}
                  </label>
                  <div className="border-2 border-dashed border-sky-100 rounded-2xl p-5 bg-sky-50/50 hover:bg-sky-50 transition-all flex flex-col items-center justify-center text-center relative group">
                    <Upload className="text-gold mb-2 group-hover:scale-110 transition-transform" size={28} />
                    <span className="text-sm font-bold text-sky-950 urdu-text">
                      {isUrdu ? 'اپنے موبائل کی VCF فائل اپ لوڈ کریں' : 'Select exported contacts (.vcf) file'}
                    </span>
                    <span className="text-xs text-zinc-500 mt-1 urdu-text">
                      {isUrdu ? 'موبائل فون -> رابطے (Contacts) -> شیئر/ایکسپورٹ کر کے حاصل کریں' : 'Export from phone contacts -> Save to file, then select here'}
                    </span>
                    <input
                      type="file"
                      accept=".vcf"
                      onChange={handleVcfUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Paste Text Area */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider urdu-text">
                    {isUrdu ? 'طریقہ ۲: رابطوں کا متن کاپی پیسٹ کریں' : 'Method 2: Paste Contact List'}
                  </label>
                  <div className="space-y-3">
                    <textarea
                      rows={4}
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder={isUrdu 
                        ? "ہر لائن پر ایک رابطہ درج کریں، مثال:\nاحمد علی, 03001234567\nمحمد خان: 03157654321" 
                        : "Enter one contact per line, example:\nJohn Doe, 03001234567\nAsif Khan: 03157654321"}
                      className="w-full p-4 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-xs font-medium text-black placeholder-zinc-400"
                    />
                    <button
                      onClick={handlePasteImport}
                      disabled={!pasteText.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gold hover:bg-gold-dark text-white font-extrabold text-sm rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      <Clipboard size={16} />
                      <span className="urdu-text">
                        {isUrdu ? 'ٹیکسٹ درآمد کریں' : 'Import Paste Text'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
