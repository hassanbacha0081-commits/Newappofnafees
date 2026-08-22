import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive, 
  ShieldCheck, 
  Database, 
  Smartphone, 
  Monitor, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lock, 
  User as UserIcon, 
  LogOut, 
  LogIn 
} from 'lucide-react';
import { db } from '../db';
import { 
  subscribeSyncStatus, 
  runFullSync, 
  migrateLocalIndexedDBToFirestore, 
  type SyncEngineStatus 
} from '../lib/syncEngine';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

interface CloudSyncManagerProps {
  lang: 'ur' | 'en';
  onSafetyBackup: () => Promise<void>;
}

export default function CloudSyncManager({ lang, onSafetyBackup }: CloudSyncManagerProps) {
  const isUrdu = lang === 'ur';

  const [status, setStatus] = useState<SyncEngineStatus>({
    isOnline: navigator.onLine,
    isAuthenticated: !!auth.currentUser,
    currentUser: auth.currentUser,
    shopId: 'nafees_jewellers_main',
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    lastSyncError: null,
    conflictCount: 0,
    migratedRecordsCount: 0,
    isMigrating: false,
    migrationProgress: 0,
  });

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [migrationStatusMsg, setMigrationStatusMsg] = useState('');
  const [localStats, setLocalStats] = useState({
    sales: 0,
    orders: 0,
    karigars: 0,
    repairs: 0,
    stock: 0,
    purchases: 0,
    total: 0
  });

  useEffect(() => {
    const unsub = subscribeSyncStatus((st) => {
      setStatus(st);
    });

    const loadLocalStats = async () => {
      try {
        const [sales, orders, karigars, repairs, stock, purchases] = await Promise.all([
          db.sales.count(),
          db.orders.count(),
          db.karigars.count(),
          db.repairs.count(),
          db.stock.count(),
          db.goldPurchases.count()
        ]);
        setLocalStats({
          sales,
          orders,
          karigars,
          repairs,
          stock,
          purchases,
          total: sales + orders + karigars + repairs + stock + purchases
        });
      } catch (e) {}
    };

    loadLocalStats();
    return () => unsub();
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, emailInput, passwordInput);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          // Attempt auto-register if first time
          await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        } catch (regErr: any) {
          setAuthError(regErr.message || 'Authentication error');
        }
      } else {
        setAuthError(err.message || 'Authentication error');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setAuthError(err.message || 'Google sign-in error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
  };

  const handleTriggerSync = async () => {
    if (!status.isAuthenticated) {
      alert(isUrdu ? 'براہ کرم پہلے لاگ ان کریں' : 'Please sign in first');
      return;
    }
    const res = await runFullSync();
    if (res.success) {
      alert(isUrdu 
        ? `کلاؤڈ سنکرونائزیشن مکمل!\nاپلوڈ ریکارڈز: ${res.pushed}\nڈاؤنلوڈ ریکارڈز: ${res.pulled}` 
        : `Cloud synchronization successful!\nPushed: ${res.pushed} | Pulled: ${res.pulled}`
      );
    } else {
      alert(isUrdu ? `سنکرونائزیشن میں مسئلہ: ${res.error}` : `Sync issue: ${res.error}`);
    }
  };

  const handleStartMigration = async () => {
    const confirm = window.confirm(
      isUrdu
        ? `کیا آپ موجودہ تمام لوکل ریکارڈز (${localStats.total}) کو محفوظ طریقے سے فائر بیس کلاؤڈ پر منتقل کرنا چاہتے ہیں؟\n\nاس سے پہلے آپ کے ڈیٹا کا سیفٹی بیک اپ ڈاؤنلوڈ کیا جائے گا۔`
        : `Do you want to migrate all ${localStats.total} local records safely to Firebase Firestore?\n\nA complete safety backup will be downloaded first.`
    );
    if (!confirm) return;

    // 1. Mandatory Safety Backup
    try {
      setMigrationStatusMsg(isUrdu ? 'سیفٹی بیک اپ بنایا جا رہا ہے...' : 'Creating mandatory safety backup...');
      await onSafetyBackup();
    } catch (bErr) {
      alert(isUrdu ? 'بیک اپ بنانے میں ناکامی، مائیگریشن روک دی گئی ہے' : 'Safety backup failed, migration halted');
      return;
    }

    // 2. Run non-destructive batch migration
    const res = await migrateLocalIndexedDBToFirestore((progress, msg) => {
      setMigrationStatusMsg(msg);
    });

    if (res.success) {
      alert(isUrdu 
        ? `مبارک ہو! تمام ${res.migratedCount} ریکارڈز کلاؤڈ پر کامیابی سے اپلوڈ ہو گئے۔ اب آپ موبائل اور کمپیوٹر دونوں جگہ حقیقی وقت میں کام کر سکتے ہیں۔` 
        : `Success! All ${res.migratedCount} records safely migrated to Firebase Firestore.`
      );
    } else {
      alert(isUrdu ? `مائیگریشن کے دوران کچھ غلطیاں ہوئیں: ${res.errors.join(', ')}` : `Migration errors: ${res.errors.join(', ')}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cloud Status Overview Card */}
      <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${status.isAuthenticated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Cloud size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-zinc-900 urdu-text">
                  {isUrdu ? 'کلاؤڈ سنکرونائزیشن (Firebase Firestore)' : 'Cloud Synchronization (Firebase)'}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  status.isAuthenticated 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {status.isAuthenticated ? (isUrdu ? 'مربوط' : 'Connected') : (isUrdu ? 'غیر مربوط' : 'Not Connected')}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 urdu-text">
                {isUrdu 
                  ? 'موبائل اور کمپیوٹر کے درمیان خودکار ڈیٹا کی ہم آہنگی اور لائیو بیک اپ' 
                  : 'Real-time multi-device database sync across Android and Web'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerSync}
              disabled={status.isSyncing || !status.isAuthenticated}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw size={15} className={status.isSyncing ? 'animate-spin' : ''} />
              <span className="urdu-text">{status.isSyncing ? (isUrdu ? 'ہم آہنگی جاری ہے...' : 'Syncing...') : (isUrdu ? 'ابھی ہم آہنگ کریں (Sync Now)' : 'Sync Now')}</span>
            </button>
          </div>
        </div>

        {/* Status Indicators Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold mb-1">
              <HardDrive size={14} />
              <span className="urdu-text">{isUrdu ? 'لوکل ڈیٹا بیس' : 'Local IndexedDB'}</span>
            </div>
            <p className="text-lg font-black text-zinc-900">{localStats.total.toLocaleString()} <span className="text-xs font-normal text-zinc-500">{isUrdu ? 'ریکارڈز' : 'records'}</span></p>
            <span className="text-[10px] text-emerald-600 font-bold">NafeesERP_V56_Final</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold mb-1">
              <ArrowUpRight size={14} className={status.pendingCount > 0 ? 'text-amber-500' : 'text-zinc-400'} />
              <span className="urdu-text">{isUrdu ? 'زیر التواء سنک' : 'Pending Queue'}</span>
            </div>
            <p className={`text-lg font-black ${status.pendingCount > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
              {status.pendingCount}
            </p>
            <span className="text-[10px] text-zinc-500">{status.pendingCount === 0 ? (isUrdu ? 'تمام اپ ٹو ڈیٹ' : 'All up to date') : (isUrdu ? 'قطار میں موجود' : 'In queue')}</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold mb-1">
              <Smartphone size={14} />
              <span className="urdu-text">{isUrdu ? 'نیٹ ورک حالت' : 'Network'}</span>
            </div>
            <p className="text-sm font-black text-zinc-900 flex items-center gap-1.5 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${status.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {status.isOnline ? (isUrdu ? 'آن لائن' : 'Online') : (isUrdu ? 'آف لائن (لوکل کام جاری)' : 'Offline')}
            </p>
            <span className="text-[10px] text-zinc-500">{isUrdu ? 'آف لائن سب کچھ محفوظ رہے گا' : 'Full offline support'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold mb-1">
              <CheckCircle2 size={14} />
              <span className="urdu-text">{isUrdu ? 'آخری سنک' : 'Last Sync'}</span>
            </div>
            <p className="text-xs font-black text-zinc-900 mt-1">
              {status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleTimeString() : (isUrdu ? 'ابھی نہیں' : 'Never')}
            </p>
            <span className="text-[10px] text-zinc-500">
              {status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleDateString() : '-'}
            </span>
          </div>
        </div>

        {/* Error notification if any */}
        {status.lastSyncError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-xs">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span>{status.lastSyncError}</span>
          </div>
        )}
      </div>

      {/* Account Authentication & Shop Connection */}
      <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
        <h4 className="font-black text-base text-zinc-900 mb-2 urdu-text">
          {isUrdu ? 'کلاؤڈ سائن ان و سیکیورٹی' : 'Cloud Authentication & Shop Access'}
        </h4>
        <p className="text-xs text-zinc-500 mb-6 urdu-text">
          {isUrdu 
            ? 'اپنے فائر بیس اکاؤنٹ سے لاگ ان کریں تاکہ تمام ڈیوائسز ایک ہی کلاؤڈ ڈیٹا بیس سے منسلک ہو سکیں۔' 
            : 'Sign in to access and sync with your central business database.'}
        </p>

        {status.isAuthenticated && status.currentUser ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold">
                {status.currentUser.email ? status.currentUser.email[0].toUpperCase() : 'U'}
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900">{status.currentUser.email || status.currentUser.displayName || 'Authenticated User'}</p>
                <p className="text-xs text-emerald-700 font-mono">Shop ID: {status.shopId}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <LogOut size={14} />
              <span className="urdu-text">{isUrdu ? 'لاگ آؤٹ' : 'Sign Out'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full sm:w-auto px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <LogIn size={15} />
              <span className="urdu-text">{isUrdu ? 'Google اکاؤنٹ کے ساتھ سائن ان کریں' : 'Sign in with Google Account'}</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-200"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-zinc-400">{isUrdu ? 'یا ای میل و پاس ورڈ' : 'or Email & Password'}</span>
              <div className="flex-grow border-t border-zinc-200"></div>
            </div>

            <form onSubmit={handleEmailSignIn} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="email"
                placeholder="email@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
              <button
                type="submit"
                disabled={authLoading}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <LogIn size={14} />
                <span className="urdu-text">{authLoading ? (isUrdu ? 'پروسیسنگ...' : 'Processing...') : (isUrdu ? 'لاگ ان / رجسٹر' : 'Sign In / Register')}</span>
              </button>
            </form>

            {authError && (
              <p className="text-xs text-red-600 font-bold">{authError}</p>
            )}
          </div>
        )}
      </div>

      {/* Safe Existing Data Migration Tool */}
      <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-3xl p-6 border border-amber-200 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-500 text-white flex-shrink-0">
            <Database size={24} />
          </div>
          <div className="flex-1">
            <h4 className="font-black text-base text-zinc-900 urdu-text">
              {isUrdu ? 'موجودہ ڈیٹا کی کلاؤڈ مائیگریشن (Safe Initial Cloud Upload)' : 'Safe Initial Cloud Data Migration'}
            </h4>
            <p className="text-xs text-zinc-600 mt-1 leading-relaxed urdu-text">
              {isUrdu
                ? `آپ کے پاس لوکل ڈیٹا بیس میں کل ${localStats.total} ریکارڈز موجود ہیں۔ یہ ٹول بغیر کسی لوکل ریکارڈ کو مٹائے یا تبدیل کیے، تمام ڈیٹا کو فائر بیس کلاؤڈ پر محفوظ طریقے سے اپلوڈ کرتا ہے۔`
                : `You currently have ${localStats.total} local records stored in IndexedDB. This safe migration uploads your complete business history to Firestore without altering local records.`}
            </p>

            {status.isMigrating ? (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-bold text-zinc-700">
                  <span className="urdu-text">{migrationStatusMsg || (isUrdu ? 'مائیگریشن جاری ہے...' : 'Migrating...')}</span>
                  <span>{status.migrationProgress}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-600 rounded-full transition-all duration-300"
                    style={{ width: `${status.migrationProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3 items-center">
                <button
                  onClick={handleStartMigration}
                  disabled={!status.isAuthenticated || status.isMigrating}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-sm transition-all"
                >
                  <ShieldCheck size={16} />
                  <span className="urdu-text">
                    {isUrdu ? 'مکمل سیفٹی بیک اپ لیں اور کلاؤڈ مائیگریشن شروع کریں' : 'Backup & Migrate All Records to Cloud'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
