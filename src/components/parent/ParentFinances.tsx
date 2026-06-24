import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

interface Consultation {
  id: string;
  date: string;
  start_time: string;
  price: number;
  status: string;
  student_full_name: string;
  child_full_name: string;
}

export default function ParentFinances() {
  const { token, user, refreshBalance, refreshUnreadCounts } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    const { data, error } = await supabase.rpc('get_all_children_consultations', {
      p_token: token,
    });
    if (!error && data) {
      setConsultations(data as Consultation[]);
    }
    if (!isSilent) setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadData();

    const handleSync = () => {
      loadData(true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [token, loadData]);

  const handlePay = async (id: string, price: number) => {
    if (!token || !user) return;
    if ((user.balance || 0) < price) {
      showToast('Недостаточно средств', 'Пожалуйста, пополните баланс в меню слева.', 'yellow', 'alert');
      return;
    }

    confirm({
      title: 'Оплата занятия',
      message: `Подтверждаете оплату занятия (${price} ₽) с вашего баланса?`,
      onConfirm: async () => {
        const { error } = await supabase.rpc('pay_consultation_from_balance', {
          p_token: token,
          p_consultation_id: id,
        });
        if (error) showToast('Ошибка при оплате', error.message, 'red', 'cross');
        else {
          showToast('Успешно', 'Оплата успешно произведена!', 'green', 'check');
          refreshBalance();
          refreshUnreadCounts();
          loadData();
        }
      }
    });
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;

  const pending = consultations.filter(c => c.status === 'pending_payment');
  const paid = consultations.filter(c => c.status === 'paid' || c.status === 'completed');
  
  const totalSpent = paid.reduce((sum, c) => sum + c.price, 0);
  const totalDebt = pending.reduce((sum, c) => sum + c.price, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-green-100 text-green-600 rounded-xl"><CreditCard size={32} /></div>
        <h1 className="text-3xl font-bold text-gray-900">Финансы и оплата</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-red-50 rounded-xl p-6 border border-red-100">
          <p className="text-sm text-red-600 font-bold uppercase mb-1">К оплате</p>
          <p className="text-3xl font-bold text-red-700">{totalDebt} ₽</p>
        </div>
        <div className="bg-green-50 rounded-xl p-6 border border-green-100">
          <p className="text-sm text-green-600 font-bold uppercase mb-1">Всего потрачено</p>
          <p className="text-3xl font-bold text-green-700">{totalSpent} ₽</p>
        </div>
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><AlertCircle className="text-red-500" /> Ожидают оплаты</h2>
          <div className="space-y-3">
            {pending.map(c => (
              <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">{new Date(c.date).toLocaleDateString('ru-RU')} в {c.start_time.substring(0, 5)} • Ребёнок: {c.child_full_name}</p>
                  <p className="font-bold text-gray-900">Репетитор: {c.student_full_name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-gray-900">{c.price} ₽</span>
                  <button onClick={() => handlePay(c.id, c.price)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
                    Оплатить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><CheckCircle className="text-green-500" /> История платежей</h2>
        {paid.length === 0 ? (
          <p className="text-gray-500 text-sm">История пуста</p>
        ) : (
          <div className="space-y-3">
            {paid.map(c => (
              <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between opacity-80">
                <div>
                  <p className="text-sm text-gray-500">{new Date(c.date).toLocaleDateString('ru-RU')} в {c.start_time.substring(0, 5)} • Ребёнок: {c.child_full_name}</p>
                  <p className="font-medium text-gray-900">Репетитор: {c.student_full_name}</p>
                </div>
                <span className="font-bold text-gray-900">{c.price} ₽</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}