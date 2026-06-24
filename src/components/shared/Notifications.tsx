import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, Check, Clock } from 'lucide-react';

interface Notification {
  id: string;
  content: string;
  type: string;
  read: boolean;
  created_at: string;
}

export function Notifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const ITEMS_PER_PAGE = 15;

  const notificationsRef = useRef<Notification[]>([]);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const loadNotifications = useCallback(async (isInitial = true, isSilent = false) => {
    if (!token) return;
    if (!isSilent) setIsLoading(true);

    const offset = isInitial ? 0 : notificationsRef.current.length;

    const { data, error } = await supabase.rpc('get_notifications', {
      p_token: token,
      p_unread_only: filter === 'unread',
      p_limit: ITEMS_PER_PAGE,
      p_offset: offset
    });

    if (error) {
      console.error('get_notifications error:', error);
      if (!isSilent) setIsLoading(false);
      return;
    }

    if (data) {
      const fetchedNotifications = data as Notification[];
      if (isInitial) {
        setNotifications(fetchedNotifications);
        setHasMore(fetchedNotifications.length === ITEMS_PER_PAGE);
      } else {
        setNotifications(prev => {
          // Фильтруем дубликаты, которые могли появиться из-за смещения страниц в БД
          const existingIds = new Set(prev.map(n => n.id));
          const newUniqueNotifications = fetchedNotifications.filter(n => !existingIds.has(n.id));
          return [...prev, ...newUniqueNotifications];
        });
        setHasMore(fetchedNotifications.length === ITEMS_PER_PAGE);
      }
    }
    if (!isSilent) setIsLoading(false);
  }, [filter, token]);

  useEffect(() => {
    loadNotifications(true);

    const handleSync = () => {
      console.log('Notifications: sync-data event received');
      loadNotifications(true, true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [token, filter, loadNotifications]); // Re-run when filter or token changes (via loadNotifications dependency)

  const markAsRead = async (notificationId: string) => {
    if (!token) return;

    await supabase.rpc('mark_notification_read', {
      p_token: token,
      p_notification_id: notificationId,
    });

    // Вместо полной перезагрузки, обновляем локальное состояние
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    
    // Если фильтр 'unread', то после отметки как прочитанного оно должно пропасть
    if (filter === 'unread') {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;

    await supabase.rpc('mark_all_notifications_read', { p_token: token });
    loadNotifications(true);
  };

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Уведомления</h1>
        <button
          onClick={markAllAsRead}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Check size={20} />
          Прочитать все
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        {(['unread', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f === 'all' ? 'Все' : 'Непрочитанные'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {notifications.length === 0 && !isLoading ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
            Нет уведомлений
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl shadow-md p-4 transition-colors ${
                  notification.read ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <Bell size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">{notification.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                      <Clock size={14} />
                      <span>
                        {new Date(notification.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                    >
                      Прочитано
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => loadNotifications(false)}
                  disabled={isLoading}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Загрузка...' : 'Загрузить еще'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}