import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  Edit, Save, X, ChevronLeft, ChevronRight, Search, Filter, 
  Wallet, TrendingUp, Users, Calendar, Star, Clock, 
  ArrowRight, User as UserIcon, RefreshCw, Plus, Minus
} from 'lucide-react';
import { User } from '../../types';
import { getAvatarUrl, getErrorMessage } from '../../lib/utils';
import ConsultationModal from '../shared/ConsultationModal';
import { ExtendedConsultation } from '../shared/ConsultationCard';

const PAGE_SIZE = 30;

interface EditUserForm {
  full_name: string;
  email: string;
  status: string;
  newPassword?: string;
}

interface UserStats {
  completed_count?: number;
  cancelled_count?: number;
  average_rating?: number;
  total_ratings?: number;
  favorites_count?: number;
  skills?: string;
  anti_skills?: string;
  parent_id?: string;
  parent_name?: string;
  children_count?: number;
  children?: { id: string; full_name: string }[];
}

interface UserDetailedInfo {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  balance: number;
  pending_balance: number;
  created_at: string;
  profile_photo_path: string | null;
  bio: string;
  stats: UserStats;
}

interface UserDetailsModalProps {
  userId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onBack: () => void;
  hasHistory: boolean;
  token: string | null;
  onBalanceChange: () => void;
}

interface UserConsultationsModalProps {
  userId: string | null;
  token: string | null;
  onClose: () => void;
}

export default function UsersTab() {
  const { token } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({
    full_name: '',
    email: '',
    status: '',
    newPassword: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [navigationStack, setNavigationStack] = useState<string[]>([]);

  const loadUsers = useCallback(async (page: number) => {
    if (!token) return;

    const { data, error } = await supabase.rpc('get_all_users', {
      p_token: token,
      p_page_number: page,
      p_page_size: PAGE_SIZE,
      p_search_query: searchQuery || null,
      p_role_filter: roleFilter || null,
      p_status_filter: statusFilter || null,
    });
    
    if (error) {
      console.error('get_all_users error:', error);
    } else if (data && data.length > 0) {
      setUsers(data[0].users_data || []);
      setTotalUsers(data[0].total_users || 0);
    } else {
      setUsers([]);
      setTotalUsers(0);
    }
  }, [token, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    if (token) loadUsers(currentPage);
  }, [token, currentPage, loadUsers]);

  const handleEditClick = (user: User) => {
    setEditingId(user.id);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      status: user.status,
      newPassword: '',
    });
  };

  const handleRowDoubleClick = (userId: string) => {
    setDetailsId(userId);
    setNavigationStack([userId]);
  };

  const handleSave = async (userId: string) => {
    if (!token) return;

    const { error } = await supabase.rpc('update_user_admin', {
      p_token: token,
      p_user_id: userId,
      p_full_name: editForm.full_name,
      p_email: editForm.email,
      p_status: editForm.status,
      p_password: editForm.newPassword || null,
    });

    if (error) {
      showToast('Ошибка', getErrorMessage(error), 'red', 'cross');
    } else {
      showToast('Успешно', 'Данные пользователя обновлены', 'green', 'check');
      setEditingId(null);
      loadUsers(currentPage);
    }
    };

    const handleDelete = async (userId: string, userRole: string) => {
    if (!token) return;
    if (userRole === 'admin') {
      showToast('Внимание', 'Нельзя удалить администратора', 'yellow', 'alert');
      return;
    }

    confirm({
      title: 'Удаление пользователя',
      message: 'Вы уверены, что хотите удалить этого пользователя?',
      onConfirm: async () => {
        const { error } = await supabase.rpc('delete_user_admin', {
          p_token: token,
          p_user_id: userId,
        });

        if (error) {
          showToast('Ошибка', getErrorMessage(error), 'red', 'cross');
        } else {
          showToast('Успешно', 'Пользователь удален', 'green', 'check');
          loadUsers(currentPage);
        }
      }
    });
    };


  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const navigateToUser = (userId: string) => {
    setDetailsId(userId);
    setNavigationStack(prev => [...prev, userId]);
  };

  const navigateBack = () => {
    if (navigationStack.length > 1) {
      const newStack = [...navigationStack];
      newStack.pop();
      setNavigationStack(newStack);
      setDetailsId(newStack[newStack.length - 1]);
    } else {
      setDetailsId(null);
      setNavigationStack([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Фильтры */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ФИО или Email..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
            >
              <option value="">Все роли</option>
              <option value="student">Репетитор</option>
              <option value="parent">Родитель</option>
              <option value="child">Школьник</option>
              <option value="admin">Админ</option>
            </select>
          </div>
        </div>
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
          <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
            >
              <option value="">Все статусы</option>
              <option value="active">Активен</option>
              <option value="pending">Ожидание</option>
              <option value="rejected">Отклонён</option>
            </select>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Пользователь</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата регистрации</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onDoubleClick={() => handleRowDoubleClick(user.id)}
                >
                  {editingId === user.id ? (
                    <>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.profile_photo_path ? (
                            <img src={getAvatarUrl(user.profile_photo_path) || ''} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                              {user.full_name.charAt(0)}
                            </div>
                          )}
                          <input
                            type="text"
                            value={editForm.full_name}
                            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                            className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.role}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="active">Активен</option>
                          <option value="pending">Ожидание</option>
                          <option value="rejected">Отклонён</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(user.id)}
                            className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                            title="Сохранить"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Отмена"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="mt-2">
                          <input
                            type="password"
                            placeholder="Новый пароль"
                            value={editForm.newPassword || ''}
                            onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center gap-3">
                          {user.profile_photo_path ? (
                            <img src={getAvatarUrl(user.profile_photo_path) || ''} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                              {user.full_name.charAt(0)}
                            </div>
                          )}
                          {user.full_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'student' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'parent' ? 'bg-teal-100 text-teal-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : user.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2 transition-opacity">
                          <button
                            onClick={() => handleEditClick(user)}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Редактировать"
                          >
                            <Edit size={16} />
                          </button>
                          {user.role !== 'admin' && (
                            <button
                              onClick={() => handleDelete(user.id, user.role)}
                              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                              title="Удалить"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Пользователи не найдены. Попробуйте изменить параметры поиска.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-700">
              Страница {currentPage} из {totalPages} <span className="text-gray-400 font-normal ml-2">({totalUsers} всего)</span>
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        )}
      </div>

      <UserDetailsModal 
        userId={detailsId}
        onClose={() => { setDetailsId(null); setNavigationStack([]); }}
        onNavigate={navigateToUser}
        onBack={navigateBack}
        hasHistory={navigationStack.length > 1}
        token={token}
        onBalanceChange={() => loadUsers(currentPage)}
      />
    </div>
  );
}

function UserDetailsModal({ userId, onClose, onNavigate, onBack, hasHistory, token, onBalanceChange }: UserDetailsModalProps) {
  const { showToast } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [userData, setUserDetailedData] = useState<UserDetailedInfo | null>(null);
  const [showConsultations, setShowConsultations] = useState(false);
  
  const loadData = useCallback(async () => {
    if (!userId || !token) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_user_detailed_info_admin', {
      p_token: token,
      p_target_user_id: userId
    });
    if (!error && data) {
      setUserDetailedData(data);
    } else {
        console.error('get_user_detailed_info_admin error:', error);
    }
    setLoading(false);
  }, [userId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdjustBalance = async (type: 'balance' | 'pending', delta: number) => {
    if (!userId || !token) return;
    const reason = prompt('Укажите причину корректировки:');
    if (reason === null) return;

    const { error } = await supabase.rpc('admin_adjust_balance', {
      p_token: token,
      p_user_id: userId,
      p_balance_delta: type === 'balance' ? delta : 0,
      p_pending_delta: type === 'pending' ? delta : 0,
      p_reason: reason || 'Корректировка администратором'
    });

    if (error) {
      showToast('Ошибка', error.message, 'red', 'cross');
    } else {
      showToast('Успешно', 'Баланс скорректирован', 'green', 'check');
      // Optimistic update for the modal
      setUserDetailedData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          balance: type === 'balance' ? prev.balance + delta : prev.balance,
          pending_balance: type === 'pending' ? prev.pending_balance + delta : prev.pending_balance
        };
      });
      onBalanceChange();
    }
  };

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-50 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b">
          <div className="flex items-center gap-3">
            {hasHistory && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Назад"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-800">Профиль пользователя</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
            <RefreshCw className="animate-spin text-blue-600" size={48} />
            <p className="text-gray-500 font-medium">Загрузка данных...</p>
          </div>
        ) : userData ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Main Info Card */}
            <div className="bg-white rounded-xl shadow-sm border flex flex-col md:flex-row gap-6">
              <div className="relative group shrink-0 self-center md:self-start">
                 {userData.profile_photo_path ? (
                    <img src={getAvatarUrl(userData.profile_photo_path) || ''} alt="" className="w-32 h-32 rounded-xl object-cover shadow-md" />
                 ) : (
                    <div className="w-32 h-32 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-4xl font-bold shadow-inner">
                        {userData.full_name.charAt(0)}
                    </div>
                 )}
                 <div className="absolute -bottom-2 -right-2 px-3 py-1 bg-white rounded-lg shadow-md border text-xs font-bold uppercase tracking-wider text-blue-600">
                    {userData.role}
                 </div>
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{userData.full_name}</h3>
                  <p className="text-gray-500">{userData.email}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <Calendar size={18} className="text-blue-500" />
                        <span>Регистрация: {new Date(userData.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <TrendingUp size={18} className="text-green-500" />
                        <span>Статус: <span className="font-semibold">{userData.status}</span></span>
                    </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        <Wallet size={14} /> Управление балансом
                    </h4>
                    <div className="flex flex-wrap gap-6">
                        <div className="space-y-1">
                            <p className="text-xs text-blue-600">Доступно</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-gray-900">{userData.balance} ₽</span>
                                <div className="flex gap-1">
                                    <button onClick={() => handleAdjustBalance('balance', 100)} className="p-1 hover:bg-green-100 text-green-600 rounded"><Plus size={14}/></button>
                                    <button onClick={() => handleAdjustBalance('balance', -100)} className="p-1 hover:bg-red-100 text-red-600 rounded"><Minus size={14}/></button>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1 border-l pl-6 border-blue-200">
                            <p className="text-xs text-blue-600">В пути (заморозка)</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-gray-900">{userData.pending_balance} ₽</span>
                                <div className="flex gap-1">
                                    <button onClick={() => handleAdjustBalance('pending', 100)} className="p-1 hover:bg-green-100 text-green-600 rounded"><Plus size={14}/></button>
                                    <button onClick={() => handleAdjustBalance('pending', -100)} className="p-1 hover:bg-red-100 text-red-600 rounded"><Minus size={14}/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {userData.role === 'student' && (
                    <>
                        <div 
                          onClick={() => setShowConsultations(true)}
                          className="bg-white p-4 rounded-xl shadow-sm border hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-green-50 text-green-600 rounded-xl group-hover:scale-110 transition-transform">
                                    <Clock size={20} />
                                </div>
                                <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{userData.stats.completed_count}</p>
                            <p className="text-xs text-gray-500 font-medium">Завершено консультаций</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                                    <X size={20} />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{userData.stats.cancelled_count}</p>
                            <p className="text-xs text-gray-500 font-medium">Отменено</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-yellow-50 text-yellow-600 rounded-xl">
                                    <Star size={20} />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <p className="text-2xl font-bold text-gray-900">{userData.stats.average_rating}</p>
                                <p className="text-sm text-gray-400">({userData.stats.total_ratings})</p>
                            </div>
                            <p className="text-xs text-gray-500 font-medium">Рейтинг</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
                                    <Star size={20} />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{userData.stats.favorites_count}</p>
                            <p className="text-xs text-gray-500 font-medium">В избранном</p>
                        </div>
                    </>
                )}

                {userData.role === 'child' && (
                    <>
                        <div 
                          onClick={() => setShowConsultations(true)}
                          className="bg-white p-4 rounded-xl shadow-sm border hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group col-span-2"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                                    <Calendar size={20} />
                                </div>
                                <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{userData.stats.completed_count}</p>
                            <p className="text-xs text-gray-500 font-medium">Посещено консультаций</p>
                        </div>
                        <div 
                          onClick={() => userData.stats.parent_id && onNavigate(userData.stats.parent_id)}
                          className="bg-white p-4 rounded-xl shadow-sm border hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group col-span-2"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                                    <Users size={20} />
                                </div>
                                <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500" />
                            </div>
                            <p className="text-lg font-bold text-gray-900 truncate">{userData.stats.parent_name}</p>
                            <p className="text-xs text-gray-500 font-medium">Родитель (перейти)</p>
                        </div>
                    </>
                )}

                {userData.role === 'parent' && (
                    <>
                        <div className="bg-white p-4 rounded-xl shadow-sm border col-span-1">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <Users size={20} />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{userData.stats.children_count}</p>
                            <p className="text-xs text-gray-500 font-medium">Детей в системе</p>
                        </div>
                        <div className="col-span-3 bg-white p-4 rounded-xl shadow-sm border overflow-hidden">
                             <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Список детей</h4>
                             <div className="flex flex-wrap gap-2">
                                {userData.stats.children && userData.stats.children.length > 0 ? userData.stats.children.map((child) => (
                                    <button 
                                      key={child.id}
                                      onClick={() => onNavigate(child.id)}
                                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-100"
                                    >
                                        <UserIcon size={14} />
                                        {child.full_name}
                                        <ArrowRight size={14} className="opacity-50" />
                                    </button>
                                )) : (
                                    <p className="text-sm text-gray-400 italic">Дети не привязаны</p>
                                )}
                             </div>
                        </div>
                    </>
                )}
            </div>

            {/* Bio Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-3">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">О себе</h4>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {userData.bio}
                </p>
            </div>

            {/* Skills/Tags Section */}
            {userData.role === 'student' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-3">
                        <h4 className="text-xs font-bold text-green-600 uppercase tracking-widest">Сильные стороны (Теги)</h4>
                        <div className="flex flex-wrap gap-2">
                            {userData.stats.skills ? userData.stats.skills.split(',').map((s, i) => (
                                <span key={i} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100">{s.trim()}</span>
                            )) : <span className="text-sm text-gray-400 italic">Не указаны</span>}
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-3">
                        <h4 className="text-xs font-bold text-red-600 uppercase tracking-widest">Слабые стороны (Антитеги)</h4>
                        <div className="flex flex-wrap gap-2">
                            {userData.stats.anti_skills ? userData.stats.anti_skills.split(',').map((s, i) => (
                                <span key={i} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-100">{s.trim()}</span>
                            )) : <span className="text-sm text-gray-400 italic">Не указаны</span>}
                        </div>
                    </div>
                </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-red-500">
            <X size={48} className="mb-4" />
            <p className="font-bold">Пользователь не найден или возникла ошибка</p>
          </div>
        )}
      </div>

      {showConsultations && (
        <UserConsultationsModal 
          userId={userId} 
          token={token} 
          onClose={() => setShowConsultations(false)} 
        />
      )}
    </div>
  );
}

function UserConsultationsModal({ userId, token, onClose }: UserConsultationsModalProps) {
    const [consultations, setConsultations] = useState<ExtendedConsultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);

    const load = useCallback(async () => {
        if (!token || !userId) return;
        setLoading(true);
        const { data, error } = await supabase.rpc('get_all_consultations_admin', {
            p_token: token,
            p_user_id: userId,
            p_page_size: 100
        });
        if (!error && data && data.length > 0) {
            setConsultations(data[0].consultations_data || []);
        }
        setLoading(false);
    }, [userId, token]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg shadow-black/10">
                <div className="px-6 py-4 flex items-center justify-between border-b bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">Список консультаций</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="py-20 flex justify-center">
                            <RefreshCw className="animate-spin text-blue-500" size={32} />
                        </div>
                    ) : consultations.length > 0 ? (
                        <div className="space-y-3">
                            {consultations.map(c => (
                                <div 
                                  key={c.id}
                                  onClick={() => setSelectedConsultation(c)}
                                  className="p-4 border rounded-xl shadow-sm border hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                                >
                                    <div className="flex gap-4 items-center">
                                        <div className="shrink-0 text-center bg-gray-100 px-3 py-2 rounded-xl">
                                            <div className="text-xs font-bold text-gray-500 uppercase">{new Date(c.date).toLocaleDateString('ru-RU', { month: 'short' })}</div>
                                            <div className="text-xl font-black text-gray-900">{new Date(c.date).getDate()}</div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${
                                                    c.status === 'completed' ? 'bg-green-500' :
                                                    c.status === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'
                                                }`} />
                                                <span className="text-sm font-bold text-gray-900">{c.start_time.substring(0, 5)} — {c.duration} мин</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Репетитор: {c.student_name}</p>
                                            <p className="text-xs text-gray-500">Ученик: {c.child_name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div className="font-bold text-gray-900">{c.price} ₽</div>
                                        <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-gray-400 italic">Консультаций не найдено</div>
                    )}
                </div>
            </div>

            {selectedConsultation && (
                <ConsultationModal 
                  isOpen={!!selectedConsultation}
                  onClose={() => setSelectedConsultation(null)}
                  consultation={selectedConsultation}
                  onUpdate={load}
                  role="admin"
                />
            )}
        </div>
    );
}