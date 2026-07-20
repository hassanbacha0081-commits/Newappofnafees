import React, { useState, useEffect } from 'react';
// Triggering sync for version 1.1.3 - troubleshooting GitHub Action build status
import { 
  Receipt, 
  History, 
  ShoppingBag, 
  Users, 
  Wrench, 
  Package, 
  BarChart3, 
  Settings as SettingsIcon,
  Menu,
  X,
  Languages,
  Wallet,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, type Language } from './translations';
import { cn } from './lib/utils';
import { db, type Sale } from './db';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// Sections
import Billing from './components/Billing';
import Dashboard from './components/Dashboard';
import Purchases from './components/Purchases';
import Records from './components/Records';
import Orders from './components/Orders';
import Karigar from './components/Karigar';
import Repairs from './components/Repairs';
import Stock from './components/Stock';
import Customers from './components/Customers';
import Reports from './components/Reports';
import Settings from './components/Settings';
import LockScreen from './components/LockScreen';
import Expenses from './components/Expenses';
import Khaata from './components/Khaata';
import { getPaletteStyles } from './lib/colors';

import { APP_CONFIG } from './config';
import { 
  registerBackupHooks, 
  googleSignIn, 
  findBackupOnDrive, 
  downloadBackupContent,
  addAuthListener,
  setCachedAccessToken
} from './lib/googleDriveBackup';
import { Cloud, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

type Section = 'billing' | 'purchases' | 'records' | 'orders' | 'karigar' | 'repairs' | 'stock' | 'customers' | 'expenses' | 'reports' | 'settings' | 'khaata';

export default function App() {
  const [lang, setLang] = useState<Language>('ur');
  const [activeSection, setActiveSection] = useState<Section>('billing');
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [goldRate, setGoldRate] = useState<number>(0);
  const [shopName, setShopName] = useState<string>(translations.ur.shopName);
  const [shopAddress, setShopAddress] = useState<string>(translations.ur.shopAddress);
  const [shopPhone, setShopPhone] = useState<string>(translations.ur.shopPhone);
  const [shopPhone2, setShopPhone2] = useState<string>(translations.ur.shopPhone2);
  const [paletteId, setPaletteId] = useState<string>('royal');
  const [isLoading, setIsLoading] = useState(true);
  
  // Google Drive Onboarding / Restore States
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'welcome' | 'checking' | 'found' | 'not_found' | 'success'>('welcome');
  const [onboardingError, setOnboardingError] = useState<string>('');
  const [foundBackup, setFoundBackup] = useState<{ id: string; modifiedTime: string; data?: any } | null>(null);
  
  // Security
  const [appPin, setAppPin] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showExitToast, setShowExitToast] = useState(false);

  const t = translations[lang];
  const isRTL = lang === 'ur';

  // Fetch initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      const rate = await db.settings.get('goldRate');
      const name = await db.settings.get('shopName');
      const address = await db.settings.get('shopAddress');
      const phone = await db.settings.get('shopPhone');
      const phone2 = await db.settings.get('shopPhone2');
      const pin = await db.settings.get('appPin');
      const autoBackupFreq = await db.settings.get('autoBackupFrequency');
      const lastBackupDate = await db.settings.get('lastBackupDate');
      const paletteSetting = await db.settings.get('colorPalette');
      
      if (rate) setGoldRate(rate.value);
      if (name) setShopName(name.value);
      if (address) setShopAddress(address.value);
      if (phone) setShopPhone(phone.value);
      if (phone2) setShopPhone2(phone2.value);
      if (paletteSetting) setPaletteId(paletteSetting.value);
      if (pin && pin.value) {
        setAppPin(pin.value);
        setIsLocked(true);
      }

      if (autoBackupFreq && autoBackupFreq.value && autoBackupFreq.value !== 'none') {
        const freqDays = parseInt(autoBackupFreq.value, 10);
        const now = new Date();
        let needsBackup = false;
        
        if (!lastBackupDate || !lastBackupDate.value) {
          needsBackup = true;
        } else {
          const lastBackup = new Date(lastBackupDate.value);
          const daysSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 3600 * 24);
          if (daysSinceLastBackup >= freqDays) needsBackup = true;
        }

        if (needsBackup) {
          try {
            const sales = await db.sales.toArray();
            const orders = await db.orders.toArray();
            const karigars = await db.karigars.toArray();
            const repairs = await db.repairs.toArray();
            const stock = await db.stock.toArray();
            const settings = await db.settings.toArray();
            const goldPurchases = await db.goldPurchases.toArray();
            const khaataAccounts = await db.khaataAccounts.toArray();
            const khaataEntries = await db.khaataEntries.toArray();

            const data = { sales, orders, karigars, repairs, stock, settings, goldPurchases, khaataAccounts, khaataEntries };
            const fileName = "nafees_jewellers_backup.json";
            const jsonString = JSON.stringify(data);
            
            await db.settings.put({ key: 'lastBackupDate', value: now.toISOString() });
            
            if (Capacitor.isNativePlatform()) {
              await Filesystem.writeFile({
                path: fileName,
                data: jsonString,
                directory: Directory.Documents,
                encoding: Encoding.UTF8,
              });
            } else {
              const blob = new Blob([jsonString], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              a.click();
              URL.revokeObjectURL(url);
            }
          } catch (error) {
            console.error('Auto backup failed:', error);
          }
        }
      }

      const initStatus = await db.settings.get('hasBeenInitialized');
      const isDbEmpty = (await db.sales.count() === 0) && (await db.orders.count() === 0);

      if (!initStatus && isDbEmpty) {
        setIsOnboarding(true);
      } else {
        registerBackupHooks();
      }
      
      setTimeout(() => setIsLoading(false), 1000);
    };
    fetchSettings();
  }, []);

  // Handle Google OAuth 2.0 redirect callbacks for both web and native deep linking
  useEffect(() => {
    // 1. Handle Web-side OAuth redirect (redirecting to native deep link, or logging in on web)
    if (!Capacitor.isNativePlatform()) {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        // Check if it's a native callback redirect
        if (hash.includes('state=native')) {
          const nativeSchemeUrl = `com.nafeesjewellers.app://oauth${hash}`;
          
          document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #0c1222; color: white; font-family: sans-serif; padding: 20px; text-align: center;">
              <div style="background: rgba(212, 175, 55, 0.08); border: 2px solid #D4AF37; padding: 40px; border-radius: 20px; max-width: 440px; box-shadow: 0 15px 35px rgba(0,0,0,0.4); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #D4AF37; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                  <span style="font-size: 32px; color: #D4AF37; line-height: 1;">✓</span>
                </div>
                <h2 style="color: #D4AF37; margin-bottom: 12px; font-size: 26px; font-weight: bold; letter-spacing: -0.5px;">Nafees Jewellers ERP</h2>
                <p style="font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 28px;">
                  Google Drive connected successfully! Opening the mobile app...
                </p>
                <a href="${nativeSchemeUrl}" style="display: inline-block; background-color: #D4AF37; color: black; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 16px; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);">
                  Open Nafees ERP App
                </a>
                <p style="font-size: 12px; color: #64748b; margin-top: 20px; line-height: 1.4;">
                  If the app did not open automatically, please click the golden button above.
                </p>
              </div>
            </div>
          `;
          
          setTimeout(() => {
            window.location.href = nativeSchemeUrl;
          }, 1200);
        } else {
          // It is a standard Web login. Parse token and set it.
          const params = new URLSearchParams(hash.substring(1));
          const token = params.get('access_token');
          if (token) {
            setCachedAccessToken(token).then(() => {
              // Clear hash without reloading the page
              window.history.replaceState(null, '', window.location.pathname);
            });
          }
        }
      }
    }

    // 2. Handle Native-side deep links
    if (Capacitor.isNativePlatform()) {
      const handleAppUrlOpen = async (data: { url: string }) => {
        console.log('App opened with URL:', data.url);
        if (data.url && (data.url.includes('access_token=') || data.url.includes('#access_token='))) {
          const parts = data.url.split('#');
          const hashStr = parts[1] || parts[0].split('?')[1];
          if (hashStr) {
            const params = new URLSearchParams(hashStr);
            const token = params.get('access_token');
            if (token) {
              console.log('Native App captured token from deep link. Activating Google Drive...');
              await setCachedAccessToken(token);
            }
          }
        }
      };

      CapApp.addListener('appUrlOpen', handleAppUrlOpen);

      return () => {
        CapApp.removeAllListeners();
      };
    }
  }, []);

  const handleOnboardingFresh = async () => {
    await db.settings.put({ key: 'hasBeenInitialized', value: 'true' });
    setIsOnboarding(false);
    registerBackupHooks();
  };

  const handleOnboardingConnect = async () => {
    setOnboardingStep('checking');
    setOnboardingError('');
    try {
      const res = await googleSignIn();
      if (!res || !res.accessToken) {
        throw new Error('No token returned');
      }
      const backup = await findBackupOnDrive(res.accessToken);
      if (backup) {
        const content = await downloadBackupContent(res.accessToken, backup.id);
        if (content) {
          setFoundBackup({
            id: backup.id,
            modifiedTime: backup.modifiedTime,
            data: content
          });
          setOnboardingStep('found');
        } else {
          setOnboardingStep('not_found');
        }
      } else {
        setOnboardingStep('not_found');
      }
    } catch (err: any) {
      console.error(err);
      setOnboardingError(lang === 'ur' ? 'رابطہ قائم کرنے میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔' : 'Connection error. Please try again.');
      setOnboardingStep('welcome');
    }
  };

  const handleOnboardingRestore = async () => {
    if (!foundBackup || !foundBackup.data) return;
    setOnboardingStep('checking');
    try {
      const data = foundBackup.data;
      
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

      await db.settings.put({ key: 'hasBeenInitialized', value: 'true' });
      await db.settings.put({ key: 'googleDriveConnected', value: 'true' });

      setOnboardingStep('success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      setOnboardingError(lang === 'ur' ? 'بیک اپ بحال کرنے میں خرابی۔' : 'Failed to restore backup.');
      setOnboardingStep('welcome');
    }
  };

  // Handle native & web back-button navigation and exit behaviors
  useEffect(() => {
    let lastTime = 0;
    let toastTimeout: NodeJS.Timeout;

    // listener for Capacitor App Back Button and exit app logic
    const setupBackListener = async () => {
      try {
        const handler = await CapApp.addListener('backButton', () => {
          if (activeSection !== 'billing') {
            setActiveSection('billing');
          } else {
            const currentTime = Date.now();
            if (currentTime - lastTime < 2000) {
              CapApp.exitApp();
            } else {
              lastTime = currentTime;
              setShowExitToast(true);
              clearTimeout(toastTimeout);
              toastTimeout = setTimeout(() => {
                setShowExitToast(false);
              }, 2000);
            }
          }
        });
        return handler;
      } catch (err) {
        console.warn('Capacitor App backButton listener not supported or failed to bind', err);
        return null;
      }
    };

    const handlerPromise = setupBackListener();

    // Standard Web browser history state / popstate listeners
    const handlePopState = (e: PopStateEvent) => {
      if (activeSection !== 'billing') {
        setActiveSection('billing');
        // Push state again so next back click isn't instantly standard popstate
        window.history.pushState({ section: 'billing' }, '');
      } else {
        const currentTime = Date.now();
        if (currentTime - lastTime < 2000) {
          window.close();
        } else {
          lastTime = currentTime;
          setShowExitToast(true);
          clearTimeout(toastTimeout);
          toastTimeout = setTimeout(() => {
            setShowExitToast(false);
          }, 2000);
          window.history.pushState({ section: 'billing' }, '');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Synchronize browser history stack
    if (!window.history.state || window.history.state.section !== activeSection) {
      window.history.pushState({ section: activeSection }, '');
    }

    return () => {
      handlerPromise.then(h => h && h.remove());
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(toastTimeout);
    };
  }, [activeSection]);

  const navItems = [
    { id: 'billing', icon: Receipt, label: t.billing },
    { id: 'purchases', icon: ShoppingBag, label: t.purchaseGold || "سونا خریدیں" },
    { id: 'records', icon: History, label: t.records },
    { id: 'orders', icon: Package, label: t.orders },
    { id: 'karigar', icon: Users, label: t.karigar },
    { id: 'repairs', icon: Wrench, label: t.repairs },
    { id: 'khaata', icon: BookOpen, label: t.khaata },
    { id: 'stock', icon: Package, label: t.stock },
    { id: 'customers', icon: Users, label: t.customers },
    { id: 'expenses', icon: Wallet, label: t.expenses },
    { id: 'reports', icon: BarChart3, label: t.reports },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'billing': return <Billing lang={lang} editingSale={editingSale} setEditingSale={setEditingSale} />;
      case 'purchases': return <Purchases lang={lang} />;
      case 'records': return <Records lang={lang} setActiveSection={setActiveSection} setEditingSale={setEditingSale} />;
      case 'orders': return <Orders lang={lang} />;
      case 'karigar': return <Karigar lang={lang} />;
      case 'repairs': return <Repairs lang={lang} />;
      case 'stock': return <Stock lang={lang} />;
      case 'customers': return <Customers lang={lang} />;
      case 'expenses': return <Expenses lang={lang} />;
      case 'khaata': return <Khaata lang={lang} />;
      case 'reports': return <Reports lang={lang} />;
      case 'settings': return <Settings lang={lang} setGoldRate={setGoldRate} setLang={setLang} paletteId={paletteId} setPaletteId={setPaletteId} />;
      default: return <Billing lang={lang} editingSale={editingSale} setEditingSale={setEditingSale} />;
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-sky-400 flex flex-col items-center justify-center text-gold-dark">
        <div className="w-24 h-24 bg-white border-2 border-gold rounded-full flex items-center justify-center mb-4 shadow-lg">
          <img src={APP_CONFIG.appIcon} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
        </div>
        <h1 className="text-3xl font-bold urdu-text text-white">{shopName}</h1>
        <div className="mt-4 animate-pulse text-white-60">Loading...</div>
      </div>
    );
  }

  if (isLocked && appPin) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: getPaletteStyles(paletteId) }} />
        <LockScreen 
          lang={lang} 
          correctPin={appPin} 
          shopName={shopName}
          onUnlock={() => setIsLocked(false)} 
        />
      </>
    );
  }

  return (
    <div className={cn(
      "min-h-screen bg-sky-200 text-zinc-900 flex",
      isRTL ? "flex-row-reverse text-right" : "flex-row text-left"
    )} dir={isRTL ? "rtl" : "ltr"}>
      <style dangerouslySetInnerHTML={{ __html: getPaletteStyles(paletteId) }} />
      {/* Sidebar Desktop */}
      <aside className={cn(
        "hidden lg:flex flex-col w-72 bg-sky-600 text-white h-screen sticky top-0 shadow-2xl z-40",
        isRTL ? "order-last border-l border-sky-500" : "order-first border-r border-sky-500"
      )}>
        <div className="p-8 border-b border-sky-500 flex flex-col items-center gap-4 bg-sky-700/50">
          <div className="relative group">
            <div className="absolute inset-0 bg-white blur-lg opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <img src={APP_CONFIG.appIcon} alt="Logo" className="w-20 h-20 object-contain rounded-2xl bg-white border border-gold-30 p-2 relative z-10 shadow-xl" referrerPolicy="no-referrer" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold urdu-text text-white tracking-tight">{shopName}</h1>
            <p className="text-[10px] text-sky-100 uppercase tracking-widest font-bold">{shopAddress}</p>
            <div className="flex items-center justify-center gap-3 mt-4 bg-white/10 px-4 py-2 rounded-xl border border-white/20 shadow-inner" dir="ltr">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-5 h-5" alt="WhatsApp" referrerPolicy="no-referrer" />
              <span className="font-mono text-sm font-bold text-white">{shopPhone}</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-700">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as Section)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                activeSection === item.id 
                  ? "text-black font-bold shadow-lg shadow-gold/20" 
                  : "text-sky-100 hover:bg-sky-500/50 hover:text-gold"
              )}
            >
              {activeSection === item.id && (
                <motion.div 
                  layoutId="nav-bg" 
                  className="absolute inset-0 bg-gold"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <item.icon size={18} className={cn("relative z-10", activeSection === item.id ? "text-black" : "group-hover:scale-110 transition-transform")} />
              <span className="urdu-text text-sm relative z-10">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-sky-500 bg-sky-700/50 space-y-2">
          <button
            onClick={() => setActiveSection('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
              activeSection === 'settings' 
                ? "bg-white text-sky-900 shadow-lg" 
                : "text-sky-100 hover:bg-sky-500"
            )}
          >
            <SettingsIcon size={20} />
            <span className="urdu-text font-bold">{t.settings}</span>
          </button>
          <button 
            onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')}
            className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-sky-700 text-sky-100 hover:bg-sky-500 hover:text-gold transition-all border border-sky-500 font-bold"
          >
            <Languages size={20} />
            <span className="text-sm">{lang === 'ur' ? 'English' : 'اردو'}</span>
          </button>
          <div className="text-center pt-1">
            <span className="text-[10px] text-sky-200/60 font-mono font-medium select-none">
              v{APP_CONFIG.version}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sky-600 text-white flex items-center justify-between px-4 z-50 border-b border-sky-500 shadow-xl">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-sky-100 hover:text-white">
          <Menu size={28} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-base font-bold urdu-text text-white leading-tight">{shopName}</h1>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] bg-white/10 px-2.5 py-1 rounded-full border border-white/20 shadow-inner" dir="ltr">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <span className="font-mono text-white font-bold">{shopPhone}</span>
          </div>
        </div>
        <button onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')} className="p-2 text-sky-100 hover:text-white">
          <Languages size={24} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 z-[60] lg:hidden backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              className={cn(
                "fixed top-0 bottom-0 w-[280px] max-w-[85vw] bg-sky-600 text-white z-[70] lg:hidden flex flex-col border-x border-sky-500 shadow-2xl",
                isRTL ? "right-0" : "left-0"
              )}
            >
              <div className="p-5 border-b border-sky-500 flex justify-between items-center bg-sky-700">
                <h1 className="text-lg font-bold urdu-text text-white truncate pr-2">{shopName}</h1>
                <button onClick={() => setIsSidebarOpen(false)} className="text-sky-100 hover:text-white transition-colors p-1 shrink-0">
                  <X size={24} />
                </button>
              </div>
              <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-700">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id as Section);
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group relative overflow-hidden",
                      activeSection === item.id 
                        ? "text-black font-bold shadow-lg shadow-gold/20" 
                        : "text-sky-100 hover:bg-sky-500/50 hover:text-gold"
                    )}
                  >
                    {activeSection === item.id && (
                      <motion.div 
                        layoutId="nav-bg-mobile" 
                        className="absolute inset-0 bg-gold"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon size={18} className={cn("relative z-10", activeSection === item.id ? "text-black" : "")} />
                    <span className="urdu-text text-sm truncate relative z-10">{item.label}</span>
                  </button>
                ))}
              </nav>
              <div className="p-4 border-t border-sky-500 bg-sky-900/30 space-y-2">
                <button
                  onClick={() => {
                    setActiveSection('settings');
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all",
                    activeSection === 'settings' 
                      ? "bg-white text-sky-900 font-black shadow-lg" 
                      : "text-sky-100 bg-sky-800/50 border border-white/10"
                  )}
                >
                  <SettingsIcon size={20} />
                  <span className="urdu-text text-base font-bold">{t.settings}</span>
                </button>
                <button 
                  onClick={() => {
                    setLang(lang === 'ur' ? 'en' : 'ur');
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-sky-800 text-sky-100 transition-all border border-sky-600 font-bold"
                >
                  <Languages size={20} />
                  <span className="text-base">{lang === 'ur' ? 'English' : 'اردو'}</span>
                </button>
                <div className="text-center pt-1">
                  <span className="text-[10px] text-sky-200/60 font-mono font-medium select-none">
                    v{APP_CONFIG.version}
                  </span>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-10 mt-16 lg:mt-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.995 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Toast Notification for back button exit */}
      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-900 border border-zinc-800 text-white rounded-full font-bold shadow-2xl flex items-center gap-2 z-[9999]"
          >
            <span className="text-gold">⚠️</span>
            <span className="urdu-text text-sm font-bold">{t.doubleBackExit}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding / Restore Dialog */}
      <AnimatePresence>
        {isOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 text-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button 
                  onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full text-xs font-bold transition-all"
                >
                  {lang === 'ur' ? 'English' : 'اردو'}
                </button>
              </div>

              <div className="flex flex-col items-center text-center space-y-6">
                <div className="p-4 bg-sky-500/10 text-sky-400 rounded-full border border-sky-500/20 animate-pulse">
                  <Cloud size={40} />
                </div>

                {onboardingStep === 'welcome' && (
                  <>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black text-white urdu-text">
                        {lang === 'ur' ? 'نفیس جیولرز میں خوش آمدید!' : 'Welcome to Nafees Jewellers!'}
                      </h2>
                      <p className="text-zinc-400 text-sm leading-relaxed urdu-text">
                        {lang === 'ur' 
                          ? 'ایسا لگتا ہے کہ یہ ایک نئی انسٹالیشن ہے۔ کیا آپ اپنے پچھلے گوگل ڈرائیو بیک اپ سے سارا ڈیٹا واپس لانا چاہتے ہیں؟' 
                          : 'It looks like this is a new installation. Would you like to check your Google Drive for a previous backup to restore?'}
                      </p>
                    </div>

                    {onboardingError && (
                      <p className="text-xs text-red-400 bg-red-400/10 border border-red-500/20 px-3 py-2 rounded-xl">
                        {onboardingError}
                      </p>
                    )}

                    <div className="flex flex-col w-full gap-3">
                      <button
                        onClick={handleOnboardingConnect}
                        className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-2xl transition-all shadow-lg"
                      >
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '20px', height: '20px' }}>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        </svg>
                        <span className="urdu-text">{lang === 'ur' ? 'ڈرائیو سے بحال کریں' : 'Restore from Google Drive'}</span>
                      </button>

                      <button
                        onClick={handleOnboardingFresh}
                        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-2xl transition-all"
                      >
                        <span className="urdu-text">{lang === 'ur' ? 'نیا کام شروع کریں' : 'Start Fresh'}</span>
                      </button>
                    </div>
                  </>
                )}

                {onboardingStep === 'checking' && (
                  <div className="flex flex-col items-center space-y-4 py-8">
                    <RefreshCw className="text-sky-500 animate-spin" size={40} />
                    <p className="text-zinc-300 font-bold urdu-text">
                      {lang === 'ur' ? 'گوگل ڈرائیو چیک ہو رہا ہے...' : 'Checking Google Drive for backups...'}
                    </p>
                  </div>
                )}

                {onboardingStep === 'found' && foundBackup && (
                  <>
                    <div className="space-y-2">
                      <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 inline-block mb-2">
                        <CheckCircle2 size={32} />
                      </div>
                      <h2 className="text-xl font-bold text-white urdu-text">
                        {lang === 'ur' ? 'پچھلا بیک اپ مل گیا!' : 'Previous Backup Found!'}
                      </h2>
                      <div className="p-4 bg-zinc-800/50 rounded-2xl text-xs text-zinc-300 space-y-1.5 text-left border border-zinc-800 font-mono">
                        <div>
                          <span className="text-zinc-500">Last Modified:</span>{' '}
                          {new Date(foundBackup.modifiedTime).toLocaleString(lang === 'ur' ? 'ur-PK' : 'en-US')}
                        </div>
                        <div>
                          <span className="text-zinc-500">File ID:</span>{' '}
                          <span className="text-sky-400">{foundBackup.id.slice(0, 12)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col w-full gap-3">
                      <button
                        onClick={handleOnboardingRestore}
                        className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl transition-all"
                      >
                        <span className="urdu-text">{lang === 'ur' ? 'ابھی بحال کریں' : 'Restore Now'}</span>
                      </button>

                      <button
                        onClick={handleOnboardingFresh}
                        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold rounded-2xl transition-all"
                      >
                        <span className="urdu-text">{lang === 'ur' ? 'رد کریں اور نیا شروع کریں' : 'Skip and Start Fresh'}</span>
                      </button>
                    </div>
                  </>
                )}

                {onboardingStep === 'not_found' && (
                  <>
                    <div className="space-y-2">
                      <div className="p-3 bg-zinc-800 text-zinc-400 rounded-full inline-block mb-2">
                        <AlertCircle size={32} />
                      </div>
                      <h2 className="text-xl font-bold text-white urdu-text">
                        {lang === 'ur' ? 'کوئی بیک اپ نہیں ملا' : 'No Backup Found'}
                      </h2>
                      <p className="text-zinc-400 text-sm urdu-text">
                        {lang === 'ur' 
                          ? 'آپ کے گوگل ڈرائیو پر نفیس جیولرز کا کوئی بیک اپ ریکارڈ نہیں ملا۔ آپ نیا کام شروع کر سکتے ہیں۔' 
                          : 'No Nafees Jewellers backup was found on your Google Drive. You can start fresh and auto-backups will be enabled.'}
                      </p>
                    </div>

                    <button
                      onClick={handleOnboardingFresh}
                      className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl transition-all"
                    >
                      <span className="urdu-text">{lang === 'ur' ? 'نیا کام شروع کریں' : 'Start Fresh'}</span>
                    </button>
                  </>
                )}

                {onboardingStep === 'success' && (
                  <div className="flex flex-col items-center space-y-4 py-8">
                    <CheckCircle2 className="text-emerald-500" size={48} />
                    <p className="text-zinc-300 font-black text-lg urdu-text">
                      {lang === 'ur' ? 'ڈیٹا کامیابی سے بحال ہو گیا!' : 'Data Restored Successfully!'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {lang === 'ur' ? 'ایپ خود بخود دوبارہ شروع ہو رہی ہے...' : 'Reloading application...'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
