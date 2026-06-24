import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { ChevronLeft, ChevronRight, Filter, AlertTriangle, Eye } from 'lucide-react';
import ConsultationModal from '../shared/ConsultationModal';
import { ExtendedConsultation } from '../shared/ConsultationCard';

const PAGE_SIZE = 30;

export default function ConsultationsTab() {
  const { token } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [consultations, setConsultations] = useState<ExtendedConsultation[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalConsultations, setTotalConsultations] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);
  const [loading, setLoading] = useState(false);

const loadConsultations = useCallback(async (page: number, isSilent = false) => {
  if (!token) return;
  if (!isSilent) setLoading(true);

  const { data, error } = await supabase.rpc('get_all_consultations_admin', {
    p_token: token,
    p_page_number: page,
    p_page_size: PAGE_SIZE,
    p_status_filter: statusFilter || null,
    p_search_query: searchQuery || null,
  });

  if (error) {
    console.error('get_all_consultations_admin error:', error);
  } else if (data && data.length > 0) {
    const consultationsData = data[0].consultations_data || [];
    setConsultations(consultationsData);
    setTotalConsultations(data[0].total_consultations || 0);

    setSelectedConsultation(prev => {
      if (!prev) return null;
      return (consultationsData as ExtendedConsultation[]).find(p => p.id === prev.id) || prev;
    });
  } else {
    setConsultations([]);
    setTotalConsultations(0);
  }
  if (!isSilent) setLoading(false);
}, [token, statusFilter, searchQuery]);

useEffect(() => {
  loadConsultations(currentPage);

  const handleSync = () => {
    loadConsultations(currentPage, true);
  };

  window.addEventListener('sync-data', handleSync);
  return () => window.removeEventListener('sync-data', handleSync);
}, [loadConsultations, currentPage]);

  const handleCancel = async (id: string) => {
    if (!token) return;
    if (!cancelReason.trim()) {
      showToast('Внимание', 'Укажите причину отмены', 'yellow', 'alert');
      return;
    }

    confirm({
      title: 'Отмена консультации',
      message: 'Вы уверены, что хотите отменить эту консультацию? Это действие нельзя отменить.',
      onConfirm: async () => {
        const { error } = await supabase.rpc('admin_cancel_consultation', {
          p_token: token,
          p_consultation_id: id,
          p_reason: cancelReason,
        });

        if (error) {
          showToast('Ошибка при отмене', error.message, 'red', 'cross');
        } else {
          showToast('Успешно', 'Консультация отменена', 'green', 'check');
          setCancelingId(null);
          setCancelReason('');
          loadConsultations(currentPage);
        }
      }
    });
  };

  const totalPages = Math.ceil(totalConsultations / PAGE_SIZE);

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    const map: Record<string, { label: string; color: string }> = {
      pending_approval: { label: 'Ожидает одобрения', color: 'bg-orange-100 text-orange-800' },
      pending_payment:  { label: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-800' },
      paid:             { label: 'Оплачена', color: 'bg-blue-100 text-blue-800' },
      completed:        { label: 'Завершена', color: 'bg-green-100 text-green-800' },
      cancelled:        { label: 'Отменена', color: 'bg-red-100 text-red-800' },
    };
    const s = map[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Фильтры */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">Поиск по участникам</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Имя репетитора или ученика..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>
        <div className="w-full md:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">Статус консультации</label>
          <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
            >
              <option value="">Все статусы</option>
              <option value="pending_approval">Ожидает одобрения</option>
              <option value="pending_payment">Ожидает оплаты</option>
              <option value="paid">Оплачена</option>
              <option value="completed">Завершена</option>
              <option value="cancelled">Отменена</option>
            </select>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading && consultations.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата и время</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Участники</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Цена / Длительность</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {consultations.map((c) => (
                <tr 
                  key={c.id} 
                  className="hover:bg-gray-50 cursor-pointer group"
                  onDoubleClick={() => setSelectedConsultation(c)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{new Date(c.date).toLocaleDateString('ru-RU')}</div>
                    <div className="text-sm text-gray-500">{c.start_time.substring(0, 5)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900"><span className="text-gray-500 mr-1">Реп:</span>{c.student_name}</div>
                    <div className="text-sm text-gray-900"><span className="text-gray-500 mr-1">Род:</span>{c.parent_name}</div>
                    <div className="text-sm text-gray-900"><span className="text-gray-500 mr-1">Уч:</span>{c.child_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(c.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-medium">{c.price} ₽</div>
                    <div className="text-sm text-gray-500">{c.duration} мин</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        {cancelingId === c.id ? (
                        <div className="space-y-2 min-w-[200px]">
                            <input
                            type="text"
                            placeholder="Причина отмены..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-red-300 rounded focus:ring-1 focus:ring-red-500 outline-none"
                            />
                            <div className="flex gap-2">
                            <button
                                onClick={() => handleCancel(c.id)}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Подтвердить
                            </button>
                            <button
                                onClick={() => { setCancelingId(null); setCancelReason(''); }}
                                className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                                Отмена
                            </button>
                            </div>
                        </div>
                        ) : (
                        <>
                            <button
                                onClick={() => setSelectedConsultation(c)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Просмотреть"
                            >
                                <Eye size={18} />
                            </button>
                            {c.status !== 'cancelled' && c.status !== 'completed' && (
                                <button
                                onClick={() => setCancelingId(c.id)}
                                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                <AlertTriangle size={16} />
                                Отменить
                                </button>
                            )}
                        </>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {consultations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Консультации не найдены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-700">
              Страница {currentPage} из {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        )}
      </div>

      <ConsultationModal 
        consultation={selectedConsultation}
        isOpen={!!selectedConsultation}
        onClose={() => setSelectedConsultation(null)}
        onUpdate={() => loadConsultations(currentPage)}
        role="admin"
      />
    </div>
  );
}
