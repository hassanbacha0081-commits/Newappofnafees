import { db } from '../db';

export interface DeduplicateResult {
  removedTotal: number;
  byTable: Record<string, number>;
}

/**
 * Scans the database across all sections and safely removes duplicate records
 * caused by previous edit operations. Preserves the most up-to-date entry.
 */
export async function cleanupDuplicateRecords(): Promise<DeduplicateResult> {
  const byTable: Record<string, number> = {
    sales: 0,
    orders: 0,
    karigars: 0,
    khaataEntries: 0,
    khaataAccounts: 0,
    repairs: 0,
    stock: 0,
    goldPurchases: 0
  };

  try {
    // 1. Sales
    if (db.sales) {
      const sales = await db.sales.toArray();
      const saleGroups = new Map<string, typeof sales>();
      for (const s of sales) {
        // Group by customer name, date, total, rec, rem
        const key = `${(s.name || '').trim().toLowerCase()}_${s.date}_${s.total}_${s.rec}_${s.rem}_${s.items?.length || 0}`;
        if (!saleGroups.has(key)) saleGroups.set(key, []);
        saleGroups.get(key)!.push(s);
      }
      for (const [, group] of saleGroups) {
        if (group.length > 1) {
          // Sort: newest updatedAt first, then lowest id to preserve original ID
          group.sort((a, b) => (b._updatedAt || 0) - (a._updatedAt || 0) || (a.id || 0) - (b.id || 0));
          for (let i = 1; i < group.length; i++) {
            if (group[i].id) {
              await db.sales.delete(group[i].id!);
              byTable.sales++;
            }
          }
        }
      }
    }

    // 2. Orders
    if (db.orders) {
      const orders = await db.orders.toArray();
      const orderGroups = new Map<string, typeof orders>();
      for (const o of orders) {
        const key = `${(o.name || '').trim().toLowerCase()}_${(o.item || '').trim().toLowerCase()}_${o.date}_${o.total}_${o.rem}`;
        if (!orderGroups.has(key)) orderGroups.set(key, []);
        orderGroups.get(key)!.push(o);
      }
      for (const [, group] of orderGroups) {
        if (group.length > 1) {
          group.sort((a, b) => (b._updatedAt || 0) - (a._updatedAt || 0) || (a.id || 0) - (b.id || 0));
          for (let i = 1; i < group.length; i++) {
            if (group[i].id) {
              await db.orders.delete(group[i].id!);
              byTable.orders++;
            }
          }
        }
      }
    }

    // 3. Karigars
    if (db.karigars) {
      const karigars = await db.karigars.toArray();
      const karigarGroups = new Map<string, typeof karigars>();
      for (const k of karigars) {
        const key = `${(k.name || '').trim().toLowerCase()}_${(k.task || '').trim().toLowerCase()}_${k.date}_${k.given}_${k.rec}`;
        if (!karigarGroups.has(key)) karigarGroups.set(key, []);
        karigarGroups.get(key)!.push(k);
      }
      for (const [, group] of karigarGroups) {
        if (group.length > 1) {
          group.sort((a, b) => (b._updatedAt || 0) - (a._updatedAt || 0) || (a.id || 0) - (b.id || 0));
          for (let i = 1; i < group.length; i++) {
            if (group[i].id) {
              await db.karigars.delete(group[i].id!);
              byTable.karigars++;
            }
          }
        }
      }
    }

    // 4. Khaata Entries
    if (db.khaataEntries) {
      const entries = await db.khaataEntries.toArray();
      const entryGroups = new Map<string, typeof entries>();
      for (const e of entries) {
        const key = `${e.accountId}_${e.date}_${(e.details || '').trim().toLowerCase()}_${e.type}_${e.mixWeight}_${e.pureWeight}`;
        if (!entryGroups.has(key)) entryGroups.set(key, []);
        entryGroups.get(key)!.push(e);
      }
      for (const [, group] of entryGroups) {
        if (group.length > 1) {
          group.sort((a, b) => (b._updatedAt || 0) - (a._updatedAt || 0) || (a.id || 0) - (b.id || 0));
          for (let i = 1; i < group.length; i++) {
            if (group[i].id) {
              await db.khaataEntries.delete(group[i].id!);
              byTable.khaataEntries++;
            }
          }
        }
      }
    }

    // 5. Khaata Accounts
    if (db.khaataAccounts) {
      const accounts = await db.khaataAccounts.toArray();
      const accGroups = new Map<string, typeof accounts>();
      for (const a of accounts) {
        const key = `${(a.name || '').trim().toLowerCase()}_${(a.phone || '').trim()}`;
        if (!accGroups.has(key)) accGroups.set(key, []);
        accGroups.get(key)!.push(a);
      }
      for (const [, group] of accGroups) {
        if (group.length > 1) {
          group.sort((a, b) => (a.id || 0) - (b.id || 0));
          const primary = group[0];
          for (let i = 1; i < group.length; i++) {
            const dup = group[i];
            if (dup.id && primary.id) {
              // Re-point child entries
              const children = await db.khaataEntries.where('accountId').equals(dup.id).toArray();
              for (const child of children) {
                if (child.id) {
                  await db.khaataEntries.update(child.id, { accountId: primary.id });
                }
              }
              await db.khaataAccounts.delete(dup.id);
              byTable.khaataAccounts++;
            }
          }
        }
      }
    }

    // 6. Repairs
    if (db.repairs) {
      const repairs = await db.repairs.toArray();
      const repairGroups = new Map<string, typeof repairs>();
      for (const r of repairs) {
        const dStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0];
        const key = `${(r.customerName || '').trim().toLowerCase()}_${(r.item || '').trim().toLowerCase()}_${r.charges}_${dStr}`;
        if (!repairGroups.has(key)) repairGroups.set(key, []);
        repairGroups.get(key)!.push(r);
      }
      for (const [, group] of repairGroups) {
        if (group.length > 1) {
          group.sort((a, b) => (b._updatedAt || 0) - (a._updatedAt || 0) || (a.id || 0) - (b.id || 0));
          for (let i = 1; i < group.length; i++) {
            if (group[i].id) {
              await db.repairs.delete(group[i].id!);
              byTable.repairs++;
            }
          }
        }
      }
    }

    // 7. Gold Purchases
    if (db.goldPurchases) {
      const purchases = await db.goldPurchases.toArray();
      const pGroups = new Map<string, typeof purchases>();
      for (const p of purchases) {
        const key = `${(p.name || '').trim().toLowerCase()}_${p.date}_${p.weight}_${p.rate}_${p.total}`;
        if (!pGroups.has(key)) pGroups.set(key, []);
        pGroups.get(key)!.push(p);
      }
      for (const [, group] of pGroups) {
        if (group.length > 1) {
          group.sort((a, b) => (b._updatedAt || 0) - (a._updatedAt || 0) || (a.id || 0) - (b.id || 0));
          for (let i = 1; i < group.length; i++) {
            if (group[i].id) {
              await db.goldPurchases.delete(group[i].id!);
              byTable.goldPurchases++;
            }
          }
        }
      }
    }

    // 8. Stock
    if (db.stock) {
      const stocks = await db.stock.toArray();
      const stockGroups = new Map<string, typeof stocks>();
      for (const s of stocks) {
        const key = `${(s.name || '').trim().toLowerCase()}_${s.type}`;
        if (!stockGroups.has(key)) stockGroups.set(key, []);
        stockGroups.get(key)!.push(s);
      }
      for (const [, group] of stockGroups) {
        if (group.length > 1) {
          const primary = group[0];
          for (let i = 1; i < group.length; i++) {
            const dup = group[i];
            if (dup.id && primary.id) {
              await db.stock.update(primary.id, {
                quantity: Number((primary.quantity + dup.quantity).toFixed(2)),
                pieces: (primary.pieces || 0) + (dup.pieces || 0)
              });
              await db.stock.delete(dup.id);
              byTable.stock++;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error during deduplication:', err);
  }

  const removedTotal = Object.values(byTable).reduce((a, b) => a + b, 0);
  if (removedTotal > 0) {
    console.log(`Deduplication complete. Removed ${removedTotal} duplicate records:`, byTable);
  }
  return { removedTotal, byTable };
}
