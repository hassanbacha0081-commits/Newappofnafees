import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  MessageCircle, 
  X, 
  Search, 
  Calendar, 
  DollarSign, 
  Wrench, 
  Package, 
  ExternalLink, 
  Filter,
  AlertCircle,
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Language, translations } from '../translations';
import { useAppNotifications, buildWhatsAppReminderUrl, AppNotification } from '../lib/notifications';
import { formatCurrency, formatDate } from '../lib/utils';
import { db } from '../db';

interface NotificationsCenterProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  shopName: string;
  onNavigateToSection?: (section: 'orders' | 'repairs', searchId?: number) => void;
}

export default function NotificationsCenter({
  isOpen,
  onClose,
  lang,
  shopName,
  onNavigateToSection
}: NotificationsCenterProps) {
  const isUrdu = lang === 'ur';
  const { notifications, totalCount, overdueCount, dueTodayCount, upcomingCount } = useAppNotifications();

  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'installments' | 'repairs'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [snoozedIds, setSnoozedIds] = useState<string[]>([]);

  // Load snoozed/dismissed IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('snoozed_notifications');
      if (stored) {
        setSnoozedIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load snoozed notifications:', e);
    }
  }, []);

  const handleSnooze = (id: string) => {
    const updated = [...snoozedIds, id];
    setSnoozedIds(updated);
    try {
      localStorage.setItem('snoozed_notifications', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save snoozed notifications:', e);
    }
  };

  const handleClearSnoozed = () => {
    setSnoozedIds([]);
    try {
      localStorage.removeItem('snoozed_notifications');
    } catch (e) {
      console.error('Failed to clear snoozed notifications:', e);
    }
  };

  // Filter notifications based on tab, search, and snoozed list
  const activeNotifications = notifications.filter((n) => {
    if (snoozedIds.includes(n.id)) return false;

    if (activeTab === 'overdue' && n.severity !== 'overdue') return false;
    if (activeTab === 'installments' && n.type !== 'order_installment') return false;
    if (activeTab === 'repairs' && n.type !== 'repair_deadline') return false;

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const matchName = n.customerName.toLowerCase().includes(query);
      const matchPhone = n.customerPhone.includes(query);
      const matchItem = n.itemName.toLowerCase().includes(query);
      return matchName || matchPhone || matchItem;
    }

    return true;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex justify-end">
        {/* Backdrop click */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          onClick={onClose}
        />

        {/* Panel Content */}
        <motion.div
          initial={{ x: isUrdu ? '-100%' : '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isUrdu ? '-100%' : '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className={`relative z-10 w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-x border-slate-200 ${
            isUrdu ? 'rtl font-nastaliq' : 'ltr font-sans'
          }`}
          dir={isUrdu ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-sky-900 text-white p-5 border-b border-sky-700/50 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-400/30 text-amber-300">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  {isUrdu ? 'اطلاعات اور تنبیہات' : 'Notifications & Alerts'}
                  {notifications.length > 0 && (
                    <span className="bg-amber-500 text-slate-950 font-mono text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {notifications.length - snoozedIds.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-sky-200/80 mt-0.5">
                  {isUrdu
                    ? 'اقساط کی واجب الادا تاریخیں اور مرمت کی ڈیڈ لائنز'
                    : 'Upcoming Qist due dates & repair delivery deadlines'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-sky-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-center">
            <div className="bg-red-50 border border-red-200/80 rounded-xl p-2.5">
              <span className="text-[11px] font-bold text-red-600 block">
                {isUrdu ? 'تاخیر شدہ (Overdue)' : 'Overdue'}
              </span>
              <span className="text-lg font-black font-mono text-red-700">{overdueCount}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5">
              <span className="text-[11px] font-bold text-amber-700 block">
                {isUrdu ? 'آج واجب الادا (Due Today)' : 'Due Today'}
              </span>
              <span className="text-lg font-black font-mono text-amber-800">{dueTodayCount}</span>
            </div>
            <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-2.5">
              <span className="text-[11px] font-bold text-blue-700 block">
                {isUrdu ? 'جلد انے والے (Upcoming)' : 'Due Soon'}
              </span>
              <span className="text-lg font-black font-mono text-blue-800">{upcomingCount}</span>
            </div>
          </div>

          {/* Search & Tabs Controls */}
          <div className="p-4 bg-white border-b border-slate-200 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className={`absolute top-3 text-slate-400 w-4 h-4 ${isUrdu ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isUrdu ? 'کسٹمر کا نام، موبائل یا آئٹم تلاش کریں...' : 'Search customer, phone or item...'}
                className={`w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:border-amber-500 focus:bg-white outline-none text-slate-800 transition-all ${
                  isUrdu ? 'pr-9' : 'pl-9'
                }`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className={`absolute top-2.5 text-slate-400 hover:text-slate-600 ${isUrdu ? 'left-3' : 'right-3'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                  activeTab === 'all'
                    ? 'bg-sky-900 text-white border-sky-900 shadow-sm'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {isUrdu ? 'تمام' : 'All'} ({notifications.length - snoozedIds.length})
              </button>
              <button
                onClick={() => setActiveTab('overdue')}
                className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'overdue'
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {isUrdu ? 'تاخیر شدہ' : 'Overdue'} ({overdueCount})
              </button>
              <button
                onClick={() => setActiveTab('installments')}
                className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'installments'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                {isUrdu ? 'اقساط (Qist)' : 'Installments'}
              </button>
              <button
                onClick={() => setActiveTab('repairs')}
                className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'repairs'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                {isUrdu ? 'مرمت (Repairs)' : 'Repairs'}
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/50">
            {activeNotifications.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-200 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {isUrdu ? 'تمام کام اور اقساط اپ ٹو ڈیٹ ہیں!' : 'All clear! No pending alerts'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    {isUrdu
                      ? 'کوئی تاخیر شدہ قسط یا واجب الادا مرمت موجود نہیں ہے۔'
                      : 'You have no upcoming or overdue installments or repair deadlines right now.'}
                  </p>
                </div>
                {snoozedIds.length > 0 && (
                  <button
                    onClick={handleClearSnoozed}
                    className="mt-2 text-xs text-amber-700 underline font-bold hover:text-amber-900"
                  >
                    {isUrdu ? 'خفیہ/مخفی کی گئی اطلاعات دوبارہ دکھائیں' : 'Reset hidden alerts'}
                  </button>
                )}
              </div>
            ) : (
              activeNotifications.map((notification) => {
                const isOverdue = notification.severity === 'overdue';
                const isDueToday = notification.severity === 'due_today';
                const isInstallment = notification.type === 'order_installment';

                let badgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
                let badgeLabel = isUrdu
                  ? `${notification.daysDifference} دنوں میں`
                  : `In ${notification.daysDifference} days`;

                if (isOverdue) {
                  badgeBg = 'bg-red-100 text-red-800 border-red-300';
                  badgeLabel = isUrdu
                    ? `${Math.abs(notification.daysDifference)} دن تاخیر`
                    : `${Math.abs(notification.daysDifference)} days overdue`;
                } else if (isDueToday) {
                  badgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
                  badgeLabel = isUrdu ? 'آج واجب الادا' : 'Due Today';
                }

                const whatsappUrl = buildWhatsAppReminderUrl(notification, shopName, lang);

                return (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group ${
                      isOverdue
                        ? 'border-red-300 ring-1 ring-red-100'
                        : isDueToday
                        ? 'border-amber-300 ring-1 ring-amber-100'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Top Stripe Color */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1.5 ${
                        isOverdue ? 'bg-red-600' : isDueToday ? 'bg-amber-500' : 'bg-sky-500'
                      }`}
                    />

                    <div className="flex justify-between items-start gap-2 mb-2 pt-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`p-2 rounded-xl flex items-center justify-center ${
                            isInstallment ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {isInstallment ? <DollarSign className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                        </span>
                        <div>
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            {isInstallment
                              ? isUrdu
                                ? 'آرڈر قسط / واجب الادا'
                                : 'Order Installment'
                              : isUrdu
                              ? 'مرمت کی ڈیڈ لائن'
                              : 'Repair Deadline'}
                          </span>
                          <h4 className="text-base font-black text-slate-900 leading-tight">
                            {notification.customerName}
                          </h4>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-2xs ${badgeBg}`}
                      >
                        {badgeLabel}
                      </span>
                    </div>

                    {/* Notification Details */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 my-2.5 text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="text-slate-500">{isUrdu ? 'آئٹم:' : 'Item:'}</span>
                        <span className="font-bold text-slate-900">{notification.itemName}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="text-slate-500">{isUrdu ? 'موبائل نمبر:' : 'Phone:'}</span>
                        <span className="font-mono font-bold text-slate-800" dir="ltr">
                          {notification.customerPhone || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="text-slate-500">{isUrdu ? 'تاریخ واجب الادا:' : 'Due Date:'}</span>
                        <span className="font-mono font-bold text-slate-900">{notification.dueDate}</span>
                      </div>
                      {notification.amountDue !== undefined && notification.amountDue > 0 && (
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                          <span className="text-slate-600 font-bold">
                            {isInstallment
                              ? isUrdu
                                ? 'بقایا قسط رقم:'
                                : 'Remaining Balance:'
                              : isUrdu
                              ? 'مرمت کے چارجز:'
                              : 'Repair Charges:'}
                          </span>
                          <span className="font-mono font-black text-amber-700 text-sm">
                            {formatCurrency(notification.amountDue)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {/* Send WhatsApp Reminder */}
                      {notification.customerPhone ? (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{isUrdu ? 'یاد دہانی بھیجیں' : 'WhatsApp Reminder'}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-italic">
                          {isUrdu ? 'فون نمبر موجود نہیں' : 'No Phone'}
                        </span>
                      )}

                      {/* View Record in App */}
                      {onNavigateToSection && (
                        <button
                          onClick={() => {
                            onNavigateToSection(
                              isInstallment ? 'orders' : 'repairs',
                              notification.targetId
                            );
                            onClose();
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1 transition-all border border-slate-200"
                        >
                          <span>{isUrdu ? 'دیکھیں' : 'View'}</span>
                          <ChevronRight className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      {/* Dismiss / Acknowledge */}
                      <button
                        onClick={() => handleSnooze(notification.id)}
                        title={isUrdu ? 'اطلاع چھپائیں' : 'Dismiss Alert'}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                      >
                        <Check className="w-4 h-4 text-emerald-600" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-3 bg-white border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-between">
            <span className="text-[11px]">
              {isUrdu ? 'آٹومیٹک نوٹیفکیشن الرٹ سسٹم' : 'Automatic In-App Alert System'}
            </span>
            {snoozedIds.length > 0 && (
              <button
                onClick={handleClearSnoozed}
                className="text-[11px] text-sky-800 hover:underline font-bold"
              >
                {isUrdu ? `خفیہ کی گئی (${snoozedIds.length}) دکھائیں` : `Show hidden (${snoozedIds.length})`}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
