import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  GraduationCap, 
  UserSquare2, 
  Clock, 
  CheckCircle2, 
  Wallet, 
  TrendingUp, 
  Lock, 
  PiggyBank,
  ShieldCheck,
  Building2,
  XCircle
} from 'lucide-react';

interface AdminStats {
  total_students: number;
  total_parents: number;
  total_children: number;
  completed_consultations: number;
  pending_approval_consultations: number;
  pending_payment_consultations: number;
  cancelled_consultations: number;
  financial_stats: {
    [key: string]: number;
  };
}

export default function DashboardTab() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats', { p_token: token });
    if (error) {
      console.error('get_admin_dashboard_stats error:', error);
    } else {
      setStats(data);
    }
    
    if (!isSilent) setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadStats();

    const handleSync = () => {
      // Админ дашборд обновляем при любых событиях тихо
      loadStats(true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [token, loadStats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Загрузка аналитики...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-gray-500">Не удалось загрузить данные статистики</p>
        <button 
          onClick={() => loadStats()}
          className="mt-4 text-blue-600 font-medium hover:underline"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return `${Number(val || 0).toLocaleString('ru-RU')} ₽`;
  };

  const fStats = stats.financial_stats || {};

  return (
    <div className="space-y-10 pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Аналитика платформы</h2>
        <button 
          onClick={() => loadStats()}
          className="text-sm bg-white border border-gray-200 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          Обновить данные
        </button>
      </div>

      {/* О СТУДЕНТАХ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-800 border-l-4 border-blue-600 pl-3">
          <GraduationCap size={20} />
          <h3 className="text-lg font-bold uppercase tracking-wider">О студентах (репетиторах)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard 
            label="Всего репетиторов" 
            value={stats.total_students} 
            icon={<GraduationCap size={22} />} 
            color="blue" 
          />
          <StatCard 
            label="Всего заработали" 
            value={formatCurrency(fStats['Всего студенты заработали'])} 
            icon={<TrendingUp size={22} />} 
            color="green" 
          />
          <StatCard 
            label="На основных счетах" 
            value={formatCurrency(fStats['На счетах студентов'])} 
            icon={<Wallet size={22} />} 
            color="teal" 
          />
          <StatCard 
            label="Заморожено (Pending)" 
            value={formatCurrency(fStats['На замороженных счетах студентов'])} 
            icon={<Lock size={22} />} 
            color="indigo" 
          />
        </div>
      </section>

      {/* О СИСТЕМЕ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-800 border-l-4 border-teal-600 pl-3">
          <Building2 size={20} />
          <h3 className="text-lg font-bold uppercase tracking-wider">О системе и клиентах</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard 
            label="Всего родителей" 
            value={stats.total_parents} 
            icon={<UserSquare2 size={22} />} 
            color="teal" 
          />
          <StatCard 
            label="Всего школьников" 
            value={stats.total_children} 
            icon={<Users size={22} />} 
            color="purple" 
          />
          <StatCard 
            label="Чистый доход платформы" 
            value={formatCurrency(fStats['Чистый заработок платформы'])} 
            icon={<ShieldCheck size={22} />} 
            color="blue" 
          />
          <StatCard 
            label="Замороженный доход" 
            value={formatCurrency(fStats['Замороженный заработок платформы'])} 
            icon={<PiggyBank size={22} />} 
            color="amber" 
          />
          <StatCard 
            label="Средства клиентов" 
            value={formatCurrency(fStats['На счетах родителей и детей'])} 
            icon={<Wallet size={22} />} 
            color="rose" 
          />
        </div>
      </section>

      {/* О КОНСУЛЬТАЦИЯХ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-800 border-l-4 border-green-600 pl-3">
          <CheckCircle2 size={20} />
          <h3 className="text-lg font-bold uppercase tracking-wider">О консультациях</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard 
            label="Завершено" 
            value={stats.completed_consultations} 
            icon={<CheckCircle2 size={22} />} 
            color="green" 
          />
          <StatCard 
            label="Ожидают подтверждения" 
            value={stats.pending_approval_consultations} 
            icon={<Clock size={22} />} 
            color="orange" 
          />
          <StatCard 
            label="Ожидают оплаты" 
            value={stats.pending_payment_consultations} 
            icon={<Wallet size={22} />} 
            color="amber" 
          />
          <StatCard 
            label="Отменено" 
            value={stats.cancelled_consultations} 
            icon={<XCircle size={22} />} 
            color="rose" 
          />
        </div>
      </section>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'teal' | 'purple' | 'orange' | 'green' | 'indigo' | 'amber' | 'rose';
  highlight?: boolean;
}

function StatCard({ label, value, icon, color, highlight }: StatCardProps) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    teal:   'bg-teal-50 text-teal-600 border-teal-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green:  'bg-green-50 text-green-600 border-green-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber:  'bg-amber-50 text-amber-600 border-amber-100',
    rose:   'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 border ${highlight ? 'ring-2 ring-orange-400 ring-offset-2 border-orange-200' : 'border-gray-100'}`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-tight mb-1 truncate">
            {label}
          </p>
          <p className="text-xl font-bold text-gray-900 truncate">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}