import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft, ChevronRight, Activity } from 'lucide-react';

const PAGE_SIZE = 30;

interface AdminLog {
  id: string;
  created_at: string;
  admin_name: string;
  admin_email: string;
  action: string;
  details: Record<string, unknown>;
}

export default function AdminLogsTab() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const loadLogs = useCallback(async (page: number) => {
    if (!token) return;

    const { data, error } = await supabase.rpc('get_admin_logs', {
      p_token: token,
      p_page_number: page,
      p_page_size: PAGE_SIZE,
    });
    
    if (error) {
      console.error('get_admin_logs error:', error);
    } else if (data && data.length > 0) {
      setLogs(data[0].logs_data || []);
      setTotalLogs(data[0].total_logs || 0);
    } else {
      setLogs([]);
      setTotalLogs(0);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadLogs(currentPage);
  }, [token, currentPage, loadLogs]);

  const totalPages = Math.ceil(totalLogs / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата и время</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Администратор</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действие</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{log.admin_name}</div>
                    <div className="text-sm text-gray-500">{log.admin_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1 w-max">
                      <Activity size={14} />
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <pre className="text-xs bg-gray-100 p-2 rounded-lg text-gray-700 overflow-x-auto max-w-xs md:max-w-md lg:max-w-xl">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Логи пусты.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-700">
              Страница {currentPage} из {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}