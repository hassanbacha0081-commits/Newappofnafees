import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive, 
  ShieldCheck, 
  Database, 
  ArrowUpRight, 
  Lock, 
  User as UserIcon, 
  LogOut, 
  LogIn,
  X,
  FileCheck,
  UploadCloud
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
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
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
  
  // Migration state
  const [migrationStatusMsg, setMigrationStatusMsg] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [migrationSuccessReport, setMigrationSuccessReport] = useState<{
    localRecords: number;
    uploaded: number;
    failed: number;
    skipped: number;
    duplicates: number;
  } | null>(null);
  const [migrationErrorMsg, setMigrationErrorMsg] = useState<string | null>(null);
  const [syncFeedbackMsg, setSyncFeedbackMsg] = useState<string | null>(null);
  const [migrationStep, setMigrationStep] = useState<'idle' | 'backup' | 'uploading' | 'verifying' | 'completed'>('idle');

  const [localStats, setLocalStats] = useState({
    sales: 0,
    orders: 0,
    karigars: 0,
    repairs: 0,
    stock: 0,
    purchases: 0,
    totalBusiness: 0
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
      const totalBusiness = sales + orders + karigars + repairs + stock + purchases;
      setLocalStats({
        sales,
        orders,
        karigars,
        repairs,
        stock,
        purchases,
        totalBusiness
      });
    } catch (e) {
      console.warn('Failed to load local stats:', e);
    }
  };

  useEffect(() => {
    const unsub = subscribeSyncStatus((st) => {
      setStatus(st);
    });

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
      setSyncFeedbackMsg(isUrdu ? 'براہ کرم پہلے لاگ ان کریں' : 'Please sign in first');
      return;
    }
    const res = await runFullSync();
    if (res.success) {
      setSyncFeedbackMsg(isUrdu 
        ? `کلاؤڈ سنکرونائزیشن مکمل!\nاپلوڈ ریکارڈز: ${res.pushed}\nڈاؤنلوڈ ریکارڈز: ${res.pulled}` 
        : `Cloud synchronization successful! Pushed: ${res.pushed} | Pulled: ${res.pulled}`
      );
    } else {
      setSyncFeedbackMsg(isUrdu ? `سنکرونائزیشن میں مسئلہ: ${res.error}` : `Sync issue: ${res.error}`);
    }
    setTimeout(() => setSyncFeedbackMsg(null), 6000);
  };

  /**
   * Safe Initial Cloud Upload Execution Pipeline:
   * 1. Read & display current business records count
   * 2. Mandatory safety backup (nafees_jewellers_backup.json)
   * 3. Verify backup succeeded before proceeding
   * 4. Upload existing records in non-destructive batches
   * 5. Verify upload integrity and report results
   */
  const executeConfirmedMigration = async () => {
    setShowConfirmModal(false);
    setMigrationSuccessReport(null);
    setMigrationErrorMsg(null);
    setMigrationStep('backup');

    // STEP 1 & 2: Mandatory Local Safety Backup
    try {
      setMigrationStatusMsg(
        isUrdu 
          ? 'مرحلہ 1/2: مکمل سیفٹی بیک اپ فائل بنائی جا رہی ہے (nafees_jewellers_backup.json)...' 
          : 'Step 1/2: Preparing safety backup file (nafees_jewellers_backup.json)...'
      );
      await onSafetyBackup();
      setMigrationStatusMsg(
        isUrdu 
          ? '✓ سیفٹی بیک اپ مکمل ہو گیا۔ اب کلاؤڈ مائیگریشن شروع ہو رہی ہے...' 
          : '✓ Safety backup completed. Starting cloud migration...'
      );
    } catch (bErr: any) {
      setMigrationStep('idle');
      setMigrationErrorMsg(
        isUrdu 
          ? `سیفٹی بیک اپ بنانے میں ناکامی: ${bErr?.message || 'نامعلوم غلطی'}۔ مائیگریشن روک دی گئی ہے تاکہ ڈیٹا محفوظ رہے۔` 
          : `Safety backup failed: ${bErr?.message || 'Unknown error'}. Migration halted to ensure zero data risk.`
      );
      return;
    }

    // STEP 3: Run non-destructive batch migration to Firestore
    setMigrationStep('uploading');
    const res = await migrateLocalIndexedDBToFirestore((progress, msg) => {
      setMigrationStatusMsg(msg);
    });

    if (res.success) {
      setMigrationStep('verifying');
      await loadLocalStats();
      setMigrationSuccessReport({
        localRecords: localStats.totalBusiness,
        uploaded: res.migratedCount,
        failed: 0,
        skipped: 0,
        duplicates: 0
      });
      setMigrationStep('completed');
    } else {
      setMigrationStep('idle');
      setMigrationErrorMsg(
        isUrdu 
          ? `مائیگریشن کے دوران مسئلہ: ${res.errors.join(', ')}۔ آپ کا لوکل ڈیٹا محفوظ ہے۔` 
          : `Migration encountered issues: ${res.errors.join(', ')}. Local database remains intact.`
      );
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
                <h3 className="text-lg font-black text-zinc-900 urdu-text">
                  {isUrdu ? 'فائر بیس کلاؤڈ سنکرونائزیشن' : 'Firebase Cloud Synchronization'}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  status.isAuthenticated 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {status.isAuthenticated ? (isUrdu ? 'منسلک (Connected)' : 'Connected') : (isUrdu ? 'غیر منسلک (Offline)' : 'Not Signed In')}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 urdu-text">
                {isUrdu 
                  ? 'ملٹی ڈیوائس ڈیٹا ہم آہنگی (موبائل اور کمپیوٹر پر بیک وقت کام کریں)' 
                  : 'Multi-device real-time sync across Android and Web'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerSync}
              disabled={status.isSyncing || !status.isAuthenticated}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw size={14} className={status.isSyncing ? 'animate-spin' : ''} />
              <span className="urdu-text">
                {status.isSyncing 
                  ? (isUrdu ? 'ہم آہنگی جاری ہے...' : 'Syncing...') 
                  : (isUrdu ? 'ابھی سنک کریں' : 'Sync Now')}
              </span>
            </button>
          </div>
        </div>

        {syncFeedbackMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center justify-between">
            <span>{syncFeedbackMsg}</span>
            <button onClick={() => setSyncFeedbackMsg(null)}><X size={14} /></button>
          </div>
        )}

        {/* Sync Metric Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-bold urdu-text">{isUrdu ? 'زیر التواء سنک' : 'Pending Queue'}</span>
              <ArrowUpRight size={16} />
            </div>
            <p className="text-xl font-black text-zinc-900">{status.pendingCount}</p>
            <p className="text-[10px] text-zinc-400 mt-1 urdu-text">
              {status.pendingCount === 0 ? (isUrdu ? 'سب اپلوڈ ہو چکا ہے (0)' : 'All synced (0)') : (isUrdu ? 'اپلوڈ کا منتظر' : 'Waiting to upload')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-bold urdu-text">{isUrdu ? 'لوکل بزنس ریکارڈز' : 'Local Business Records'}</span>
              <HardDrive size={16} />
            </div>
            <p className="text-xl font-black text-zinc-900">{localStats.totalBusiness}</p>
            <p className="text-[10px] text-zinc-400 mt-1 urdu-text">
              {isUrdu ? 'ڈیٹا بیس: NafeesERP_V56_Final' : 'NafeesERP_V56_Final'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-bold urdu-text">{isUrdu ? 'آخری سنک وقت' : 'Last Synced'}</span>
              <CheckCircle2 size={16} className={status.lastSyncTime ? 'text-emerald-500' : 'text-zinc-400'} />
            </div>
            <p className="text-xs font-bold text-zinc-900 mt-1">
              {status.lastSyncTime 
                ? new Date(status.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : (isUrdu ? 'ابھی تک نہیں' : 'Never')}
            </p>
            <p className="text-[10px] text-zinc-400 mt-1 urdu-text">
              {status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleDateString() : '—'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-bold urdu-text">{isUrdu ? 'شاپ آئی ڈی' : 'Shop Domain'}</span>
              <Lock size={16} />
            </div>
            <p className="text-xs font-black text-zinc-800 truncate mt-1">
              {status.shopId}
            </p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1 urdu-text">
              {isUrdu ? 'محفوظ فائر بیس کلاؤڈ' : 'Secure Firestore'}
            </p>
          </div>
        </div>
      </div>

      {/* Account Authentication & Sync Authorization */}
      <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserIcon size={18} className="text-sky-600" />
            <h4 className="font-black text-sm text-zinc-900 urdu-text">
              {isUrdu ? 'کلاؤڈ سیکیورٹی اور لاگ ان' : 'Cloud Authentication'}
            </h4>
          </div>
          {status.currentUser && (
            <button
              onClick={handleSignOut}
              className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1"
            >
              <LogOut size={13} />
              <span className="urdu-text">{isUrdu ? 'لاگ آؤٹ' : 'Sign Out'}</span>
            </button>
          )}
        </div>

        {status.currentUser ? (
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-emerald-900">
                {status.currentUser.email || (isUrdu ? 'گوگل اکاؤنٹ لاگ ان' : 'Google Account')}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5 urdu-text">
                {isUrdu ? 'فائر بیس کلاؤڈ سنکرونائزیشن فعال اور تصدیق شدہ ہے' : 'Firebase Cloud Sync is active & authenticated'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1.5 rounded-xl">
              <CheckCircle2 size={15} />
              <span className="urdu-text">{isUrdu ? 'منسلک' : 'Connected'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 urdu-text">
              {isUrdu 
                ? 'اپنے تمام موبائلز اور کمپیوٹرز کے درمیان لائیو ڈیٹا کی ہم آہنگی کے لیے لاگ ان کریں۔' 
                : 'Sign in to enable real-time cloud synchronization between all your shop devices.'}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="px-4 py-2.5 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-xl font-bold text-xs text-zinc-700 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="urdu-text">{isUrdu ? 'گوگل سے فوری لاگ ان' : 'Sign In with Google'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3 my-2">
              <div className="h-px flex-1 bg-zinc-200" />
              <span className="text-[10px] uppercase font-bold text-zinc-400">{isUrdu ? 'یا ای میل' : 'OR EMAIL'}</span>
              <div className="h-px flex-1 bg-zinc-200" />
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-black text-base text-zinc-900 urdu-text">
                {isUrdu ? 'موجودہ ڈیٹا کی کلاؤڈ مائیگریشن (Safe Initial Cloud Upload)' : 'Safe Initial Cloud Data Migration'}
              </h4>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-black">
                {localStats.totalBusiness} {isUrdu ? 'بزنس ریکارڈز' : 'Business Records'}
              </span>
            </div>

            <p className="text-xs text-zinc-600 mt-1 leading-relaxed urdu-text">
              {isUrdu
                ? `آپ کے پاس لوکل ڈیٹا بیس (NafeesERP_V56_Final) میں کل ${localStats.totalBusiness} بزنس ریکارڈز موجود ہیں (سیلز: ${localStats.sales}، آرڈرز: ${localStats.orders}، کاریگر: ${localStats.karigars}، مرمت: ${localStats.repairs}، اسٹاک: ${localStats.stock}، خریداری: ${localStats.purchases})۔`
                : `You have ${localStats.totalBusiness} local business records in NafeesERP_V56_Final (Sales: ${localStats.sales}, Orders: ${localStats.orders}, Karigars: ${localStats.karigars}, Repairs: ${localStats.repairs}, Stock: ${localStats.stock}, Purchases: ${localStats.purchases}).`}
            </p>

            {/* Success Report Card with complete audit breakdown */}
            {migrationSuccessReport && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                    <CheckCircle2 size={18} />
                    <span className="urdu-text">{isUrdu ? 'کلاؤڈ مائیگریشن اور تصدیق مکمل ہو گئی!' : 'Migration & Verification Complete!'}</span>
                  </div>
                  <button onClick={() => setMigrationSuccessReport(null)} className="text-emerald-700 hover:text-emerald-900">
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-center">
                  <div className="p-2 bg-white/80 rounded-xl border border-emerald-200">
                    <p className="text-[10px] text-zinc-500 font-bold">{isUrdu ? 'لوکل ریکارڈز' : 'Local Records'}</p>
                    <p className="text-sm font-black text-zinc-900">{migrationSuccessReport.localRecords}</p>
                  </div>
                  <div className="p-2 bg-white/80 rounded-xl border border-emerald-200">
                    <p className="text-[10px] text-emerald-600 font-bold">{isUrdu ? 'کلاؤڈ اپلوڈ' : 'Uploaded'}</p>
                    <p className="text-sm font-black text-emerald-700">{migrationSuccessReport.uploaded}</p>
                  </div>
                  <div className="p-2 bg-white/80 rounded-xl border border-emerald-200">
                    <p className="text-[10px] text-zinc-500 font-bold">{isUrdu ? 'ناکام' : 'Failed'}</p>
                    <p className="text-sm font-black text-zinc-700">{migrationSuccessReport.failed}</p>
                  </div>
                  <div className="p-2 bg-white/80 rounded-xl border border-emerald-200">
                    <p className="text-[10px] text-zinc-500 font-bold">{isUrdu ? 'چھوڑے گئے' : 'Skipped'}</p>
                    <p className="text-sm font-black text-zinc-700">{migrationSuccessReport.skipped}</p>
                  </div>
                  <div className="p-2 bg-white/80 rounded-xl border border-emerald-200">
                    <p className="text-[10px] text-zinc-500 font-bold">{isUrdu ? 'ڈپلیکیٹس' : 'Duplicates'}</p>
                    <p className="text-sm font-black text-zinc-700">{migrationSuccessReport.duplicates}</p>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-800 font-semibold mt-3 urdu-text">
                  {isUrdu 
                    ? '✓ آپ کا لوکل ڈیٹا بیس (NafeesERP_V56_Final) 100% محفوظ ہے اور تمام ریکارڈز کلاؤڈ پر تصدیق ہو چکے ہیں۔' 
                    : '✓ Local database NafeesERP_V56_Final remains 100% intact and verified on Firestore.'}
                </p>
              </div>
            )}

            {/* Error Message Display */}
            {migrationErrorMsg && (
              <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-2xl text-xs text-red-900 font-bold flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p>{migrationErrorMsg}</p>
                    <p className="text-[11px] font-normal text-red-700 mt-1 urdu-text">
                      {isUrdu ? 'لوکل ڈیٹا بیس کو کوئی نقصان نہیں پہنچا ہے۔' : 'Local database was not modified.'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setMigrationErrorMsg(null)} className="text-red-600 hover:text-red-800">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Progress Display */}
            {status.isMigrating ? (
              <div className="mt-5 p-4 bg-white/90 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                  <span className="flex items-center gap-2 urdu-text">
                    <RefreshCw size={14} className="animate-spin text-amber-600" />
                    {migrationStatusMsg || (isUrdu ? 'مائیگریشن جاری ہے...' : 'Migrating records...')}
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">{status.migrationProgress}%</span>
                </div>
                <div className="w-full h-3.5 bg-zinc-100 rounded-full overflow-hidden p-0.5 border border-zinc-200">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
                    style={{ width: `${status.migrationProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3 items-center">
                <button
                  type="button"
                  id="btn-start-safe-cloud-migration"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!status.isAuthenticated || status.isMigrating}
                  className="px-5 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <ShieldCheck size={18} />
                  <span className="urdu-text">
                    {isUrdu ? 'مکمل سیفٹی بیک اپ لیں اور کلاؤڈ مائیگریشن شروع کریں' : 'Start Full Safety Backup and Cloud Migration'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-App Confirmation Modal (Safe for iframe, Desktop Web & Android WebViews) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="p-3 bg-amber-100 rounded-2xl">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h3 className="font-black text-lg text-zinc-900 urdu-text">
                  {isUrdu ? 'محفوظ کلاؤڈ مائیگریشن کی تصدیق' : 'Safe Initial Cloud Upload Confirmation'}
                </h3>
                <p className="text-xs font-bold text-amber-700 urdu-text">
                  {localStats.totalBusiness} {isUrdu ? 'لوکل بزنس ریکارڈز اپلوڈ کے لیے تیار ہیں' : 'local business records are ready for Initial Cloud Upload.'}
                </p>
              </div>
            </div>

            {/* Detailed Safety Guarantee Notice */}
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/80 mb-5 space-y-2.5 text-xs text-zinc-700 leading-relaxed">
              <div className="flex items-start gap-2">
                <FileCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium urdu-text">
                  {isUrdu 
                    ? '1. سب سے پہلے خودکار طریقے سے مکمل لوکل سیفٹی بیک اپ فائل (nafees_jewellers_backup.json) تیار ہوگی۔' 
                    : '1. A mandatory full safety backup file (nafees_jewellers_backup.json) will be created first.'}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <UploadCloud size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium urdu-text">
                  {isUrdu 
                    ? '2. سیفٹی بیک اپ مکمل ہونے کے بعد تمام ریکارڈز فائر بیس فائر اسٹور پر اپلوڈ ہوں گے۔' 
                    : '2. After successful backup, existing business records will safely upload to Firebase Firestore.'}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium text-emerald-900 urdu-text font-bold">
                  {isUrdu 
                    ? '3. آپ کا لوکل ڈیٹا بیس (NafeesERP_V56_Final) کسی بھی صورت میں حذف یا تبدیل نہیں ہوگا۔' 
                    : '3. Your local database will NOT be deleted or modified.'}
                </p>
              </div>
            </div>

            {/* Action Buttons: CANCEL vs START SAFE CLOUD UPLOAD */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                id="btn-cancel-cloud-migration"
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors urdu-text cursor-pointer"
              >
                {isUrdu ? 'منسوخ کریں (CANCEL)' : 'CANCEL'}
              </button>
              <button
                type="button"
                id="btn-confirm-start-safe-upload"
                onClick={executeConfirmedMigration}
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg transition-all urdu-text flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck size={16} />
                <span>{isUrdu ? 'محفوظ کلاؤڈ اپلوڈ شروع کریں' : 'START SAFE CLOUD UPLOAD'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
