import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
    ArrowLeft, Save, Plus, Trash2, GripVertical, Image as ImageIcon, 
    Music, Video, MessageSquare, AlertCircle, Clock,
    ChevronDown, ChevronRight
} from 'lucide-react';
import { produce } from 'immer';

interface Answer {
    id?: string;
    text: string;
    is_correct: boolean;
    order_index: number;
}

interface Question {
    id?: string;
    text: string;
    type: 'single' | 'multi' | 'text' | 'media_only' | 'matching' | 'select' | 'fill';
    media_url?: string;
    media_type?: 'image' | 'audio' | 'video';
    explanation?: string;
    points: number;
    match_type: 'full' | 'partial';
    order_index: number;
    shuffle_answers: boolean;
    answers: Answer[];
}

interface Block {
    id?: string;
    title: string;
    description?: string;
    time_limit: number;
    min_block_score: number;
    order_index: number;
    is_enabled: boolean;
    shuffle_questions: boolean;
    questions: Question[];
}

interface TestData {
    id?: string;
    specialization_id: string | null;
    title: string;
    description?: string;
    min_pass_score: number;
    blocks: Block[];
}

interface TestEditorProps {
    testId: string | null;
    onClose: () => void;
}

export default function TestEditor({ testId, onClose }: TestEditorProps) {
    const { token } = useAuth();
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [specializations, setSpecializations] = useState<{id: string, name: string}[]>([]);
    const [data, setData] = useState<TestData>({
        title: '',
        specialization_id: null,
        min_pass_score: 70,
        blocks: []
    });
    const [expandedBlocks, setExpandedBlocks] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (token) {
            supabase.rpc('get_all_specializations', { p_token: token })
                .then(({ data }) => setSpecializations(data || []));
            
            if (testId) {
                setLoading(true);
                supabase.rpc('get_test_full_admin', { p_token: token, p_test_id: testId })
                    .then(({ data: testData, error }) => {
                        if (testData) {
                            setData({
                                ...testData,
                                blocks: (testData.blocks || []).map((b: any) => ({
                                    ...b,
                                    is_enabled: b.is_enabled ?? true,
                                    shuffle_questions: b.shuffle_questions ?? false,
                                    min_block_score: b.min_block_score ?? 0,
                                    questions: (b.questions || []).map((q: any) => ({
                                        ...q,
                                        shuffle_answers: q.shuffle_answers ?? false,
                                        answers: q.answers || []
                                    }))
                                }))
                            });
                        }
                        setLoading(false);
                    });
            }
        }
    }, [token, testId]);

    const handleSave = async () => {
        if (!data.title) {
            showToast('Внимание', 'Введите название теста', 'yellow', 'alert');
            return;
        }
        setSaving(true);
        try {
            const { data: newId, error } = await supabase.rpc('save_test_admin', {
                p_token: token,
                p_test_data: data
            });
            if (error) throw error;
            showToast('Успешно', 'Тест сохранен', 'green', 'check');
            onClose();
        } catch (err: any) {
            showToast('Ошибка', err.message, 'red', 'cross');
        } finally {
            setSaving(false);
        }
    };

    const addBlock = () => {
        setData(produce(draft => {
            if (!draft.blocks) draft.blocks = [];
            const newIndex = draft.blocks.length;
            draft.blocks.push({
                title: 'Новый блок',
                time_limit: 600,
                min_block_score: 0,
                order_index: newIndex,
                is_enabled: true,
                shuffle_questions: false,
                questions: []
            });
            setExpandedBlocks(prev => ({ ...prev, [newIndex]: true }));
        }));
    };

    const addQuestion = (blockIndex: number) => {
        setData(produce(draft => {
            if (!draft.blocks[blockIndex].questions) draft.blocks[blockIndex].questions = [];
            draft.blocks[blockIndex].questions.push({
                text: 'Новый вопрос',
                type: 'single',
                points: 1,
                match_type: 'full',
                order_index: draft.blocks[blockIndex].questions.length,
                shuffle_answers: false,
                answers: []
            });
        }));
    };

    const addAnswer = (blockIndex: number, questionIndex: number) => {
        setData(produce(draft => {
            if (!draft.blocks[blockIndex].questions[questionIndex].answers) 
                draft.blocks[blockIndex].questions[questionIndex].answers = [];
            
            draft.blocks[blockIndex].questions[questionIndex].answers.push({
                text: 'Новый вариант',
                is_correct: false,
                order_index: draft.blocks[blockIndex].questions[questionIndex].answers.length
            });
        }));
    };

    const removeBlock = (index: number) => {
        setData(produce(draft => { draft.blocks.splice(index, 1); }));
    };

    const removeQuestion = (blockIndex: number, qIndex: number) => {
        setData(produce(draft => { draft.blocks[blockIndex].questions.splice(qIndex, 1); }));
    };

    const removeAnswer = (blockIndex: number, qIndex: number, aIndex: number) => {
        setData(produce(draft => { draft.blocks[blockIndex].questions[qIndex].answers.splice(aIndex, 1); }));
    };

    const handleMediaUpload = async (blockIdx: number, qIdx: number, file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `tests/media/${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('Documents').upload(fileName, file);
        if (error) {
            showToast('Ошибка загрузки', error.message, 'red', 'cross');
            return;
        }
        setData(produce(draft => {
            const q = draft.blocks[blockIdx].questions[qIdx];
            q.media_url = fileName;
            if (file.type.startsWith('image/')) q.media_type = 'image';
            else if (file.type.startsWith('audio/')) q.media_type = 'audio';
            else if (file.type.startsWith('video/')) q.media_type = 'video';
        }));
    };

    if (loading) return <div className="p-12 text-center text-gray-400 animate-pulse">Загрузка структуры...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-32">
            <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">{testId ? 'Редактирование теста' : 'Новый тест'}</h2>
                        <p className="text-sm text-gray-500">Настройте структуру, вопросы и критерии оценки</p>
                    </div>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                    {saving ? 'Сохранение...' : <><Save size={20} /> Сохранить тест</>}
                </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Название теста</label>
                        <input 
                            type="text" 
                            value={data.title} 
                            onChange={e => setData({...data, title: e.target.value})}
                            placeholder="Напр: Входное тестирование по английскому"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Специализация (null = входной)</label>
                        <select 
                            value={data.specialization_id || ''} 
                            onChange={e => setData({...data, specialization_id: e.target.value || null})}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        >
                            <option value="">Входной тест (для всех студентов)</option>
                            {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Описание</label>
                        <textarea 
                            value={data.description || ''} 
                            onChange={e => setData({...data, description: e.target.value})}
                            rows={2}
                            placeholder="Инструкции для студента..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Проходной балл (%)</label>
                        <input 
                            type="number" 
                            value={data.min_pass_score} 
                            onChange={e => setData({...data, min_pass_score: parseInt(e.target.value) || 0})}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex justify-end gap-4">
                    <button 
                        onClick={() => setExpandedBlocks((data.blocks || []).reduce((acc, _, i) => ({ ...acc, [i]: true }), {}))}
                        className="text-xs font-bold text-gray-400 hover:text-blue-500 transition-colors"
                    >
                        Развернуть всё
                    </button>
                    <button 
                        onClick={() => setExpandedBlocks({})}
                        className="text-xs font-bold text-gray-400 hover:text-blue-500 transition-colors"
                    >
                        Свернуть всё
                    </button>
                </div>

                {(data.blocks || []).map((block, bIdx) => (
                    <div key={bIdx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setExpandedBlocks(prev => ({ ...prev, [bIdx]: !prev[bIdx] }))}
                                    className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400"
                                >
                                    {expandedBlocks[bIdx] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </button>
                                <GripVertical className="text-gray-300 cursor-move" size={20} />
                                <div className="flex flex-col">
                                    <input 
                                        type="text" 
                                        value={block.title} 
                                        onChange={e => setData(produce(draft => { draft.blocks[bIdx].title = e.target.value; }))}
                                        className="bg-transparent font-black text-gray-800 outline-none focus:border-b border-blue-500"
                                    />
                                    <span className="text-[10px] text-gray-400 uppercase font-black">Блок {bIdx + 1} • {(block.questions || []).length} вопр.</span>
                                </div>
                            </div>
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-gray-400 uppercase">Мин. балл блока:</span>
                                        <input 
                                            type="number" 
                                            value={block.min_block_score} 
                                            onChange={e => setData(produce(draft => { draft.blocks[bIdx].min_block_score = parseInt(e.target.value) || 0; }))}
                                            className="w-12 bg-transparent text-sm font-bold outline-none border-b border-dashed border-gray-300 focus:border-blue-500"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={block.is_enabled} 
                                            onChange={e => setData(produce(draft => { draft.blocks[bIdx].is_enabled = e.target.checked; }))}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-[10px] font-black text-gray-500 uppercase">Включен</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={block.shuffle_questions} 
                                            onChange={e => setData(produce(draft => { draft.blocks[bIdx].shuffle_questions = e.target.checked; }))}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-[10px] font-black text-gray-500 uppercase">Перемешивать вопросы</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-gray-400" />
                                        <input 
                                            type="number" 
                                            value={block.time_limit} 
                                            onChange={e => setData(produce(draft => { draft.blocks[bIdx].time_limit = parseInt(e.target.value) || 0; }))}
                                            className="w-16 bg-transparent text-sm font-bold outline-none"
                                        />
                                        <span className="text-xs text-gray-400 font-bold">сек</span>
                                    </div>
                                    <button onClick={() => removeBlock(bIdx)} className="text-red-400 hover:text-red-600 p-1">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            {expandedBlocks[bIdx] && (
                                <div className="px-6 py-2 border-b bg-gray-50/30">
                                    <input 
                                        type="text"
                                        value={block.description || ''}
                                        onChange={e => setData(produce(draft => { draft.blocks[bIdx].description = e.target.value; }))}
                                        placeholder="Описание блока (инструкции)..."
                                        className="w-full bg-transparent text-xs text-gray-500 outline-none placeholder:text-gray-300"
                                    />
                                </div>
                            )}

                        {expandedBlocks[bIdx] && (
                            <div className="p-6 space-y-6">
                                {(block.questions || []).map((q, qIdx) => (
                                    <div key={qIdx} className="bg-gray-50/50 p-6 rounded-xl border border-gray-100 space-y-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex gap-4">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Вопрос {qIdx + 1}</label>
                                                        <textarea 
                                                            value={q.text} 
                                                            onChange={e => setData(produce(draft => { draft.blocks[bIdx].questions[qIdx].text = e.target.value; }))}
                                                            rows={2}
                                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div className="w-48">
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Тип</label>
                                                        <select 
                                                            value={q.type} 
                                                            onChange={e => {
                                                                const newType = e.target.value as any;
                                                                setData(produce(draft => { 
                                                                    draft.blocks[bIdx].questions[qIdx].type = newType; 
                                                                    if (newType === 'media_only') {
                                                                        draft.blocks[bIdx].questions[qIdx].points = 0;
                                                                    } else if (draft.blocks[bIdx].questions[qIdx].points === 0) {
                                                                        draft.blocks[bIdx].questions[qIdx].points = 1;
                                                                    }
                                                                }));
                                                            }}
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none font-bold text-sm"
                                                        >
                                                            <option value="single">Один выбор</option>
                                                            <option value="multi">Множ. выбор</option>
                                                            <option value="text">Текст. ввод</option>
                                                            <option value="matching">Соотнесение</option>
                                                            <option value="select">Выбор в тексте</option>
                                                            <option value="fill">Ввод в тексте</option>
                                                            <option value="media_only">Только медиа</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Instructions for special types */}
                                                {q.type === 'matching' && (
                                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-2 items-start">
                                                        <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                                        <p className="text-[10px] font-medium text-blue-700 leading-tight">
                                                            Для <b>соотнесения</b> пишите варианты в формате <code>Утверждение | Правильный ответ</code>.<br />
                                                            Студент увидит список утверждений и выпадающие списки со всеми уникальными ответами справа.
                                                        </p>
                                                    </div>
                                                )}
                                                {(q.type === 'select' || q.type === 'fill') && (
                                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-2 items-start">
                                                        <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                                        <p className="text-[10px] font-medium text-blue-700 leading-tight">
                                                            Используйте <code>[[0]]</code>, <code>[[1]]</code> и т.д. в тексте вопроса для обозначения пропусков.<br />
                                                            Для <b>Выбора</b> добавьте варианты ответов и отметьте по одному правильному для каждого индекса (используйте Order Index для связи с [[n]]).<br />
                                                            Для <b>Ввода</b> добавьте по одному правильному ответу для каждого индекса.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap gap-4 items-end">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Баллы</label>
                                                        <input 
                                                            type="number" 
                                                            value={q.points} 
                                                            onChange={e => setData(produce(draft => { 
                                                                draft.blocks[bIdx].questions[qIdx].points = q.type === 'media_only' ? 0 : (parseInt(e.target.value) || 0); 
                                                            }))}
                                                            disabled={q.type === 'media_only'}
                                                            className={`w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold ${q.type === 'media_only' ? 'bg-gray-100 text-gray-400' : ''}`}
                                                        />
                                                    </div>
                                                    {['multi', 'matching', 'select', 'fill'].includes(q.type) && (
                                                        <div>
                                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Оценка</label>
                                                            <select 
                                                                value={q.match_type} 
                                                                onChange={e => setData(produce(draft => { draft.blocks[bIdx].questions[qIdx].match_type = e.target.value as any; }))}
                                                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold"
                                                            >
                                                                <option value="full">Полное совп.</option>
                                                                <option value="partial">Долевое</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                    {['single', 'multi'].includes(q.type) && (
                                                        <label className="flex items-center gap-2 cursor-pointer pb-2">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={q.shuffle_answers} 
                                                                onChange={e => setData(produce(draft => { draft.blocks[bIdx].questions[qIdx].shuffle_answers = e.target.checked; }))}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-[10px] font-black text-gray-500 uppercase">Случайный порядок</span>
                                                        </label>
                                                    )}
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1">
                                                            <MessageSquare size={10} /> Пояснение при ошибке
                                                        </label>
                                                        <input 
                                                            type="text" 
                                                            value={q.explanation || ''} 
                                                            onChange={e => setData(produce(draft => { draft.blocks[bIdx].questions[qIdx].explanation = e.target.value; }))}
                                                            placeholder="Почему ответ неверный..."
                                                            className="w-full px-4 py-1.5 border border-gray-200 rounded-lg text-sm"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Media section */}
                                                <div className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-xl">
                                                    <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                                                        {q.media_type === 'image' ? <ImageIcon size={20} /> : q.media_type === 'audio' ? <Music size={20} /> : q.media_type === 'video' ? <Video size={20} /> : <ImageIcon size={20} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        {q.media_url ? (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-blue-600 truncate max-w-xs">{q.media_url}</span>
                                                                <button onClick={() => setData(produce(draft => { draft.blocks[bIdx].questions[qIdx].media_url = undefined; }))} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <label className="text-xs font-bold text-gray-400 cursor-pointer hover:text-blue-500 transition-colors">
                                                                Прикрепить медиа (картинка/аудио/видео)
                                                                <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleMediaUpload(bIdx, qIdx, e.target.files[0])} />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Answers section */}
                                                {q.type !== 'media_only' && (
                                                    <div className="space-y-2 mt-4">
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Варианты ответов</label>
                                                        {(q.answers || []).map((a, aIdx) => (
                                                            <div key={aIdx} className="flex items-center gap-3">
                                                                {['single', 'multi', 'select'].includes(q.type) && (
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={a.is_correct} 
                                                                        onChange={e => setData(produce(draft => { 
                                                                            if (q.type === 'single') {
                                                                                draft.blocks[bIdx].questions[qIdx].answers.forEach((ans, idx) => ans.is_correct = idx === aIdx);
                                                                            } else {
                                                                                draft.blocks[bIdx].questions[qIdx].answers[aIdx].is_correct = e.target.checked;
                                                                            }
                                                                        }))}
                                                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                )}
                                                                <input 
                                                                    type="text" 
                                                                    value={a.text} 
                                                                    onChange={e => setData(produce(draft => { draft.blocks[bIdx].questions[qIdx].answers[aIdx].text = e.target.value; }))}
                                                                    placeholder={
                                                                        q.type === 'text' ? "Правильный вариант ответа..." : 
                                                                        q.type === 'matching' ? "Утверждение | Ответ" :
                                                                        "Текст варианта..."
                                                                    }
                                                                    className="flex-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                                                />
                                                                {['select', 'fill'].includes(q.type) && (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[10px] font-black text-gray-400">IDX</span>
                                                                        <input 
                                                                            type="number" 
                                                                            value={a.order_index} 
                                                                            onChange={e => setData(produce(draft => { draft.blocks[bIdx].questions[qIdx].answers[aIdx].order_index = parseInt(e.target.value) || 0; }))}
                                                                            className="w-12 px-2 py-1 border border-gray-200 rounded text-xs font-bold"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <button onClick={() => removeAnswer(bIdx, qIdx, aIdx)} className="text-gray-300 hover:text-red-400"><Trash2 size={16} /></button>
                                                            </div>
                                                        ))}
                                                        <button 
                                                            onClick={() => addAnswer(bIdx, qIdx)}
                                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2"
                                                        >
                                                            <Plus size={14} /> Добавить вариант
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => removeQuestion(bIdx, qIdx)} className="p-2 text-gray-300 hover:text-red-400 transition-colors">
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => addQuestion(bIdx)}
                                    className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={20} /> Добавить вопрос в блок
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                <button 
                    onClick={addBlock}
                    className="w-full py-6 bg-blue-50 border-2 border-blue-200 rounded-2xl text-blue-600 font-black text-lg hover:bg-blue-100 transition-all flex items-center justify-center gap-3 shadow-sm"
                >
                    <Plus size={24} /> ДОБАВИТЬ НОВЫЙ БЛОК ТЕСТА
                </button>
            </div>
        </div>
    );
}
