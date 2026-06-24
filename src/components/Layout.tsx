import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, User as UserIcon, MessageSquare, Bell,
  Calendar, FileText, Users, Settings, BookText, LayoutDashboard, TrendingUp, CreditCard, Search
} from 'lucide-react';
import BalanceWidget from './shared/BalanceWidget';
import { Child } from '../types';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, token, logout, unreadCounts } = useAuth();
  const [childrenList, setChildrenList] = useState<Child[]>([]);

  const getUnreadCount = (id: string) => {
    switch (id) {
      case 'messages': return unreadCounts.messages;
      case 'notifications': return unreadCounts.notifications;
      case 'applications': return unreadCounts.applications;
      case 'finances': return unreadCounts.pendingPayments;
      default: return 0;
    }
  };

  const loadChildren = useCallback(async () => {
    if (!token) return;

    const { data, error } = await supabase.rpc('get_children_for_menu', { p_token: token });
    if (error) console.error('get_children_for_menu error:', error);
    else setChildrenList(data || []);
  }, [token]);

  useEffect(() => {
    if (user?.role === 'parent' && token) {
      loadChildren();
    }
  }, [user, token, loadChildren]);

  const getMenuItems = () => {
    if (user?.role === 'student') {
      return [
        { id: 'profile',        label: 'Профиль',           icon: UserIcon },
        { id: 'dashboard',      label: 'Личный кабинет',    icon: LayoutDashboard },
        { id: 'applications',   label: 'Заявки',            icon: FileText },
        { id: 'schedule',       label: 'Моё расписание',    icon: Calendar },
        { id: 'consultations',  label: 'Мои консультации',  icon: FileText },
        { id: 'recommendations', label: 'Методический блок',icon: BookText },
        { id: 'materials',      label: 'Материалы',         icon: BookText },
        { id: 'messages',       label: 'Сообщения',         icon: MessageSquare },
        { id: 'notifications',  label: 'Уведомления',       icon: Bell },
        { id: 'finance',        label: 'Финансы',           icon: TrendingUp },
      ];
    }

    if (user?.role === 'parent') {
      const base = [
        { id: 'profile',          label: 'Профиль',          icon: UserIcon },
        { id: 'dashboard',        label: 'Личный кабинет',   icon: LayoutDashboard },
        { id: 'recommendations',  label: 'Методический блок',icon: BookText },
        { id: 'calendar',         label: 'Календарь',        icon: Calendar },
        { id: 'finances',         label: 'Финансы',          icon: CreditCard },
        { id: 'new-consultation', label: 'Найти репетитора', icon: Search },
        { id: 'messages',         label: 'Сообщения',        icon: MessageSquare },
        { id: 'notifications',    label: 'Уведомления',      icon: Bell },
        { id: 'children',         label: 'Мои дети',         icon: Users },
      ];
      const childItems = childrenList.map((child) => ({
        id: `child-${child.child_user_id}`,
        label: child.full_name,
        icon: UserIcon,
      }));
      return [...base, ...childItems];
    }

    if (user?.role === 'child') {
      return [
        { id: 'dashboard',         label: 'Личный кабинет',                      icon: LayoutDashboard },
        { id: 'profile',           label: 'Профиль',                      icon: UserIcon },
        { id: 'recommendations',   label: 'Методический блок',                 icon: BookText },
        { id: 'messages',          label: 'Сообщения',                   icon: MessageSquare },
        { id: 'notifications',     label: 'Уведомления',                  icon: Bell },
        { id: 'new-consultation',  label: 'Новая консультация',           icon: Calendar },
        { id: 'consultations',     label: 'Мои консультации',             icon: FileText },
        { id: 'switch-parent',     label: 'Перейти в профиль родителя',   icon: UserIcon },
      ];
    }

    if (user?.role === 'admin') {
      return [
        { id: 'profile',         label: 'Профиль',          icon: UserIcon },
        { id: 'admin-panel',     label: 'Админ панель',     icon: Settings },
        { id: 'messages',        label: 'Сообщения',        icon: MessageSquare },
        { id: 'notifications',   label: 'Уведомления',      icon: Bell },
      ];
    }

    return [];
  };

  const menuItems = getMenuItems();

  return (
    <div className="h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-black text-blue-900 uppercase tracking-tighter">Огарёв - <span className="text-blue-600">Точка знаний</span></h1>
          <BalanceWidget />
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeTab === item.id || 
                    (item.id === 'dashboard' && activeTab === 'profile' && (user?.role === 'child' || user?.role === 'student') && !localStorage.getItem('activeTab'))
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                  }`}
                >
                  <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-blue-500'} />
                  <span className="text-sm font-bold flex-1 text-left">{item.label}</span>
                  {getUnreadCount(item.id) > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === item.id ? 'bg-white text-blue-600' : 'bg-red-600 text-white'
                    }`}>
                      {getUnreadCount(item.id)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors font-bold"
          >
            <LogOut size={20} />
            <span className="text-sm">Выйти</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}