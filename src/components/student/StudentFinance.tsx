import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  DollarSign, 
  Download,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface FinanceRecord {
  id: string;
  date: string;
  price: number;
  status: string;
  child_name: string;
  specialization_name: string;
}

export default function StudentFinance() {
  const { token } = useAuth();
  const [history, setHistory] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFinanceHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_student_finance_history', { p_token: token });
    if (error) {
      console.error('get_student_finance_history error:', error);
    } else {
      setHistory((data as FinanceRecord[]) || []);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadFinanceHistory();
  }, [token, loadFinanceHistory]);

  const handleExportCSV = () => {
    if (history.length === 0) return;

    const headers = ['Дата', 'Ученик', 'Предмет', 'Статус', 'Сумма (₽)'];
    const rows = history.map(record => [
      new Date(record.date).toLocaleDateString('ru-RU'),
      record.child_name,
      record.specialization_name,
      record.status === 'completed' ? 'Завершено' : record.status === 'paid' ? 'Оплачено' : 'Ожидает оплаты',
      record.price
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `finance_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalEarnings = history
    .filter(r => r.status === 'completed')
    .reduce((sum, rec) => sum + rec.price, 0);
  const completedCount = history.filter(r => r.status === 'completed').length;
  const pendingCount = history.filter(r => r.status === 'pending_payment').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Мои финансы</h1>
        <p className="text-gray-600 mt-2">История начислений и статистика доходов.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-lg text-green-600">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase font-bold">Общий доход</p>
              <p className="text-2xl font-black text-gray-900">{totalEarnings} ₽</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase font-bold">Проведено занятий</p>
              <p className="text-2xl font-black text-gray-900">{completedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase font-bold">В ожидании оплаты</p>
              <p className="text-2xl font-black text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">История начислений</h2>
          <button 
            onClick={handleExportCSV}
            disabled={history.length === 0}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} /> Экспорт в CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Дата</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ученик</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Предмет</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.length > 0 ? (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.child_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {record.specialization_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        record.status === 'completed' 
                          ? 'bg-green-100 text-green-700' 
                          : record.status === 'paid'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {record.status === 'completed' ? 'Завершено' : record.status === 'paid' ? 'Оплачено' : 'Ожидает оплаты'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                      {record.price} ₽
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    У вас пока нет истории начислений.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
