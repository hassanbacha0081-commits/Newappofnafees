import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Expense } from '../db';
import { 
  Plus, 
  Trash2, 
  Search, 
  Wallet, 
  Calendar as CalendarIcon,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Tag
} from 'lucide-react';
import { formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ExpensesProps {
  lang: string;
}

export default function Expenses({ lang }: ExpensesProps) {
  const isUrdu = lang === 'ur';
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    category: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  });

  const expenses = useLiveQuery(() => 
    db.expenses.orderBy('date').reverse().toArray()
  ) || [];

  const categories = [
    { id: 'rent', ur: 'کرایہ', en: 'Rent' },
    { id: 'utility', ur: 'بجلی/پانی', en: 'Utilities' },
    { id: 'staff', ur: 'اسٹاف/تنخواہ', en: 'Staff/Salary' },
    { id: 'tea', ur: 'چائے/کھانا', en: 'Food/Entertainment' },
    { id: 'marketing', ur: 'اشتہارات', en: 'Marketing/Ads' },
    { id: 'other', ur: 'متفرق', en: 'Misc' }
  ];

  const filteredExpenses = expenses.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const todayExpenses = expenses
    .filter(e => e.date === new Date().toISOString().split('T')[0])
    .reduce((acc, e) => acc + e.amount, 0);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.amount || !newExpense.category) return;

    await db.expenses.add({
      category: newExpense.category as string,
      description: newExpense.description || '',
      amount: Number(newExpense.amount),
      date: newExpense.date || new Date().toISOString().split('T')[0]
    });

    setShowAddForm(false);
    setNewExpense({
      category: '',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleDelete = async (id: number) => {
    if (confirm(isUrdu ? 'کیا آپ اس خرچ کو حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this expense?')) {
      await db.expenses.delete(id);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-sky-900 tracking-tight urdu-text">
            {isUrdu ? 'دکان کے اخراجات' : 'Shop Expenses'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            {isUrdu ? 'اپنے تمام روزانہ کے اخراجات یہاں ریکارڈ کریں' : 'Track all your daily operational costs here'}
          </p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-sky-600 text-white hover:bg-sky-700 transition-all font-bold shadow-lg shadow-sky-200"
        >
          <Plus size={20} />
          <span className="urdu-text">{isUrdu ? 'نیا خرچہ' : 'Add Expense'}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-sky-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-zinc-500 font-bold urdu-text text-sm mb-1">{isUrdu ? 'آج کا کل خرچ' : 'Today\'s Total'}</p>
            <p className="text-3xl font-black text-sky-900">Rs. {todayExpenses.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <ArrowUpRight size={32} />
          </div>
        </div>
        <div className="bg-sky-900 p-8 rounded-3xl text-white shadow-xl flex items-center justify-between overflow-hidden relative group">
          <div className="relative z-10">
            <p className="text-sky-200 font-bold urdu-text text-sm mb-1">{isUrdu ? 'مجموعی اخراجات' : 'All-time Expenses'}</p>
            <p className="text-3xl font-black">Rs. {totalExpenses.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white/10 rounded-2xl border border-white/20 relative z-10">
            <Wallet size={32} className="text-gold" />
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-gold/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
        </div>
      </div>

      {/* Filter & List */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-sky-50 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400" size={20} />
            <input 
              type="text"
              placeholder={isUrdu ? 'تلاش کریں...' : 'Search expenses...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-sky-50/50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold outline-none transition-all font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-sky-50">
          <table className="w-full text-left border-collapse">
            <thead className="bg-sky-50/50">
              <tr>
                <th className="p-5 text-zinc-500 font-black uppercase text-[10px] tracking-widest urdu-text">{isUrdu ? 'تاریخ' : 'Date'}</th>
                <th className="p-5 text-zinc-500 font-black uppercase text-[10px] tracking-widest urdu-text">{isUrdu ? 'زمرہ' : 'Category'}</th>
                <th className="p-5 text-zinc-500 font-black uppercase text-[10px] tracking-widest urdu-text">{isUrdu ? 'تفصیل' : 'Description'}</th>
                <th className="p-5 text-zinc-500 font-black uppercase text-[10px] tracking-widest urdu-text text-right">{isUrdu ? 'رقم' : 'Amount'}</th>
                <th className="p-5 text-zinc-500 font-black uppercase text-[10px] tracking-widest urdu-text text-center">{isUrdu ? 'عمل' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-50">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-sky-50/30 transition-colors group">
                  <td className="p-5 whitespace-nowrap">
                    <span className="text-sm font-bold text-zinc-400 font-mono italic">{formatDate(expense.date)}</span>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-gold"></div>
                       <span className="text-sm font-bold text-sky-900 urdu-text">
                        {categories.find(c => c.id === expense.category)?.[isUrdu ? 'ur' : 'en'] || expense.category}
                       </span>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className="text-sm font-medium text-zinc-600 truncate max-w-[200px] block urdu-text">{expense.description}</span>
                  </td>
                  <td className="p-5 text-right font-black text-sky-950 font-mono">
                    Rs. {expense.amount.toLocaleString()}
                  </td>
                  <td className="p-5 text-center">
                    <button 
                      onClick={() => expense.id && handleDelete(expense.id)}
                      className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <div className="py-20 text-center text-zinc-400 urdu-text italic bg-zinc-50/50">
              {isUrdu ? 'کوئی خرچہ ریکارڈ نہیں ملا' : 'No expenses found'}
            </div>
          )}
        </div>
      </div>

      {/* Add Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-sky-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-sky-100"
            >
              <div className="p-8 bg-sky-600 text-white flex justify-between items-center">
                 <h3 className="text-2xl font-black urdu-text">{isUrdu ? 'نیا خرچہ ریکارڈ کریں' : 'New Expense'}</h3>
                 <button onClick={() => setShowAddForm(false)} className="bg-white/10 p-2 rounded-xl border border-white/20 hover:bg-white/20 transition-all">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleAddExpense} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest urdu-text">{isUrdu ? 'تاریخ' : 'Date'}</label>
                  <input 
                    type="date"
                    required
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                    className="w-full p-4 bg-sky-50 border border-sky-100 rounded-2xl text-lg font-bold outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest urdu-text">{isUrdu ? 'زمرہ' : 'Category'}</label>
                  <select 
                    required
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                    className="w-full p-4 bg-sky-50 border border-sky-100 rounded-2xl text-lg font-bold outline-none focus:ring-2 focus:ring-gold urdu-text appearance-none"
                  >
                    <option value="">{isUrdu ? 'منتخب کریں...' : 'Select Category...'}</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c[isUrdu ? 'ur' : 'en']}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest urdu-text">{isUrdu ? 'رقم' : 'Amount'}</label>
                  <input 
                    type="number"
                    required
                    placeholder="0.00"
                    value={newExpense.amount || ''}
                    onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}
                    className="w-full p-4 bg-sky-50 border border-sky-100 rounded-2xl text-2xl font-black outline-none focus:ring-2 focus:ring-gold text-sky-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest urdu-text">{isUrdu ? 'تفصیل' : 'Description'}</label>
                  <textarea 
                    placeholder={isUrdu ? 'خرچے کی تفصیل لکھیں...' : 'Enter description...'}
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    rows={3}
                    className="w-full p-4 bg-sky-50 border border-sky-100 rounded-2xl text-base font-bold outline-none focus:ring-2 focus:ring-gold urdu-text"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-gold text-black font-black text-xl rounded-3xl hover:bg-gold-dark transition-all shadow-xl shadow-gold/20"
                >
                  {isUrdu ? 'محفوظ کریں' : 'Save Expense'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Support Icons
function X({ size }: { size: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
