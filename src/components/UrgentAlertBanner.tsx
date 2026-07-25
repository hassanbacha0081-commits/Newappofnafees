import React, { useState } from 'react';
import { AlertTriangle, Bell, ChevronRight, X } from 'lucide-react';
import { useAppNotifications } from '../lib/notifications';
import { Language } from '../translations';

interface UrgentAlertBannerProps {
  onOpenNotifications: () => void;
  lang: Language;
}

export function UrgentAlertBanner({ onOpenNotifications, lang }: UrgentAlertBannerProps) {
  const { overdueCount, dueTodayCount, totalCount } = useAppNotifications();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || (overdueCount === 0 && dueTodayCount === 0)) {
    return null;
  }

  const isUrdu = lang === 'ur';

  return (
    <div
      className={`mb-4 rounded-2xl p-3.5 border shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-sm transition-all ${
        overdueCount > 0
          ? 'bg-gradient-to-r from-red-900 via-red-800 to-amber-900 border-red-700/60 text-white'
          : 'bg-gradient-to-r from-amber-900 via-amber-800 to-sky-900 border-amber-700/60 text-white'
      } ${isUrdu ? 'rtl font-nastaliq' : 'ltr font-sans'}`}
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-amber-300 shrink-0">
          <AlertTriangle className="w-5 h-5 animate-bounce" />
        </div>
        <div>
          <h4 className="font-bold text-white text-base leading-tight">
            {isUrdu
              ? overdueCount > 0
                ? `توجه: ${overdueCount} قسط/مرمت کی تاریخ گزر چکی ہے!`
                : `اطلاع: ${dueTodayCount} قسط/مرمت کی ڈیڈ لائن آج ہے!`
              : overdueCount > 0
              ? `Attention: ${overdueCount} items are overdue!`
              : `Notice: ${dueTodayCount} items are due today!`}
          </h4>
          <p className="text-xs text-amber-100/90 mt-0.5">
            {isUrdu
              ? 'کسٹمرز کو وقت پر ڈیلیوری اور اداائگی کی یاد دہانی کے لیے نوٹیفکیشن چیک کریں۔'
              : 'Check notifications to send WhatsApp reminders or view details.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <button
          onClick={onOpenNotifications}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all whitespace-nowrap"
        >
          <Bell className="w-3.5 h-3.5 text-slate-950" />
          <span>{isUrdu ? 'تفصیلات دیکھیں' : 'View Alerts'}</span>
          <ChevronRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title={isUrdu ? 'بند کریں' : 'Dismiss'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
