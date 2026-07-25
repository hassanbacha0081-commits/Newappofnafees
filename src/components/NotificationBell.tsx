import React from 'react';
import { Bell } from 'lucide-react';
import { useAppNotifications } from '../lib/notifications';
import { Language } from '../translations';

interface NotificationBellProps {
  onClick: () => void;
  lang: Language;
}

export function NotificationBell({ onClick, lang }: NotificationBellProps) {
  const { totalCount, overdueCount } = useAppNotifications();

  const isUrdu = lang === 'ur';

  return (
    <button
      onClick={onClick}
      className="relative p-2.5 rounded-xl bg-sky-700/60 hover:bg-sky-700 text-sky-100 hover:text-white transition-all border border-sky-500/50 shadow-sm flex items-center gap-2 group"
      title={isUrdu ? 'اطلاعات اور تنبیہات' : 'Notifications & Alerts'}
    >
      <div className="relative">
        <Bell size={20} className="group-hover:scale-110 transition-transform text-amber-300" />
        {totalCount > 0 && (
          <span
            className={`absolute -top-1.5 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-mono font-black text-white px-1 shadow-md ${
              overdueCount > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
            }`}
          >
            {totalCount}
          </span>
        )}
      </div>
      <span className="hidden md:inline text-xs font-bold text-sky-100 group-hover:text-amber-300 transition-colors">
        {isUrdu ? 'اطلاعات' : 'Alerts'}
      </span>
    </button>
  );
}
