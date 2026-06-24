import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Star, Video, MessageSquare, Calendar, Award } from 'lucide-react';
import Avatar from '../shared/Avatar';
import { getAvatarUrl } from '../../lib/utils';

interface Review {
  rating: number;
  comment: string | null;
  created_at: string;
  child_name: string;
}

interface StudentProfileModalProps {
  student: {
    id: string;
    full_name: string;
    profile_photo_path: string | null;
    grade_average: number;
    average_rating: number;
    total_ratings: number;
    video_greeting?: string;
    bio?: string;
  };
  onClose: () => void;
  onBook: () => void;
  onMessage: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export default function StudentProfileModal({ 
  student, onClose, onBook, onMessage, isFavorite, onToggleFavorite 
}: StudentProfileModalProps) {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const loadReviews = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_student_reviews', {
      p_token: token,
      p_student_id: student.id,
    });
    if (!error && data) setReviews(data as Review[]);
    setLoadingReviews(false);
  }, [student.id, token]);

  useEffect(() => {
    if (token) loadReviews();
    // Блокируем скролл при открытии модалки
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [loadReviews, token]);

  const avatarUrl = getAvatarUrl(student.profile_photo_path);

  return (
    <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative h-32 bg-blue-600">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          <div className="absolute -bottom-12 left-8">
            <Avatar imageUrl={avatarUrl} name={student.full_name} size={96}/>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pt-16 px-8 pb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{student.full_name}</h2>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-yellow-500 font-bold">
                  <Star size={20} fill="currentColor" />
                  <span>{student.average_rating.toFixed(1)}</span>
                  <span className="text-gray-400 font-normal text-sm">({student.total_ratings} отзывов)</span>
                </div>
                <div className="flex items-center gap-1 text-blue-600 font-bold">
                  <Award size={20} />
                  <span>{student.grade_average.toFixed(2)}</span>
                  <span className="text-gray-400 font-normal text-sm">средний балл</span>
                </div>
              </div>
            </div>
            <button 
              onClick={onToggleFavorite}
              className={`p-3 rounded-xl border-2 transition-all ${
                isFavorite 
                  ? 'bg-red-50 border-red-200 text-red-500' 
                  : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-red-100 hover:text-red-400'
              }`}
            >
              <Star size={24} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {student.video_greeting && (
                <section>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Video size={20} className="text-blue-600" /> Видео-приветствие
                  </h3>
                  <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-inner flex items-center justify-center max-w-md">
                    <video 
                      src={getAvatarUrl(student.video_greeting) || ''} 
                      controls 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-2">О себе</h3>
                <p className="text-gray-600 leading-relaxed">
                  {student.bio || 'Репетитор пока не заполнил информацию о себе.'}
                </p>
              </section>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Отзывы учеников</h3>
              {loadingReviews ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl"></div>)}
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500 text-sm">
                  У этого репетитора пока нет отзывов.
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review, i) => (
                    <div key={i} className="bg-gray-50 p-4 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-800 text-sm">{review.child_name}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star 
                              key={star} 
                              size={12} 
                              className={star <= review.rating ? 'text-yellow-500' : 'text-gray-300'} 
                              fill={star <= review.rating ? 'currentColor' : 'none'} 
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-1">
                        <span className="text-[10px] text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('ru-RU')}
                        </span>
                        {review.comment && (
                          <p className="text-sm text-gray-600 mt-2 italic leading-relaxed">
                            "{review.comment}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex gap-4">
          <button 
            onClick={onMessage}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
          >
            <MessageSquare size={20} /> Написать
          </button>
          <button 
            onClick={onBook}
            className="flex-2 flex-[2] flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            <Calendar size={20} /> Забронировать занятие
          </button>
        </div>
      </div>
    </div>
  );
}