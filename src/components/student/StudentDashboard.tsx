import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BookOpen, 
  TrendingUp, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import ConsultationCard, { ExtendedConsultation } from '../shared/ConsultationCard';
import ConsultationModal from '../shared/ConsultationModal';

interface DashboardStats {
  total_hours: number;
  total_earnings: number;
  monthly_earnings: number;
  pending_applications: number;
  upcoming_consultations: ExtendedConsultation[];
  recommendation_rating: number;
}

export default function StudentDashboard({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);

  const loadDashboardStats = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    const { data, error } = await supabase.rpc('get_student_dashboard_stats', { p_token: token });
    if (error) {
      console.error('get_student_dashboard_stats error:', error);
    } else if (data) {
      const dashboardData = data as DashboardStats & { upcoming_consultations: (ExtendedConsultation & { specialization_name?: string })[] };
      const parsed = dashboardData.upcoming_consultations?.map((c) => ({
        ...c,
        spec_name: c.specialization_name, // Mapping specialization_name to spec_name for uniformity
      }));
      setStats({ 
        ...dashboardData, 
        upcoming_consultations: parsed,
        recommendation_rating: dashboardData.recommendation_rating
      } as DashboardStats);
    }
    if (!isSilent) setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) {
      loadDashboardStats();
    }

    const handleSync = () => {
      // Обновляем дашборд при любых изменениях, но тихо
      loadDashboardStats(true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [token, loadDashboardStats]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Общий доход',
      value: `${stats?.total_earnings || 0} ₽`,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      label: 'Доход за месяц',
      value: `${stats?.monthly_earnings || 0} ₽`,
      icon: BookOpen,
      color: 'bg-purple-500',
    },
    {
      label: 'Новые заявки',
      value: stats?.pending_applications || 0,
      icon: AlertCircle,
      color: 'bg-orange-500',
      action: () => onTabChange('applications'),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Добро пожаловать, {user?.full_name?.split(' ')[0]}!</h1>
        <p className="text-gray-600 mt-2">Вот краткий обзор вашей активности и ближайших занятий.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${stat.action ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
            onClick={stat.action}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg text-white`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Consultations */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Ближайшие консультации</h2>
              <button 
                onClick={() => onTabChange('consultations')}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
              >
                Все занятия <ChevronRight size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {stats?.upcoming_consultations && stats.upcoming_consultations.length > 0 ? (
                stats.upcoming_consultations.map((c) => (
                  <ConsultationCard 
                    key={c.id} 
                    consultation={c} 
                    role="student" 
                    onClick={setSelectedConsultation} 
                  />
                ))
              ) : (
                <div className="p-12 text-center text-gray-500">
                  У вас пока нет забронированных занятий.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="bg-blue-600 rounded-xl shadow-md p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Быстрые действия</h2>
            <div className="space-y-3">
              <button 
                onClick={() => onTabChange('schedule')}
                className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 p-3 rounded-lg text-left transition-all flex items-center justify-between"
              >
                <span>Настроить расписание</span>
                <ChevronRight size={18} />
              </button>
              <button 
                onClick={() => onTabChange('profile')}
                className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 p-3 rounded-lg text-left transition-all flex items-center justify-between"
              >
                <span>Обновить профиль</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Ваш рейтинг</h2>
            <div className="flex flex-col gap-4 mb-4">
               <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-yellow-500">
                    ★ {user?.average_rating?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-sm text-gray-500">
                    На основе отзывов родителей
                  </div>
               </div>
               <div className="flex items-center gap-4 pt-4 border-t border-gray-50">
                  <div className="text-4xl font-bold text-green-600">
                    {stats?.recommendation_rating || 50}%
                  </div>
                  <div className="text-sm text-gray-500 leading-tight">
                    Рекомендательный рейтинг<br/>
                    <span className="text-[10px] text-gray-400">Влияет на позицию в поиске</span>
                  </div>
               </div>
            </div>
            <button 
              onClick={() => onTabChange('recommendations')}
              className="w-full py-2 border-2 border-gray-100 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Как повысить рейтинг?
            </button>
          </div>
        </div>
      </div>

      <ConsultationModal 
        consultation={selectedConsultation}
        isOpen={!!selectedConsultation}
        onClose={() => setSelectedConsultation(null)}
        onUpdate={loadDashboardStats}
        role="student"
      />
    </div>
  );
}
