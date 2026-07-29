import { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Order, type Repair } from '../db';
import { Language, translations } from '../translations';
import { formatCurrency, formatDate, formatWhatsAppUrl } from './utils';

export interface AppNotification {
  id: string; // e.g. "order-12" or "repair-5"
  type: 'order_installment' | 'repair_deadline';
  targetId: number;
  customerName: string;
  customerPhone: string;
  itemName: string;
  amountDue?: number;
  dueDate: string; // YYYY-MM-DD
  daysDifference: number; // negative if overdue, 0 if today, positive if future
  severity: 'overdue' | 'due_today' | 'upcoming';
  status: string;
  originalRecord: Order | Repair;
}

const DISMISSED_STORAGE_KEY = 'dismissed_notifications';

export function getDismissedNotificationIds(): string[] {
  try {
    const item = localStorage.getItem(DISMISSED_STORAGE_KEY) || localStorage.getItem('snoozed_notifications');
    return item ? JSON.parse(item) : [];
  } catch {
    return [];
  }
}

export function saveDismissedNotificationIds(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(ids));
    localStorage.setItem('snoozed_notifications', JSON.stringify(ids));
    window.dispatchEvent(new Event('dismissed_notifications_updated'));
  } catch (e) {
    console.error('Failed to save dismissed notifications:', e);
  }
}

export function dismissNotification(id: string) {
  const current = getDismissedNotificationIds();
  if (!current.includes(id)) {
    saveDismissedNotificationIds([...current, id]);
  }
}

export function dismissAllNotifications(idsToDismiss: string[]) {
  const current = getDismissedNotificationIds();
  const updated = Array.from(new Set([...current, ...idsToDismiss]));
  saveDismissedNotificationIds(updated);
}

export function restoreNotification(id: string) {
  const current = getDismissedNotificationIds();
  saveDismissedNotificationIds(current.filter((i) => i !== id));
}

export function clearAllDismissedNotifications() {
  saveDismissedNotificationIds([]);
}

export function useAppNotifications() {
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const repairs = useLiveQuery(() => db.repairs.toArray()) || [];

  const [dismissedIds, setDismissedIds] = useState<string[]>(getDismissedNotificationIds);

  useEffect(() => {
    const handleUpdate = () => {
      setDismissedIds(getDismissedNotificationIds());
    };
    window.addEventListener('dismissed_notifications_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('dismissed_notifications_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);

    const rawNotifications: AppNotification[] = [];

    // Process Orders (Installments / Due Payments)
    orders.forEach((order) => {
      if (!order.id) return;

      // Check if order is pending or active and has remaining balance or non-completed status
      const isCompleted =
        order.status === 'delivered' ||
        order.status === 'مکمل' ||
        order.status === 'Done' ||
        order.status === 'دی دیا گیا';

      const remaining = order.rem ?? (order.total - (order.payments?.reduce((s, p) => s + p.amt, 0) || 0));

      if (!isCompleted && order.due) {
        const due = new Date(order.due);
        if (!isNaN(due.getTime())) {
          const diffTime = due.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Alert if overdue, due today, or due within 7 days
          if (diffDays <= 7) {
            let severity: 'overdue' | 'due_today' | 'upcoming' = 'upcoming';
            if (diffDays < 0) severity = 'overdue';
            else if (diffDays === 0) severity = 'due_today';

            rawNotifications.push({
              id: `order-${order.id}`,
              type: 'order_installment',
              targetId: order.id,
              customerName: order.name,
              customerPhone: order.phone,
              itemName: order.item,
              amountDue: Math.max(0, remaining),
              dueDate: order.due,
              daysDifference: diffDays,
              severity,
              status: order.status,
              originalRecord: order,
            });
          }
        }
      }
    });

    // Process Repairs (Repair Deadlines)
    repairs.forEach((repair) => {
      if (!repair.id) return;

      if (repair.status === 'Pending') {
        let deadlineStr = repair.dueDate;
        
        // If no explicit dueDate set, check if created repair date is 3+ days old
        if (!deadlineStr && repair.date) {
          const repairCreated = new Date(repair.date);
          if (!isNaN(repairCreated.getTime())) {
            // Default deadline 3 days after creation
            const autoDeadline = new Date(repairCreated);
            autoDeadline.setDate(autoDeadline.getDate() + 3);
            deadlineStr = autoDeadline.toISOString().split('T')[0];
          }
        }

        if (deadlineStr) {
          const due = new Date(deadlineStr);
          if (!isNaN(due.getTime())) {
            const diffTime = due.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 7) {
              let severity: 'overdue' | 'due_today' | 'upcoming' = 'upcoming';
              if (diffDays < 0) severity = 'overdue';
              else if (diffDays === 0) severity = 'due_today';

              rawNotifications.push({
                id: `repair-${repair.id}`,
                type: 'repair_deadline',
                targetId: repair.id,
                customerName: repair.customerName,
                customerPhone: repair.customerPhone,
                itemName: repair.item,
                amountDue: repair.charges || 0,
                dueDate: deadlineStr,
                daysDifference: diffDays,
                severity,
                status: repair.status,
                originalRecord: repair,
              });
            }
          }
        }
      }
    });

    // Sort by urgency: overdue first, then due today, then upcoming, then by due date
    rawNotifications.sort((a, b) => {
      const severityOrder = { overdue: 0, due_today: 1, upcoming: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.daysDifference - b.daysDifference;
    });

    // Separate active notifications from checked/dismissed ones
    const notifications = rawNotifications.filter((n) => !dismissedIds.includes(n.id));
    const dismissedNotifications = rawNotifications.filter((n) => dismissedIds.includes(n.id));

    const overdueCount = notifications.filter((n) => n.severity === 'overdue').length;
    const dueTodayCount = notifications.filter((n) => n.severity === 'due_today').length;
    const upcomingCount = notifications.filter((n) => n.severity === 'upcoming').length;

    return {
      allNotifications: rawNotifications,
      notifications, // Active notifications only
      dismissedNotifications, // Checked / hidden notifications
      dismissedIds,
      totalCount: notifications.length,
      overdueCount,
      dueTodayCount,
      upcomingCount,
      orders,
      repairs,
      dismissNotification,
      dismissAllNotifications,
      restoreNotification,
      clearAllDismissedNotifications,
    };
  }, [orders, repairs, dismissedIds]);
}

export function buildWhatsAppReminderUrl(notification: AppNotification, shopName: string, lang: Language): string {
  const isUrdu = lang === 'ur';
  let message = '';

  if (notification.type === 'order_installment') {
    if (isUrdu) {
      message = `اسلام علیکم ${notification.customerName} صاحب!\n` +
        `نفیس جیولرز (${shopName}) کی طرف سے یاد دہانی:\n` +
        `آپ کے آرڈر "${notification.itemName}" کی بقایا رقم ${notification.amountDue ? notification.amountDue.toLocaleString() + ' روپے' : ''} کی ادائیگی کی آخری تاریخ ${notification.dueDate} ہے۔\n` +
        `برائے مہربانی وقت پر رقم جمع کروائیں۔ شکریہ!`;
    } else {
      message = `Assalam-o-Alaikum ${notification.customerName}!\n` +
        `Payment reminder from ${shopName}:\n` +
        `Your order "${notification.itemName}" has an installment/remaining balance of Rs ${notification.amountDue ? notification.amountDue.toLocaleString() : '0'} due on ${notification.dueDate}.\n` +
        `Please kindly process the payment. Thank you!`;
    }
  } else {
    if (isUrdu) {
      message = `اسلام علیکم ${notification.customerName} صاحب!\n` +
        `نفیس جیولرز (${shopName}) کی طرف سے آپ کی مرمت (${notification.itemName}) کے بارے میں اطلاع:\n` +
        `آپ کا مرمتی سامان تیار / جائزہ کے مرحلے میں ہے۔ برائے مہربانی دکان سے رابطہ فرمائیں۔ شکریہ!`;
    } else {
      message = `Assalam-o-Alaikum ${notification.customerName}!\n` +
        `Update regarding your repair item "${notification.itemName}" from ${shopName}:\n` +
        `Your repair item deadline is ${notification.dueDate}. Please contact us for details. Thank you!`;
    }
  }

  return formatWhatsAppUrl(notification.customerPhone, message);
}
