import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../shared/Avatar';
import { 
  Calendar, Clock, Star, Video, 
  ChevronRight, Award, BookOpen, Clock3 
} from 'lucide-react';
import ConsultationModal from '../shared/ConsultationModal';
import { ExtendedConsultation } from '../shared/ConsultationCard';
import { getAvatarUrl } from '../../lib/utils';

interface DashboardData {
  next_consultation: ExtendedConsultation | null;
  favorites: Array<{
    id: string;
    full_name: string;
    profile_photo_path: string | null;
    average_rating: number;
  }>;
  recent_materials: Array<{
    id: string;
    date: string;
    student_name: string;
    materials_text: string;
    spec_name: string;
  }>;
  stats: {
    total_consultations: number;
    completed_consultations: number;
    pending_consultations: number;
  };
}

interface ChildDashboardProps {
    onTabChange: (tab: string) => void;
}

export default function ChildDashboard({ onTabChange }: ChildDashboardProps) {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);

  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    const { data: dashboardData, error } = await supabase.rpc('get_child_dashboard_data', {
      p_token: token,
    });

    if (error) {
      console.error('get_child_dashboard_data error:', error);
    } else {
      setData(dashboardData as DashboardData);
      
      // Update selected consultation if it exists to refresh its data in modal
      setSelectedConsultation(prev => {
        if (prev && (dashboardData as DashboardData).next_consultation?.id === prev.id) {
          return (dashboardData as DashboardData).next_consultation;
        }
        return prev;
      });
    }
    if (!isSilent) setLoading(false);
  }, [token]);

  useEffect(() => {
    loadDashboardData();

    const handleSync = () => {
      // Обновляем дашборд при любых изменениях, но тихо
      loadDashboardData(true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [loadDashboardData]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Привет!</h1>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Award size={24} /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Занятий</p>
              <p className="text-xl font-bold text-gray-900">{data?.stats.completed_consultations ?? 0}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg"><Clock3 size={24} /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">В ожидании</p>
              <p className="text-xl font-bold text-gray-900">{data?.stats.pending_consultations ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ближайшее занятие */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-blue-600 rounded-xl p-8 text-white shadow-lg">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Calendar size={24} /> Ближайшая консультация
            </h2>
            {data?.next_consultation ? (
              <div 
                onClick={() => setSelectedConsultation(data.next_consultation)}
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer group"
              >
                <div>
                  <p className="text-blue-100 text-sm mb-1">{data.next_consultation.spec_name}</p>
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
                <div className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg">
                  {data.next_consultation.video_link ? <Video size={20} /> : <ChevronRight size={20} />}
                  {data.next_consultation.video_link ? 'Присоединиться' : 'Подробнее'}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-blue-100 mb-4">У вас пока нет запланированных занятий</p>
                <button 
                  onClick={() => onTabChange('new-consultation')}
                  className="bg-white text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors"
                >
                  Записаться
                </button>
              </div>
            )}
          </section>

          {/* Последние материалы */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Последние материалы</h2>
              <button onClick={() => onTabChange('consultations')} className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-1">
                Все занятия <ChevronRight size={16} />
              </button>
            </div>
            <div className="space-y-4">
              {data?.recent_materials.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center text-gray-500 border border-dashed border-gray-300">
                  Здесь появятся материалы от ваших репетиторов
                </div>
              ) : (
                data?.recent_materials.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg"><BookOpen size={24} /></div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-gray-900">{m.spec_name}</h4>
                        <span className="text-xs text-gray-500">{new Date(m.date).toLocaleDateString('ru-RU')}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{m.materials_text}</p>
                      <p className="text-xs text-gray-400 mt-2">От: {m.student_name}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Правая колонка - Избранные */}
        <div className="space-y-6">
          <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Star className="text-yellow-500" size={20} fill="currentColor" /> Избранные
            </h2>
            <div className="space-y-6">
              {data?.favorites.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 mb-4">Добавляйте репетиторов в избранное для быстрого доступа</p>
                  <button 
                    onClick={() => onTabChange('new-consultation')}
                    className="text-blue-600 text-sm font-bold hover:underline"
                  >
                    Найти репетитора
                  </button>
                </div>
              ) : (
                data?.favorites.map((fav) => (
                  <div key={fav.id} className="flex items-center gap-4 group">
                    <Avatar 
                      imageUrl={getAvatarUrl(fav.profile_photo_path)}
                      name={fav.full_name}
                      size={48}
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{fav.full_name}</h4>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Star size={14} className="text-yellow-500" fill="currentColor" />
                        <span>{fav.average_rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <button 
                        onClick={() => onTabChange('new-consultation')}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {data?.favorites && data.favorites.length > 0 && (
              <button 
                onClick={() => onTabChange('new-consultation')}
                className="w-full mt-6 py-3 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors"
              >
                Все репетиторы
              </button>
            )}
          </section>
        </div>
      </div>

      <ConsultationModal 
        consultation={selectedConsultation}
        isOpen={!!selectedConsultation}
        onClose={() => setSelectedConsultation(null)}
        onUpdate={loadDashboardData}
        role="child"
      />
    </div>
  );
}