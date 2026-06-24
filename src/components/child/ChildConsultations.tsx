import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar } from 'lucide-react';
import ConsultationCard, { ExtendedConsultation } from '../shared/ConsultationCard';
import ConsultationModal from '../shared/ConsultationModal';

interface BookAgainData {
  studentId: string;
  specializationId: string;
}

interface ChildConsultationsProps {
    onTabChange?: (tab: string, data?: BookAgainData) => void;
}

export function ChildConsultations({ onTabChange }: ChildConsultationsProps) {
  const { token } = useAuth();
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [consultations, setConsultations] = useState<ExtendedConsultation[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);
  const [loading, setLoading] = useState(false);

  const loadConsultations = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_child_own_consultations', {
        p_token: token,
        p_filter: filter,
      });

      if (error) throw error;

      const results = data || [];
      const parsed = (results as ExtendedConsultation[]).map((c) => ({
        ...c,
        files: typeof c.files === 'string' ? JSON.parse(c.files) : (c.files ?? []),
      }));
      setConsultations(parsed);

      setSelectedConsultation(prev => {
        if (!prev) return null;
        return parsed.find(p => p.id === prev.id) || prev;
      });
    } catch (err) {
      console.error('Error loading consultations:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    loadConsultations();

    const handleSync = () => {
      loadConsultations(true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [loadConsultations]);

  const handleBookAgain = (consultation: ExtendedConsultation) => {
    if (onTabChange) {
        onTabChange('new-consultation', { 
            studentId: consultation.student_id || '', 
            specializationId: consultation.specialization_id || '' 
        });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Мои консультации</h1>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
            {(['upcoming', 'past'] as const).map((f) => (
            <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                filter === f ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                {f === 'upcoming' ? 'Будущие' : 'Прошедшие'}
            </button>
            ))}
        </div>
      </div>

      {loading && consultations.length === 0 ? (
        <div className="text-center py-12">
           <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
           <p className="mt-2 text-gray-600 font-medium">Загрузка занятий...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {consultations.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500 border border-gray-100">
              <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Calendar size={32} />
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1">Нет консультаций</p>
              <p className="text-sm">Здесь будет отображаться ваша история занятий</p>
            </div>
          ) : (
            consultations.map((consultation) => (
              <ConsultationCard 
                key={consultation.id} 
                consultation={consultation} 
                role="child" 
                onClick={setSelectedConsultation} 
              />
            ))
          )}
        </div>
      )}

      <ConsultationModal 
        consultation={selectedConsultation}
        isOpen={!!selectedConsultation}
        onClose={() => setSelectedConsultation(null)}
        onUpdate={loadConsultations}
        role="child"
        onBookAgain={handleBookAgain}
      />
    </div>
  );
}