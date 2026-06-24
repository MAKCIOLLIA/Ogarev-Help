import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Check, X, Clock, User, AlertCircle, Zap, Video } from 'lucide-react';

interface ConsultationApplication {
  id: string;
  child_id: string;
  parent_id: string;
  child_full_name: string;
  parent_full_name: string;
  specialization_name: string;
  date: string;
  start_time: string;
  duration: number;
  price: number;
  description: string;
  created_at: string;
  is_immediate?: boolean;
}

export default function StudentApplications() {
  const { token, refreshUnreadCounts } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [applications, setApplications] = useState<ConsultationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  const loadApplications = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);

    const { data, error } = await supabase.rpc('get_student_applications', { p_token: token });

    if (error) {
      console.error('get_student_applications error:', error);
    } else if (data) {
      setApplications(data as ConsultationApplication[]);
    }

    if (!isSilent) setLoading(false);
  }, [token]);

  useEffect(() => {
    loadApplications();

    const handleSync = () => {
      loadApplications(true);
    };

    window.addEventListener('sync-data', handleSync);
    window.addEventListener('immediate_consultation_available', handleSync);

    return () => {
      window.removeEventListener('sync-data', handleSync);
      window.removeEventListener('immediate_consultation_available', handleSync);
    };
  }, [loadApplications]);

  const handleApprove = async (application: ConsultationApplication) => {
    if (!token) return;

    confirm({
      title: application.is_immediate ? 'Принятие срочного вызова' : 'Подтверждение заявки',
      message: application.is_immediate 
        ? 'Вы подтверждаете, что готовы начать консультацию прямо сейчас? Ссылка на видеосвязь будет создана мгновенно.' 
        : 'Вы уверены, что хотите подтвердить эту заявку?',
      onConfirm: async () => {
        const rpcName = application.is_immediate ? 'accept_immediate_consultation' : 'approve_application';
        
        const { error } = await supabase.rpc(rpcName, {
          p_token: token,
          p_consultation_id: application.id,
        });

        if (error) {
          console.error(`${rpcName} error:`, error);
          showToast('Ошибка', error.message || 'Ошибка при подтверждении заявки', 'red', 'cross');
          return;
        }

        showToast('Успешно', application.is_immediate ? 'Вызов принят! Перейдите в расписание для начала.' : 'Заявка подтверждена', 'green', 'check');
        refreshUnreadCounts();
        loadApplications();
        window.dispatchEvent(new CustomEvent('sync-data'));
      }
    });
  };

  const handleReject = async (consultationId: string) => {
    if (!token) return;

    if (!comment.trim()) {
      showToast('Внимание', 'Пожалуйста, добавьте комментарий при отклонении заявки', 'yellow', 'alert');
      return;
    }

    const { error } = await supabase.rpc('reject_application', {
      p_token: token,
      p_consultation_id: consultationId,
      p_comment: comment,
    });

    if (error) {
      console.error('reject_application error:', error);
      showToast('Ошибка', 'Ошибка при отклонении заявки', 'red', 'cross');
      return;
    }

    setComment('');
    setSelectedApplicationId(null);
    showToast('Успешно', 'Заявка отклонена', 'green', 'check');
    refreshUnreadCounts();
    loadApplications();
  };

  const formatDateTime = (date: string, time: string, isImmediate?: boolean) => {
    if (isImmediate) return 'ПРЯМО СЕЙЧАС';
    return `${new Date(date).toLocaleDateString('ru-RU')} в ${time.substring(0, 5)}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Заявки на консультацию</h1>
        <p className="text-gray-600 mt-2">
          Здесь вы можете просматривать и обрабатывать новые заявки на консультации
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Загрузка заявок...</div>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Нет новых заявок</h3>
          <p className="text-gray-600">Все заявки обработаны. Новые заявки появятся здесь.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map((application) => (
            <div
              key={application.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 transition-all ${application.is_immediate ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       {application.is_immediate && (
                         <div className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse">
                            <Zap size={12} fill="currentColor" /> СРОЧНО
                         </div>
                       )}
                       <h3 className="text-xl font-bold text-gray-900">
                         Заявка на консультацию
                       </h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-gray-600">
                      <div className={`flex items-center gap-2 font-bold ${application.is_immediate ? 'text-red-600' : ''}`}>
                        <Clock size={18} />
                        <span>{formatDateTime(application.date, application.start_time, application.is_immediate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                          {application.duration} минут
                        </span>
                        <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                          {application.price} ₽
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-lg">
                    Поступила {new Date(application.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                  <div className="bg-gray-50 rounded-xl p-5">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Информация о клиенте</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600"><User size={20} /></div>
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase">Родитель</div>
                          <div className="font-bold text-gray-900">{application.parent_full_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600"><User size={20} /></div>
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase">Школьник</div>
                          <div className="font-bold text-gray-900">{application.child_full_name}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-50">
                    <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Детали консультации</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-bold text-blue-400 uppercase">Предмет</div>
                        <div className="font-bold text-gray-900">{application.specialization_name}</div>
                      </div>
                      {application.description && (
                        <div>
                          <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Описание / Темы</div>
                          <p className="text-sm text-gray-700 leading-relaxed bg-white/50 p-3 rounded-xl">
                            {application.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedApplicationId === application.id && (
                  <div className="mb-6 p-5 bg-red-50 border border-red-100 rounded-xl">
                    <label className="block text-sm font-bold text-red-700 mb-2 uppercase">
                      Причина отклонения
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"
                      rows={3}
                      placeholder="Введите причину отклонения заявки..."
                    />
                    <p className="text-[10px] text-red-400 font-bold mt-2 uppercase tracking-tight">
                      Этот комментарий будет отправлен родителю и школьнику.
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-100">
                  {selectedApplicationId === application.id ? (
                    <>
                      <button
                        onClick={() => { setSelectedApplicationId(null); setComment(''); }}
                        className="px-6 py-3 text-gray-500 hover:text-gray-900 font-bold transition-colors"
                      >
                        ОТМЕНА
                      </button>
                      <button
                        onClick={() => handleReject(application.id)}
                        disabled={!comment.trim()}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold transition-all shadow-lg shadow-red-100 disabled:opacity-50"
                      >
                        <X size={20} />
                        ОТКЛОНИТЬ ЗАЯВКУ
                      </button>
                    </>
                  ) : (
                    <>
                      {!application.is_immediate && (
                        <button
                          onClick={() => { setSelectedApplicationId(application.id); setComment(''); }}
                          className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-400 hover:text-red-500 rounded-xl font-bold transition-all hover:bg-red-50"
                        >
                          <X size={20} />
                          ОТКЛОНИТЬ
                        </button>
                      )}
                      <button
                        onClick={() => handleApprove(application)}
                        className={`flex items-center justify-center gap-2 px-10 py-4 rounded-xl shadow-xl transition-all active:translate-y-0 ${application.is_immediate ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-100'}`}
                      >
                        {application.is_immediate ? <Video size={24} /> : <Check size={24} />}
                        {application.is_immediate ? 'ПРИНЯТЬ ВЫЗОВ И СОЗДАТЬ ССЫЛКУ' : 'ПОДТВЕРДИТЬ'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}