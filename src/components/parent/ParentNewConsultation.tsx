import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import NewConsultation from '../child/NewConsultation';
import { Users } from 'lucide-react';

interface Child {
  child_user_id: string;
  full_name: string;
}

interface ParentNewConsultationProps {
  onTabChange: (tab: string) => void;
}

export default function ParentNewConsultation({ onTabChange }: ParentNewConsultationProps) {
  const { token } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadChildren = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_children_for_menu', { p_token: token });
    if (!error && data) {
      const childrenList = data as Child[];
      setChildren(childrenList);
      
      // Автовыбор, если ребенок один
      if (childrenList.length === 1) {
        setSelectedChildId(childrenList[0].child_user_id);
      }
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadChildren();
  }, [token, loadChildren]);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  if (children.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Бронирование занятия</h1>
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <p className="text-gray-600 mb-4">У вас пока не добавлено ни одного ребёнка в аккаунт.</p>
          <button 
            onClick={() => onTabChange('children')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            Добавить ребёнка
          </button>
        </div>
      </div>
    );
  }

  if (!selectedChildId) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Для кого бронируем занятие?</h1>
          <p className="text-gray-600">Выберите ребёнка, которого хотите записать к репетитору</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(child => (
            <button
              key={child.child_user_id}
              onClick={() => setSelectedChildId(child.child_user_id)}
              className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">
                  {child.full_name.charAt(0)}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {child.full_name}
              </h3>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Бронирование для: <span className="font-bold text-gray-900">{children.find(c => c.child_user_id === selectedChildId)?.full_name}</span>
        </p>
        <button 
          onClick={() => setSelectedChildId(null)}
          className="text-blue-600 hover:underline text-sm font-medium"
        >
          Изменить выбор
        </button>
      </div>
      <NewConsultation onTabChange={onTabChange} targetChildId={selectedChildId} />
    </div>
  );
}