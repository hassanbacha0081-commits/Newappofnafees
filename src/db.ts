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
  status: string;
  measurements?: string;
  pricePerTola?: string;
  img?: string | null;
  makingCharges?: string;
  weightPolish?: string;
  totalWt?: string;
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

export class MyDatabase extends Dexie {
  sales!: Table<Sale>;
  orders!: Table<Order>;
  karigars!: Table<KarigarRecord>;
  repairs!: Table<Repair>;
  stock!: Table<StockItem>;
  settings!: Table<Setting>;
  goldPurchases!: Table<GoldPurchase>;
  expenses!: Table<Expense>;

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
