import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Users, CreditCard, Clock } from 'lucide-react';
import ConsultationModal from '../shared/ConsultationModal';
import { ExtendedConsultation } from '../shared/ConsultationCard';

interface ParentDashboardData {
  total_children: number;
  pending_payments: number;
  total_debt: number;
  next_consultation: ExtendedConsultation | null;
}

interface ParentDashboardProps {
  onTabChange: (tab: string) => void;
}

export default function ParentDashboard({ onTabChange }: ParentDashboardProps) {
  const { token } = useAuth();
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    const { data: dashboardData, error } = await supabase.rpc('get_parent_dashboard_data', {
      p_token: token,
    });

    if (error) {
      console.error('get_parent_dashboard_data error:', error);
    } else {
      const parentData = dashboardData as ParentDashboardData;
      setData(parentData);
      setSelectedConsultation(prev => {
        if (!prev) return null;
        if (parentData.next_consultation?.id === prev.id) {
            return parentData.next_consultation;
        }
        return prev;
      });
    }
    if (!isSilent) setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadData();

    const handleSync = () => {
      // Обновляем дашборд при любых изменениях, но тихо
      loadData(true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [token, loadData]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }
//from-blue-600 to-indigo-700 p-8 shadow-lg relative overflow-hidden group
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Личный кабинет</h1>
        <button
          onClick={() => onTabChange('new-consultation')}
          className="flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-xl font-black text-lg shadow-lg hover:shadow-xl transition-all"
        >
          <Calendar size={24} />
          Запросить консультацию
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><Users size={32} /></div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-bold">Детей в аккаунте</p>
            <p className="text-2xl font-bold text-gray-900">{data?.total_children || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="p-4 bg-yellow-50 text-yellow-600 rounded-xl"><Clock size={32} /></div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-bold">Ожидают оплаты</p>
            <p className="text-2xl font-bold text-gray-900">{data?.pending_payments || 0} занятий</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="p-4 bg-red-50 text-red-600 rounded-xl"><CreditCard size={32} /></div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-bold">Сумма к оплате</p>
            <p className="text-2xl font-bold text-gray-900">{data?.total_debt || 0} ₽</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-blue-600 rounded-xl p-8 text-white shadow-lg relative overflow-hidden group">
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Calendar size={24} /> Ближайшее занятие
            </h2>
            {data?.next_consultation ? (
              <div 
                onClick={() => setSelectedConsultation(data.next_consultation)}
                className="space-y-4 cursor-pointer"
              >
                <div>
                  <p className="text-blue-100 text-sm mb-1">Ребёнок: <span className="font-semibold text-white">{data.next_consultation.child_name}</span></p>
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-blue-200 transition-colors">Репетитор: {data.next_consultation.student_name}</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                      <Calendar size={18} />
                      <span>{new Date(data.next_consultation.date).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                      <Clock size={18} />
                      <span>{data.next_consultation.start_time.substring(0, 5)}</span>
                    </div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-bold text-white/80 group-hover:text-white transition-colors">
                   Подробнее <Clock size={16} />
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-blue-100 mb-4">Нет запланированных занятий</p>
                <button 
                  onClick={() => onTabChange('new-consultation')}
                  className="bg-white text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors"
                >
                  Записать ребёнка
                </button>
              </div>
            )}
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
            <Calendar size={200} className="transform translate-x-1/4 translate-y-1/4" />
          </div>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center space-y-6">
          <div className="p-6 bg-green-50 text-green-600 rounded-full">
            <CreditCard size={48} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Финансы и оплата</h2>
            <p className="text-gray-500 mb-6">Управляйте оплатами и просматривайте историю расходов на обучение ваших детей.</p>
            <button 
              onClick={() => onTabChange('finances')}
              className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors w-full"
            >
              Перейти к оплате
            </button>
          </div>
        </section>
      </div>

      <ConsultationModal 
        consultation={selectedConsultation}
        isOpen={!!selectedConsultation}
        onClose={() => setSelectedConsultation(null)}
        onUpdate={loadData}
        role="parent"
      />
    </div>
  );
}