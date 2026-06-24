import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Eye } from 'lucide-react';
import ConsultationCard, { ExtendedConsultation } from '../shared/ConsultationCard';
import ConsultationModal from '../shared/ConsultationModal';

interface ChildConsultationsViewProps {
  childId: string;
}

export default function ChildConsultationsView({ childId }: ChildConsultationsViewProps) {
  const { token, switchToChild } = useAuth();
  const [consultations, setConsultations] = useState<ExtendedConsultation[]>([]);
  const [childName, setChildName] = useState('');
  const [selectedConsultation, setSelectedConsultation] = useState<ExtendedConsultation | null>(null);
  const [loading, setLoading] = useState(false);

  const loadConsultations = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);

    const { data, error } = await supabase.rpc('get_child_consultations', {
      p_token: token,
      p_child_id: childId,
    });

    if (error) {
      console.error('get_child_consultations error:', error);
    } else if (data) {
      const consultationsData = (data as ExtendedConsultation[]) ?? [];
      setConsultations(consultationsData);
      
      setSelectedConsultation(prev => {
        if (!prev) return null;
        return consultationsData.find(p => p.id === prev.id) || prev;
      });
    }
    if (!isSilent) setLoading(false);
  }, [token, childId]);

  useEffect(() => {
    if (token) loadConsultations();

    const handleSync = (event: Event) => {
      const type = (event as CustomEvent).detail;
      if (!type || type === 'consultation') {
        loadConsultations(true);
      }
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [token, loadConsultations]);

  // Получаем имя ребёнка из списка детей родителя
  useEffect(() => {
    const fetchChildName = async () => {
      if (!token) return;
      const { data } = await supabase.rpc('get_children', { p_token: token });
      if (data) {
        const child = (data as { child_user_id: string; full_name: string }[])
          .find((c) => c.child_user_id === childId);
        if (child) setChildName(child.full_name);
      }
    };
    fetchChildName();
  }, [childId, token]);

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Консультации: {childName}
        </h1>
        <button
          onClick={() => switchToChild(childId)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Eye size={20} />
          Перейти в профиль
        </button>
      </div>

      {loading && consultations.length === 0 ? (
        <div className="text-center py-12">
           <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
           <p className="mt-2 text-gray-600 font-medium">Загрузка занятий...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {consultations.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
              Нет консультаций
            </div>
          ) : (
            consultations.map((consultation) => (
              <ConsultationCard 
                key={consultation.id} 
                consultation={consultation} 
                role="parent" 
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
        role="parent"
      />
    </div>
  );
}