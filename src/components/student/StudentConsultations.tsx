import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ConsultationCard, { ExtendedConsultation } from '../shared/ConsultationCard';
import ConsultationModal from '../shared/ConsultationModal';

export default function StudentConsultations() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [consultations, setConsultations] = useState<ExtendedConsultation[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);
  const [loading, setLoading] = useState(false);

  const loadConsultations = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    const { data, error } = await supabase.rpc('get_student_consultations', {
      p_token: token,
      p_filter: filter,
    });
    if (error) {
      console.error('get_student_consultations error:', error);
    } else if (data) {
      const parsed = (data as Record<string, unknown>[]).map((c) => ({
        ...c,
        files: typeof c.files === 'string' ? JSON.parse(c.files) : (c.files ?? []),
      }));
      const consultationsData = parsed as ExtendedConsultation[];
      setConsultations(consultationsData);
      
      // Update selected consultation if it exists to refresh its data in modal
      setSelectedConsultation(prev => {
        if (!prev) return null;
        return consultationsData.find(p => p.id === prev.id) || prev;
      });
    }
    if (!isSilent) setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    if (token) {
        loadConsultations();
    }

    const handleSync = () => {
      loadConsultations(true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [token, loadConsultations]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Мои консультации</h1>

      <div className="flex gap-3 mb-6">
        {(['upcoming', 'past'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f === 'upcoming' ? 'Будущие' : 'Прошедшие'}
          </button>
        ))}
      </div>

      {loading && consultations.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="mt-2 text-gray-600">Загрузка консультаций...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {consultations.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
              {filter === 'upcoming' ? 'Нет предстоящих консультаций' : 'Нет прошедших консультаций'}
            </div>
          ) : (
            consultations.map((consultation) => (
              <ConsultationCard 
                key={consultation.id} 
                consultation={consultation} 
                role="student" 
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
        role="student"
      />
    </div>
  );
}