import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar as CalendarIcon } from 'lucide-react';
import ConsultationCard, { ExtendedConsultation } from '../shared/ConsultationCard';
import ConsultationModal from '../shared/ConsultationModal';

export default function FamilyCalendar() {
  const { token } = useAuth();
  const [consultations, setConsultations] = useState<ExtendedConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);
const loadData = useCallback(async (isSilent = false) => {
  if (!token) return;
  if (!isSilent) setLoading(true);
  const { data, error } = await supabase.rpc('get_all_children_consultations', {
    p_token: token,
  });

  if (error) {
    console.error(error);
  } else {
    const consultationsData = data as ExtendedConsultation[];
    setConsultations(consultationsData);
    setSelectedConsultation(prev => {
      if (!prev) return null;
      return consultationsData.find(p => p.id === prev.id) || prev;
    });
  }
  if (!isSilent) setLoading(false);
}, [token]);

useEffect(() => {
  if (token) loadData();

  const handleSync = (event: Event) => {
    const type = (event as CustomEvent).detail;
    if (!type || type === 'consultation') {
      loadData(true);
    }
  };
  window.addEventListener('sync-data', handleSync);
  return () => window.removeEventListener('sync-data', handleSync);
}, [token, loadData]);
  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  // Filter out cancelled ones, and sort by date/time ascending to show upcoming first
  const upcoming = consultations
    .filter(c => c.status !== 'cancelled' && (new Date(c.date) >= new Date(new Date().setHours(0,0,0,0))))
    .sort((a, b) => new Date(`${a.date}T${a.start_time}`).getTime() - new Date(`${b.date}T${b.start_time}`).getTime());

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
          <CalendarIcon size={32} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Семейный календарь</h1>
      </div>

      {upcoming.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-dashed border-gray-300">
          Запланированных занятий пока нет.
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.map(c => (
            <ConsultationCard 
                key={c.id} 
                consultation={c} 
                role="parent" 
                onClick={setSelectedConsultation} 
            />
          ))}
        </div>
      )}

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