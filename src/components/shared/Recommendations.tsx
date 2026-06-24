import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { ContentItem } from '../admin/editor-types';
import { BookText, Info } from 'lucide-react';
import { RecommendationsRenderer } from './RecommendationsRenderer';

interface StudentProfileData {
    specializations: { specialization_id: string }[];
}

const Recommendations: React.FC = () => {
    const { user, token } = useAuth();
    const { showToast } = useNotifications();
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [studentSpecs, setStudentSpecs] = useState<string[]>([]);

    const fetchContent = useCallback(async () => {
        setLoading(true);

        const { data, error: rpcError } = await supabase.rpc('get_site_content', {
            p_content_id: 'recommendations',
        });

        if (rpcError) {
            console.error('Error fetching recommendations:', rpcError);
            showToast('Ошибка', 'Не удалось загрузить рекомендации.', 'red', 'cross');
        } else {
            try {
                const parsed = JSON.parse(data);
                setItems(Array.isArray(parsed) ? parsed : []);
            } catch {
                setItems([]);
            }
        }
        setLoading(false);
    }, [showToast]);

    const fetchStudentSpecs = useCallback(async () => {
        if (!token || user?.role !== 'student') return;
        const { data } = await supabase.rpc('get_student_profile', { p_token: token });
        if (data && data.length > 0) {
            const p = data[0] as StudentProfileData;
            const specs: { specialization_id: string }[] = typeof p.specializations === 'string' 
                ? JSON.parse(p.specializations) 
                : (p.specializations ?? []);
            setStudentSpecs(specs.map(s => s.specialization_id));
        }
    }, [token, user?.role]);

    useEffect(() => {
        fetchContent();
        fetchStudentSpecs();
    }, [fetchContent, fetchStudentSpecs]);

    const filteredItems = useMemo(() => {
        if (!user) return [];

        const filterRecursive = (list: ContentItem[]): ContentItem[] => {
            return list.filter(item => {
                // 1. Role filter
                const userRole = user.role as 'student' | 'parent' | 'child' | 'admin';
                if (userRole === 'admin') return true; // Admins see everything

                if (item.visibility?.roles && !item.visibility.roles.includes(userRole as 'student' | 'parent' | 'child')) {
                    return false;
                }

                // 2. Specialization filter (only for students)
                if (user.role === 'student' && item.visibility?.specialization_ids && item.visibility.specialization_ids.length > 0) {
                    const hasMatch = item.visibility.specialization_ids.some(id => studentSpecs.includes(id));
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
                // If it's an empty section after filtering children, maybe hide it? 
                // Let's hide empty sections.
                if (item.type === 'section' && item.children.length === 0) {
                    return false;
                }
                return true;
            });
        };

        return filterRecursive(items);
    }, [items, user, studentSpecs]);

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white p-8 sm:p-12 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                    <div className="p-4 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">
                        <BookText size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900">Методический блок</h1>
                        <p className="text-gray-500 mt-1">Полезные советы и материалы, отобранные специально для вас</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-500 rounded-full animate-spin mb-4" />
                        Загрузка персональных рекомендаций...
                    </div>
                ) : filteredItems.length > 0 ? (
                    <RecommendationsRenderer items={filteredItems} />
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200 px-6 text-center">
                        <div className="p-6 bg-white rounded-full shadow-sm mb-4">
                            <Info size={40} className="text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Методического блока для Вас пока что нет</h3>
                        <p className="text-gray-500 mt-2 max-w-sm">
                            Мы скоро добавим новые материалы. Заглядывайте сюда почаще!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Recommendations;
