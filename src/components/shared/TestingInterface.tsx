import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
    Clock, CheckCircle, AlertTriangle, ChevronRight, 
    Image as ImageIcon, Music, Video, Star, ArrowRight, X, LogOut
} from 'lucide-react';

interface TestingInterfaceProps {
    testId: string;
    onComplete: (result: { passed: boolean, status: string, percentage: number }) => void;
    onCancel?: () => void;
}

interface Question {
    id: string;
    text: string;
    type: 'single' | 'multi' | 'text' | 'media_only' | 'matching' | 'select' | 'fill';
    media_url?: string;
    media_type?: 'image' | 'audio' | 'video';
    points: number;
    shuffle_answers: boolean;
    answers: { id: string, text: string, order_index?: number }[];
    user_response?: {
        answer_ids: string[] | null;
        text_response: string | null;
        is_correct: boolean | null;
    };
}

interface Block {
    id: string;
    title: string;
    description: string;
    time_limit: number;
    total_questions: number;
    total_points: number;
    is_finished: boolean;
    questions: Question[];
}

interface TestStructure {
    id: string;
    title: string;
    description: string;
    attempt_id: string;
    blocks: Block[];
}

export default function TestingInterface({ testId, onComplete, onCancel }: TestingInterfaceProps) {
    const { token, logout } = useAuth();
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [structure, setStructure] = useState<TestStructure | null>(null);
    const [attemptId, setAttemptId] = useState<string | null>(null);
    
    const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [blockStarted, setBlockStarted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [validating, setValidating] = useState(false);
    const [finished, setFinished] = useState(false);
    const [result, setResult] = useState<{ passed: boolean, status: string, percentage: number } | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const loadTest = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            // First start/resume attempt
            const { data: aId, error: startError } = await supabase.rpc('start_test_attempt', { p_token: token, p_test_id: testId });
            if (startError) throw startError;
            setAttemptId(aId);

            // Get structure and progress
            const { data: struct, error: structError } = await supabase.rpc('get_test_structure', { p_token: token, p_test_id: testId });
            if (structError) throw structError;
            setStructure(struct);
            
            // Resume progress
            const resumeAnswers: Record<string, any> = {};
            let firstUnfinishedBlock = 0;
            
            struct.blocks.forEach((b: Block, bIdx: number) => {
                if (b.is_finished && firstUnfinishedBlock === bIdx) {
                    firstUnfinishedBlock = bIdx + 1;
                }
                b.questions.forEach((q: Question) => {
                    if (q.user_response) {
                        if (q.type === 'text') resumeAnswers[q.id] = q.user_response.text_response;
                        else if (q.type === 'single') resumeAnswers[q.id] = q.user_response.answer_ids?.[0];
                        else resumeAnswers[q.id] = q.user_response.answer_ids || [];
                    }
                });
            });

            setAnswers(resumeAnswers);
            
            if (firstUnfinishedBlock >= struct.blocks.length) {
                // All blocks finished but test not finalized?
                handleFinishTest(aId);
            } else {
                setCurrentBlockIdx(firstUnfinishedBlock);
                // Find first unanswered question in current block
                const block = struct.blocks[firstUnfinishedBlock];
                const firstUnanswered = block.questions.findIndex((q: Question) => !q.user_response);
                setCurrentQuestionIdx(firstUnanswered === -1 ? 0 : firstUnanswered);
            }

        } catch (err: any) {
            showToast('Ошибка', err.message, 'red', 'cross');
            if (onCancel) onCancel();
        } finally {
            setLoading(false);
        }
    }, [token, testId, showToast, onCancel]);

    useEffect(() => {
        loadTest();
    }, [loadTest]);

    useEffect(() => {
        if (blockStarted && !finished && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current!);
                        handleNextBlock();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [blockStarted, finished, timeLeft]);

    const startBlock = () => {
        const block = structure!.blocks[currentBlockIdx];
        setTimeLeft(block.time_limit);
        setBlockStarted(true);
    };

    const handleAnswerChange = (val: any) => {
        if (isCorrect !== null) return;
        setAnswers(prev => ({ ...prev, [structure!.blocks[currentBlockIdx].questions[currentQuestionIdx].id]: val }));
    };

    const handleSubmitAnswer = async () => {
        const question = structure!.blocks[currentBlockIdx].questions[currentQuestionIdx];
        const val = answers[question.id];
        
        if (question.type !== 'media_only' && (val === undefined || val === null || (Array.isArray(val) && val.length === 0))) {
            showToast('Внимание', 'Выберите или введите ответ', 'yellow', 'alert');
            return;
        }

        setValidating(true);
        try {
            let p_answer_ids = null;
            let p_text_response = null;

            if (question.type === 'single') p_answer_ids = [val];
            else if (question.type === 'multi') p_answer_ids = val;
            else if (question.type === 'select') p_answer_ids = Object.keys(val).map(Number).sort((a,b) => a-b).map(k => val[k]);
            else if (question.type === 'text') p_text_response = val;
            else if (question.type === 'matching') p_text_response = Object.keys(val).map(Number).sort((a,b) => a-b).map(k => val[k]).join('|');
            else if (question.type === 'fill') p_text_response = Object.keys(val).map(Number).sort((a,b) => a-b).map(k => val[k]).join('|');

            const { data: result, error } = await supabase.rpc('check_question_answer', {
                p_token: token,
                p_attempt_id: attemptId,
                p_question_id: question.id,
                p_answer_ids,
                p_text_response
            });
            
            if (error) throw error;
            
            if (result.is_correct) {
                handleNextQuestion();
            } else {
                setIsCorrect(false);
                setExplanation(result.explanation);
            }
        } catch (err: any) {
            showToast('Ошибка', err.message, 'red', 'cross');
        } finally {
            setValidating(false);
        }
    };

    const handleNextQuestion = () => {
        const block = structure!.blocks[currentBlockIdx];
        if (currentQuestionIdx < block.questions.length - 1) {
            setIsCorrect(null);
            setExplanation(null);
            setCurrentQuestionIdx(prev => prev + 1);
        } else {
            handleNextBlock();
        }
    };

    const handleNextBlock = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setBlockStarted(false);
        
        const block = structure!.blocks[currentBlockIdx];
        await supabase.rpc('submit_test_block', { p_token: token, p_attempt_id: attemptId, p_block_id: block.id });

        if (currentBlockIdx < structure!.blocks.length - 1) {
            setCurrentBlockIdx(prev => prev + 1);
            setCurrentQuestionIdx(0);
            setIsCorrect(null);
            setExplanation(null);
        } else {
            handleFinishTest(attemptId!);
        }
    };

    const handleFinishTest = async (aId: string) => {
        setFinished(true);
        try {
            const { data: finalResult, error } = await supabase.rpc('finalize_test_attempt', { p_token: token, p_attempt_id: aId });
            if (error) throw error;
            
            setResult(finalResult);
        } catch (err: any) {
            showToast('Ошибка', 'Не удалось завершить тест: ' + err.message, 'red', 'cross');
            setFinished(false);
        }
    };

    if (loading) return (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-500 font-bold">Подготовка тестирования...</p>
        </div>
    );

    if (result) {
        return (
            <div className="fixed inset-0 bg-gray-50 z-[9999] flex items-center justify-center p-8">
                <div className={`max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border-t-8 ${result.passed ? 'border-green-500' : (result.status === 'pending_admin' ? 'border-orange-500' : 'border-red-500')}`}>
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${result.passed ? 'bg-green-100 text-green-600' : (result.status === 'pending_admin' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600')}`}>
                        {result.passed ? <CheckCircle size={40} /> : (result.status === 'pending_admin' ? <Star size={40} /> : <X size={40} />)}
                    </div>
                    
                    <h2 className="text-2xl font-black text-gray-900 mb-2">
                        {result.passed ? 'Тест успешно пройден!' : (result.status === 'pending_admin' ? 'Ожидание решения' : 'Тест не пройден')}
                    </h2>
                    
                    <div className="bg-gray-50 p-4 rounded-2xl mb-8">
                        <p className="text-sm font-bold text-gray-500 mb-1">Ваш результат:</p>
                        <p className={`text-4xl font-black ${result.passed ? 'text-green-600' : 'text-red-600'}`}>{result.percentage}%</p>
                    </div>

                    <p className="text-gray-600 leading-relaxed mb-10">
                        {result.passed 
                            ? 'Поздравляем! Дисциплина будет автоматически добавлена в ваш список специализаций.' 
                            : (result.status === 'pending_admin' 
                                ? 'Ваш средний балл зачетки высок, поэтому результат передан администратору на рассмотрение.' 
                                : 'К сожалению, вы не набрали проходной балл. Следующая попытка будет доступна через 3 месяца.')
                        }
                    </p>

                    <button 
                        onClick={() => onComplete(result)}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xl hover:bg-black transition-all"
                    >
                        {result.passed ? 'Отлично' : 'Вернуться'}
                    </button>
                </div>
            </div>
        );
    }

    if (!structure) return null;

    const block = structure.blocks[currentBlockIdx];
    const question = block.questions[currentQuestionIdx];
    
    // Progress calculation
    const totalQs = structure.blocks.reduce((acc, b) => acc + b.total_questions, 0);
    const completedQsInPrevBlocks = structure.blocks.slice(0, currentBlockIdx).reduce((acc, b) => acc + b.total_questions, 0);
    const progress = Math.round(((completedQsInPrevBlocks + currentQuestionIdx + (isCorrect !== null ? 1 : 0)) / totalQs) * 100);

    if (finished) {
        return (
            <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-8 animate-bounce">
                    <Star size={48} />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-4">Тестирование завершено!</h2>
                <p className="text-gray-500 font-medium mb-12 max-w-md">Ваши ответы успешно сохранены и обработаны. Сейчас вы увидите результат.</p>
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!blockStarted) {
        return (
            <div className="fixed inset-0 bg-gray-50 z-[9999] flex flex-col items-center justify-center p-8">
                <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-10 border border-gray-100">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-200">
                            {currentBlockIdx + 1}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900">{block.title}</h2>
                            <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Блок тестирования</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-10">
                        <div className="bg-gray-50 p-4 rounded-2xl text-center">
                            <div className="text-xs font-black text-gray-400 uppercase mb-1">Вопросов</div>
                            <div className="text-xl font-black text-gray-900">{block.total_questions}</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl text-center">
                            <div className="text-xs font-black text-gray-400 uppercase mb-1">Баллов</div>
                            <div className="text-xl font-black text-gray-900">{block.total_points}</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl text-center">
                            <div className="text-xs font-black text-gray-400 uppercase mb-1">Время</div>
                            <div className="text-xl font-black text-gray-900">{Math.floor(block.time_limit / 60)}м</div>
                        </div>
                    </div>

                    {structure.description && currentBlockIdx === 0 && (
                        <div className="mb-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50 max-h-60 overflow-y-auto custom-scrollbar">
                            <div className="text-[10px] font-black text-blue-400 uppercase mb-2 tracking-widest sticky top-0 bg-blue-50/50 py-1">Описание теста</div>
                            <div className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">
                                {structure.description}
                            </div>
                        </div>
                    )}

                    {block.description && (
                        <div className="mb-10 text-gray-600 font-medium leading-relaxed italic border-l-4 border-gray-200 pl-6">
                            «{block.description}»
                        </div>
                    )}

                    <button
                        onClick={startBlock}
                        className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-xl hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 group"
                    >
                        {currentBlockIdx === 0 ? 'Начать тестирование' : 'Начать следующий блок'} <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                        onClick={logout}
                        className="w-full mt-4 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
                    >
                        <LogOut size={18} /> Выйти из аккаунта
                    </button>
                </div>
                
                {onCancel && (
                    <button onClick={onCancel} className="mt-8 text-gray-400 font-bold hover:text-gray-600 underline">Прервать тестирование</button>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-50 z-[9999] flex flex-col">
            {/* Header */}
            <header className="bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-xl font-black text-gray-900">{structure.title}</h1>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{block.title}</p>
                    </div>
                    <div className="hidden md:flex gap-2">
                        {structure.blocks.map((b, i) => (
                            <div key={b.id} className={`w-3 h-3 rounded-full transition-all ${i === currentBlockIdx ? 'bg-blue-600 scale-125' : (i < currentBlockIdx || b.is_finished ? 'bg-green-500' : 'bg-gray-200')}`} title={b.title} />
                        ))}
                    </div>
                </div>
                
                <div className="flex items-center gap-8">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black ${timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
                        <Clock size={20} />
                        <span className="text-lg">
                            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                        </span>
                    </div>
                    {onCancel && (
                        <button onClick={onCancel} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <X size={24} />
                        </button>
                    )}
                </div>
            </header>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-gray-200">
                <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
                <div className="w-full max-w-3xl space-y-8">
                    {/* Question Card */}
                    <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 p-10 border border-gray-100">
                        <div className="flex justify-between mb-8">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                Вопрос {currentQuestionIdx + 1} из {block.total_questions}
                            </span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black rounded-full">
                                +{question.points} {question.points === 1 ? 'балл' : 'балла'}
                            </span>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-8 whitespace-pre-wrap">
                            {(question.type === 'select' || question.type === 'fill') ? (
                                <div className="leading-loose">
                                    {question.text.split(/(\[\[\d+\]\])/g).map((part, i) => {
                                        const match = part.match(/\[\[(\d+)\]\]/);
                                        if (match) {
                                            const idx = parseInt(match[1]);
                                            if (question.type === 'select') {
                                                const options = question.answers.filter(a => a.order_index === idx);
                                                return (
                                                    <select
                                                        key={i}
                                                        value={answers[question.id]?.[idx] || ''}
                                                        onChange={e => {
                                                            const cur = answers[question.id] || {};
                                                            handleAnswerChange({ ...cur, [idx]: e.target.value });
                                                        }}
                                                        disabled={isCorrect !== null}
                                                        className="mx-2 px-3 py-1 bg-gray-50 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold text-blue-600 transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="">...</option>
                                                        {options.map(opt => (
                                                            <option key={opt.id} value={opt.id}>{opt.text}</option>
                                                        ))}
                                                    </select>
                                                );
                                            } else {
                                                return (
                                                    <input
                                                        key={i}
                                                        type="text"
                                                        value={answers[question.id]?.[idx] || ''}
                                                        onChange={e => {
                                                            const cur = answers[question.id] || {};
                                                            handleAnswerChange({ ...cur, [idx]: e.target.value });
                                                        }}
                                                        disabled={isCorrect !== null}
                                                        placeholder="..."
                                                        className="mx-2 px-3 py-1 w-32 bg-gray-50 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold text-blue-600 transition-all"
                                                    />
                                                );
                                            }
                                        }
                                        return <span key={i}>{part}</span>;
                                    })}
                                </div>
                            ) : question.text}
                        </h2>

                        {/* Media Placeholder/Renderer */}
                        {question.media_url && (
                            <div className="mb-8 rounded-2xl overflow-hidden border-4 border-gray-50 shadow-inner bg-gray-50 flex items-center justify-center min-h-[200px]">
                                {question.media_type === 'image' ? (
                                    <img src={supabase.storage.from('Documents').getPublicUrl(question.media_url).data.publicUrl} className="max-h-[400px] object-contain" />
                                ) : question.media_type === 'audio' ? (
                                    <audio controls src={supabase.storage.from('Documents').getPublicUrl(question.media_url).data.publicUrl} className="w-full max-w-md" />
                                ) : question.media_type === 'video' ? (
                                    <video controls src={supabase.storage.from('Documents').getPublicUrl(question.media_url).data.publicUrl} className="w-full rounded-lg" />
                                ) : null}
                            </div>
                        )}

                        {/* Answers */}
                        <div className="space-y-3">
                            {question.type === 'matching' && (
                                <div className="space-y-4">
                                    {question.answers.map((a, idx) => {
                                        const [left] = a.text.split('|').map(s => s.trim());
                                        const options = Array.from(new Set(question.answers.map(ans => ans.text.split('|')[1]?.trim()))).filter(Boolean).sort();
                                        return (
                                            <div key={a.id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border-2 border-gray-100">
                                                <div className="flex-1 font-bold text-gray-700">{left}</div>
                                                <ArrowRight size={16} className="text-gray-300" />
                                                <select
                                                    value={answers[question.id]?.[idx] || ''}
                                                    onChange={e => {
                                                        const cur = answers[question.id] || {};
                                                        handleAnswerChange({ ...cur, [idx]: e.target.value });
                                                    }}
                                                    disabled={isCorrect !== null}
                                                    className="w-48 px-4 py-2 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 font-black text-sm transition-all cursor-pointer"
                                                >
                                                    <option value="">Выберите...</option>
                                                    {options.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {question.type === 'single' && question.answers.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => handleAnswerChange(a.id)}
                                    disabled={isCorrect !== null}
                                    className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between group
                                        ${answers[question.id] === a.id 
                                            ? 'border-blue-600 bg-blue-50 text-blue-900' 
                                            : 'border-gray-100 hover:border-blue-200 text-gray-700'
                                        }
                                        ${isCorrect !== null && answers[question.id] === a.id ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : ''}
                                    `}
                                >
                                    <span className="font-bold">{a.text}</span>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                                        ${answers[question.id] === a.id ? 'border-blue-600 bg-blue-600' : 'border-gray-200 group-hover:border-blue-300'}
                                    `}>
                                        {answers[question.id] === a.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                </button>
                            ))}

                            {question.type === 'multi' && question.answers.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => {
                                        const cur = answers[question.id] || [];
                                        handleAnswerChange(cur.includes(a.id) ? cur.filter((id: string) => id !== a.id) : [...cur, a.id]);
                                    }}
                                    disabled={isCorrect !== null}
                                    className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between group
                                        ${(answers[question.id] || []).includes(a.id) 
                                            ? 'border-blue-600 bg-blue-50 text-blue-900' 
                                            : 'border-gray-100 hover:border-blue-200 text-gray-700'
                                        }
                                    `}
                                >
                                    <span className="font-bold">{a.text}</span>
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all
                                        ${(answers[question.id] || []).includes(a.id) ? 'border-blue-600 bg-blue-600' : 'border-gray-200 group-hover:border-blue-300'}
                                    `}>
                                        {(answers[question.id] || []).includes(a.id) && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                </button>
                            ))}

                            {question.type === 'text' && (
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        value={answers[question.id] || ''}
                                        onChange={e => handleAnswerChange(e.target.value)}
                                        disabled={isCorrect !== null}
                                        placeholder="Введите ваш ответ здесь..."
                                        className={`w-full p-5 rounded-2xl border-2 font-bold text-lg outline-none transition-all
                                            ${isCorrect === null ? 'border-gray-100 focus:border-blue-600' : (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')}
                                        `}
                                    />
                                </div>
                            )}

                            {question.type === 'media_only' && (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 font-bold">Ознакомьтесь с материалом и нажмите «Продолжить»</p>
                                </div>
                            )}
                        </div>

                        {/* Feedback & Navigation */}
                        <div className="mt-12 pt-8 border-t flex flex-col items-center">
                            {isCorrect === null ? (
                                <button
                                    onClick={handleSubmitAnswer}
                                    disabled={validating || (question.type !== 'media_only' && !answers[question.id])}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-200 disabled:bg-gray-200 disabled:shadow-none"
                                >
                                    {validating ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        question.type === 'media_only' ? 'Продолжить' : 'Проверить ответ'
                                    )}
                                </button>
                            ) : (
                                <div className="w-full space-y-6">
                                    <div className={`p-6 rounded-2xl flex items-start gap-4 ${isCorrect ? 'bg-green-50 border border-green-100 text-green-800' : 'bg-red-50 border border-red-100 text-red-800'}`}>
                                        <div className={`p-2 rounded-xl ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                                            {isCorrect ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-lg mb-1">{isCorrect ? 'Верно!' : 'Ошибка'}</h4>
                                            {explanation && <p className="text-sm font-medium leading-relaxed opacity-80">{explanation}</p>}
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={handleNextQuestion}
                                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xl hover:bg-black transition-all flex items-center justify-center gap-2 group"
                                    >
                                        Далее <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
