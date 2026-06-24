import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimation,
  DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical, Eye, Edit2, Users, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { ContentItem, SectionItem } from './editor-types';
import { EditorCanvas } from './Editor';
import { RecommendationsRenderer } from '../shared/RecommendationsRenderer';
import { produce } from 'immer';

// Helper to find an item and its parent container in the tree
interface FoundItemInfo {
    item: ContentItem;
    parent: ContentItem[] | null;
    parentId: string;
}

const findItemAndParent = (items: ContentItem[], id: string, parent: ContentItem[] | null = null, parentId: string = 'root'): FoundItemInfo | null => {
    for (const item of items) {
        if (item.id === id) return { item, parent, parentId };
        if (item.type === 'section') {
            const found = findItemAndParent(item.children, id, item.children, item.id);
            if (found) return found;
        }
    }
    return null;
};


const RecommendationsEditor: React.FC = () => {
    const { token } = useAuth();
    const { showToast } = useNotifications();
    const [items, setItems] = useState<ContentItem[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Preview Mode States
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const [previewRole, setPreviewRole] = useState<'student' | 'parent' | 'child'>('student');
    const [previewSpecs, setPreviewSpecs] = useState<string[]>([]);
    const [specializations, setSpecializations] = useState<{id: string, name: string}[]>([]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const activeItem = activeId ? findItemAndParent(items, activeId)?.item : null;

    useEffect(() => {
        setLoading(true);
        supabase.rpc('get_site_content', { p_content_id: 'recommendations' })
            .then(({ data, error }) => {
                if (error) {
                    showToast('Ошибка', 'Не удалось загрузить контент.', 'red', 'cross');
                } else {
                    try {
                        const parsed = data ? JSON.parse(data) : [];
                        setItems(Array.isArray(parsed) ? parsed : []);
                    } catch {
                        setItems([]);
                    }
                }
                setLoading(false);
            });
    }, [showToast]);

    useEffect(() => {
        if (viewMode === 'preview' && specializations.length === 0 && token) {
            supabase.rpc('get_all_specializations', { p_token: token })
                .then(({ data }) => {
                    if (data) setSpecializations(data);
                });
        }
    }, [viewMode, token, specializations.length]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const findItemPath = (items: ContentItem[], id: string, path: number[] = []): number[] | null => {
        for (let i = 0; i < items.length; i++) {
            if (items[i].id === id) return [...path, i];
            if (items[i].type === 'section') {
                const found = findItemPath((items[i] as SectionItem).children, id, [...path, i]);
                if (found) return found;
            }
        }
        return null;
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        setItems((currentItems) => {
            return produce(currentItems, (draft) => {
                const activePath = findItemPath(draft, active.id as string);
                const overPath = findItemPath(draft, over.id as string);

                if (!activePath || !overPath) return;

                // Validate they are in the same array (same level)
                if (activePath.length !== overPath.length) return;
                for (let i = 0; i < activePath.length - 1; i++) {
                    if (activePath[i] !== overPath[i]) return;
                }

                // Helper to get parent array and index
                const getParentAndIndex = (path: number[]) => {
                    let parentArr = draft;
                    for (let i = 0; i < path.length - 1; i++) {
                        parentArr = (parentArr[path[i]] as SectionItem).children;
                    }
                    return { parentArr, index: path[path.length - 1] };
                };

                const { parentArr, index: sourceIndex } = getParentAndIndex(activePath);
                const { index: destIndex } = getParentAndIndex(overPath);

                const movedItem = parentArr[sourceIndex];
                parentArr.splice(sourceIndex, 1);
                parentArr.splice(destIndex, 0, movedItem);
            });
        });
    };

    const handleSave = async () => {
        if (!token) {
            showToast('Ошибка', 'Ошибка аутентификации.', 'red', 'cross');
            return;
        }
        setSaving(true);
        
        const jsonContent = JSON.stringify(items);
    
        const { error: rpcError } = await supabase.rpc('update_site_content', {
            p_token: token,
            p_content_id: 'recommendations',
            p_content: jsonContent,
        });
        if (rpcError) {
            showToast('Ошибка', 'Не удалось сохранить контент.', 'red', 'cross');
        } else {
            showToast('Успешно', 'Контент успешно сохранен!', 'green', 'check');
        }
        setSaving(false);
    };

    const filteredItems = useMemo(() => {
        const filterRecursive = (list: ContentItem[]): ContentItem[] => {
            return list.filter(item => {
                if (item.visibility?.roles && !item.visibility.roles.includes(previewRole)) {
                    return false;
                }
                if (previewRole === 'student' && item.visibility?.specialization_ids && item.visibility.specialization_ids.length > 0) {
                    const hasMatch = item.visibility.specialization_ids.some(id => previewSpecs.includes(id));
                    if (!hasMatch) return false;
                }
                return true;
            }).map(item => {
                if (item.type === 'section') {
                    return {
                        ...item,
                        children: filterRecursive(item.children)
                    };
                }
                return item;
            }).filter(item => {
                if (item.type === 'section' && item.children.length === 0) {
                    return false;
                }
                return true;
            });
        };
        return filterRecursive(items);
    }, [items, previewRole, previewSpecs]);

    const togglePreviewSpec = (id: string) => {
        setPreviewSpecs(prev => 
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    return (
        <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col h-full space-y-6">
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-100 flex flex-col">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-3xl font-black text-gray-900">Редактор рекомендаций</h2>
                            <p className="text-gray-500 mt-1">Настройте контент и правила отображения для пользователей</p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                <button
                                    onClick={() => setViewMode('edit')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'edit' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Edit2 size={16} /> Редактор
                                </button>
                                <button
                                    onClick={() => setViewMode('preview')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'preview' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Eye size={16} /> Предпросмотр
                                </button>
                            </div>
                            
                            <button 
                                onClick={handleSave} 
                                disabled={saving || loading} 
                                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-blue-300 transition-all flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Сохранение...
                                    </>
                                ) : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                    
                    {viewMode === 'preview' && (
                        <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Users size={18} className="text-purple-500" />
                                Настройки предпросмотра
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-2">Роль пользователя</label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'student', label: 'Студент' },
                                            { id: 'parent', label: 'Родитель' },
                                            { id: 'child', label: 'Ребенок' }
                                        ].map(role => (
                                            <button
                                                key={role.id}
                                                onClick={() => setPreviewRole(role.id as 'student' | 'parent' | 'child')}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                                    previewRole === role.id
                                                        ? 'bg-purple-600 text-white shadow-md'
                                                        : 'bg-white text-gray-500 border border-gray-200 hover:border-purple-300'
                                                }`}
                                            >
                                                {role.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {previewRole === 'student' && specializations.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase mb-2 flex items-center gap-1">
                                            <BookOpen size={12} /> Выбранные специализации
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {specializations.map(spec => (
                                                <button
                                                    key={spec.id}
                                                    onClick={() => togglePreviewSpec(spec.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                        previewSpecs.includes(spec.id)
                                                            ? 'bg-blue-600 text-white shadow-md'
                                                            : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
                                                    }`}
                                                >
                                                    {spec.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 min-h-[500px] pb-32">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-500 rounded-full animate-spin mb-4" />
                                Загрузка контента...
                            </div>
                        ) : viewMode === 'edit' ? (
                            <EditorCanvas items={items} parentId={'root'} onItemsChange={setItems} />
                        ) : (
                            <div className="max-w-4xl mx-auto bg-gray-50/50 p-8 rounded-xl border border-dashed border-gray-200">
                                {filteredItems.length > 0 ? (
                                    <RecommendationsRenderer items={filteredItems} />
                                ) : (
                                    <div className="text-center py-12 text-gray-400 font-bold">
                                        Нет рекомендаций для выбранных параметров
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {viewMode === 'edit' && (
                <DragOverlay dropAnimation={defaultDropAnimation}>
                    {activeId ? (
                        <div className="bg-white rounded-xl shadow-2xl ring-2 ring-blue-500 opacity-90 scale-105 transition-transform">
                            <div className="p-4 flex items-center gap-3">
                                <GripVertical size={20} className="text-blue-500" />
                                <span className="font-bold text-gray-700">
                                    {activeItem?.type === 'text' ? 'Текстовый блок' : 
                                     activeItem?.type === 'section' ? `Раздел: ${activeItem.title}` : 
                                     'Изображение'}
                                </span>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            )}
        </DndContext>
    );
};

export default RecommendationsEditor;
