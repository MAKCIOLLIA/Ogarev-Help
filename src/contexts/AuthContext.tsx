import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import { useNotifications } from './NotificationContext';

interface UnreadCounts {
  notifications: number;
  messages: number;
  applications: number;
  pendingPayments: number;
}

interface TestStatus {
  is_student: boolean;
  accepted_code_at: string | null;
  entrance_test: {
    exists: boolean;
    test_id: string;
    status: 'not_started' | 'started' | 'failed' | 'passed' | 'pending_admin';
    can_retry: boolean;
    retry_after?: string;
  };
  subject_tests: {
    id: string;
    name: string;
    test_id: string;
    status: string;
  }[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  switchToChild: (childId: string) => Promise<void>;
  switchToParent: (password?: string) => Promise<{ success: boolean; error?: string }>;
  renewToken: (password: string) => Promise<boolean>;
  updateUser: (userData: Partial<User>) => void;
  loading: boolean;
  refreshBalance: () => Promise<void>;
  isTokenExpired: boolean;
  unreadCounts: UnreadCounts;
  refreshUnreadCounts: () => Promise<void>;
  testStatus: TestStatus | null;
  refreshTestStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useNotifications();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    notifications: 0,
    messages: 0,
    applications: 0,
    pendingPayments: 0,
  });
  const [testStatus, setTestStatus] = useState<TestStatus | null>(null);

  // Refs для предотвращения дублирования уведомлений
  const lastNotifiedBalance = useRef<number | null>(null);
  const lastNotifiedPendingBalance = useRef<number | null>(null);

  // Глобальный слушатель ошибок токена
  useEffect(() => {
    const handleError = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('Token expired')) {
        setIsTokenExpired(true);
      }
    };

    window.addEventListener('unhandledrejection', handleError);
    return () => window.removeEventListener('unhandledrejection', handleError);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase.rpc('get_my_balance', { p_token: token });
      if (!error && data && data.length > 0) {
        const newVal = data[0];
        
        // Проверяем по Refs, а не по стейту, чтобы избежать гонки данных
        if (lastNotifiedBalance.current !== null && lastNotifiedBalance.current !== newVal.balance) {
          const diff = newVal.balance - lastNotifiedBalance.current;
          const text = diff > 0 ? `Ваш счёт пополнился на ${diff}р.` : `С вашего счёта списалось ${Math.abs(diff)}р.`;
          showToast('Обновление баланса', text, diff > 0 ? 'green' : 'yellow', 'info', true, 300);
        }
        
        if (lastNotifiedPendingBalance.current !== null && lastNotifiedPendingBalance.current !== newVal.pending_balance) {
          const diff = newVal.pending_balance - lastNotifiedPendingBalance.current;
          const text = diff > 0 ? `На ваш замороженный счёт поступило ${diff}р.` : `С вашего замороженного счёта списалось ${Math.abs(diff)}р.`;
          showToast('Обновление баланса', text, diff > 0 ? 'green' : 'yellow', 'clock', true, 300);
        }

        lastNotifiedBalance.current = newVal.balance;
        lastNotifiedPendingBalance.current = newVal.pending_balance;
        
        setUser(prev => {
          if (!prev) return null;
          const updatedUser = { ...prev, balance: newVal.balance, pending_balance: newVal.pending_balance };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          return updatedUser;
        });
      }
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, [token, showToast]);

  const refreshUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase.rpc('get_unread_counts', { p_token: token });
      if (!error && data && data.length > 0) {
        setUnreadCounts({
          notifications: parseInt(data[0].unread_notifications) || 0,
          messages: parseInt(data[0].unread_messages) || 0,
          applications: parseInt(data[0].pending_applications) || 0,
          pendingPayments: parseInt(data[0].pending_payments) || 0,
        });
      }
    } catch (err) {
      console.error('Failed to refresh unread counts:', err);
    }
  }, [token]);

  const refreshTestStatus = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase.rpc('get_student_test_status', { p_token: token });
      if (!error && data) {
        setTestStatus(data);
      }
    } catch (err) {
      console.error('Failed to refresh test status:', err);
    }
  }, [token]);

  // Инициализация
  useEffect(() => {
    const init = async () => {
      const storedUser = localStorage.getItem('currentUser');
      const storedToken = localStorage.getItem('authToken');
      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        
        // Первичная загрузка данных (без уведомлений)
        try {
          const [balanceRes, countsRes, testRes] = await Promise.all([
            supabase.rpc('get_my_balance', { p_token: storedToken }),
            supabase.rpc('get_unread_counts', { p_token: storedToken }),
            supabase.rpc('get_student_test_status', { p_token: storedToken })
          ]);

          if (!balanceRes.error && balanceRes.data?.length > 0) {
            const b = balanceRes.data[0];
            lastNotifiedBalance.current = b.balance;
            lastNotifiedPendingBalance.current = b.pending_balance;
            const updatedUser = { ...parsedUser, balance: b.balance, pending_balance: b.pending_balance };
            setUser(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          }

          if (!countsRes.error && countsRes.data?.length > 0) {
            setUnreadCounts({
              notifications: parseInt(countsRes.data[0].unread_notifications) || 0,
              messages: parseInt(countsRes.data[0].unread_messages) || 0,
              applications: parseInt(countsRes.data[0].pending_applications) || 0,
              pendingPayments: parseInt(countsRes.data[0].pending_payments) || 0,
            });
          }

          if (!testRes.error && testRes.data) {
            setTestStatus(testRes.data);
          }
        } catch (err) {
          console.error('Initial sync error:', err);
        }
      }
      setLoading(false);
    };

    init();
  }, []);

  // Сохраняем состояние авторизации в localStorage
  const persistSession = useCallback((userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    localStorage.setItem('authToken', authToken);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase.rpc('login_user', {
        p_email: email,
        p_password: password,
        p_user_agent: navigator.userAgent,
      });

      if (error) {
        console.error('Login error:', error);
        return null;
      }

      if (!data || data.length === 0) return null;

      const { auth_token, ...userData } = data[0];

      if (userData.role === 'student' && userData.status === 'pending') {
        showToast('Ожидание подтверждения', 'Ваш профиль ожидает подтверждения администратором', 'white', 'info');
        return null;
      }
      if (userData.role === 'student' && userData.status === 'rejected') {
        showToast('Доступ отклонен', 'Ваш профиль был отклонен администратором', 'red', 'cross');
        return null;
      }

      persistSession(userData as User, auth_token);
      
      // Сразу после логина обновляем данные
      const refresh = async (t: string) => {
        const [b, c, ts] = await Promise.all([
          supabase.rpc('get_my_balance', { p_token: t }),
          supabase.rpc('get_unread_counts', { p_token: t }),
          supabase.rpc('get_student_test_status', { p_token: t })
        ]);
        if (!b.error && b.data?.length > 0) {
          lastNotifiedBalance.current = b.data[0].balance;
          lastNotifiedPendingBalance.current = b.data[0].pending_balance;
          setUser(prev => prev ? { ...prev, balance: b.data[0].balance, pending_balance: b.data[0].pending_balance } : null);
        }
        if (!c.error && c.data?.length > 0) {
          setUnreadCounts({
            notifications: parseInt(c.data[0].unread_notifications) || 0,
            messages: parseInt(c.data[0].unread_messages) || 0,
            applications: parseInt(c.data[0].pending_applications) || 0,
            pendingPayments: parseInt(c.data[0].pending_payments) || 0,
          });
        }
        if (!ts.error && ts.data) {
          setTestStatus(ts.data);
        }
      };
      refresh(auth_token);
      
      return userData as User;
    } catch (err) {
      console.error('Login exception:', err);
      return null;
    }
  }, [persistSession, showToast]);

  const logout = useCallback(async () => {
    if (!token) {
      clearSession();
      return;
    }

    try {
      const { error } = await supabase.rpc('logout_user_by_token', { p_token: token });
      if (error) {
        console.error('Logout error:', error);
        showToast('Ошибка выхода', `Не удалось завершить сеанс на сервере. Пожалуйста, попробуйте еще раз. Ошибка: ${error.message}`, 'red', 'cross');
        return;
      }
      clearSession();
    } catch (err) {
      console.error('Logout exception:', err);
      showToast('Ошибка выхода', 'Произошла ошибка при выходе из системы. Проверьте консоль для получения дополнительной информации.', 'red', 'cross');
    }
  }, [token, clearSession, showToast]);

  // Родитель переключается на аккаунт ребёнка.
  const switchToChild = useCallback(async (childId: string) => {
    if (!token) return;

    const { data, error } = await supabase.rpc('switch_to_child', {
      p_token: token,
      p_child_id: childId,
    });

    if (error || !data || data.length === 0) {
      console.error('switchToChild error:', error);
      return;
    }

    const { auth_token: childToken, ...childUser } = data[0];

    persistSession(childUser as User, childToken);
    
    // Обновляем данные для нового токена
    const [b, c, ts] = await Promise.all([
      supabase.rpc('get_my_balance', { p_token: childToken }),
      supabase.rpc('get_unread_counts', { p_token: childToken }),
      supabase.rpc('get_student_test_status', { p_token: childToken })
    ]);
    if (!b.error && b.data?.length > 0) {
      lastNotifiedBalance.current = b.data[0].balance;
      lastNotifiedPendingBalance.current = b.data[0].pending_balance;
      setUser(prev => prev ? { ...prev, balance: b.data[0].balance, pending_balance: b.data[0].pending_balance } : null);
    }
    if (!c.error && c.data?.length > 0) {
      setUnreadCounts({
        notifications: parseInt(c.data[0].unread_notifications) || 0,
        messages: parseInt(c.data[0].unread_messages) || 0,
        applications: parseInt(c.data[0].pending_applications) || 0,
        pendingPayments: parseInt(c.data[0].pending_payments) || 0,
      });
    }
    if (!ts.error && ts.data) {
      setTestStatus(ts.data);
    }
  }, [token, persistSession]);

  const renewToken = useCallback(async (password: string) => {
    if (!token) return false;
    
    const { data, error } = await supabase.rpc('renew_token', {
      p_token: token,
      p_password: password
    });

    if (error) {
      console.error('renewToken error:', error);
      return false;
    }

    if (data) {
      setIsTokenExpired(false);
      refreshUnreadCounts();
      refreshBalance();
      refreshTestStatus();
      return true;
    }
    
    return false;
  }, [token, refreshUnreadCounts, refreshBalance]);

  const switchToParent = useCallback(async (password?: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'No active session' };
    if (!password) return { success: false, error: 'Password required' };

    const { data, error } = await supabase.rpc('switch_to_parent', { 
      p_token: token,
      p_password: password 
    });

    if (error) {
      console.error('switchToParent error:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Failed to switch to parent' };
    }

    localStorage.removeItem('parentToken');
    localStorage.removeItem('parentUser');

    const { auth_token: parentToken, ...parentUser } = data[0];
    persistSession(parentUser as User, parentToken);
    
    // Обновляем данные для нового токена
    const [b, c, ts] = await Promise.all([
      supabase.rpc('get_my_balance', { p_token: parentToken }),
      supabase.rpc('get_unread_counts', { p_token: parentToken }),
      supabase.rpc('get_student_test_status', { p_token: parentToken })
    ]);
    if (!b.error && b.data?.length > 0) {
      lastNotifiedBalance.current = b.data[0].balance;
      lastNotifiedPendingBalance.current = b.data[0].pending_balance;
      setUser(prev => prev ? { ...prev, balance: b.data[0].balance, pending_balance: b.data[0].pending_balance } : null);
    }
    if (!c.error && c.data?.length > 0) {
      setUnreadCounts({
        notifications: parseInt(c.data[0].unread_notifications) || 0,
        messages: parseInt(c.data[0].unread_messages) || 0,
        applications: parseInt(c.data[0].pending_applications) || 0,
        pendingPayments: parseInt(c.data[0].pending_payments) || 0,
      });
    }
    if (!ts.error && ts.data) {
      setTestStatus(ts.data);
    }
    
    return { success: true };
  }, [token, persistSession]);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updatedUser = { ...prev, ...userData };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);


  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      switchToChild,
      switchToParent,
      renewToken,
      updateUser,
      refreshBalance,
      loading,
      isTokenExpired,
      unreadCounts,
      refreshUnreadCounts,
      testStatus,
      refreshTestStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}