import { db } from '../db';

export interface RestoreResult {
  success: boolean;
  counts: Record<string, number>;
}

const generateSyncId = (): string => 
  'sync_' + Math.random().toString(36).substring(2, 10) + '_' + Math.random().toString(36).substring(2, 11);

/**
 * Restores all database tables safely from a backup object.
 * Protects data from being deleted by cloud sync tombstones by:
 * 1. Clearing pending deletion queues
 * 2. Assigning fresh IDs and modern updatedAt timestamps to all restored items
 * 3. Clearing deletedAt markers
 */
export async function restoreBackupData(data: any): Promise<RestoreResult> {
  // 1. Clear any pending synchronization queues so old deletion tasks don't fire
  if (db.syncQueue) {
    await db.syncQueue.clear();
  }
  if (db.syncConflicts) {
    await db.syncConflicts.clear();
  }

  // 2. Clear all local tables
  await Promise.all([
    db.sales.clear(),
    db.orders.clear(),
    db.karigars.clear(),
    db.repairs.clear(),
    db.stock.clear(),
    db.settings.clear(),
    db.goldPurchases.clear(),
    db.expenses ? db.expenses.clear() : Promise.resolve(),
    db.contacts ? db.contacts.clear() : Promise.resolve(),
    db.khaataAccounts ? db.khaataAccounts.clear() : Promise.resolve(),
    db.khaataEntries ? db.khaataEntries.clear() : Promise.resolve(),
  ]);

  const now = Date.now();
  const deviceId = 'device_local_' + Math.random().toString(36).substring(2, 8);

  // Helper to sanitize and refresh records so they are treated as fresh, active records
  const sanitizeRecords = (records: any[]) => {
    if (!Array.isArray(records)) return [];
    return records.map(rec => {
      const item = { ...rec };
      item._syncId = generateSyncId();
      item._updatedAt = now;
      item._deletedAt = null;
      item._deviceId = deviceId;
      return item;
    });
  };

    const counts: Record<string, number> = {};

    if (data.sales && Array.isArray(data.sales) && data.sales.length > 0) {
      const sanitized = sanitizeRecords(data.sales);
      await db.sales.bulkAdd(sanitized);
      counts.sales = sanitized.length;
    }

    if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
      const sanitized = sanitizeRecords(data.orders);
      await db.orders.bulkAdd(sanitized);
      counts.orders = sanitized.length;
    }

    if (data.karigars && Array.isArray(data.karigars) && data.karigars.length > 0) {
      const sanitized = sanitizeRecords(data.karigars);
      await db.karigars.bulkAdd(sanitized);
      counts.karigars = sanitized.length;
    }

    if (data.repairs && Array.isArray(data.repairs) && data.repairs.length > 0) {
      const sanitized = sanitizeRecords(data.repairs);
      await db.repairs.bulkAdd(sanitized);
      counts.repairs = sanitized.length;
    }

    if (data.stock && Array.isArray(data.stock) && data.stock.length > 0) {
      const sanitized = sanitizeRecords(data.stock);
      await db.stock.bulkAdd(sanitized);
      counts.stock = sanitized.length;
    }

    if (data.goldPurchases && Array.isArray(data.goldPurchases) && data.goldPurchases.length > 0) {
      const sanitized = sanitizeRecords(data.goldPurchases);
      await db.goldPurchases.bulkAdd(sanitized);
      counts.goldPurchases = sanitized.length;
    }

    if (data.expenses && Array.isArray(data.expenses) && data.expenses.length > 0 && db.expenses) {
      const sanitized = sanitizeRecords(data.expenses);
      await db.expenses.bulkAdd(sanitized);
      counts.expenses = sanitized.length;
    }

    if (data.contacts && Array.isArray(data.contacts) && data.contacts.length > 0 && db.contacts) {
      const sanitized = sanitizeRecords(data.contacts);
      await db.contacts.bulkAdd(sanitized);
      counts.contacts = sanitized.length;
    }

    if (data.khaataAccounts && Array.isArray(data.khaataAccounts) && data.khaataAccounts.length > 0 && db.khaataAccounts) {
      const sanitized = sanitizeRecords(data.khaataAccounts);
      await db.khaataAccounts.bulkAdd(sanitized);
      counts.khaataAccounts = sanitized.length;
    }

    if (data.khaataEntries && Array.isArray(data.khaataEntries) && data.khaataEntries.length > 0 && db.khaataEntries) {
      const sanitized = sanitizeRecords(data.khaataEntries);
      await db.khaataEntries.bulkAdd(sanitized);
      counts.khaataEntries = sanitized.length;
    }

    if (data.settings && Array.isArray(data.settings) && data.settings.length > 0) {
      const validSettings = data.settings.filter(
        (s: any) => s && s.key && !s.key.startsWith('lastCloudSync')
      );
      if (validSettings.length > 0) {
        await db.settings.bulkAdd(validSettings);
        counts.settings = validSettings.length;
      }
    }

    // Mark as initialized
    await db.settings.put({ key: 'hasBeenInitialized', value: 'true' });

    return { success: true, counts };
}
