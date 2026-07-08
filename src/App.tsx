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
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, type Language } from './translations';
import { cn } from './lib/utils';
import { db, type Sale } from './db';
import { App as CapApp } from '@capacitor/app';

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

import { APP_CONFIG } from './config';

type Section = 'billing' | 'purchases' | 'records' | 'orders' | 'karigar' | 'repairs' | 'stock' | 'customers' | 'expenses' | 'reports' | 'settings';

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
  const [isLoading, setIsLoading] = useState(true);
  
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
      
      if (rate) setGoldRate(rate.value);
      if (name) setShopName(name.value);
      if (address) setShopAddress(address.value);
      if (phone) setShopPhone(phone.value);
      if (phone2) setShopPhone2(phone2.value);
      if (pin && pin.value) {
        setAppPin(pin.value);
        setIsLocked(true);
      }
      
      setTimeout(() => setIsLoading(false), 1000);
    };
    fetchSettings();
  }, []);

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
      case 'reports': return <Reports lang={lang} />;
      case 'settings': return <Settings lang={lang} setGoldRate={setGoldRate} setLang={setLang} />;
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
      <LockScreen 
        lang={lang} 
        correctPin={appPin} 
        shopName={shopName}
        onUnlock={() => setIsLocked(false)} 
      />
    );
  }

  return (
    <div className={cn(
      "min-h-screen bg-sky-200 text-zinc-900 flex",
      isRTL ? "flex-row-reverse text-right" : "flex-row text-left"
    )} dir={isRTL ? "rtl" : "ltr"}>
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
                  ? "bg-gold text-black shadow-lg shadow-gold/20 font-bold" 
                  : "text-sky-100 hover:bg-sky-500 hover:text-gold"
              )}
            >
              {activeSection === item.id && (
                <motion.div layoutId="nav-bg" className="absolute inset-0 bg-gold" />
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
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all",
                      activeSection === item.id 
                        ? "bg-gold text-black font-bold shadow-lg shadow-gold/20" 
                        : "text-sky-100 hover:bg-sky-500 hover:text-gold"
                    )}
                  >
                    <item.icon size={18} />
                    <span className="urdu-text text-sm truncate">{item.label}</span>
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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
    </div>
  );
}
