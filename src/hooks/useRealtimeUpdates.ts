import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

interface RealtimeSignal {
  id: string;
  user_id: string;
  event_type: string;
  payload: {
    sender_name?: string;
    child_name?: string;
    student_name?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export function useRealtimeUpdates() {
  const { user, token, refreshBalance, refreshUnreadCounts } = useAuth();
  const { showToast } = useNotifications();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const userId = user?.id;
  const userRole = user?.role;

  useEffect(() => {
    if (!userId || !token) return;

    console.log('Setting up secure Realtime Signal Bus for user:', userId);

    const debounceRefresh = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        refreshUnreadCounts();
        window.dispatchEvent(new CustomEvent('sync-data'));
      }, 500);
    };

    const channel = supabase.channel(`realtime-bus-${userId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: '_logs', 
        table: 'realtime_bus', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => {
        const signal = payload.new as RealtimeSignal;
        console.log('Signal received from bus:', signal.event_type, signal.payload);
        
        switch (signal.event_type) {
          case 'balance':
            // Показываем уведомление, если баланс увеличился
            if (signal.payload && 
                typeof signal.payload === 'object' && 
                'new_balance' in signal.payload && 
                'old_balance' in signal.payload) {
              
              const payload = signal.payload as { new_balance: number, old_balance: number };
              if (payload.new_balance > payload.old_balance) {
                showToast(
                  'Баланс пополнен', 
                  `Ваш счет пополнен на ${payload.new_balance - payload.old_balance} руб.`, 
                  'green', 'check', true, 5
                );
              }
            }
            refreshBalance();
            debounceRefresh();
            break;
          case 'message':
            // Показываем уведомление только если есть имя отправителя
            if (signal.payload?.sender_name) {
              showToast(
                'Новое сообщение', 
                `Отправитель: ${signal.payload.sender_name}`, 
                'white', 'info', true, 5
              );
            }
            debounceRefresh();
            break;
          case 'notification':
            debounceRefresh();
            break;
          case 'consultation_requested':
            showToast(
              'Новая заявка', 
              `Пользователь ${signal.payload?.child_name || 'Неизвестный'} запросил консультацию.`, 
              'white', 'user', true, 300
            );
            debounceRefresh();
            break;
          case 'immediate_consultation_available':
            showToast(
              'СРОЧНАЯ ЗАЯВКА!', 
              `Пользователю ${signal.payload?.child_name || 'XXX'} требуется немедленная консультация по предмету: ${signal.payload?.specialization_name || 'предмет'} (${signal.payload?.duration} мин)`, 
              'red', 'clock', true, 600
            );
            debounceRefresh();
            break;
          case 'immediate_search_started':
            window.dispatchEvent(new CustomEvent('immediate_search_started', { detail: signal.payload }));
            break;
          case 'immediate_consultation_accepted':
            window.dispatchEvent(new CustomEvent('immediate_consultation_accepted', { detail: signal.payload }));
            debounceRefresh();
            break;
          case 'consultation_approved':
            showToast(
              'Заявка одобрена', 
              `Студент ${signal.payload?.student_name || 'Репетитор'} одобрил занятие. ${userRole === 'parent' ? 'Не забудьте его оплатить!' : ''}`, 
              'green', 'check', true, 300
            );
            debounceRefresh();
            break;
          case 'consultation_rejected':
            showToast(
              'Заявка отклонена', 
              `Студент ${signal.payload?.student_name || 'Репетитор'} отклонил занятие.`, 
              'red', 'cross', true, 10
            );
            debounceRefresh();
            break;
          case 'consultation':
          default:
            debounceRefresh();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Signal Bus: Subscribed successfully');
        }
      });

    return () => {
      console.log('Cleaning up Signal Bus subscription');
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [userId, userRole, token, refreshBalance, refreshUnreadCounts, showToast]);
}
