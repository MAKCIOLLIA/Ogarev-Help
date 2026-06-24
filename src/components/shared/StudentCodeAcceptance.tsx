import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { BookOpen, CheckCircle, Download, ExternalLink } from 'lucide-react';

interface StudentCodeAcceptanceProps {
    codeUrl: string;
    onComplete: () => void;
}

export default function StudentCodeAcceptance({ codeUrl, onComplete }: StudentCodeAcceptanceProps) {
    const { token } = useAuth();
    const { showToast } = useNotifications();
    const [accepted, setAccepted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleAccept = async () => {
        if (!accepted) {
            showToast('Внимание', 'Необходимо подтвердить согласие с кодексом', 'yellow', 'alert');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.rpc('accept_student_code', { p_token: token });
            if (error) throw error;
            
            showToast('Успешно', 'Кодекс принят. Добро пожаловать!', 'green', 'check');
            onComplete();
        } catch (err: any) {
            showToast('Ошибка', err.message, 'red', 'cross');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                <div className="bg-blue-600 p-8 text-white text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <BookOpen size={40} />
                    </div>
                    <h2 className="text-3xl font-black mb-2">Кодекс студента</h2>
                    <p className="text-blue-100 font-medium">Заключительный этап регистрации</p>
                </div>

                <div className="p-10">
                    <div className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                        <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                            <Download size={20} />
                            Инструкции:
                        </h3>
                        <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm font-medium">
                            <li>Скачайте и внимательно изучите «Кодекс студента»</li>
                            <li>Убедитесь, что вы согласны со всеми правилами платформы</li>
                            <li>Нажмите на галочку «Принимаю» и завершите регистрацию</li>
                        </ol>
                    </div>

                    <div className="space-y-6">
                        <a 
                            href={codeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-200 rounded-2xl transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-xl text-red-500 shadow-sm">
                                    <ExternalLink size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">Кодекс_студента.pdf</div>
                                    <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">Открыть файл в новой вкладке</div>
                                </div>
                            </div>
                            <Download className="text-gray-300 group-hover:text-blue-600 transition-colors" size={24} />
                        </a>

                        <label className="flex items-start gap-4 p-4 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors">
                            <div className="pt-1">
                                <input 
                                    type="checkbox" 
                                    checked={accepted}
                                    onChange={(e) => setAccepted(e.target.checked)}
                                    className="w-6 h-6 rounded border-2 border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                />
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-gray-900 mb-1">Я принимаю условия «Кодекса студента»</div>
                                <div className="text-sm text-gray-500 leading-relaxed">
                                    Нажимая эту галочку, вы подтверждаете, что ознакомлены с правилами работы репетитора на платформе Огарёв - Точка знаний и обязуетесь их соблюдать.
                                </div>
                            </div>
                        </label>
                    </div>

                    <button
                        onClick={handleAccept}
                        disabled={loading || !accepted}
                        className={`w-full mt-10 py-5 rounded-2xl font-black text-xl shadow-xl transition-all flex items-center justify-center gap-3
                            ${accepted 
                                ? 'bg-gray-900 text-white hover:bg-black active:scale-[0.98]' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                            }`}
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>Завершить регистрацию <CheckCircle size={24} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
