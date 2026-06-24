import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Search, Star, Calendar, BookOpen, Info, Award, Zap, Loader2, XCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getAvatarUrl } from '../../lib/utils';
import Avatar from '../shared/Avatar';
import StudentProfileModal from './StudentProfileModal';

interface StudentWithProfile {
  id: string;
  full_name: string;
  profile_photo_path: string | null;
  grade_average: number;
  average_rating: number;
  total_ratings: number;
  video_greeting?: string;
  bio?: string;
  is_ai_recommended?: boolean;
  availableSlots: Array<{ id: string; start_time: string }>;
}

interface Specialization {
  id: string;
  name: string;
  description?: string;
}

interface ActiveSearch {
  id: string;
  specialization_id: string;
  specialization_name: string;
  duration: number;
  price: number;
  description: string;
  created_at: string;
  eligible_count: number;
}

interface NewConsultationProps {
  onTabChange?: (tab: string, state?: Record<string, unknown>) => void;
  targetChildId?: string | null;
}

export default function NewConsultation({ onTabChange, targetChildId }: NewConsultationProps) {
  const { token, user, refreshBalance } = useAuth();
  const { showToast, confirm } = useNotifications();
  
  // Navigation State
  const [step, setStep] = useState<'subject' | 'calendar' | 'task' | 'filter' | 'booking'>('subject');
  
  // Data State
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<Specialization | null>(null);
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithProfile | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Immediate State
  const [isImmediate, setIsImmediate] = useState(false);
  const [activeSearch, setActiveSearch] = useState<ActiveSearch | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [showProfileId, setShowProfileId] = useState<string | null>(null);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);

  // Form State
  const [filters, setFilters] = useState({
    minGrade: '',
    minRating: '',
    hasVideo: false,
    selectedTime: '',
  });
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    duration: 15,
    description: '',
  });
  const [taskDescription, setTaskDescription] = useState('');

  const timeSlots = useMemo(() => Array.from({ length: 15 }, (_, i) =>
    `${(8 + i).toString().padStart(2, '0')}:00`
  ), []);

  const loadSpecializations = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_specializations_public', { p_token: token });
    if (!error && data) setSpecializations(data as Specialization[]);
  }, [token]);

  const loadFavorites = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_favorite_students', { p_token: token });
    if (!error && data) {
        setFavorites(new Set((data as { id: string }[]).map(s => s.id)));
    }
  }, [token]);

  const checkActiveSearch = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc('get_active_immediate_consultation', { p_token: token });
    if (!error && data && (data as ActiveSearch[]).length > 0) {
      const search = (data as ActiveSearch[])[0];
      setActiveSearch(search);
      setStep('booking');
      setIsImmediate(true);
      setSelectedSpecialization({ id: search.specialization_id, name: search.specialization_name });
    }
  }, [token]);

  // Initial Loads
  useEffect(() => {
    if (token) {
        loadSpecializations();
        loadFavorites();
        checkActiveSearch();
    }
  }, [token, loadSpecializations, loadFavorites, checkActiveSearch]);

  // Realtime signals for search status
  useEffect(() => {
    if (!token || !user) return;

    const handleSearchStarted = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { eligible_count } = customEvent.detail;
      setActiveSearch(prev => prev ? { ...prev, eligible_count } : null);
    };

    const handleSearchAccepted = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { student_name } = customEvent.detail;
      showToast('Ура!', `Репетитор ${student_name} принял ваш вызов!`, 'green', 'check', true, 10);
      if (onTabChange) onTabChange('consultations');
    };

    window.addEventListener('immediate_search_started', handleSearchStarted);
    window.addEventListener('immediate_consultation_accepted', handleSearchAccepted);

    return () => {
      window.removeEventListener('immediate_search_started', handleSearchStarted);
      window.removeEventListener('immediate_consultation_accepted', handleSearchAccepted);
    };
  }, [token, user, onTabChange, showToast]);

  // Load available dates when specialization is selected
  useEffect(() => {
    if (step === 'calendar' && selectedSpecialization && token) {
        const loadDates = async () => {
            setLoadingDates(true);
            const { data, error } = await supabase.rpc('get_available_dates', {
                p_token: token,
                p_specialization_id: selectedSpecialization.id,
            });
            if (!error && data) setAvailableDates((data as { date: string }[]).map(r => r.date));
            setLoadingDates(false);
        };
        loadDates();
    }
  }, [step, selectedSpecialization, token]);

  // Load available times when student and date/duration are selected
  useEffect(() => {
    if (step === 'booking' && selectedStudent && bookingData.date && token) {
        const loadTimes = async () => {
            setLoadingTimes(true);
            const { data, error } = await supabase.rpc('get_student_available_times', {
                p_token: token,
                p_student_id: selectedStudent.id,
                p_date: bookingData.date,
                p_duration: bookingData.duration,
            });
            if (!error && data) {
                const times = (data as { slot_time: string }[]).map(r => r.slot_time);
                setAvailableTimes(times);
                // Если текущее выбранное время больше недоступно для новой длительности - сбрасываем
                if (bookingData.time && !times.includes(bookingData.time)) {
                    setBookingData(prev => ({ ...prev, time: '' }));
                }
            }
            setLoadingTimes(false);
        };
        loadTimes();
    }
  }, [step, selectedStudent, bookingData.date, bookingData.duration, bookingData.time, token]);

  const toggleFavorite = async (studentId: string) => {
    const { data, error } = await supabase.rpc('toggle_favorite', {
        p_token: token,
        p_student_id: studentId
    });
    if (!error) {
        const newFavs = new Set(favorites);
        if (data) newFavs.add(studentId);
        else newFavs.delete(studentId);
        setFavorites(newFavs);
    }
  };

  const [recommendedId, setRecommendedId] = useState<string | null>(null);

  const filteredStudents = useMemo(() => {
    let filtered = [...students];

    if (searchTerm)
      filtered = filtered.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

    if (filters.minGrade) {
      const v = parseFloat(filters.minGrade);
      if (!isNaN(v)) filtered = filtered.filter(s => s.grade_average >= v);
    }

    if (filters.minRating) {
      const v = parseFloat(filters.minRating);
      if (!isNaN(v)) filtered = filtered.filter(s => s.average_rating >= v);
    }

    if (filters.hasVideo) filtered = filtered.filter(s => s.video_greeting);

    if (filters.selectedTime)
      filtered = filtered.filter(s =>
        s.availableSlots.some(slot => slot.start_time.startsWith(filters.selectedTime))
      );
    
    filtered.sort((a, b) => {
        // Priority 1: AI Recommendation
        if (a.id === recommendedId && b.id !== recommendedId) return -1;
        if (a.id !== recommendedId && b.id === recommendedId) return 1;

        // Priority 2: Favorites
        const aFav = favorites.has(a.id) ? 1 : 0;
        const bFav = favorites.has(b.id) ? 1 : 0;
        return bFav - aFav;
    });

    return filtered;
  }, [students, searchTerm, filters, favorites, recommendedId]);

  const fetchAvailableStudents = async () => {
    if (!selectedSpecialization || !bookingData.date || !token) {
        console.warn('Missing data for fetching students:', { selectedSpecialization, date: bookingData.date, hasToken: !!token });
        return;
    }
    
    setLoadingStudents(true);
    const { data, error } = await supabase.rpc('get_available_students', {
      p_token: token,
      p_specialization_id: selectedSpecialization.id,
      p_date: bookingData.date
    });

    if (!error && data) {
        interface StudentRow {
          id: string;
          full_name: string;
          profile_photo_path: string | null;
          grade_average: number;
          average_rating: number;
          total_ratings: number;
          video_greeting: string;
          bio: string;
          slot_id: string;
          slot_time: string;
        }
        const map = new Map<string, StudentWithProfile>();
        for (const row of (data as StudentRow[])) {
            if (!map.has(row.id)) {
                map.set(row.id, {
                    id: row.id,
                    full_name: row.full_name,
                    profile_photo_path: row.profile_photo_path,
                    grade_average: row.grade_average,
                    average_rating: row.average_rating,
                    total_ratings: row.total_ratings,
                    video_greeting: row.video_greeting,
                    bio: row.bio,
                    availableSlots: [],
                });
            }
            map.get(row.id)!.availableSlots.push({ id: row.slot_id, start_time: row.slot_time });
        }
        setStudents(Array.from(map.values()));
    } else if (error) {
        console.error('Error loading students:', error);
        showToast('Ошибка', 'Не удалось загрузить список репетиторов', 'red', 'cross');
    }
    setLoadingStudents(false);
  };

  const handleAITournament = async () => {
    if (!taskDescription.trim() || !selectedSpecialization || !bookingData.date) return;

    setIsAIAnalyzing(true);
    setRecommendedId(null);
    
    try {
      // Запускаем два запроса параллельно
      const [, aiResult] = await Promise.all([
          fetchAvailableStudents(),
          supabase.rpc('get_ai_recommendation', {
              p_problem: taskDescription,
              p_date: bookingData.date,
              p_specialization_id: selectedSpecialization.id
          })
      ]);

      if (aiResult.data) {
          setRecommendedId(aiResult.data as string);
          console.log('AI recommended student ID:', aiResult.data);
      }
      
      setStep('filter');
    } catch (err: unknown) {
      console.error('AI recommendation error:', err);
      showToast('Внимание', 'Не удалось запустить умный подбор, показываем всех репетиторов.', 'yellow', 'info');
      setStep('filter');
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  const handleSpecializationSelect = (spec: Specialization) => {
    setSelectedSpecialization(spec);
    setRecommendedId(null);
    setStep('calendar');
  };

  const handleDateSelect = (date: string) => {
    setBookingData(prev => ({ ...prev, date, time: '', duration: 15 }));
    setFilters(prev => ({ ...prev, selectedTime: '' }));
    setRecommendedId(null);
    setIsImmediate(false);
    setStep('task'); // Go to task description step
  };

  const renderTaskStep = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Опишите вашу задачу</h1>
          <p className="text-gray-600">Наш ИИ подберет лучших репетиторов специально под ваш запрос</p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-6">
            <label className="block text-sm font-bold text-blue-800 uppercase tracking-wider mb-2">Ваша цель или проблема:</label>
            <textarea
              value={taskDescription}
              onChange={(e) => {
                  setTaskDescription(e.target.value);
                  // Only sync to bookingData for non-immediate flow
                  if (!isImmediate) {
                      setBookingData(prev => ({ ...prev, description: e.target.value }));
                  }
              }}
              rows={6}
              placeholder="Напр.: Нужно подготовиться к КР по Python. Тема: циклы и асинхронность. Хочу разобрать конкретные примеры..."
              className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-lg"
            />
            <p className="text-xs text-blue-400 mt-2 italic">Чем подробнее описание, тем точнее будет подбор.</p>
          </div>

          <div className="flex gap-4">
            <button 
                onClick={() => setStep('calendar')}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
                Назад
            </button>
            <button 
                onClick={isImmediate ? () => setStep('booking') : handleAITournament}
                disabled={!taskDescription.trim() || isAIAnalyzing}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:bg-gray-400 disabled:shadow-none flex items-center justify-center gap-2"
            >
                {isAIAnalyzing ? (
                    <>
                        <Loader2 className="animate-spin" size={24} />
                        АНАЛИЗИРУЕМ...
                    </>
                ) : (
                    isImmediate ? 'ПРОДОЛЖИТЬ' : 'ПОДОБРАТЬ РЕПЕТИТОРОВ'
                )}
            </button>
          </div>
          
          <button 
            onClick={async () => {
                await fetchAvailableStudents();
                setStep('filter');
            }}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium py-2"
          >
            Пропустить и показать всех репетиторов
          </button>
        </div>
      </div>
    </div>
  );

  const handleImmediateSelect = () => {
    setIsImmediate(true);
    setBookingData(prev => ({ 
      ...prev, 
      date: new Date().toISOString().split('T')[0], 
      time: 'now', // Dummy time for immediate
      duration: 15 
    }));
    setStep('booking');
  };

  const handleStudentSelect = (student: StudentWithProfile) => {
    setSelectedStudent(student);
    setIsImmediate(false);
    setBookingData(prev => ({ ...prev, time: '', duration: 15 }));
    setStep('booking');
  };

  const handleSubmitBooking = async () => {
    if ((!selectedStudent && !isImmediate) || !selectedSpecialization || !user || !bookingData.time) return;
    
    if (isImmediate) {
      const { data, error } = await supabase.rpc('book_immediate_consultation', {
        p_token: token,
        p_specialization_id: selectedSpecialization.id,
        p_duration: bookingData.duration,
        p_description: bookingData.description,
        p_target_child_id: targetChildId || null,
      });

      if (!error && data) {
        showToast('Поиск начат', 'Мы ищем для вас подходящего репетитора', 'green', 'clock');
        refreshBalance();
        checkActiveSearch(); // This will set activeSearch and keep us in booking step
      } else {
        showToast('Ошибка', error?.message || 'Ошибка при запуске поиска', 'red', 'cross');
      }
    } else {
      const { data, error } = await supabase.rpc('book_consultation', {
          p_token: token,
          p_consultation_id: uuidv4(),
          p_student_id: selectedStudent!.id,
          p_specialization_id: selectedSpecialization.id,
          p_date: bookingData.date,
          p_time: bookingData.time,
          p_duration: bookingData.duration,
          p_description: bookingData.description,
          p_target_child_id: targetChildId || null,
      });                                                                                                                
      if (!error && data) {                                                                                                 
          showToast('Успешно', 'Заявка на консультацию отправлена!', 'green', 'check');                        
          if (onTabChange) onTabChange('consultations');
          else setStep('subject');
      } else {
          showToast('Ошибка', error?.message || 'Ошибка при отправке заявки', 'red', 'cross');
      }
    }
  };

  const handleCancelSearch = async () => {
    if (!activeSearch || !token) return;

    confirm({
      title: 'Отмена поиска',
      message: 'Вы уверены, что хотите отменить поиск? Деньги будут возвращены на ваш счет.',
      onConfirm: async () => {
        setIsCancelling(true);
        const { error } = await supabase.rpc('cancel_immediate_search', {
          p_token: token,
          p_consultation_id: activeSearch.id,
        });

        if (!error) {
          showToast('Поиск отменен', 'Средства возвращены на ваш баланс', 'white', 'info');
          setActiveSearch(null);
          setIsImmediate(false);
          setStep('subject');
          refreshBalance();
        } else {
          showToast('Ошибка', error.message, 'red', 'cross');
        }
        setIsCancelling(false);
      }
    });
  };

  // Render Functions
  const renderSubjectStep = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">
        <div className="text-center mb-8">
          <BookOpen className="mx-auto mb-4 text-blue-600" size={48} />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Выберите предмет</h1>
          <p className="text-gray-600">Выберите предмет, по которому вам нужна помощь</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {specializations.map((spec) => (
            <button
              key={spec.id}
              onClick={() => handleSpecializationSelect(spec)}
              className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{spec.name}</h3>
              {spec.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{spec.description}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCalendarStep = () => {
    const formatDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('ru-RU', {
        weekday: 'short', day: 'numeric', month: 'short',
      });

    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="text-center mb-8">
            <Calendar className="mx-auto mb-4 text-blue-600" size={48} />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Выберите дату для консультации по {selectedSpecialization?.name}
            </h1>
            <p className="text-gray-600">Выберите удобную дату (время выберете на следующем шаге)</p>
          </div>

          <div className="mb-8 p-6 bg-red-50 rounded-xl border-2 border-red-200 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-600 text-white rounded-xl animate-pulse"><Zap size={32} /></div>
                <div>
                  <h3 className="text-xl font-black text-red-900 uppercase">Прямо сейчас!</h3>
                </div>
              </div>
              <button 
                onClick={handleImmediateSelect}
                className="bg-red-600 text-white px-10 py-4 rounded-xl font-black text-lg hover:bg-red-700 transition-all shadow-lg shadow-red-200 hover:-translate-y-1 active:translate-y-0"
              >
                НАЧАТЬ ПОИСК
              </button>
          </div>

          <div className="relative flex items-center gap-4 my-8">
              <div className="flex-1 h-[1px] bg-gray-200"></div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white px-4">ИЛИ ВЫБЕРИТЕ ДАТУ</span>
              <div className="flex-1 h-[1px] bg-gray-200"></div>
          </div>

          {loadingDates ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {availableDates.map((date) => (
                <button
                  key={date}
                  onClick={() => handleDateSelect(date)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    bookingData.date === date
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className="font-medium">{formatDate(date)}</div>
                </button>
              ))}
              {availableDates.length === 0 && <p className="col-span-full text-center text-gray-500 py-4">Нет доступных дат</p>}
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => { setSelectedSpecialization(null); setStep('subject'); }}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Назад к предметам
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFilterStep = () => (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Репетиторы по {selectedSpecialization?.name} на {bookingData.date}
            </h1>
            <p className="text-gray-600">Выберите репетитора по критериям ниже</p>
          </div>
          <button
            onClick={() => { setBookingData(prev => ({ ...prev, date: '' })); setStep('calendar'); }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Изменить дату
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по имени..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <input
              type="text"
              value={filters.minGrade}
              onChange={(e) => setFilters({...filters, minGrade: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Мин. балл зачётки"
            />
          </div>

          <div>
            <input
              type="text"
              value={filters.minRating}
              onChange={(e) => setFilters({...filters, minRating: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Мин. рейтинг"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasVideo}
              onChange={(e) => setFilters({ ...filters, hasVideo: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 font-medium">С видео-приветствием</span>
          </label>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-1">
            <span className="text-sm text-gray-500 whitespace-nowrap">Время:</span>
            <button
              onClick={() => setFilters({ ...filters, selectedTime: '' })}
              className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-colors ${
                filters.selectedTime === '' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
              }`}
            >
              Все
            </button>
            {timeSlots.map((time) => (
              <button
                key={time}
                onClick={() => setFilters({ ...filters, selectedTime: time })}
                className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-colors ${
                  filters.selectedTime === time ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredStudents.map((student) => {
          const avatarUrl = getAvatarUrl(student.profile_photo_path);
          const isFav = favorites.has(student.id);
          const isRecommended = student.id === recommendedId;

          return (
            <div
              key={student.id}
              className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-all relative overflow-hidden group ${
                  isRecommended ? 'border-blue-400 ring-4 ring-blue-50 shadow-lg' : 'border-gray-100'
              }`}
            >
              {isRecommended && (
                  <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-br-xl flex items-center gap-1 shadow-sm z-10">
                      <Zap size={12} fill="currentColor" /> Рекомендуем для вашей задачи
                  </div>
              )}
              {isFav && <div className={`absolute top-0 right-0 w-12 h-12 flex items-center justify-center rounded-bl-2xl shadow-sm ${isRecommended ? 'bg-blue-600 text-white' : 'bg-red-50 text-red-500'}`}><Star size={20} fill="currentColor" /></div>}
              
              <div className="flex items-start gap-4 mb-4 mt-2">
                <Avatar imageUrl={avatarUrl} name={student.full_name} size={64} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-gray-900 truncate pr-8">{student.full_name}</h3>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                      <Star size={16} fill="currentColor" />
                      <span>{student.average_rating.toFixed(1)}</span>
                    </div>
                    <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                    <span className="text-sm text-gray-500">Зачётка: <span className="text-blue-600 font-bold">{student.grade_average.toFixed(2)}</span></span>
                  </div>
                </div>
              </div>

              {student.bio && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">{student.bio}</p>
              )}

              <div className="flex gap-2 mb-6">
                <button 
                    onClick={() => setShowProfileId(student.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors"
                >
                    <Info size={18} /> Профиль
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(student.id); }}
                    className={`p-2 rounded-xl border-2 transition-all ${
                        isFav ? 'bg-red-50 border-red-100 text-red-500' : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-red-400'
                    }`}
                >
                    <Star size={20} fill={isFav ? "currentColor" : "none"} />
                </button>
              </div>

              <button 
                onClick={() => handleStudentSelect(student)}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
              >
                Выбрать репетитора
              </button>
            </div>
          );
        })}
      </div>

      {(filteredStudents.length === 0 || loadingStudents) && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500 border border-gray-100">
          {loadingStudents ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          ) : (
            <>
                <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={32} className="text-gray-300" />
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">Ничего не нашли</p>
                <p className="text-sm mb-6">Попробуйте изменить фильтры или выбрать другую дату</p>
                <button
                    onClick={() => { 
                        setFilters({ minGrade: '', minRating: '', hasVideo: false, selectedTime: '' }); 
                        setSearchTerm(''); 
                        setRecommendedId(null);
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                    Сбросить всё
                </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  const renderBookingStep = () => {
    if (!selectedSpecialization) return null;

    if (activeSearch) {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border-4 border-blue-50 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-100">
               <div className="h-full bg-blue-600 animate-progress origin-left"></div>
            </div>

            <div className="relative z-10 space-y-8">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-25"></div>
                  <div className="bg-white p-8 rounded-full shadow-inner border border-blue-100">
                     <Loader2 className="text-blue-600 animate-spin" size={64} />
                  </div>
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-black text-gray-900 mb-2">Ищем репетитора...</h1>
                <p className="text-lg text-gray-500 font-medium">Предмет: <span className="text-blue-600">{activeSearch.specialization_name}</span></p>
              </div>

              <div className="max-w-md mx-auto bg-blue-50 rounded-xl p-6 border border-blue-100">
                 <p className="text-sm font-bold text-blue-800 uppercase tracking-widest mb-1">Уведомлено студентов</p>
                 <div className="text-5xl font-black text-blue-600">{activeSearch.eligible_count}</div>
                 <p className="text-xs text-blue-500 mt-2">Ваша заявка видна всем свободным репетиторам по выбранному предмету.</p>
              </div>

              <div className="pt-8 space-y-4">
                <p className="text-sm text-gray-400">Как только репетитор примет вызов, вы получите уведомление.</p>
                <button 
                  onClick={handleCancelSearch}
                  disabled={isCancelling}
                  className="flex items-center gap-2 mx-auto px-8 py-3 bg-white border-2 border-red-100 text-red-500 rounded-xl font-bold hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50"
                >
                  {isCancelling ? <Loader2 className="animate-spin" size={20} /> : <XCircle size={20} />}
                  Отменить поиск
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8">
          <button onClick={() => setStep(isImmediate ? 'calendar' : 'filter')} className="flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 mb-6">← Назад</button>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {isImmediate ? (
              <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                  <div className="p-3 bg-red-600 text-white rounded-xl shadow-sm"><Zap size={24} /></div>
                  <div>
                      <h3 className="font-bold text-red-900 uppercase">Немедленная консультация</h3>
                      <p className="text-sm text-red-700">{selectedSpecialization.name}</p>
                  </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                  <Avatar 
                      imageUrl={getAvatarUrl(selectedStudent?.profile_photo_path || null)}
                      name={selectedStudent?.full_name || ''}
                      size={56}
                  />
                  <div>
                      <h3 className="font-bold text-gray-900">{selectedStudent?.full_name}</h3>
                      <p className="text-sm text-blue-700">{selectedSpecialization.name}</p>
                  </div>
              </div>
            )}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm"><Calendar size={24} /></div>
                <div>
                    <h3 className="font-bold text-gray-900">{isImmediate ? 'Прямо сейчас!' : new Date(bookingData.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h3>
                    <p className="text-sm text-gray-500">Дата консультации</p>
                </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Длительность</label>
              <div className="grid grid-cols-2 gap-4">
                {([15, 45] as const).map((dur) => (
                  <button
                    key={dur}
                    onClick={() => setBookingData({ ...bookingData, duration: dur })}
                    className={`p-6 rounded-xl border-2 transition-all text-left relative ${bookingData.duration === dur ? 'border-blue-600 bg-blue-50' : 'border-gray-100 bg-gray-50 hover:border-blue-200'}`}
                  >
                    <div className={`font-bold text-xl mb-1 ${bookingData.duration === dur ? 'text-blue-600' : 'text-gray-900'}`}>{dur} минут</div>
                    <div className="text-gray-500 text-sm">Стоимость: <span className="text-blue-600 font-bold">{dur === 15 ? 200 : 500} ₽</span></div>
                    {bookingData.duration === dur && <div className="absolute top-4 right-4 text-blue-600"><Award size={24} /></div>}
                  </button>
                ))}
              </div>
            </div>

            {!isImmediate && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Выберите время</label>
                {loadingTimes ? (
                  <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {availableTimes.map((time) => (
                      <button
                        key={time}
                        onClick={() => setBookingData({ ...bookingData, time })}
                        className={`py-2 px-1 rounded-lg border-2 text-sm font-bold transition-all ${bookingData.time === time ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-blue-200'}`}
                      >
                        {time}
                      </button>
                    ))}
                    {availableTimes.length === 0 && <p className="col-span-full text-center text-gray-500">Нет доступного времени для выбранной длительности</p>}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Что хотите обсудить?</label>
              <textarea
                value={bookingData.description}
                onChange={(e) => setBookingData({ ...bookingData, description: e.target.value })}
                rows={4}
                placeholder="Напишите темы или вопросы, которые нужно разобрать..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500">Итого к оплате:</p>
                    <p className="text-3xl font-black text-blue-600">{bookingData.duration === 15 ? 200 : 500} ₽</p>
                </div>
                <button
                    onClick={handleSubmitBooking}
                    disabled={!bookingData.time || !bookingData.date}
                    className={`px-12 py-4 text-white rounded-xl font-bold transition-all shadow-lg disabled:bg-gray-200 disabled:shadow-none ${isImmediate ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                >
                    {isImmediate ? 'Начать поиск и оплатить' : 'Забронировать'}
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (step) {
      case 'subject':  return renderSubjectStep();
      case 'calendar': return renderCalendarStep();
      case 'task':     return renderTaskStep();
      case 'filter':   return renderFilterStep();
      case 'booking':  return renderBookingStep();
      default:         return renderSubjectStep();
    }
  };

  return (
    <>
      {renderContent()}
      {showProfileId && (
        <StudentProfileModal 
            student={students.find(s => s.id === showProfileId)!}
            onClose={() => setShowProfileId(null)}
            onBook={() => {
                const s = students.find(s => s.id === showProfileId)!;
                handleStudentSelect(s);
                setShowProfileId(null);
            }}
            onMessage={() => {
                if (onTabChange) onTabChange('messages', { userId: showProfileId });
                setShowProfileId(null);
            }}
            isFavorite={favorites.has(showProfileId)}
            onToggleFavorite={() => toggleFavorite(showProfileId)}
        />
      )}
    </>
  );
}