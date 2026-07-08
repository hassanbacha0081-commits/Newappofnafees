import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { translations, type Language } from '../translations';
import { TrendingUp, Users, ShoppingBag, CreditCard, PieChart as PieChartIcon, BarChart as BarChartIcon, History, Filter, Download as DownloadIcon, Calendar, CheckCircle2 } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ReportsProps {
  lang: Language;
}

export default function Reports({ lang }: ReportsProps) {
  const t = translations[lang];

  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  const sales = useLiveQuery(() => db.sales?.toArray() || Promise.resolve([]));
  const orders = useLiveQuery(() => db.orders?.toArray() || Promise.resolve([]));

  // Helper to parse DD/MM/YYYY to Date object
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    return new Date(dateStr);
  };

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    if (!dateRange.start && !dateRange.end) return sales;

    return sales.filter(sale => {
      const saleDate = parseDate(sale.date);
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;

      if (start && saleDate < start) return false;
      if (end) {
        // Set end to end of day
        const endDay = new Date(end);
        endDay.setHours(23, 59, 59, 999);
        if (saleDate > endDay) return false;
      }
      return true;
    });
  }, [sales, dateRange]);

  const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalReceivedAmount = filteredSales.reduce((sum, sale) => sum + sale.rec, 0);
  const totalRemainingAmount = filteredSales.reduce((sum, sale) => sum + sale.rem, 0);
  
  const totalOrders = orders?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
  const completedOrders = orders?.filter(o => o.status === 'complete' || o.status === 'delivered').length || 0;
  const inProgressOrders = orders?.filter(o => o.status === 'progress').length || 0;

  const chartData = useMemo(() => {
    if (!sales) return [];
    
    const groups: { [key: string]: { date: string, total: number, received: number } } = {};
    
    // Group sales by date
    sales.forEach(sale => {
      const date = sale.date;
      if (!groups[date]) {
        groups[date] = { date, total: 0, received: 0 };
      }
      groups[date].total += sale.total;
      groups[date].received += sale.rec;
    });
    
    // Convert to array and sort
    return Object.values(groups).sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return dateA.getTime() - dateB.getTime();
    }).slice(-7); // Last 7 days
  }, [sales]);

  const orderStatusData = [
    { name: lang === 'ur' ? "زیر التواء" : "Pending", value: pendingOrders, color: '#ef6c00' },
    { name: lang === 'ur' ? "جاری" : "In Progress", value: inProgressOrders, color: '#1565c0' },
    { name: lang === 'ur' ? "مکمل" : "Completed", value: completedOrders, color: '#2e7d32' },
  ];

  const stats = [
    {
      title: lang === 'ur' ? "کل فروخت" : "Total Sales",
      value: totalSalesAmount,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      title: lang === 'ur' ? "وصول شدہ رقم" : "Received Amount",
      value: totalReceivedAmount,
      icon: CreditCard,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      title: lang === 'ur' ? "باقی رقم" : "Remaining Amount",
      value: totalRemainingAmount,
      icon: CreditCard,
      color: "text-red-600",
      bg: "bg-red-50"
    },
    {
      title: lang === 'ur' ? "کل آرڈرز" : "Total Orders",
      value: totalOrders,
      icon: ShoppingBag,
      color: "text-gold-dark",
      bg: "bg-gold-10"
    }
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gold-20 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-gold-dark urdu-text">{t.reports}</h2>
          <p className="text-zinc-500 text-sm">{lang === 'ur' ? 'کاروباری سرگرمیوں کا خلاصہ اور تجزیہ' : 'Summary and analysis of business activities'}</p>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-sky-100 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-1 border-r border-sky-100">
            <Calendar size={16} className="text-gold-dark" />
            <span className="text-xs font-bold text-zinc-600 urdu-text">{lang === 'ur' ? 'فلٹر:' : 'Filter:'}</span>
          </div>
          <input 
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="text-xs p-1 rounded border border-sky-50 focus:ring-1 focus:ring-gold outline-none"
          />
          <span className="text-zinc-400 text-xs urdu-text">{lang === 'ur' ? 'سے' : 'to'}</span>
          <input 
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="text-xs p-1 rounded border border-sky-50 focus:ring-1 focus:ring-gold outline-none"
          />
          {(dateRange.start || dateRange.end) && (
            <button 
              onClick={() => setDateRange({ start: '', end: '' })}
              className="text-[10px] bg-zinc-100 px-2 py-1 rounded hover:bg-zinc-200 urdu-text"
            >
              ری سیٹ
            </button>
          )}
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl border border-sky-200 shadow-sm hover:border-gold-30 transition-all group">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110 shadow-sm`}>
                <stat.icon size={28} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 urdu-text uppercase tracking-wider">{stat.title}</p>
                <p className={`text-2xl font-black ${stat.color} font-mono`}>Rs. {stat.value.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-xl border border-sky-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChartIcon className="text-gold-dark" size={20} />
              <h3 className="text-xl font-bold urdu-text text-zinc-900">فروخت کا گراف (Last 7 Days)</h3>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: '#71717a' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#71717a' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#18181b' }}
                  itemStyle={{ color: '#d4af37' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Legend iconType="circle" align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
                <Bar 
                  name={lang === 'ur' ? "کل فروخت" : "Total Sales"} 
                  dataKey="total" 
                  fill="#d4af37" 
                  radius={[6, 6, 0, 0]} 
                  barSize={20}
                />
                <Bar 
                  name={lang === 'ur' ? "وصول شدہ" : "Received"} 
                  dataKey="received" 
                  fill="#16a34a" 
                  radius={[6, 6, 0, 0]} 
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-zinc-900 text-white p-6 rounded-xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-gold">
              <History size={20} />
              <h3 className="text-xl font-bold urdu-text">لین دین کی تاریخ (History)</h3>
            </div>
            <div className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 font-bold tracking-widest uppercase">
              {filteredSales.length} Transactions
            </div>
          </div>
          
          <div className="flex-1 overflow-auto max-h-[300px] custom-scrollbar">
            {filteredSales.length > 0 ? (
              <table className="w-full text-left">
                <thead className="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                  <tr>
                    <th className="pb-3 urdu-text px-2">{lang === 'ur' ? 'تاریخ' : 'Date'}</th>
                    <th className="pb-3 urdu-text px-2">{lang === 'ur' ? 'کسٹمر' : 'Cust'}</th>
                    <th className="pb-3 urdu-text px-2 text-right">{lang === 'ur' ? 'رقم' : 'Amt'}</th>
                    <th className="pb-3 urdu-text px-2 text-right">{lang === 'ur' ? 'وصول' : 'Rec'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredSales.slice().reverse().map((sale) => (
                    <tr key={sale.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-2 text-xs font-mono text-zinc-400">{sale.date}</td>
                      <td className="py-3 px-2 text-sm urdu-text truncate max-w-[100px]">{sale.name}</td>
                      <td className="py-3 px-2 text-sm text-right font-bold text-white">{sale.total.toLocaleString()}</td>
                      <td className="py-3 px-2 text-sm text-right font-bold text-green-400">{sale.rec.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-10">
                <Filter size={32} className="mb-2 opacity-20" />
                <p className="urdu-text">{lang === 'ur' ? 'کوئی لین دین نہیں ملا' : 'No transactions found'}</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 p-3 rounded-lg">
              <p className="text-[10px] text-zinc-500 uppercase mb-1 urdu-text">کل فروخت</p>
              <p className="text-xl font-black text-white">{totalSalesAmount.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-800/50 p-3 rounded-lg">
              <p className="text-[10px] text-zinc-500 uppercase mb-1 urdu-text">صاف بقایا</p>
              <p className="text-xl font-black text-red-400">{totalRemainingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Order Distribution Chart */}
        <div className="bg-white p-6 rounded-xl border border-sky-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="text-gold-dark" size={20} />
            <h3 className="text-xl font-bold urdu-text text-zinc-900">آرڈر کی صورتحال (Order Status)</h3>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {orderStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#18181b', fontSize: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Business Summary Cards */}
        <div className="bg-gradient-to-br from-gold/5 to-transparent p-6 rounded-xl border border-gold/10 shadow-sm">
          <h3 className="text-xl font-bold mb-6 urdu-text text-zinc-900 border-b border-gold/10 pb-2 flex items-center gap-2">
            <TrendingUp size={20} className="text-gold-dark" />
            کاروباری رپورٹ (Summary)
          </h3>
          <div className="grid gap-4">
            <div className="bg-white p-4 rounded-xl border border-sky-100 flex items-center justify-between group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gold/10 text-gold-dark rounded-xl">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Active Orders</p>
                  <p className="font-bold urdu-text text-zinc-700">زیر التواء آرڈرز</p>
                </div>
              </div>
              <span className="text-3xl font-black text-gold-dark">{pendingOrders}</span>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-sky-100 flex items-center justify-between group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Success Rate</p>
                  <p className="font-bold urdu-text text-zinc-700">مکمل آرڈرز</p>
                </div>
              </div>
              <span className="text-3xl font-black text-green-600">{completedOrders}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-sky-100 flex items-center justify-between group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-zinc-900 text-white rounded-xl">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Customer Loyalty</p>
                  <p className="font-bold urdu-text text-zinc-700">کل کسٹمرز (سیلز)</p>
                </div>
              </div>
              <span className="text-3xl font-black text-zinc-900">{sales?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
