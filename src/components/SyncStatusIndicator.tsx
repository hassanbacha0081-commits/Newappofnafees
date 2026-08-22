import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { subscribeSyncStatus, runFullSync, type SyncEngineStatus } from '../lib/syncEngine';

interface SyncStatusIndicatorProps {
  lang: 'ur' | 'en';
  onOpenSettings?: () => void;
}

export default function SyncStatusIndicator({ lang, onOpenSettings }: SyncStatusIndicatorProps) {
  const isUrdu = lang === 'ur';

  const [status, setStatus] = useState<SyncEngineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isAuthenticated: false,
    currentUser: null,
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

  useEffect(() => {
    const unsub = subscribeSyncStatus(setStatus);
    return () => unsub();
  }, []);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!status.isAuthenticated) {
      onOpenSettings?.();
      return;
    }
    await runFullSync();
  };

  return (
    <button
      onClick={handleManualSync}
      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
        !status.isAuthenticated
          ? 'bg-zinc-800/40 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
          : status.isSyncing
          ? 'bg-sky-600/80 border-sky-400 text-white'
          : status.pendingCount > 0
          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30'
          : 'bg-emerald-600/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-600/30'
      }`}
      title={
        isUrdu
          ? status.isAuthenticated
            ? status.isSyncing
              ? 'کلاؤڈ ہم آہنگی جاری ہے...'
              : `کلاؤڈ سنک فعال (${status.pendingCount} زیر التواء) - کلک کر کے سنک کریں`
            : 'کلاؤڈ سنک غیر فعال - سیٹنگز میں لاگ ان کریں'
          : status.isAuthenticated
          ? status.isSyncing
            ? 'Syncing with Cloud...'
            : `Cloud Synced (${status.pendingCount} pending) - Click to sync now`
          : 'Cloud Sync Offline - Click to configure in Settings'
      }
    >
      {status.isSyncing ? (
        <RefreshCw size={14} className="animate-spin text-sky-200" />
      ) : !status.isOnline ? (
        <CloudOff size={14} className="text-red-400" />
      ) : !status.isAuthenticated ? (
        <CloudOff size={14} className="text-zinc-400" />
      ) : status.pendingCount > 0 ? (
        <Cloud size={14} className="text-amber-300 animate-pulse" />
      ) : (
        <CheckCircle2 size={14} className="text-emerald-400" />
      )}

      <span className="hidden sm:inline urdu-text font-bold text-[11px]">
        {!status.isOnline
          ? isUrdu ? 'آف لائن' : 'Offline'
          : !status.isAuthenticated
          ? isUrdu ? 'کلاؤڈ غیر مربوط' : 'Cloud Offline'
          : status.isSyncing
          ? isUrdu ? 'ہم آہنگی...' : 'Syncing...'
          : status.pendingCount > 0
          ? `${status.pendingCount} ${isUrdu ? 'زیر التواء' : 'Pending'}`
          : isUrdu ? 'کلاؤڈ فعال' : 'Synced'}
      </span>
    </button>
  );
}
