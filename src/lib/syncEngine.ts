import React from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  writeBatch, 
  query, 
  where, 
  onSnapshot, 
  type Unsubscribe, 
  type DocumentData 
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { firestore, auth } from './firebase';
import { db } from '../db';
import { compressImage } from './utils';

// Business & Device Identity Configuration
export const DEFAULT_SHOP_ID = 'nafees_jewellers_main';

export const getDeviceId = (): string => {
  let id = localStorage.getItem('nafees_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('nafees_device_id', id);
  }
  return id;
};

// Generate UUID v4 for distributed record identities
export const generateSyncId = (): string => {
  return 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
};

// Map Dexie table names to Firestore collection names
export const TABLE_COLLECTIONS: Record<string, string> = {
  sales: 'sales',
  orders: 'orders',
  karigars: 'karigars',
  repairs: 'repairs',
  stock: 'stock',
  goldPurchases: 'goldPurchases',
  expenses: 'expenses',
  contacts: 'contacts',
  khaataAccounts: 'khaataAccounts',
  khaataEntries: 'khaataEntries',
  settings: 'settings',
};

// Core Business Tables for Sync
export const SYNC_TABLES = [
  'sales',
  'orders',
  'karigars',
  'repairs',
  'stock',
  'goldPurchases',
  'expenses',
  'contacts',
  'khaataAccounts',
  'khaataEntries',
  'settings'
] as const;

export type SyncTable = typeof SYNC_TABLES[number];

/**
 * Excluded ephemeral and local runtime settings keys.
 * These keys must NEVER enter the Firestore sync queue.
 */
export const EXCLUDED_SETTING_KEYS = new Set([
  'lastCloudSyncTimestamp',
  'lastCloudSyncDate',
  'lastCloudSyncTime',
  'lastDriveBackupDate',
  'lastAutoBackupTime',
  'googleDriveConnected',
  'googleDriveAccessToken',
  'googleDriveUserEmail',
  'googleDriveUserName',
  'googleDriveTokenExpiry',
  'hasBeenInitialized',
  'migrationCompleted',
  'deviceSyncId',
  'localDeviceId',
  'lastBackupDate',
  'lastBackupTime',
  'activeSection',
  'paletteId',
  'lang'
]);

export const isExcludedSettingKey = (key: string | undefined | null): boolean => {
  if (!key || typeof key !== 'string') return false;
  if (EXCLUDED_SETTING_KEYS.has(key)) return true;
  if (
    key.startsWith('lastCloudSync') || 
    key.startsWith('lastDrive') || 
    key.startsWith('lastAuto') || 
    key.startsWith('googleDrive') ||
    key.startsWith('local_') ||
    key.startsWith('temp_') ||
    key.startsWith('sync_') ||
    key.startsWith('device_')
  ) {
    return true;
  }
  return false;
};

/**
 * Robust Remote Sync Execution Context
 * Prevents Firestore -> Dexie writes from triggering local Dexie hooks and creating feedback loops.
 */
let remoteSyncLockCount = 0;

export const isApplyingRemoteSync = (): boolean => remoteSyncLockCount > 0;

export const runWithRemoteSync = async <T>(operation: () => Promise<T>): Promise<T> => {
  remoteSyncLockCount++;
  try {
    return await operation();
  } finally {
    remoteSyncLockCount = Math.max(0, remoteSyncLockCount - 1);
  }
};

export interface SyncEngineStatus {
  isOnline: boolean;
  isAuthenticated: boolean;
  isConnected: boolean;
  currentUser: User | null;
  shopId: string;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  isQuotaExceeded: boolean;
  quotaExceededMessage: string | null;
  conflictCount: number;
  migratedRecordsCount: number;
  isMigrating: boolean;
  migrationProgress: number; // 0 to 100
}

let syncStatus: SyncEngineStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isAuthenticated: false,
  isConnected: true,
  currentUser: null,
  shopId: DEFAULT_SHOP_ID,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  lastSyncError: null,
  isQuotaExceeded: false,
  quotaExceededMessage: null,
  conflictCount: 0,
  migratedRecordsCount: 0,
  isMigrating: false,
  migrationProgress: 0,
};

/**
 * Detects if an error is caused by Firebase / Firestore quota or resource limits.
 */
export const isQuotaError = (err: any): boolean => {
  if (!err) return false;
  const str = (err.message || err.code || String(err)).toLowerCase();
  return (
    str.includes('quota') ||
    str.includes('resource_exhausted') ||
    str.includes('free daily read units') ||
    str.includes('quota exceeded') ||
    str.includes('quota limit') ||
    str.includes('limit exceeded') ||
    str.includes('daily read units per project')
  );
};

export const getFirestoreQuotaUpgradeUrl = (): string => {
  return 'https://console.firebase.google.com/project/engaged-striker-cj4jh/firestore/databases/ai-studio-remixnafeesjewel-54790b84-fdd5-46df-ac31-4e71270cda9d/data?openUpgradeDialog=true';
};

type StatusListener = (status: SyncEngineStatus) => void;
const statusListeners: Set<StatusListener> = new Set();

export const subscribeSyncStatus = (listener: StatusListener) => {
  statusListeners.add(listener);
  listener({ ...syncStatus });
  return () => {
    statusListeners.delete(listener);
  };
};

export const useSyncStatus = (): SyncEngineStatus => {
  const [status, setStatus] = React.useState<SyncEngineStatus>(() => ({ ...syncStatus }));

  React.useEffect(() => {
    return subscribeSyncStatus((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  return status;
};

const notifyStatus = () => {
  const current = { ...syncStatus };
  statusListeners.forEach(l => l(current));
};

export const updatePendingCount = async () => {
  try {
    const count = await db.syncQueue.where('status').equals('pending').count();
    const conflicts = await db.syncConflicts.where('resolved').equals(0 as any).count();
    syncStatus.pendingCount = count;
    syncStatus.conflictCount = conflicts;
    notifyStatus();
  } catch (e) {
    console.warn('Failed to update pending sync count:', e);
  }
};

/**
 * 1. AUTOMATIC HOOKS FOR LOCAL CHANGES (OFFLINE FIRST)
 * Whenever user creates, updates, or deletes records locally in Dexie,
 * this queues a change for immediate or background Firestore sync.
 */
let isSyncHooksRegistered = false;

export const registerSyncHooks = () => {
  if (isSyncHooksRegistered) return;
  isSyncHooksRegistered = true;

  SYNC_TABLES.forEach((tableName) => {
    const table = (db as any)[tableName];
    if (!table) return;

    // Hook 'creating' to inject _syncId and timestamp
    table.hook('creating', function (this: any, primKey: any, obj: any) {
      if (isApplyingRemoteSync()) return;
      if (tableName === 'settings' && isExcludedSettingKey(obj?.key)) return;

      if (!obj._syncId) {
        obj._syncId = generateSyncId();
      }
      obj._createdAt = obj._createdAt || Date.now();
      obj._updatedAt = Date.now();
      obj._version = (obj._version || 0) + 1;
      obj._deviceId = getDeviceId();
      obj._deletedAt = null;

      const capturedSyncId = obj._syncId;
      const capturedObj = { ...obj };
      const effectiveId = primKey || obj?.id;

      // Queue sync item
      setTimeout(async () => {
        if (isApplyingRemoteSync()) return;
        if (tableName === 'settings' && isExcludedSettingKey(capturedObj?.key)) return;

        let finalSyncId = capturedSyncId;
        let action: 'create' | 'update' = 'create';

        // If an ID was provided, verify if an existing record was being updated via put()
        if (effectiveId && tableName !== 'settings') {
          try {
            const existing = await table.get(effectiveId);
            if (existing) {
              action = 'update';
              if (existing._syncId && existing._syncId !== capturedSyncId) {
                // Keep the original _syncId so we do not orphan the Firestore document
                finalSyncId = existing._syncId;
                capturedObj._syncId = existing._syncId;
                await table.update(effectiveId, { _syncId: existing._syncId });
              }
            }
          } catch (e) {
            // Ignore if record check fails
          }
        }

        queueLocalChange(tableName, finalSyncId, action, capturedObj);
      }, 50);
    });

    // Hook 'updating' to bump timestamp and queue
    table.hook('updating', function (this: any, modifications: any, primKey: any, obj: any) {
      if (isApplyingRemoteSync()) return modifications;
      const effectiveKey = modifications?.key || obj?.key;
      if (tableName === 'settings' && isExcludedSettingKey(effectiveKey)) return modifications;

      const updatedAt = Date.now();
      modifications._updatedAt = updatedAt;
      modifications._version = (obj._version || 0) + 1;
      modifications._deviceId = getDeviceId();

      const syncId = obj._syncId || generateSyncId();
      if (!obj._syncId) {
        modifications._syncId = syncId;
      }

      const merged = { ...obj, ...modifications };
      setTimeout(() => {
        if (isApplyingRemoteSync()) return;
        if (tableName === 'settings' && isExcludedSettingKey(merged?.key)) return;
        queueLocalChange(tableName, syncId, 'update', merged);
      }, 50);

      return modifications;
    });

    // Hook 'deleting' for soft-delete queue
    table.hook('deleting', function (this: any, primKey: any, obj: any) {
      if (isApplyingRemoteSync()) return;
      if (tableName === 'settings' && isExcludedSettingKey(obj?.key)) return;

      if (obj && obj._syncId) {
        const capturedSyncId = obj._syncId;
        setTimeout(() => {
          if (isApplyingRemoteSync()) return;
          queueLocalChange(tableName, capturedSyncId, 'delete', {
            _syncId: capturedSyncId,
            _deletedAt: Date.now(),
            _deviceId: getDeviceId()
          });
        }, 50);
      }
    });
  });

  console.log('Sync Engine: IndexedDB hooks registered.');
};

/**
 * Queue a local modification into Dexie syncQueue
 */
export const queueLocalChange = async (
  tableName: string, 
  syncId: string, 
  action: 'create' | 'update' | 'delete', 
  data: any
) => {
  if (isApplyingRemoteSync()) return;
  if (tableName === 'settings') {
    const key = data?.key || syncId;
    if (isExcludedSettingKey(key)) return;
  }

  try {
    // Avoid double-queuing if already queued and pending
    const existing = await db.syncQueue
      .where({ table: tableName, syncId: syncId })
      .first();

    if (existing) {
      await db.syncQueue.update(existing.id!, {
        action,
        data,
        timestamp: Date.now(),
        status: 'pending',
        error: undefined
      });
    } else {
      await db.syncQueue.add({
        table: tableName,
        syncId,
        action,
        data,
        timestamp: Date.now(),
        retries: 0,
        status: 'pending'
      });
    }

    await updatePendingCount();

    // If online and authenticated, trigger debounced sync
    if (syncStatus.isOnline && syncStatus.isAuthenticated && !syncStatus.isSyncing) {
      debounceSync();
    }
  } catch (e) {
    console.error('Failed to queue local change:', e);
  }
};

let debounceTimer: NodeJS.Timeout | null = null;
const debounceSync = () => {
  // If quota is currently exceeded, do not schedule continuous sync runs
  if (syncStatus.isQuotaExceeded) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runFullSync().catch((err) => {
      if (isQuotaError(err)) {
        console.warn('Sync delayed due to quota limits.');
      } else {
        console.error(err);
      }
    });
  }, 2000);
};

/**
 * Helper to get clean Firestore document reference under shop structure
 */
export const getShopDocRef = (collectionName: string, docId: string) => {
  const shopId = syncStatus.shopId || DEFAULT_SHOP_ID;
  return doc(firestore, 'shops', shopId, collectionName, docId);
};

/**
 * Ensures any embedded base64 image in the record is safely compressed and within Firestore's 1MB limit.
 * Also recursively compresses any sales items images or setting values.
 */
export const sanitizePayloadForFirestore = async (
  data: any, 
  tableName?: string, 
  syncId?: string
): Promise<{ payload: any; wasModified: boolean }> => {
  if (!data || typeof data !== 'object') {
    return { payload: data, wasModified: false };
  }

  let wasModified = false;
  const cloned = { ...data };

  // 1. Check primary 'img' field
  if (cloned.img && typeof cloned.img === 'string' && cloned.img.startsWith('data:image')) {
    if (cloned.img.length > 250000) {
      try {
        const compressed = await compressImage(cloned.img, 800, 800, 0.65);
        if (compressed && compressed.length < cloned.img.length) {
          cloned.img = compressed;
          wasModified = true;
        }
      } catch (e) {
        console.warn('Failed to compress oversized image in sync payload:', e);
      }
    }
  }

  // 2. Check settings logo 'value'
  if (tableName === 'settings' && cloned.key === 'shopLogo' && cloned.value && typeof cloned.value === 'string' && cloned.value.startsWith('data:image')) {
    if (cloned.value.length > 250000) {
      try {
        const compressed = await compressImage(cloned.value, 400, 400, 0.65);
        if (compressed && compressed.length < cloned.value.length) {
          cloned.value = compressed;
          wasModified = true;
        }
      } catch (e) {}
    }
  }

  // 3. Check items array (for sales items)
  if (Array.isArray(cloned.items)) {
    const updatedItems = [];
    let itemsChanged = false;
    for (const itm of cloned.items) {
      if (itm && itm.img && typeof itm.img === 'string' && itm.img.startsWith('data:image') && itm.img.length > 250000) {
        try {
          const comp = await compressImage(itm.img, 800, 800, 0.65);
          if (comp && comp.length < itm.img.length) {
            updatedItems.push({ ...itm, img: comp });
            itemsChanged = true;
            continue;
          }
        } catch (e) {}
      }
      updatedItems.push(itm);
    }
    if (itemsChanged) {
      cloned.items = updatedItems;
      wasModified = true;
    }
  }

  // 4. Final safety check: Firestore hard limit is 1,048,576 bytes.
  let estimatedSize = 0;
  try {
    estimatedSize = JSON.stringify(cloned).length;
  } catch (e) {
    estimatedSize = 0;
  }

  if (estimatedSize > 750000) {
    console.warn(`Payload for ${tableName}/${syncId} is large (~${estimatedSize} bytes). Performing emergency downsampling...`);
    if (cloned.img && typeof cloned.img === 'string' && cloned.img.startsWith('data:image')) {
      try {
        const emergencyComp = await compressImage(cloned.img, 400, 400, 0.45);
        if (emergencyComp && emergencyComp.length < cloned.img.length) {
          cloned.img = emergencyComp;
          wasModified = true;
        }
      } catch (e) {}
    }
    // If still over 900,000 bytes after emergency compression, strip image to avoid dropping business transaction
    try {
      if (JSON.stringify(cloned).length > 900000) {
        console.error(`Document for ${tableName}/${syncId} exceeds 900KB even after compression. Stripping image to protect record integrity.`);
        cloned.img = null;
        wasModified = true;
      }
    } catch (e) {}
  }

  return { payload: cloned, wasModified };
};

/**
 * Safe cleanup of any obsolete local runtime settings items accidentally trapped in syncQueue,
 * and automatic healing of any oversized items (such as uncompressed photos).
 */
export const cleanupOrphanedMetadataQueue = async () => {
  try {
    const queueItems = await db.syncQueue.toArray();
    for (const item of queueItems) {
      // 1. Exclude runtime settings
      if (item.table === 'settings') {
        const key = item.data?.key || item.syncId;
        if (isExcludedSettingKey(key)) {
          if (item.id) {
            await db.syncQueue.delete(item.id);
          }
          continue;
        }
      }

      // 2. Check for oversized or size-errored items (e.g. item #442)
      const isSizeError = item.error && (
        item.error.includes('exceeds the maximum allowed size') || 
        item.error.includes('1,048,576 bytes')
      );
      
      let itemSize = 0;
      try {
        itemSize = item.data ? JSON.stringify(item.data).length : 0;
      } catch (e) {
        itemSize = 0;
      }

      if (isSizeError || itemSize > 400000) {
        console.log(`Sanitizing oversized queue item #${item.id} (${item.table}/${item.syncId})...`);
        const { payload: sanitizedData, wasModified } = await sanitizePayloadForFirestore(item.data, item.table, item.syncId);
        
        await db.syncQueue.update(item.id!, {
          data: sanitizedData,
          status: 'pending',
          error: undefined,
          retries: 0
        });

        // Also heal the local Dexie table record so IndexedDB doesn't store 4MB blobs
        if (wasModified && sanitizedData.img !== undefined) {
          await runWithRemoteSync(async () => {
            const table = (db as any)[item.table];
            if (table) {
              const localRec = await table.where('_syncId').equals(item.syncId).first();
              if (localRec && localRec.id) {
                await table.update(localRec.id, { img: sanitizedData.img });
              }
            }
          });
        }
      }
    }
    await updatePendingCount();
  } catch (e) {
    console.warn('Failed to clean metadata queue:', e);
  }
};

/**
 * 2. MIGRATION: Safe, non-destructive initial upload of existing IndexedDB to Firestore
 */
export const migrateLocalIndexedDBToFirestore = async (
  onProgress?: (progress: number, message: string) => void
): Promise<{ success: boolean; migratedCount: number; errors: string[] }> => {
  if (!syncStatus.isOnline) {
    return { success: false, migratedCount: 0, errors: ['انٹرنیٹ کنکشن درکار ہے (Internet connection required).'] };
  }

  syncStatus.isMigrating = true;
  syncStatus.migrationProgress = 0;
  notifyStatus();

  const errors: string[] = [];
  let totalRecords = 0;
  let processedRecords = 0;

  try {
    onProgress?.(5, 'سابقہ ریکارڈز کی گنتی کی جا رہی ہے (Counting existing records)...');

    // 1. Calculate total local records across all tables
    const tableCounts: Record<string, number> = {};
    for (const tableName of SYNC_TABLES) {
      const table = (db as any)[tableName];
      if (table) {
        const count = await table.count();
        tableCounts[tableName] = count;
        totalRecords += count;
      }
    }

    if (totalRecords === 0) {
      onProgress?.(100, 'کوئی سابقہ ریکارڈ موجود نہیں (No records found).');
      syncStatus.isMigrating = false;
      syncStatus.migrationProgress = 100;
      notifyStatus();
      return { success: true, migratedCount: 0, errors: [] };
    }

    // 2. Iterate through each table and safely upload records
    for (const tableName of SYNC_TABLES) {
      const table = (db as any)[tableName];
      if (!table) continue;

      const records = await table.toArray();
      const collectionName = TABLE_COLLECTIONS[tableName] || tableName;

      // Process in batches of 200 for optimal Firestore throughput
      const batchSize = 200;
      for (let i = 0; i < records.length; i += batchSize) {
        const chunk = records.slice(i, i + batchSize);
        const batch = writeBatch(firestore);

        for (const record of chunk) {
          if (tableName === 'settings' && isExcludedSettingKey(record.key)) {
            continue;
          }

          // Guarantee valid _syncId and timestamp
          const syncId = record._syncId || generateSyncId();
          if (!record._syncId) {
            record._syncId = syncId;
            record._createdAt = record._createdAt || (record.date ? new Date(record.date).getTime() : Date.now());
            record._updatedAt = record._updatedAt || Date.now();
            record._version = 1;
            record._deviceId = getDeviceId();
            
            await runWithRemoteSync(async () => {
              if (tableName === 'settings') {
                await db.settings.put(record);
              } else if (record.id) {
                await table.update(record.id, { _syncId: syncId, _updatedAt: record._updatedAt });
              }
            });
          }

          // Build clean Firestore payload (stripping undefined/NaN and compressing oversized images)
          const { payload: sanitizedRecord } = await sanitizePayloadForFirestore(record, tableName, syncId);
          const firestorePayload = cleanForFirestore({
            ...sanitizedRecord,
            _table: tableName,
            _syncedAt: Date.now()
          });

          const docRef = getShopDocRef(collectionName, syncId);
          batch.set(docRef, firestorePayload, { merge: true });
        }

        try {
          await batch.commit();
          processedRecords += chunk.length;
          const pct = Math.min(95, Math.round((processedRecords / totalRecords) * 100));
          syncStatus.migrationProgress = pct;
          syncStatus.migratedRecordsCount = processedRecords;
          notifyStatus();
          onProgress?.(pct, `${tableName}: ${processedRecords}/${totalRecords} ریکارڈز اپلوڈ ہو گئے...`);
        } catch (batchErr: any) {
          console.error(`Batch upload error for ${tableName}:`, batchErr);
          errors.push(`Table ${tableName} batch error: ${batchErr.message || batchErr}`);
        }
      }
    }

    syncStatus.isMigrating = false;
    syncStatus.migrationProgress = 100;
    syncStatus.lastSyncTime = Date.now();
    await runWithRemoteSync(async () => {
      await db.settings.put({ key: 'lastCloudSyncTime', value: new Date().toISOString() });
      await db.settings.put({ key: 'migrationCompleted', value: 'true' });
    });
    notifyStatus();

    onProgress?.(100, `مائیگریشن مکمل ہو گئی! (${processedRecords} ریکارڈز محفوظ)`);
    return {
      success: errors.length === 0,
      migratedCount: processedRecords,
      errors
    };
  } catch (err: any) {
    syncStatus.isMigrating = false;
    notifyStatus();
    console.error('Migration failed:', err);
    return { success: false, migratedCount: processedRecords, errors: [err.message || String(err)] };
  }
};

/**
 * 3. RUN FULL TWO-WAY SYNCHRONIZATION
 * - Process pending outbox queue (Upload) - writes directly without redundant reads
 * - Fetch modified cloud records since last sync (Download)
 * - Detect and safely handle quota limits without breaking local operations
 */
export const runFullSync = async (force: boolean = false): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> => {
  if (syncStatus.isSyncing) {
    return { success: false, pushed: 0, pulled: 0, error: 'Sync already in progress' };
  }

  if (!syncStatus.isOnline) {
    return { success: false, pushed: 0, pulled: 0, error: 'Offline. Data is saved locally.' };
  }

  // If quota is exceeded and this is not a manual force retry, skip cloud requests
  if (syncStatus.isQuotaExceeded && !force) {
    return { 
      success: false, 
      pushed: 0, 
      pulled: 0, 
      error: 'Firestore daily free read quota reached. All data is saved safely on your device and will sync automatically when quota resets.' 
    };
  }

  // If forced, reset quota exceeded flag to test connection
  if (force) {
    syncStatus.isQuotaExceeded = false;
    syncStatus.quotaExceededMessage = null;
  }

  syncStatus.isSyncing = true;
  syncStatus.lastSyncError = null;
  notifyStatus();

  let pushedCount = 0;
  let pulledCount = 0;

  try {
    // --- STEP A: PUSH LOCAL QUEUE TO FIRESTORE (Zero-Read Outbox Pattern) ---
    const pendingQueue = await db.syncQueue
      .where('status')
      .equals('pending')
      .limit(100)
      .toArray();

    if (pendingQueue.length > 0) {
      for (const item of pendingQueue) {
        // Skip excluded settings that might have been queued
        if (item.table === 'settings') {
          const key = item.data?.key || item.syncId;
          if (isExcludedSettingKey(key)) {
            await db.syncQueue.delete(item.id!);
            continue;
          }
        }

        try {
          const collectionName = TABLE_COLLECTIONS[item.table] || item.table;
          const docRef = getShopDocRef(collectionName, item.syncId);

          if (item.action === 'delete') {
            // Soft delete on cloud (Direct write, zero reads required)
            await setDoc(docRef, {
              _syncId: item.syncId,
              _deletedAt: item.data?._deletedAt || Date.now(),
              _updatedAt: Date.now(),
              _deviceId: getDeviceId()
            }, { merge: true });
          } else {
            // Sanitize payload to guarantee base64 images are compressed and within 1MB Firestore limit
            let dataToPush = item.data;
            try {
              const { payload: sanitizedData, wasModified } = await sanitizePayloadForFirestore(item.data, item.table, item.syncId);
              if (wasModified) {
                dataToPush = sanitizedData;
                await db.syncQueue.update(item.id!, { data: sanitizedData });
                if (sanitizedData.img !== undefined) {
                  await runWithRemoteSync(async () => {
                    const table = (db as any)[item.table];
                    if (table) {
                      const localRec = await table.where('_syncId').equals(item.syncId).first();
                      if (localRec && localRec.id) {
                        await table.update(localRec.id, { img: sanitizedData.img });
                      }
                    }
                  });
                }
              }
            } catch (sanitizeErr) {
              console.warn('Sanitize payload error before push:', sanitizeErr);
            }

            // Direct upsert with merge: true (Zero reads required!)
            const cleanPayload = cleanForFirestore({
              ...dataToPush,
              _syncedAt: Date.now()
            });

            await setDoc(docRef, cleanPayload, { merge: true });
          }

          await db.syncQueue.delete(item.id!);
          pushedCount++;
        } catch (itemErr: any) {
          if (isQuotaError(itemErr)) {
            syncStatus.isQuotaExceeded = true;
            syncStatus.quotaExceededMessage = 'Firestore daily free read quota reached. All data is saved safely on your device.';
            stopRealtimeListeners();
            notifyStatus();
            console.warn('Firestore quota reached during push. Halting queue processing to protect client.');
            break;
          }

          const errMsg = itemErr.message || String(itemErr);
          // Auto-rescue items that exceed Firestore's 1MB document size limit (e.g. queue item #442)
          if (errMsg.includes('exceeds the maximum allowed size') || errMsg.includes('1,048,576 bytes')) {
            console.warn(`Queue item #${item.id} exceeded Firestore 1MB document size limit. Applying emergency rescue...`);
            try {
              const collectionName = TABLE_COLLECTIONS[item.table] || item.table;
              const docRef = getShopDocRef(collectionName, item.syncId);
              const fallbackPayload = cleanForFirestore({
                ...item.data,
                img: null,
                _syncedAt: Date.now()
              });
              await setDoc(docRef, fallbackPayload, { merge: true });
              await db.syncQueue.delete(item.id!);
              pushedCount++;

              // Heal local table so oversized image doesn't re-queue
              await runWithRemoteSync(async () => {
                const table = (db as any)[item.table];
                if (table) {
                  const localRec = await table.where('_syncId').equals(item.syncId).first();
                  if (localRec && localRec.id) {
                    await table.update(localRec.id, { img: null });
                  }
                }
              });
              continue;
            } catch (fallbackErr) {
              console.error(`Emergency fallback for #${item.id} failed:`, fallbackErr);
            }
          }

          console.error(`Failed to push queue item #${item.id}:`, itemErr);
          await db.syncQueue.update(item.id!, {
            retries: (item.retries || 0) + 1,
            error: itemErr.message || String(itemErr)
          });
        }
      }
    }

    // If quota was hit during push, do not proceed to pull
    if (syncStatus.isQuotaExceeded) {
      syncStatus.isSyncing = false;
      notifyStatus();
      return { 
        success: false, 
        pushed: pushedCount, 
        pulled: 0, 
        error: 'Firestore daily free read quota reached. Data is safely stored locally on your device.' 
      };
    }

    // --- STEP B: PULL CLOUD CHANGES INTO LOCAL INDEXEDDB ---
    const lastSyncSetting = await db.settings.get('lastCloudSyncTimestamp');
    const sinceTimestamp = lastSyncSetting?.value ? Number(lastSyncSetting.value) : 0;

    await runWithRemoteSync(async () => {
      for (const tableName of SYNC_TABLES) {
        if (syncStatus.isQuotaExceeded) break;

        const collectionName = TABLE_COLLECTIONS[tableName] || tableName;
        const colRef = collection(firestore, 'shops', syncStatus.shopId, collectionName);

        // Query documents updated since last sync
        let q = query(colRef);
        if (sinceTimestamp > 0) {
          q = query(colRef, where('_updatedAt', '>', sinceTimestamp - 60000)); // 1 min buffer
        }

        let snapshot;
        try {
          snapshot = await getDocs(q);
        } catch (tableErr: any) {
          if (isQuotaError(tableErr)) {
            syncStatus.isQuotaExceeded = true;
            syncStatus.quotaExceededMessage = 'Firestore daily free read quota reached. All data is saved safely on your device.';
            stopRealtimeListeners();
            notifyStatus();
            console.warn(`Firestore read quota reached on table ${tableName}. Pull halted.`);
            break;
          }
          console.warn(`Pull skipped for ${tableName}:`, tableErr);
          continue;
        }
        const table = (db as any)[tableName];
        if (!table) continue;

        for (const docSnap of snapshot.docs) {
          const cloudData = docSnap.data();
          const syncId = docSnap.id || cloudData._syncId;

          // Skip if originated from this device and matches local version
          if (cloudData._deviceId === getDeviceId() && cloudData._updatedAt <= sinceTimestamp) {
            continue;
          }

          if (tableName === 'settings' && isExcludedSettingKey(cloudData.key)) {
            continue;
          }

          // Check if record exists locally by _syncId
          let localExisting: any = null;
          if (tableName === 'settings') {
            localExisting = await db.settings.get(cloudData.key);
          } else {
            localExisting = await table.where('_syncId').equals(syncId).first();
            if (!localExisting && cloudData.id) {
              const byId = await table.get(cloudData.id);
              if (byId) {
                localExisting = byId;
                await table.update(byId.id, { _syncId: syncId });
              }
            }
          }

          // If marked deleted in cloud
          if (cloudData._deletedAt) {
            if (localExisting) {
              // Only apply deletion if the cloud deletion timestamp is strictly newer than local record
              if ((localExisting._updatedAt || 0) < cloudData._deletedAt) {
                if (tableName === 'settings') {
                  await db.settings.delete(cloudData.key);
                } else if (localExisting.id) {
                  await table.delete(localExisting.id);
                }
                pulledCount++;
              }
            }
            continue;
          }

          // If local is newer than cloud, do not overwrite
          if (localExisting && localExisting._updatedAt && cloudData._updatedAt && localExisting._updatedAt > cloudData._updatedAt) {
            continue;
          }

          // Apply cloud record locally safely under remote-sync context
          const cleanLocal: any = { ...cloudData, _syncId: syncId };
          if (tableName === 'settings') {
            if (cleanLocal.key && cleanLocal.value !== undefined) {
              await db.settings.put({ key: cleanLocal.key, value: cleanLocal.value });
            }
          } else if (localExisting && (localExisting as any).id) {
            cleanLocal.id = (localExisting as any).id;
            await table.put(cleanLocal);
          } else {
            // Deduplication safety check: if local record with matching core details exists, update instead of duplicating
            let dupMatch: any = null;
            try {
              if (tableName === 'sales' && cleanLocal.name && cleanLocal.date) {
                dupMatch = await table.where({ name: cleanLocal.name, date: cleanLocal.date }).first();
              } else if (tableName === 'orders' && cleanLocal.name && cleanLocal.item) {
                dupMatch = await table.where({ name: cleanLocal.name, item: cleanLocal.item }).first();
              } else if (tableName === 'karigars' && cleanLocal.name && cleanLocal.task) {
                dupMatch = await table.where({ name: cleanLocal.name, task: cleanLocal.task }).first();
              } else if (tableName === 'khaataEntries' && cleanLocal.accountId && cleanLocal.date) {
                dupMatch = await table.where({ accountId: cleanLocal.accountId, date: cleanLocal.date }).first();
              }
            } catch (e) {}

            if (dupMatch && (dupMatch as any).id) {
              cleanLocal.id = (dupMatch as any).id;
              await table.put(cleanLocal);
            } else {
              delete cleanLocal.id; // allow auto-increment
              await table.add(cleanLocal);
            }
          }
          pulledCount++;
        }
      }
    });

    if (!syncStatus.isQuotaExceeded) {
      const now = Date.now();
      syncStatus.lastSyncTime = now;
      syncStatus.lastSyncError = null;
      
      // Save local sync timestamps under remote-sync lock so they never generate queue items
      await runWithRemoteSync(async () => {
        await db.settings.put({ key: 'lastCloudSyncTimestamp', value: String(now) });
        await db.settings.put({ key: 'lastCloudSyncDate', value: new Date().toISOString() });
      });
    }

    await updatePendingCount();
    syncStatus.isSyncing = false;
    notifyStatus();

    return { success: !syncStatus.isQuotaExceeded, pushed: pushedCount, pulled: pulledCount };
  } catch (err: any) {
    syncStatus.isSyncing = false;
    if (isQuotaError(err)) {
      syncStatus.isQuotaExceeded = true;
      syncStatus.quotaExceededMessage = 'Firestore daily free read quota reached. All data is saved safely on your device.';
      stopRealtimeListeners();
    } else {
      syncStatus.lastSyncError = err.message || String(err);
    }
    notifyStatus();
    console.error('Full sync status:', err);
    return { success: false, pushed: pushedCount, pulled: pulledCount, error: syncStatus.lastSyncError || 'Sync interrupted' };
  }
};

/**
 * Clean data structures before writing to Firestore (handles Date, undefined, nulls)
 */
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();

  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore);
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (typeof value === 'number' && isNaN(value)) {
      result[key] = 0;
    } else {
      result[key] = cleanForFirestore(value);
    }
  }
  return result;
}

/**
 * 4. REAL-TIME MULTI-DEVICE LISTENER SUBSCRIPTION
 * Listens to active collections in Firestore to reflect instant changes.
 * Remote writes are guarded by `runWithRemoteSync` to prevent feedback loops.
 */
let activeUnsubscribes: Unsubscribe[] = [];

export const startRealtimeListeners = () => {
  stopRealtimeListeners();
  if (!syncStatus.isOnline) return;

  const shopId = syncStatus.shopId || DEFAULT_SHOP_ID;

  ['sales', 'orders', 'karigars', 'repairs', 'stock', 'khaataEntries', 'contacts', 'expenses', 'goldPurchases', 'khaataAccounts'].forEach((tableName) => {
    const colRef = collection(firestore, 'shops', shopId, tableName);
    const unsub = onSnapshot(colRef, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const cloudData = change.doc.data();
        const syncId = change.doc.id;

        // Ignore changes originated from this device
        if (cloudData._deviceId === getDeviceId()) return;

        const table = (db as any)[tableName];
        if (!table) return;

        await runWithRemoteSync(async () => {
          if (change.type === 'removed' || cloudData._deletedAt) {
            const local: any = await table.where('_syncId').equals(syncId).first();
            if (local?.id) {
              if (change.type === 'removed' || (local._updatedAt || 0) < cloudData._deletedAt) {
                await table.delete(local.id);
              }
            }
          } else {
            let local: any = await table.where('_syncId').equals(syncId).first();
            if (!local && cloudData.id) {
              const byId = await table.get(cloudData.id);
              if (byId) {
                local = byId;
                await table.update(byId.id, { _syncId: syncId });
              }
            }

            const record: any = { ...cloudData, _syncId: syncId };
            if (local?.id) {
              record.id = local.id;
              await table.put(record);
            } else {
              // Deduplication safety check
              let dupMatch: any = null;
              try {
                if (tableName === 'sales' && record.name && record.date) {
                  dupMatch = await table.where({ name: record.name, date: record.date }).first();
                } else if (tableName === 'orders' && record.name && record.item) {
                  dupMatch = await table.where({ name: record.name, item: record.item }).first();
                } else if (tableName === 'karigars' && record.name && record.task) {
                  dupMatch = await table.where({ name: record.name, task: record.task }).first();
                } else if (tableName === 'khaataEntries' && record.accountId && record.date) {
                  dupMatch = await table.where({ accountId: record.accountId, date: record.date }).first();
                }
              } catch (e) {}

              if (dupMatch && dupMatch.id) {
                record.id = dupMatch.id;
                await table.put(record);
              } else {
                delete record.id;
                await table.add(record);
              }
            }
          }
        });
      });
    }, (err) => {
      if (isQuotaError(err)) {
        syncStatus.isQuotaExceeded = true;
        syncStatus.quotaExceededMessage = 'Firestore daily free read quota reached. All data is saved safely on your device.';
        stopRealtimeListeners();
        notifyStatus();
        console.warn(`Firestore read quota reached in listener for ${tableName}. Realtime listener paused.`);
      } else {
        console.warn(`Realtime listener error for ${tableName}:`, err);
      }
    });

    activeUnsubscribes.push(unsub);
  });
};

export const stopRealtimeListeners = () => {
  activeUnsubscribes.forEach(u => u());
  activeUnsubscribes = [];
};

/**
 * 5. INITIALIZATION & LIFECYCLE
 */
export const initSyncEngine = async () => {
  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      syncStatus.isOnline = true;
      notifyStatus();
      startRealtimeListeners();
      runFullSync().catch(console.error);
    });

    window.addEventListener('offline', () => {
      syncStatus.isOnline = false;
      notifyStatus();
      stopRealtimeListeners();
    });
  }

  // Register Dexie hooks first
  registerSyncHooks();

  // Clean any obsolete metadata-only items trapped in syncQueue from earlier sessions
  await cleanupOrphanedMetadataQueue();

  // Start Realtime Firestore listeners immediately
  startRealtimeListeners();

  // Monitor Firebase Auth State if available
  onAuthStateChanged(auth, async (user) => {
    syncStatus.currentUser = user;
    syncStatus.isAuthenticated = !!user;
    notifyStatus();

    if (user) {
      await updatePendingCount();
      runFullSync().catch(console.error);
    }
  });

  // Trigger initial full sync on app startup
  runFullSync().catch(console.error);

  // Hydrate last sync timestamp from local settings
  try {
    const saved = await db.settings.get('lastCloudSyncTimestamp');
    if (saved?.value) {
      syncStatus.lastSyncTime = Number(saved.value);
    }
    await updatePendingCount();
  } catch (e) {}
};
