import Dexie, { type Table } from 'dexie';

export interface SalesItem {
  n: string; // Item name
  w: number; // Weight
  p: number; // Pieces/Count
  mk: number; // Polish (per gram)
  r: number; // Rate
  t: number; // Total for item
  img?: string | null;
}

export interface Sale {
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

export interface Order {
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

export interface KarigarRecord {
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

export interface KhaataAccount {
  id?: number;
  name: string;
  phone: string;
  date: string;
  notes?: string;
}

export interface KhaataEntry {
  id?: number;
  accountId: number;
  date: string;
  details: string;        // Items details
  type: 'give' | 'receive'; // give = بنام (دیا / Out), receive = جمع (وصول / In)
  mixWeight: number;      // Mix weight (g)
  pakaye: number;         // Pakaye (g)
  kaatRati: number;       // Kaat in rati
  pureWeight: number;     // Pure weight (g)
  pasaDia: number;        // Pasa Gold given/received (g)
  img?: string | null;    // Image base64 or URL
}

export interface Repair {
  id?: number;
  customerName: string;
  customerPhone: string;
  item: string;
  issue: string;
  charges: number;
  status: 'Pending' | 'Done';
  date: Date;
  img?: string | null;
}

export interface StockItem {
  id?: number;
  name: string;
  type: 'Gold' | 'Item';
  quantity: number; // grams for gold, count for items
  unit: string;
  pieces?: number;
  img?: string | null;
}

export interface GoldPurchase {
  id?: number;
  name: string;
  phone: string;
  weight: number;
  rate: number;
  total: number;
  date: string;
  img?: string | null;
}

export interface Expense {
  id?: number;
  category: string;
  description: string;
  amount: number;
  date: string;
}

export interface Setting {
  id?: string;
  key: string;
  value: any;
}

export interface PhoneContact {
  id?: number;
  name: string;
  phone: string;
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

  constructor() {
    super('NafeesERP_V56_Final');
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
  }
}

const db = new MyDatabase();

// Safety: Ensure tables are accessible even if shortcut properties are delayed
export { db };

db.on('ready', () => {
  console.log('Database is ready');
});

db.open().catch((err) => {
  console.error('Failed to open db:', err);
});
