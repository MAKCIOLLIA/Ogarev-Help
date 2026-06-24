import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabase } from '../../lib/supabase';
import { PlusCircle, Wallet, ArrowDownCircle } from 'lucide-react';

export default function BalanceWidget() {
  const { user, token, refreshBalance } = useAuth();
  const { showToast } = useNotifications();
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  if (!user || user.role === 'admin') return null;

  const handleTopUp = async () => {
    if (!amount || amount <= 0 || !token) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('top_up_balance', {
        p_token: token,
        p_amount: amount
      });
      if (error) throw error;
      await refreshBalance();
      setIsTopUpOpen(false);
      setAmount('');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Произошла ошибка';
      showToast('Ошибка пополнения', message, 'red', 'cross');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || amount <= 0 || !token) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('withdraw_balance', {
        p_token: token,
        p_amount: amount
      });
      if (error) throw error;
      await refreshBalance();
      setIsWithdrawOpen(false);
      setAmount('');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Произошла ошибка';
      showToast('Ошибка вывода', message, 'red', 'cross');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-blue-900 font-medium">
          <Wallet size={16} />
          <span className="text-sm">Баланс:</span>
        </div>
        <span className="font-bold text-blue-700">{user.balance || 0} ₽</span>
      </div>
      
      {user.role === 'student' && (
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="text-gray-500">В заморозке:</span>
          <span className="font-medium text-gray-600">{user.pending_balance || 0} ₽</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setIsTopUpOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-white text-blue-600 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors"
        >
          <PlusCircle size={14} />
          Пополнить
        </button>
        <button
          onClick={() => setIsWithdrawOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-white text-orange-600 border border-orange-200 rounded-lg text-xs font-medium hover:bg-orange-50 transition-colors"
        >
          <ArrowDownCircle size={14} />
          Вывести
        </button>
      </div>

      {(isTopUpOpen || isWithdrawOpen) && (
        <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {isTopUpOpen ? 'Пополнение баланса' : 'Вывод средств'}
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Сумма (₽)</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Введите сумму"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsTopUpOpen(false);
                  setIsWithdrawOpen(false);
                  setAmount('');
                }}
                className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                onClick={isTopUpOpen ? handleTopUp : handleWithdraw}
                disabled={!amount || amount <= 0 || loading}
                className={`px-5 py-2.5 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isTopUpOpen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {loading ? 'Обработка...' : (isTopUpOpen ? 'Пополнить' : 'Вывести')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}