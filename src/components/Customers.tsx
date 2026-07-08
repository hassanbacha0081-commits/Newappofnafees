import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Sale, type Order } from '../db';
import { Search, User, Phone, MapPin, ChevronRight, History, CreditCard, Package } from 'lucide-react';
import { formatDate, formatWhatsAppUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { APP_CONFIG } from '../config';

interface CustomersProps {
  lang: string;
}

interface CustomerSummary {
  name: string;
  phone: string;
  totalSpent: number;
  totalRemaining: number;
  lastVisit: string;
  transactionCount: number;
  sales: Sale[];
  orders: Order[];
}

export default function Customers({ lang }: CustomersProps) {
  const isUrdu = lang === 'ur';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.toArray()) || [];

  const customerMap = useMemo(() => {
    const map = new Map<string, CustomerSummary>();

    const processRecord = (name: string, phone: string, amount: number, remaining: number, date: string, type: 'sale' | 'order', record: any) => {
      const key = `${name.trim().toLowerCase()}_${phone.trim()}`;
      const existing = map.get(key);

      if (existing) {
        existing.totalSpent += amount;
        existing.totalRemaining += remaining;
        existing.transactionCount += 1;
        if (new Date(date) > new Date(existing.lastVisit)) {
          existing.lastVisit = date;
        }
        if (type === 'sale') existing.sales.push(record);
        if (type === 'order') existing.orders.push(record);
      } else {
        map.set(key, {
          name,
          phone,
          totalSpent: amount,
          totalRemaining: remaining,
          lastVisit: date,
          transactionCount: 1,
          sales: type === 'sale' ? [record] : [],
          orders: type === 'order' ? [record] : []
        });
      }
    };

    sales.forEach(s => processRecord(s.name, s.phone, s.total, s.rem, s.date, 'sale', s));
    orders.forEach(o => processRecord(o.name, o.phone, o.total, o.rem, o.date, 'order', o));

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [sales, orders]);

  const filteredCustomers = customerMap.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-sky-900 tracking-tight urdu-text">
            {isUrdu ? 'گاہکوں کی فہرست' : 'Customer Directory'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">{isUrdu ? 'اپنے تمام مستقل گاہکوں کا ریکارڈ سنبھالیں' : 'Manage your client relationships and history'}</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400" size={20} />
          <input 
            type="text"
            placeholder={isUrdu ? 'گاہک کا نام یا فون تلاش کریں...' : 'Search by name or phone...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-white border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold outline-none transition-all shadow-sm font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer List */}
        <div className="lg:col-span-1 space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-sky-200">
          {filteredCustomers.map((customer, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedCustomer(customer)}
              className={`w-full text-left p-5 rounded-3xl border transition-all flex items-center gap-4 group ${
                selectedCustomer?.phone === customer.phone 
                  ? 'bg-sky-600 border-sky-600 shadow-xl shadow-sky-200' 
                  : 'bg-white border-sky-50 hover:border-sky-200 hover:shadow-md'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                selectedCustomer?.phone === customer.phone ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-600'
              }`}>
                <User size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold truncate ${selectedCustomer?.phone === customer.phone ? 'text-white' : 'text-zinc-900'}`}>
                  {customer.name}
                </h3>
                <p className={`text-xs font-mono font-medium ${selectedCustomer?.phone === customer.phone ? 'text-sky-100' : 'text-zinc-400'}`}>
                  {customer.phone}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-black text-sm ${selectedCustomer?.phone === customer.phone ? 'text-gold' : 'text-sky-600'}`}>
                  Rs. {customer.totalSpent.toLocaleString()}
                </p>
                {customer.totalRemaining > 0 && (
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-tighter">
                    Due: Rs. {customer.totalRemaining.toLocaleString()}
                  </p>
                )}
              </div>
            </button>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="py-20 text-center bg-white/50 rounded-3xl border-2 border-dashed border-sky-100">
              <User className="mx-auto text-sky-200 mb-4" size={48} />
              <p className="text-zinc-400 urdu-text">{isUrdu ? 'کوئی گاہک نہیں ملا' : 'No customers found'}</p>
            </div>
          )}
        </div>

        {/* Customer Details View */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedCustomer ? (
              <motion.div
                key={selectedCustomer.phone}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[2rem] border border-sky-50 shadow-xl overflow-hidden min-h-[70vh]"
              >
                {/* Profile Header */}
                <div className="bg-sky-600 p-8 text-white relative">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <User size={120} />
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 items-center md:items-start relative z-10">
                    <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-4xl font-black">
                      {selectedCustomer.name.charAt(0)}
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <h3 className="text-3xl font-black urdu-text mb-2">{selectedCustomer.name}</h3>
                      <div className="flex flex-wrap justify-center md:justify-start gap-4">
                        <div className="flex items-center gap-2 bg-black/20 px-4 py-1.5 rounded-full text-xs font-bold border border-white/10">
                          <Phone size={14} className="text-gold" />
                          <span className="font-mono">{selectedCustomer.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-black/20 px-4 py-1.5 rounded-full text-xs font-bold border border-white/10">
                          <History size={14} className="text-gold" />
                          <span>Last Visit: {formatDate(selectedCustomer.lastVisit)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 border-b border-sky-50">
                   <div className="bg-sky-50 p-6 rounded-3xl space-y-1">
                      <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">{isUrdu ? 'کل بزنس' : 'Total Business'}</p>
                      <p className="text-2xl font-black text-sky-900">Rs. {selectedCustomer.totalSpent.toLocaleString()}</p>
                   </div>
                   <div className={`p-6 rounded-3xl space-y-1 relative group ${selectedCustomer.totalRemaining > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${selectedCustomer.totalRemaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isUrdu ? 'بقیہ رقم' : 'Remaining Balance'}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className={`text-2xl font-black ${selectedCustomer.totalRemaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          Rs. {selectedCustomer.totalRemaining.toLocaleString()}
                        </p>
                        {selectedCustomer.totalRemaining > 0 && (
                          <button 
                            onClick={() => {
                              const message = `محترم ${selectedCustomer.name} صاحب، ${APP_CONFIG.shopNameUrdu} کی جانب سے آپ کا بقایا Rs. ${selectedCustomer.totalRemaining.toLocaleString()} ہے۔ براہ کرم جلد ادا کر دیں۔ شکریہ۔`;
                              const url = formatWhatsAppUrl(selectedCustomer.phone, message);
                              if (url) window.open(url, '_blank');
                            }}
                            className="p-2 bg-emerald-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                            title="Send WhatsApp Reminder"
                          >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-5 h-5 brightness-0 invert" alt="WA" />
                          </button>
                        )}
                      </div>
                   </div>
                   <div className="bg-amber-50 p-6 rounded-3xl space-y-1">
                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{isUrdu ? 'کل وزٹ' : 'Total Transactions'}</p>
                      <p className="text-2xl font-black text-amber-900">{selectedCustomer.transactionCount}</p>
                   </div>
                </div>

                {/* History Tabs */}
                <div className="p-8 space-y-8">
                  {/* Sales History */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-bold text-zinc-800 urdu-text flex items-center gap-2">
                       <CreditCard size={20} className="text-sky-500" />
                       {isUrdu ? 'سیلز ہسٹری' : 'Sales History'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCustomer.sales.map((sale, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-zinc-100 hover:border-sky-200 transition-colors flex justify-between items-center bg-zinc-50/50">
                          <div>
                            <p className="text-xs font-bold text-zinc-500">{formatDate(sale.date)}</p>
                            <p className="text-sm font-black text-zinc-900">Rs. {sale.total.toLocaleString()}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${sale.rem > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {sale.rem > 0 ? `Due: ${sale.rem}` : 'Paid'}
                          </div>
                        </div>
                      ))}
                      {selectedCustomer.sales.length === 0 && <p className="text-zinc-400 text-xs italic">No sales found</p>}
                    </div>
                  </div>

                  {/* Orders History */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-bold text-zinc-800 urdu-text flex items-center gap-2">
                       <Package size={20} className="text-amber-500" />
                       {isUrdu ? 'آرڈرز ہسٹری' : 'Orders History'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCustomer.orders.map((order, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-zinc-100 hover:border-amber-200 transition-colors flex justify-between items-center bg-zinc-50/50">
                          <div>
                            <p className="text-xs font-bold text-zinc-500">{order.item} ({formatDate(order.date)})</p>
                            <p className="text-sm font-black text-zinc-900">Rs. {order.total.toLocaleString()}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                            {order.status}
                          </div>
                        </div>
                      ))}
                      {selectedCustomer.orders.length === 0 && <p className="text-zinc-400 text-xs italic">No orders found</p>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-white/50 rounded-[2rem] border-2 border-dashed border-sky-100 min-h-[70vh]">
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-sky-200 mb-6 shadow-sm">
                  <User size={48} />
                </div>
                <h3 className="text-xl font-bold text-sky-900 urdu-text">
                  {isUrdu ? 'گاہک کا انتخاب کریں' : 'Select a Customer'}
                </h3>
                <p className="text-zinc-500 text-sm mt-2">
                  {isUrdu ? 'تفصیلات دیکھنے کے لیے فہرست سے انتخاب کریں' : 'Select from the list to view detailed history and balances'}
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
