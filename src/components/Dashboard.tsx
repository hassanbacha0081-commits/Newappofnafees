import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  ShoppingBag, 
  History, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  Package,
  BadgeDollarSign
} from 'lucide-react';
import { formatDate } from '../lib/utils';

interface DashboardProps {
  lang: string;
  setActiveSection: (section: any) => void;
}

export default function Dashboard({ lang, setActiveSection }: DashboardProps) {
  const isUrdu = lang === 'ur';
  const today = new Date().toISOString().split('T')[0];

  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const purchases = useLiveQuery(() => db.goldPurchases.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const repairs = useLiveQuery(() => db.repairs.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];

  const stats = useMemo(() => {
    const todaySales = sales.filter(s => s.date === today);
    const todayExpenses = expenses.filter(e => e.date === today);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const yesterdaySales = sales.filter(s => s.date === yesterdayStr);

    const totalTodayRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
    const totalTodayExpenses = todayExpenses.reduce((acc, e) => acc + e.amount, 0);
    const totalYesterdayRevenue = yesterdaySales.reduce((acc, s) => acc + s.total, 0);

    const revenueGrowth = totalYesterdayRevenue > 0 
      ? ((totalTodayRevenue - totalYesterdayRevenue) / totalYesterdayRevenue) * 100 
      : 100;

    const totalPendingAmount = sales.reduce((acc, s) => acc + (s.rem || 0), 0) + 
                          orders.reduce((acc, o) => acc + (o.rem || 0), 0);

    const totalGoldSold = sales.reduce((acc, s) => {
      return acc + s.items.reduce((sum, item) => sum + item.w, 0);
    }, 0);

    const totalGoldPurchased = purchases.reduce((acc, p) => acc + p.weight, 0);
    const currentStockEstimate = totalGoldPurchased - totalGoldSold;

    // Financial calculations
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const totalPurchasedValue = purchases.reduce((acc, p) => acc + p.total, 0);
    const totalExp = expenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = totalRevenue - totalPurchasedValue - totalExp;

    // Chart Data (Last 7 days)
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dStr = d.toISOString().split('T')[0];
      const daySales = sales.filter(s => s.date === dStr);
      const dayPurchases = purchases.filter(p => p.date === dStr);
      const dayExpenses = expenses.filter(e => e.date === dStr);
      
      return {
        name: d.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-US', { weekday: 'short' }),
        sales: daySales.reduce((sum, s) => sum + s.total, 0),
        purchases: dayPurchases.reduce((sum, p) => sum + p.total, 0),
        expenses: dayExpenses.reduce((sum, e) => sum + e.amount, 0)
      };
    });

    return {
      todayRevenue: totalTodayRevenue,
      todayExpenses: totalTodayExpenses,
      revenueGrowth,
      pendingAmount: totalPendingAmount,
      goldStock: currentStockEstimate,
      netProfit,
      activeOrders: orders.filter(o => o.status !== 'Completed').length,
      pendingRepairs: repairs.filter(r => r.status === 'Pending').length,
      chartData,
      recentSales: sales.slice(-5).reverse(),
      recentPurchases: purchases.slice(-5).reverse()
    };
  }, [sales, purchases, orders, repairs, expenses, today, lang]);

  const cards = [
    {
      title: isUrdu ? 'آج کی سیلز' : 'Today\'s Sales',
      value: `Rs. ${stats.todayRevenue.toLocaleString()}`,
      trend: `${stats.revenueGrowth.toFixed(1)}%`,
      trendUp: stats.revenueGrowth >= 0,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-500'
    },
    {
      title: isUrdu ? 'خالص منافع' : 'Net Business Profit',
      value: `Rs. ${stats.netProfit.toLocaleString()}`,
      trend: isUrdu ? 'مجموعی جائزہ' : 'Total Overview',
      trendUp: stats.netProfit >= 0,
      icon: BadgeDollarSign,
      color: 'bg-sky-600',
      textColor: 'text-sky-600'
    },
    {
      title: isUrdu ? 'کل واجب الادا' : 'Pending Payments',
      value: `Rs. ${stats.pendingAmount.toLocaleString()}`,
      trend: isUrdu ? 'کل رقم' : 'Total Amount',
      trendUp: false,
      icon: BadgeDollarSign,
      color: 'bg-amber-500',
      textColor: 'text-amber-500'
    },
    {
      title: isUrdu ? 'موجودہ اسٹاک' : 'Current Stock',
      value: `${stats.goldStock.toFixed(2)}g`,
      trend: isUrdu ? 'خالص تخمینہ' : 'Net Weight',
      trendUp: stats.goldStock > 0,
      icon: Package,
      color: 'bg-gold',
      textColor: 'text-gold'
    }
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-sky-900 tracking-tight urdu-text">
            {isUrdu ? 'کاروباری جائزہ' : 'Business Dashboard'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">{isUrdu ? 'خوش آمدید! آپ کے کاروبار کی تازہ ترین صورتحال یہاں ہے' : 'Welcome back! Here is your business at a glance'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveSection('billing')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-all font-bold shadow-lg shadow-sky-200"
          >
            <Plus size={20} />
            <span className="urdu-text">{isUrdu ? 'نیا بل' : 'New Bill'}</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-sky-100 shadow-sm relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${card.color}`}></div>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${card.color}/10 ${card.textColor}`}>
                <card.icon size={24} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${card.trendUp ? 'text-emerald-500' : 'text-amber-500'}`}>
                {card.trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {card.trend}
              </div>
            </div>
            <h3 className="text-zinc-500 text-sm font-bold urdu-text mb-1">{card.title}</h3>
            <p className="text-2xl font-black text-zinc-900 tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-sky-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-sky-900 urdu-text flex items-center gap-2">
              <History className="text-gold" size={24} />
              {isUrdu ? 'سیلز گراف' : 'Sales Trends'}
            </h3>
            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-500"></div>
                Sales
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gold"></div>
                Purchase
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                Expense
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPurchased" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v) => `Rs.${v >= 1000 ? v/1000 + 'k' : v}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }} 
                />
                <Area type="monotone" dataKey="sales" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="purchases" stroke="#fbbf24" strokeWidth={3} fillOpacity={1} fill="url(#colorPurchased)" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-8 rounded-3xl border border-sky-100 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-sky-900 urdu-text flex items-center gap-2">
            <History className="text-sky-500" size={24} />
            {isUrdu ? 'حالیہ ریکارڈز' : 'Recent Sales'}
          </h3>
          <div className="space-y-4">
            {stats.recentSales.map((sale, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-sky-50 transition-colors cursor-pointer group" onClick={() => setActiveSection('records')}>
                <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 font-bold group-hover:bg-sky-600 group-hover:text-white transition-all">
                  {sale.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{sale.name}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">{formatDate(sale.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-zinc-900">Rs. {sale.total.toLocaleString()}</p>
                  <p className={`text-[10px] font-bold ${sale.rem > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {sale.rem > 0 ? (isUrdu ? 'باقی: ' : 'Rem: ') + sale.rem : (isUrdu ? 'مکمل' : 'Paid')}
                  </p>
                </div>
              </div>
            ))}
            {stats.recentSales.length === 0 && (
              <div className="py-12 text-center text-zinc-400 urdu-text italic">
                {isUrdu ? 'کوئی ریکارڈ نہیں ملا' : 'No recent sales found'}
              </div>
            )}
          </div>
          <button 
            onClick={() => setActiveSection('records')}
            className="w-full py-3 rounded-xl bg-zinc-50 text-sky-600 font-bold text-sm hover:bg-sky-100 transition-colors"
          >
            {isUrdu ? 'تمام ریکارڈز دیکھیں' : 'View All Records'}
          </button>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-sky-600 p-8 rounded-3xl text-white shadow-xl shadow-sky-200 flex items-center justify-between overflow-hidden relative group">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
          <div className="space-y-2 relative z-10">
            <h4 className="text-sky-100/80 font-bold text-sm urdu-text">{isUrdu ? 'ایکٹیو کسٹمرز' : 'Total Customers'}</h4>
            <p className="text-4xl font-black">{sales.length + orders.length}</p>
          </div>
          <div className="p-4 bg-white/10 rounded-2xl border border-white/20 relative z-10">
             <Users size={40} className="text-gold" />
          </div>
        </div>

        <div className="bg-zinc-900 p-8 rounded-3xl text-white shadow-xl shadow-zinc-200 flex items-center justify-between overflow-hidden relative group cursor-pointer hover:bg-black transition-all" onClick={() => setActiveSection('purchases')}>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-gold/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
          <div className="space-y-2 relative z-10">
            <h4 className="text-zinc-400 font-bold text-sm urdu-text">{isUrdu ? 'حالیہ خریداری' : 'Today\'s Gold Bought'}</h4>
            <p className="text-4xl font-black text-gold">
              {purchases.filter(p => p.date === today).reduce((acc, p) => acc + p.weight, 0).toFixed(2)}g
            </p>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 relative z-10">
             <ShoppingBag size={40} className="text-gold" />
          </div>
        </div>
      </div>
    </div>
  );
}
