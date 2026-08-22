import Dexie, { type Table } from 'dexie';

export interface SyncMetadata {
  _syncId?: string;           // Unique UUID across devices
  _updatedAt?: number;        // Timestamp ms
  _createdAt?: number;        // Timestamp ms
  _deletedAt?: number | null; // Soft-delete marker
  _syncedAt?: number | null;  // Last sync timestamp
  _version?: number;          // Monotonically increasing revision
  _deviceId?: string;         // Originating client identifier
}

export interface SalesItem {
  n: string; // Item name
  w: number; // Weight
  p: number; // Pieces/Count
  mk: number; // Polish (per gram)
  r: number; // Rate
  t: number; // Total for item
  img?: string | null;
}

export interface Sale extends SyncMetadata {
  id?: number;
  name: string;
  phone: string;
  items: SalesItem[];
  total: number;
  rec: number;
  rem: number;
  discount?: number;
  date: string;
}

export interface OrderPayment {
  amt: number;
  date: string;
}

export interface Order extends SyncMetadata {
  id?: number;
  name: string;
  phone: string;
  date: string;
  due: string;
  item: string;
  karigar: string;
  oldWt: string;
  readyWt: string;
  total: number;
  payments: OrderPayment[];
  rem: number;
  discount?: number;
  status: string;
  measurements?: string;
  pricePerTola?: string;
  img?: string | null;
  makingCharges?: string;
  weightPolish?: string;
  totalWt?: string;
  izafiWt?: string;
  price?: number;
  mazdori?: number;
}

export interface KarigarRecord extends SyncMetadata {
  id?: number;
  name: string;
  phone: string;
  task: string;
  given: number;
  rec: number;
  kaat: number;
  net: number;
  img?: string | null;
  date: string;
  receivedRemaining?: number; // Cumulative gold received later to clear/settle remaining
  settledDate?: string;       // Date of settlement
}

export interface KhaataAccount extends SyncMetadata {
  id?: number;
  name: string;
  phone: string;
  date: string;
  notes?: string;
}

export interface KhaataEntry extends SyncMetadata {
  id?: number;
  accountId: number;
  accountSyncId?: string; // Cross-device stable foreign key
  date: string;
  details: string;        // Items details
  type: 'give' | 'receive'; // give = بنام (Out), receive = جمع (In)
  mixWeight: number;      // Mix weight (g)
  pakaye: number;         // Pakaye (g)
  kaatRati: number;       // Kaat in rati
  pureWeight: number;     // Pure weight (g)
  pasaDia: number;        // Pasa Gold given/received (g)
  img?: string | null;    // Image base64 or URL
}

export interface Repair extends SyncMetadata {
  id?: number;
  customerName: string;
  customerPhone: string;
  item: string;
  issue: string;
  charges: number;
  status: 'Pending' | 'Done';
  date: Date;
  dueDate?: string;
  img?: string | null;
}

export interface StockItem extends SyncMetadata {
  id?: number;
  name: string;
  type: 'Gold' | 'Item';
  quantity: number; // grams for gold, count for items
  unit: string;
  pieces?: number;
  img?: string | null;
}

export interface GoldPurchase extends SyncMetadata {
  id?: number;
  name: string;
  phone: string;
  weight: number;
  rate: number;
  total: number;
  date: string;
  img?: string | null;
}

export interface Expense extends SyncMetadata {
  id?: number;
  category: string;
  description: string;
  amount: number;
  date: string;
}

export interface Setting extends SyncMetadata {
  id?: string;
  key: string;
  value: any;
}

export interface PhoneContact extends SyncMetadata {
  id?: number;
  name: string;
  phone: string;
}

export interface SyncQueueItem {
  id?: number;
  table: string;
  recordId?: number | string;
  syncId: string;
  action: 'create' | 'update' | 'delete';
  data?: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
}

export interface SyncConflictItem {
  id?: number;
  table: string;
  syncId: string;
  localData: any;
  cloudData: any;
  detectedAt: number;
  resolved: boolean;
}

export class MyDatabase extends Dexie {
  sales!: Table<Sale>;
  orders!: Table<Order>;
  karigars!: Table<KarigarRecord>;
  repairs!: Table<Repair>;
  stock!: Table<StockItem>;
  settings!: Table<Setting>;
  goldPurchases!: Table<GoldPurchase>;
  expenses!: Table<Expense>;
  contacts!: Table<PhoneContact>;
  khaataAccounts!: Table<KhaataAccount>;
  khaataEntries!: Table<KhaataEntry>;
  syncQueue!: Table<SyncQueueItem>;
  syncConflicts!: Table<SyncConflictItem>;

  constructor() {
    super('NafeesERP_V56_Final');
    
    // Existing schema history preserved
    this.version(6).stores({
      sales: '++id, name, phone, date',
      orders: '++id, name, phone, status, due, karigar',
      karigars: '++id, name, phone, date',
      repairs: '++id, customerName, status, date',
      stock: '++id, name, type, [name+type]',
      settings: 'key',
      goldPurchases: '++id, name, phone, date',
      expenses: '++id, category, date'
    });
    this.version(7).stores({
      sales: '++id, name, phone, date',
      orders: '++id, name, phone, status, due, karigar',
      karigars: '++id, name, phone, date',
      repairs: '++id, customerName, status, date',
      stock: '++id, name, type, [name+type]',
      settings: 'key',
      goldPurchases: '++id, name, phone, date',
      expenses: '++id, category, date',
      contacts: '++id, name, phone'
    });
    this.version(8).stores({
      sales: '++id, name, phone, date',
      orders: '++id, name, phone, status, due, karigar',
      karigars: '++id, name, phone, date',
      repairs: '++id, customerName, status, date',
      stock: '++id, name, type, [name+type]',
      settings: 'key',
      goldPurchases: '++id, name, phone, date',
      expenses: '++id, category, date',
      contacts: '++id, name, phone',
      khaataAccounts: '++id, name, phone',
      khaataEntries: '++id, accountId, date'
    });
    this.version(9).stores({
      sales: '++id, name, phone, date',
      orders: '++id, name, phone, status, due, karigar',
      karigars: '++id, name, phone, date',
      repairs: '++id, customerName, status, date',
      stock: '++id, name, type, [name+type]',
      settings: 'key',
      goldPurchases: '++id, name, phone, date',
      expenses: '++id, category, date',
      contacts: '++id, name, phone',
      khaataAccounts: '++id, name, phone',
      khaataEntries: '++id, accountId, date'
    });

    // Version 10: Non-destructive migration adding sync metadata indexes and sync queue tables
    this.version(10).stores({
      sales: '++id, _syncId, name, phone, date, _updatedAt, _deletedAt',
      orders: '++id, _syncId, name, phone, status, due, karigar, _updatedAt, _deletedAt',
      karigars: '++id, _syncId, name, phone, date, _updatedAt, _deletedAt',
      repairs: '++id, _syncId, customerName, status, date, _updatedAt, _deletedAt',
      stock: '++id, _syncId, name, type, [name+type], _updatedAt, _deletedAt',
      settings: 'key, _syncId, _updatedAt',
      goldPurchases: '++id, _syncId, name, phone, date, _updatedAt, _deletedAt',
      expenses: '++id, _syncId, category, date, _updatedAt, _deletedAt',
      contacts: '++id, _syncId, name, phone, _updatedAt, _deletedAt',
      khaataAccounts: '++id, _syncId, name, phone, _updatedAt, _deletedAt',
      khaataEntries: '++id, _syncId, accountId, accountSyncId, date, _updatedAt, _deletedAt',
      syncQueue: '++id, table, syncId, status, timestamp',
      syncConflicts: '++id, table, syncId, resolved, detectedAt'
    });
  }
}

const db = new MyDatabase();

// Export database instance
export { db };

db.on('ready', () => {
  console.log('Database NafeesERP_V56_Final is ready with Sync Engine v10');
});

db.open().catch((err) => {
  console.error('Failed to open db:', err);
});
