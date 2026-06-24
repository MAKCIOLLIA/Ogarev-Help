import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Plus, Edit, Trash2, BookOpen, ClipboardCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
import TestEditor from './TestEditor';

interface AdminTest {
    id: string;
    specialization_id: string | null;
    spec_name: string | null;
    title: string;
    description: string | null;
    min_pass_score: number;
    blocks_count: number;
}

interface PendingModeration {
    attempt_id: string;
    student_id: string;
    student_name: string;
    grade_avg: number;
    score: number;
    test_title: string;
    started_at: string;
    details: {
        block_title: string;
        score: number;
        max_score: number;
    }[];
}

export default function TestsTab() {
    const { token } = useAuth();
    const { showToast, confirm } = useNotifications();
    const [tests, setTests] = useState<AdminTest[]>([]);
    const [pending, setPending] = useState<PendingModeration[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTest, setEditingTest] = useState<AdminTest | null | 'new'>(null);
    const [activeTab, setActiveTab] = useState<'tests' | 'moderation'>('tests');

    const loadData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const { data: testsData } = await supabase.rpc('get_tests_admin', { p_token: token });
            const { data: pendingData } = await supabase.rpc('get_pending_test_moderation', { p_token: token });
            setTests(testsData || []);
            setPending(pendingData || []);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDelete = async (id: string) => {
        confirm({
            title: 'Удалить тест',
            message: 'Вы уверены? Все вопросы и результаты будут удалены.',
            onConfirm: async () => {
                const { error } = await supabase.rpc('delete_test_admin', { p_token: token, p_id: id });
                if (error) showToast('Ошибка', error.message, 'red', 'cross');
                else {
                    showToast('Успешно', 'Тест удален', 'green', 'check');
                    loadData();
                }
            }
        });
    };

    const handleModerate = async (attemptId: string, status: 'passed' | 'failed') => {
        const { error } = await supabase.rpc('moderate_test_attempt', { 
            p_token: token, 
            p_attempt_id: attemptId, 
            p_status: status 
        });
        if (error) showToast('Ошибка', error.message, 'red', 'cross');
        else {
            showToast('Успешно', status === 'passed' ? 'Студент допущен' : 'Студент отклонен', 'green', 'check');
            loadData();
        }
    };

    if (editingTest) {
        return (
            <TestEditor 
                testId={editingTest === 'new' ? null : editingTest.id} 
                onClose={() => { setEditingTest(null); loadData(); }} 
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('tests')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'tests' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Все тесты
                </button>
                <button
                    onClick={() => setActiveTab('moderation')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'moderation' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Модерация
                    {pending.length > 0 && (
                        <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                            {pending.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'tests' ? (
                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <BookOpen className="text-blue-500" />
                            База тестов
                        </h2>
                        <button 
                            onClick={() => setEditingTest('new')}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                        >
                            <Plus size={18} /> Создать тест
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-black text-gray-400 uppercase">Название / Дисциплина</th>
                                    <th className="px-6 py-3 text-xs font-black text-gray-400 uppercase text-center">Блоки</th>
                                    <th className="px-6 py-3 text-xs font-black text-gray-400 uppercase text-center">Порог</th>
                                    <th className="px-6 py-3 text-xs font-black text-gray-400 uppercase text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tests.length > 0 ? tests.map((test) => (
                                    <tr key={test.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{test.title}</div>
                                            <div className="text-xs text-blue-600 font-medium">
                                                {test.spec_name || 'Входное тестирование'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">
                                                {test.blocks_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-black text-gray-700">{test.min_pass_score}%</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setEditingTest(test)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(test.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold">
                                            Тесты еще не созданы
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {pending.length > 0 ? pending.map((item) => (
                        <div key={item.attempt_id} className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black text-gray-900">{item.student_name}</h3>
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded border border-blue-100">
                                            Балл: {item.grade_avg}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <ClipboardCheck size={14} /> Результат: 
                                        <span className="font-black text-orange-600 ml-1">{item.score}%</span> 
                                        (требуется ручное решение)
                                    </p>
                                    <div className="flex gap-4 mt-4">
                                        {(item.details || []).map((d, i) => (
                                            <div key={i} className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                <div className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">{d.block_title}</div>
                                                <div className="text-sm font-bold text-gray-700">{d.score} / {d.max_score}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-col gap-2 justify-end">
                                    <button 
                                        onClick={() => handleModerate(item.attempt_id, 'passed')}
                                        className="flex-1 px-6 py-2 bg-green-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                                    >
                                        <CheckCircle size={18} /> Допустить
                                    </button>
                                    <button 
                                        onClick={() => handleModerate(item.attempt_id, 'failed')}
                                        className="flex-1 px-6 py-2 bg-red-50 text-red-600 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 transition-all"
                                    >
                                        <XCircle size={18} /> Отклонить
                                    </button>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-400 border border-dashed border-gray-200">
                            <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="font-bold">Нет заявок на модерацию</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
