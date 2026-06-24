import React, { useState, useEffect, useRef } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';
import { 
    ChevronDown, Trash2, Settings, Eye, Users, 
    BookOpen, Type, FolderPlus, Image as ImageIcon, 
    Upload, AlertCircle, Plus, AlertTriangle, Info,
    File, TableProperties, X, Minus
} from 'lucide-react';
import { 
    ContentItem, SectionItem as SectionItemType, 
    TextItem as TextItemType, ImageItem as ImageItemType,
    AlertItem as AlertItemType, FileItem as FileItemType,
    TableItem as TableItemType,
    VisibilitySettings 
} from './editor-types';
import { SortableItem } from './SortableItem';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// --- Types ---
interface EditorCanvasProps {
  items: ContentItem[];
  parentId: string | null;
  onItemsChange: (items: ContentItem[]) => void;
}

interface ItemWrapperProps {
    item: ContentItem;
    onDelete: (id: string) => void;
    onUpdateVisibility: (id: string, visibility: VisibilitySettings) => void;
    children: React.ReactNode;
    icon: React.ReactNode;
    title: string;
}

interface Specialization {
    id: string;
    name: string;
}

// --- AddBlockMenu ---
const AddBlockMenu: React.FC<{ onAdd: (type: 'text' | 'section' | 'image' | 'alert' | 'file' | 'table') => void }> = ({ onAdd }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative flex justify-center py-1 group">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="h-[2px] w-full bg-transparent group-hover:bg-blue-100 transition-colors rounded-full" />
            </div>
            
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative z-10 p-1 bg-white border-2 border-gray-100 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-full shadow-sm transition-all"
                title="Добавить элемент"
            >
                <Plus size={16} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 z-50 flex flex-wrap justify-center gap-2 p-3 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[300px]">
                    <button onClick={() => { onAdd('text'); setIsOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded-lg min-w-[70px] transition-colors">
                        <Type size={20} />
                        <span className="text-[10px] font-bold">Текст</span>
                    </button>
                    <button onClick={() => { onAdd('section'); setIsOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-green-50 hover:text-green-600 text-gray-600 rounded-lg min-w-[70px] transition-colors">
                        <FolderPlus size={20} />
                        <span className="text-[10px] font-bold">Раздел</span>
                    </button>
                    <button onClick={() => { onAdd('image'); setIsOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-purple-50 hover:text-purple-600 text-gray-600 rounded-lg min-w-[70px] transition-colors">
                        <ImageIcon size={20} />
                        <span className="text-[10px] font-bold">Фото</span>
                    </button>
                    <button onClick={() => { onAdd('alert'); setIsOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-lg min-w-[70px] transition-colors">
                        <AlertTriangle size={20} />
                        <span className="text-[10px] font-bold">Важно</span>
                    </button>
                    <button onClick={() => { onAdd('file'); setIsOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-amber-50 hover:text-amber-600 text-gray-600 rounded-lg min-w-[70px] transition-colors">
                        <File size={20} />
                        <span className="text-[10px] font-bold">Файл</span>
                    </button>
                    <button onClick={() => { onAdd('table'); setIsOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-cyan-50 hover:text-cyan-600 text-gray-600 rounded-lg min-w-[70px] transition-colors">
                        <TableProperties size={20} />
                        <span className="text-[10px] font-bold">Таблица</span>
                    </button>
                </div>
            )}
            
            {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
        </div>
    );
};


// --- Visibility Settings Component ---
const VisibilitySettingsPanel: React.FC<{
    visibility?: VisibilitySettings;
    onUpdate: (v: VisibilitySettings) => void;
    specializations: Specialization[];
}> = ({ visibility, onUpdate, specializations }) => {
    const roles: ('student' | 'parent' | 'child')[] = ['student', 'parent', 'child'];
    const currentRoles = visibility?.roles || ['student', 'parent', 'child'];
    const currentSpecs = visibility?.specialization_ids || [];

    const toggleRole = (role: 'student' | 'parent' | 'child') => {
        const newRoles = currentRoles.includes(role)
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];
        onUpdate({ ...visibility, roles: newRoles });
    };

    const toggleSpec = (specId: string) => {
        const newSpecs = currentSpecs.includes(specId)
            ? currentSpecs.filter(id => id !== specId)
            : [...currentSpecs, specId];
        onUpdate({ 
            ...visibility, 
            roles: currentRoles, 
            specialization_ids: newSpecs 
        });
    };

    return (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4 duration-200">
            <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-2 flex items-center gap-1">
                    <Users size={12} /> Видимость для ролей
                </label>
                <div className="flex flex-wrap gap-2">
                    {roles.map(role => (
                        <button
                            key={role}
                            onClick={() => toggleRole(role)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                                currentRoles.includes(role)
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-white text-gray-400 border border-gray-200 hover:border-blue-300'
                            }`}
                        >
                            {role === 'student' ? 'Студенты' : role === 'parent' ? 'Родители' : 'Дети'}
                        </button>
                    ))}
                </div>
            </div>

            {currentRoles.includes('student') && (
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-2 flex items-center gap-1">
                        <BookOpen size={12} /> Только для специализаций (опционально)
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {specializations.map(spec => (
                            <button
                                key={spec.id}
                                onClick={() => toggleSpec(spec.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    currentSpecs.includes(spec.id)
                                        ? 'bg-purple-600 text-white shadow-md'
                                        : 'bg-white text-gray-400 border border-gray-200 hover:border-purple-300'
                                }`}
                            >
                                {spec.name}
                            </button>
                        ))}
                    </div>
                    {currentSpecs.length === 0 && (
                        <p className="text-[10px] text-gray-400 mt-1 italic">Если ничего не выбрано, доступно всем студентам</p>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Item Wrapper ---
const ItemWrapper: React.FC<ItemWrapperProps> = ({ item, onDelete, onUpdateVisibility, children, icon, title }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [specializations, setSpecializations] = useState<Specialization[]>([]);
    const { token } = useAuth();

    useEffect(() => {
        if (showSettings && token && specializations.length === 0) {
            supabase.rpc('get_all_specializations', { p_token: token })
                .then(({ data }) => {
                    if (data) setSpecializations(data);
                });
        }
    }, [showSettings, token, specializations.length]);

    return (
        <div className="group w-full">
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2 text-gray-300">
                    <div className="text-gray-400">
                        {icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
                    
                    {item.visibility && (item.visibility.roles.length < 3 || (item.visibility.specialization_ids?.length ?? 0) > 0) && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50/50 text-amber-600/70 rounded-md text-[9px] font-black border border-amber-100/50">
                            <Eye size={10} /> ОГРАНИЧЕННЫЙ
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-blue-500'}`}
                        title="Настройки видимости"
                    >
                        <Settings size={16} />
                    </button>
                    <button 
                        onClick={() => onDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                        title="Удалить блок"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="mb-3">
                    <VisibilitySettingsPanel 
                        visibility={item.visibility} 
                        onUpdate={(v) => onUpdateVisibility(item.id, v)}
                        specializations={specializations}
                    />
                </div>
            )}

            <div className="w-full">
                {children}
            </div>
        </div>
    );
};

// --- ImageElement ---
const ImageElement: React.FC<{
    item: ImageItemType;
    onUpdate: (id: string, updates: Partial<ImageItemType>) => void;
}> = ({ item, onUpdate }) => {
    const { token, user } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !token || !user) return;

        setUploading(true);
        setError(null);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `recommendations/images/${uuidv4()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('Documents')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('Documents')
                .getPublicUrl(fileName);

            onUpdate(item.id, { url: publicUrl });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-3">
            {item.url ? (
                <div className="relative group/img rounded-xl overflow-hidden border border-gray-100 bg-gray-50/50 flex justify-center p-2">
                    <img src={item.url} alt={item.alt} className="w-auto h-auto max-h-[300px] object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-white text-gray-700 rounded-lg hover:bg-blue-600 hover:text-white transition-all font-bold flex items-center gap-2"
                        >
                            <Upload size={16} /> Заменить
                        </button>
                        <button 
                            onClick={() => onUpdate(item.id, { url: '' })}
                            className="p-2 bg-white text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all font-bold"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-100 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-400 hover:text-blue-500"
                >
                    {uploading ? (
                        <div className="w-8 h-8 border-3 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
                    ) : (
                        <>
                            <div className="p-3 bg-gray-100 rounded-full group-hover:bg-blue-100 transition-colors">
                                <ImageIcon size={32} />
                            </div>
                            <p className="font-bold text-sm">Нажмите, чтобы загрузить изображение</p>
                        </>
                    )}
                </div>
            )}
            
            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />

            {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input 
                    type="text" 
                    placeholder="Описание (alt)..."
                    value={item.alt || ''}
                    onChange={(e) => onUpdate(item.id, { alt: e.target.value })}
                    className="px-3 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                />
                <input 
                    type="text" 
                    placeholder="Подпись к фото..."
                    value={item.caption || ''}
                    onChange={(e) => onUpdate(item.id, { caption: e.target.value })}
                    className="px-3 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                />
            </div>
        </div>
    );
};

// --- TextElement ---
const TextElement: React.FC<{
    item: TextItemType;
    onUpdate: (id: string, content: string) => void;
}> = ({ item, onUpdate }) => {
  const [content, setContent] = useState(item.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full p-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-200 outline-none text-gray-700 min-h-[60px] resize-none transition-all text-sm overflow-hidden"
      value={content}
      onChange={(e) => setContent(e.target.value)}
      onBlur={() => onUpdate(item.id, content)}
      placeholder="Введите текст рекомендации..."
    />
  );
};

// --- FileElement ---
const FileElement: React.FC<{
    item: FileItemType;
    onUpdate: (id: string, updates: Partial<FileItemType>) => void;
}> = ({ item, onUpdate }) => {
    const { token } = useAuth();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !token) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `recommendations/files/${uuidv4()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('Documents')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('Documents')
                .getPublicUrl(fileName);

            const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
            onUpdate(item.id, { url: publicUrl, name: file.name, size: `${sizeInMb} MB` });
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex items-center gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-xl group/file">
            <div className="w-12 h-12 bg-white rounded-xl border border-gray-100 flex items-center justify-center text-amber-500 shadow-sm">
                <File size={24} />
            </div>
            <div className="flex-1 min-w-0">
                {item.url ? (
                    <div className="space-y-1">
                        <input 
                            type="text" 
                            value={item.name}
                            onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                            className="w-full bg-transparent border-none outline-none font-bold text-gray-700 text-sm focus:ring-0 p-0"
                        />
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{item.size || 'Неизвестный размер'}</p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 font-medium">Файл не выбран</p>
                )}
            </div>
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-amber-300 hover:text-amber-600 transition-all flex items-center gap-2"
            >
                {uploading ? <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /> : <Upload size={14} />}
                {item.url ? 'Заменить' : 'Загрузить'}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
        </div>
    );
};

// --- TableElement ---
const TableElement: React.FC<{
    item: TableItemType;
    onUpdate: (id: string, updates: Partial<TableItemType>) => void;
}> = ({ item, onUpdate }) => {
    const updateHeader = (index: number, val: string) => {
        const newHeaders = [...item.headers];
        newHeaders[index] = val;
        onUpdate(item.id, { headers: newHeaders });
    };

    const updateCell = (rowIndex: number, colIndex: number, val: string) => {
        const newRows = [...item.rows];
        newRows[rowIndex] = [...newRows[rowIndex]];
        newRows[rowIndex][colIndex] = val;
        onUpdate(item.id, { rows: newRows });
    };

    const addColumn = () => {
        onUpdate(item.id, {
            headers: [...item.headers, `Заголовок ${item.headers.length + 1}`],
            rows: item.rows.map(row => [...row, ''])
        });
    };

    const addRow = () => {
        onUpdate(item.id, {
            rows: [...item.rows, new Array(item.headers.length).fill('')]
        });
    };

    const removeColumn = (index: number) => {
        if (item.headers.length <= 1) return;
        onUpdate(item.id, {
            headers: item.headers.filter((_, i) => i !== index),
            rows: item.rows.map(row => row.filter((_, i) => i !== index))
        });
    };

    const removeRow = (index: number) => {
        if (item.rows.length <= 1) return;
        onUpdate(item.id, {
            rows: item.rows.filter((_, i) => i !== index)
        });
    };

    return (
        <div className="overflow-x-auto bg-gray-50/30 rounded-xl border border-gray-100 p-2">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        {item.headers.map((h, i) => (
                            <th key={i} className="p-1 min-w-[120px]">
                                <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg p-1 group/header">
                                    <input 
                                        type="text" 
                                        value={h} 
                                        onChange={(e) => updateHeader(i, e.target.value)}
                                        className="w-full bg-transparent border-none outline-none text-xs font-black uppercase text-gray-400 focus:ring-0 p-1"
                                    />
                                    <button onClick={() => removeColumn(i)} className="opacity-0 group-hover/header:opacity-100 text-gray-300 hover:text-red-500 p-1 transition-all">
                                        <X size={12} />
                                    </button>
                                </div>
                            </th>
                        ))}
                        <th className="p-1">
                            <button onClick={addColumn} className="p-2 text-gray-300 hover:text-blue-500 hover:bg-white rounded-lg transition-all">
                                <Plus size={14} />
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {item.rows.map((row, ri) => (
                        <tr key={ri}>
                            {row.map((cell, ci) => (
                                <td key={ci} className="p-1">
                                    <input 
                                        type="text" 
                                        value={cell} 
                                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                                        className="w-full bg-white border border-gray-100 rounded-lg p-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </td>
                            ))}
                            <td className="p-1 text-center">
                                <button onClick={() => removeRow(ri)} className="p-2 text-gray-300 hover:text-red-500 transition-all">
                                    <Minus size={14} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={item.headers.length + 1} className="p-1">
                            <button onClick={addRow} className="w-full py-2 flex justify-center text-gray-300 hover:text-blue-500 hover:bg-white rounded-lg transition-all border border-dashed border-gray-200 mt-1">
                                <Plus size={14} />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

// --- AlertElement ---
const AlertElement: React.FC<{
    item: AlertItemType;
    onUpdate: (id: string, updates: Partial<AlertItemType>) => void;
}> = ({ item, onUpdate }) => {
    const [content, setContent] = useState(item.content);

    return (
        <div className={`p-4 rounded-xl border flex gap-3 transition-all ${
            item.level === 'error' ? 'bg-red-50/50 border-red-100 text-red-900' :
            item.level === 'warning' ? 'bg-amber-50/50 border-amber-100 text-amber-900' :
            'bg-blue-50/50 border-blue-100 text-blue-900'
        }`}>
            <div className="flex-shrink-0 mt-1">
                {item.level === 'error' ? <AlertTriangle size={18} className="text-red-500" /> :
                 item.level === 'warning' ? <AlertCircle size={18} className="text-amber-500" /> :
                 <Info size={18} className="text-blue-500" />}
            </div>
            <div className="flex-1 space-y-3">
                <textarea
                    className="w-full bg-transparent border-none outline-none focus:ring-0 text-sm resize-none font-medium placeholder:text-gray-400"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onBlur={() => onUpdate(item.id, { content })}
                    placeholder="Введите текст важного сообщения..."
                    rows={2}
                />
                <div className="flex gap-2 border-t border-black/5 pt-2">
                    {[
                        { id: 'info', label: 'Инфо', color: 'bg-blue-100 text-blue-600' },
                        { id: 'warning', label: 'Внимание', color: 'bg-amber-100 text-amber-600' },
                        { id: 'error', label: 'Важно', color: 'bg-red-100 text-red-600' }
                    ].map(level => (
                        <button
                            key={level.id}
                            onClick={() => onUpdate(item.id, { level: level.id as AlertItemType['level'] })}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                                item.level === level.id ? level.color : 'bg-white/50 text-gray-400 hover:bg-white'
                            }`}
                        >
                            {level.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- SectionElement ---
function SectionElement({ item, onUpdate, onToggle, onItemsChange }: {
    item: SectionItemType;
    onUpdate: (id: string, title: string) => void;
    onToggle: (id: string) => void;
    onItemsChange: (parentId: string, items: ContentItem[]) => void;
}) {
    const [title, setTitle] = useState(item.title);

    return (
        <div className="w-full transition-all">
            <div 
              onClick={() => onToggle(item.id)} 
              className={`p-3 cursor-pointer flex justify-between items-center select-none bg-gray-50/50 hover:bg-gray-100/80 transition-colors rounded-xl border border-gray-100`}
            >
                <div className="flex items-center gap-3 flex-1">
                    <FolderPlus size={18} className="text-green-600" />
                    <input 
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={(e) => { e.stopPropagation(); onUpdate(item.id, title || 'Новый раздел'); }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-gray-800 bg-transparent border-none outline-none focus:ring-0 flex-1 text-sm"
                    />
                </div>
                
                <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 ${item.isOpen ? '' : '-rotate-90'}`} />
            </div>
            
            {item.isOpen && (
                <div className="pt-2 pb-2 pl-4 min-h-[50px] border-l-2 border-gray-50 ml-2 mt-1">
                    <EditorCanvas 
                        items={item.children} 
                        parentId={item.id}
                        onItemsChange={(newChildren) => onItemsChange(item.id, newChildren)} 
                    />
                </div>
            )}
        </div>
    );
}

// --- EditorCanvas ---
function EditorCanvas({ items, parentId, onItemsChange }: EditorCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: parentId || 'root', data: { type: 'container' } });

  const handleUpdate = (id: string, updates: Partial<ContentItem>) => {
    const newItems = items.map(item => {
      if (item.id === id) return { ...item, ...updates } as ContentItem;
      return item;
    });
    onItemsChange(newItems);
  };

  const handleUpdateContent = (id: string, newContent: string) => handleUpdate(id, { content: newContent });
  const handleUpdateTitle = (id: string, newTitle: string) => handleUpdate(id, { title: newTitle });
  const handleUpdateVisibility = (id: string, visibility: VisibilitySettings) => handleUpdate(id, { visibility });
  const handleUpdateImage = (id: string, updates: Partial<ImageItemType>) => handleUpdate(id, updates);
  const handleUpdateAlert = (id: string, updates: Partial<AlertItemType>) => handleUpdate(id, updates);
  const handleUpdateFile = (id: string, updates: Partial<FileItemType>) => handleUpdate(id, updates);
  const handleUpdateTable = (id: string, updates: Partial<TableItemType>) => handleUpdate(id, updates);

  const handleItemDelete = (id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const handleSectionToggle = (id: string) => {
    onItemsChange(items.map(item => (item.id === id && item.type === 'section') ? { ...item, isOpen: !item.isOpen } : item));
  };

  const handleChildItemsChange = (sectionId: string, newChildren: ContentItem[]) => {
    onItemsChange(items.map(item => (item.id === sectionId && item.type === 'section') ? { ...item, children: newChildren } : item));
  };

  const handleAdd = (type: 'text' | 'section' | 'image' | 'alert' | 'file' | 'table', index: number) => {
    let newItem: ContentItem;
    const base = {
      id: uuidv4(),
      visibility: {
        roles: ['student', 'parent', 'child'] as ('student' | 'parent' | 'child')[],
      }
    };

    if (type === 'text') {
      newItem = { ...base, type: 'text', content: 'Новый текстовый блок.' };
    } else if (type === 'section') {
      newItem = { ...base, type: 'section', title: 'Новый раздел', isOpen: true, children: [] };
    } else if (type === 'alert') {
      newItem = { ...base, type: 'alert', content: 'Важное сообщение...', level: 'error' };
    } else if (type === 'file') {
        newItem = { ...base, type: 'file', url: '', name: 'Новый файл', size: '' };
    } else if (type === 'table') {
        newItem = { ...base, type: 'table', headers: ['Заголовок 1', 'Заголовок 2'], rows: [['', '']] };
    } else {
      newItem = { ...base, type: 'image', url: '', alt: '', caption: '' };
    }
    
    const newItems = [...items];
    newItems.splice(index, 0, newItem);
    onItemsChange(newItems);
  };
  
  return (
    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
      <div 
        ref={setNodeRef} 
        className={`flex flex-col w-full min-h-[50px] transition-all rounded-xl ${isOver && parentId !== 'root' ? 'bg-blue-50/50 ring-2 ring-blue-200' : ''}`}
      >
        <AddBlockMenu onAdd={(type) => handleAdd(type, 0)} />
        
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <SortableItem id={item.id}>
              {item.type === 'text' ? (
                <ItemWrapper 
                  item={item} 
                  onDelete={handleItemDelete} 
                  onUpdateVisibility={handleUpdateVisibility}
                  icon={<Type size={14} />}
                  title="Текстовый блок"
                >
                  <TextElement item={item} onUpdate={handleUpdateContent} />
                </ItemWrapper>
              ) : item.type === 'image' ? (
                  <ItemWrapper 
                      item={item} 
                      onDelete={handleItemDelete} 
                      onUpdateVisibility={handleUpdateVisibility}
                      icon={<ImageIcon size={14} />}
                      title="Изображение"
                  >
                      <ImageElement item={item} onUpdate={handleUpdateImage} />
                  </ItemWrapper>
              ) : item.type === 'alert' ? (
                  <ItemWrapper 
                      item={item} 
                      onDelete={handleItemDelete} 
                      onUpdateVisibility={handleUpdateVisibility}
                      icon={<AlertTriangle size={14} />}
                      title="Важное"
                  >
                      <AlertElement item={item} onUpdate={handleUpdateAlert} />
                  </ItemWrapper>
              ) : item.type === 'file' ? (
                <ItemWrapper 
                    item={item} 
                    onDelete={handleItemDelete} 
                    onUpdateVisibility={handleUpdateVisibility}
                    icon={<File size={14} />}
                    title="Файл"
                >
                    <FileElement item={item} onUpdate={handleUpdateFile} />
                </ItemWrapper>
              ) : item.type === 'table' ? (
                <ItemWrapper 
                    item={item} 
                    onDelete={handleItemDelete} 
                    onUpdateVisibility={handleUpdateVisibility}
                    icon={<TableProperties size={14} />}
                    title="Таблица"
                >
                    <TableElement item={item} onUpdate={handleUpdateTable} />
                </ItemWrapper>
              ) : (
                  <ItemWrapper 
                      item={item} 
                      onDelete={handleItemDelete} 
                      onUpdateVisibility={handleUpdateVisibility}
                      icon={<FolderPlus size={14} />}
                      title="Раздел"
                  >
                      <SectionElement 
                          item={item} 
                          onUpdate={handleUpdateTitle}
                          onToggle={handleSectionToggle}
                          onItemsChange={handleChildItemsChange}
                      />
                  </ItemWrapper>
              )}
            </SortableItem>
            <AddBlockMenu onAdd={(type) => handleAdd(type, index + 1)} />
          </React.Fragment>
        ))}
      </div>
    </SortableContext>
  );
}

export { EditorCanvas };
