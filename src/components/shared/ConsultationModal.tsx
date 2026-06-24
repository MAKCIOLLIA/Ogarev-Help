import { useState, useEffect, useCallback } from 'react';
import { 
  X, Calendar, Clock, Video, FileText, Upload, BookText, 
  Star, Trash2, Edit3, Save, ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { getAvatarUrl, getErrorMessage } from '../../lib/utils';
import Avatar from './Avatar';
import { ExtendedConsultation } from './ConsultationCard';

interface ConsultationModalProps {
  consultation: ExtendedConsultation | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  role: 'student' | 'child' | 'parent' | 'admin';
  onBookAgain?: (consultation: ExtendedConsultation) => void;
}

interface Material {
  id: string;
  display_name: string;
  file_path: string;
}

export default function ConsultationModal({ consultation, isOpen, onClose, onUpdate, role }: ConsultationModalProps) {
  const { token, refreshBalance } = useAuth();
  const { showToast, confirm } = useNotifications();
  
  const [materialsText, setMaterialsText] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  
  const [showMaterialsLibrary, setShowMaterialsLibrary] = useState(false);
  const [myMaterials, setMyMaterials] = useState<Material[]>([]);

  const resetState = useCallback(() => {
    if (consultation) {
      setMaterialsText(consultation.materials_text || '');
      setPrivateNotes(consultation.private_notes || '');
      setRating(consultation.rating || 0);
      setRatingComment(consultation.rating_comment || '');
      setFiles([]);
      setRescheduling(false);
      setNewDate('');
      setNewTime('');
    }
  }, [consultation]);

  const loadMyMaterials = useCallback(async () => {
    if (!token) return;
    const { data } = await supabase.rpc('get_student_materials_list', { p_token: token });
    if (data) setMyMaterials(data as Material[]);
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      resetState();
      document.body.style.overflow = 'hidden';
      if (role === 'student' && token) {
        loadMyMaterials();
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, resetState, role, token, loadMyMaterials]);

  if (!isOpen || !consultation) return null;

  const isPast = new Date(consultation.date + 'T' + consultation.start_time) < new Date();
  
  const handleSaveMaterials = async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      // 1. Upload files if any
      const fileData = [];
      for (const file of files) {
        const hash = Math.random().toString(36).substring(7);
        const filePath = `consultation_files/${hash}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('Documents').upload(filePath, file);
        if (!uploadError) {
          fileData.push({ file_path: filePath, display_name: file.name });
        }
      }

      // 2. Save materials
      const { error: materialsError } = await supabase.rpc('save_consultation_materials', {
        p_token: token,
        p_consultation_id: consultation.id,
        p_materials_text: materialsText,
        p_files: fileData,
      });

      // 3. Save private notes
      const { error: notesError } = await supabase.rpc('update_consultation_private_notes', {
          p_token: token,
          p_consultation_id: consultation.id,
          p_notes: privateNotes
      });

      if (!materialsError && !notesError) {
        showToast('Успешно', 'Данные сохранены', 'green', 'check');
        onUpdate();
        onClose();
      } else {
        showToast('Ошибка', 'Не удалось сохранить изменения', 'red', 'cross');
      }
    } catch (err) {
      console.error(err);
      showToast('Ошибка', getErrorMessage(err), 'red', 'cross');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!newDate || !newTime || !token) return;
    setLoading(true);
    const { error } = await supabase.rpc('propose_consultation_reschedule', {
        p_token: token,
        p_consultation_id: consultation.id,
        p_new_date: newDate,
        p_new_time: newTime
    });
    setLoading(false);
    if (!error) {
        showToast('Перенос', 'Предложение о переносе отправлено', 'white', 'clock');
        setRescheduling(false);
        onUpdate();
        onClose();
    } else {
        showToast('Ошибка', error.message, 'red', 'cross');
    }
  };

  const handleAcceptReschedule = async () => {
    if (!token) return;
    setLoading(true);
    const { error } = await supabase.rpc('accept_reschedule', {
        p_token: token,
        p_consultation_id: consultation.id
    });
    setLoading(false);
    if (!error) {
        showToast('Успешно', 'Перенос подтвержден', 'green', 'check');
        onUpdate();
        onClose();
    }
  };

  const handleRejectReschedule = async () => {
    if (!token) return;
    setLoading(true);
    const { error } = await supabase.rpc('reject_reschedule', {
        p_token: token,
        p_consultation_id: consultation.id
    });
    setLoading(false);
    if (!error) {
        showToast('Успешно', 'Перенос отклонен', 'green', 'check');
        onUpdate();
        onClose();
    }
  };

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    if (!token) return;

    confirm({
      title: 'Удалить файл',
      message: 'Вы уверены, что хотите удалить этот файл?',
      onConfirm: async () => {
        setLoading(true);
        try {
          // 1. Storage
          await supabase.storage.from('Documents').remove([filePath]);
          // 2. DB
          const { error } = await supabase.rpc('delete_consultation_file', {
            p_token: token,
            p_file_id: fileId
          });
          if (error) throw error;
          onUpdate();
          showToast('Успешно', 'Файл удален', 'green', 'check');
        } catch (err) {
          showToast('Ошибка при удалении', getErrorMessage(err), 'red', 'cross');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const generateVideoLink = async () => {
    if (!token) return;
    setLoading(true);
    const { error } = await supabase.rpc('generate_video_link', {
      p_token: token,
      p_consultation_id: consultation.id,
    });
    setLoading(false);
    if (!error) {
      showToast('Видеосвязь', 'Ссылка на видеовстречу создана', 'green', 'check');
      onUpdate();
    } else {
      showToast('Ошибка', error.message, 'red', 'cross');
    }
  };

  const endVideoConference = async () => {
    if (!token) return;

    confirm({
      title: 'Завершить консультацию',
      message: 'Вы уверены, что хотите завершить консультацию?',
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.rpc('end_video_conference', {
          p_token: token,
          p_consultation_id: consultation.id,
        });
        setLoading(false);
        if (!error) {
          showToast('Успешно', 'Консультация завершена', 'green', 'check');
          onUpdate();
          onClose();
        } else {
          showToast('Ошибка', 'Не удалось завершить конференцию', 'red', 'cross');
        }
      }
    });
  };

  const handlePay = async () => {
    if (!token) return;
    setLoading(true);
    const { error } = await supabase.rpc('pay_consultation_from_balance', {
      p_token: token,
      p_consultation_id: consultation.id,
    });
    setLoading(false);
    if (error) {
      showToast('Ошибка при оплате', error.message, 'red', 'cross');
    } else {
      showToast('Успешно', 'Оплата прошла успешно!', 'green', 'check');
      refreshBalance();
      onUpdate();
      onClose();
    }
  };

  const submitRating = async () => {
    if (!token || rating === 0) return;
    setLoading(true);
    const { error } = await supabase.rpc('submit_rating', {
        p_token: token,
        p_consultation_id: consultation.id,
        p_rating: rating,
        p_comment: ratingComment
    });
    setLoading(false);
    if (error) {
        showToast('Ошибка при сохранении оценки', error.message, 'red', 'cross');
    } else {
        showToast('Успешно', 'Спасибо за вашу оценку!', 'green', 'check');
        onUpdate();
        onClose();
    }
  };

  const cancelConsultation = async () => {
    if (!token) return;

    confirm({
      title: 'Отмена консультации',
      message: 'Вы уверены, что хотите отменить консультацию?',
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.rpc('cancel_consultation', {
          p_token: token,
          p_consultation_id: consultation.id,
        });
        setLoading(false);
        if (error) {
          showToast('Ошибка при отмене', error.message, 'red', 'cross');
        } else {
          showToast('Успешно', 'Консультация отменена', 'green', 'check');
          onUpdate();
          onClose();
        }
      }
    });
  };

  const addFromLibrary = (mat: Material) => {
    const url = supabase.storage.from('Documents').getPublicUrl(mat.file_path).data.publicUrl;
    setMaterialsText(prev => prev + (prev ? '\n' : '') + `Ссылка на материал "${mat.display_name}": ${url}`);
    setShowMaterialsLibrary(false);
  };

  const getStatusLabel = (s?: string) => {
    switch (s) {
      case 'paid': return 'Оплачена';
      case 'pending_payment': return 'Ожидает оплаты';
      case 'completed': return 'Завершена';
      case 'cancelled': return 'Отменена';
      case 'pending': return 'Ожидает';
      case 'searching': return 'Поиск репетитора';
      case 'pending_approval': return 'На проверке';
      default: return s || 'Неизвестно';
    }
  };

  const isTooEarlyToGenerate = () => {
    const startTime = new Date(consultation.date + 'T' + consultation.start_time);
    const tenMinutesBefore = new Date(startTime.getTime() - 10 * 60000);
    return new Date() < tenMinutesBefore;
  };

  const otherPartyName = role === 'student' 
    ? (consultation.child_full_name || consultation.child_name || 'Ученик')
    : (consultation.student_full_name || consultation.student_name || (consultation.status === 'searching' ? 'Поиск репетитора...' : 'Репетитор'));

  return (
    <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col duration-200">
        {/* Header */}
        <div className="relative h-32 bg-blue-600 p-6 flex items-end">
          {consultation.is_immediate && (
            <div className="absolute top-4 left-6 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg z-10 animate-pulse uppercase tracking-widest">
               Срочно
            </div>
          )}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="flex items-center gap-4">
            <Avatar 
                imageUrl={getAvatarUrl(role === 'student' ? (consultation.child_photo || null) : (consultation.student_photo || null))} 
                name={otherPartyName} 
                size={80}
            />
            <div className="text-white">
              <h2 className="text-2xl font-bold">{otherPartyName}</h2>
              <p className="opacity-90 flex items-center gap-2 text-sm font-medium">
                <Calendar size={16} />
                {consultation.status === 'searching' ? 'Прямо сейчас' : `${new Date(consultation.date).toLocaleDateString('ru-RU')} в ${consultation.start_time.substring(0, 5)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status and Badge */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Статус занятия</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  consultation.status === 'paid' ? 'bg-green-500' : 
                  consultation.status === 'pending_payment' ? 'bg-yellow-500' : 
                  consultation.status === 'completed' ? 'bg-gray-500' : 
                  consultation.status === 'searching' ? 'bg-purple-500 animate-pulse' :
                  'bg-red-500'
                }`}></span>
                <span className="font-bold text-gray-900">{getStatusLabel(consultation.status)}</span>
              </div>
            </div>
            {consultation.price && (
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Стоимость</p>
                <p className="text-xl font-black text-blue-600">{consultation.price} ₽</p>
              </div>
            )}
          </div>

          {/* Rescheduling Banner */}
          {consultation.is_rescheduling && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Clock size={20} /></div>
                <div>
                  <p className="font-bold text-orange-900">Предложен перенос</p>
                  <p className="text-orange-700 text-sm">
                    Новое время: {new Date(consultation.proposed_new_date!).toLocaleDateString('ru-RU')} в {consultation.proposed_new_time?.substring(0, 5)}
                  </p>
                </div>
              </div>
              {(role === 'child' || role === 'parent') && (
                <div className="flex gap-2">
                  <button onClick={handleAcceptReschedule} className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm">Принять</button>
                  <button onClick={handleRejectReschedule} className="flex-1 py-2 bg-white border border-orange-200 text-orange-600 rounded-lg font-bold text-sm">Отклонить</button>
                </div>
              )}
              {role === 'student' && (
                 <p className="text-xs text-orange-600 italic">Ожидаем ответа от родителя</p>
              )}
            </div>
          )}

          {/* Description */}
          {consultation.description && (
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Edit3 size={16} className="text-blue-500" /> Описание проблемы
              </h4>
              <p className="text-gray-600 bg-gray-50 p-4 rounded-xl text-sm leading-relaxed">
                {consultation.description}
              </p>
            </div>
          )}

          {/* Files from Parent/Child */}
          {(() => {
            const filesList = consultation.files 
              ? (typeof consultation.files === 'string' ? JSON.parse(consultation.files) : consultation.files) 
              : [];
            
            if (filesList.length === 0) return null;

            return (
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" /> Прикреплённые файлы
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filesList.map((file: Material) => (
                    <div key={file.id} className="flex items-center gap-1">
                      <a
                        href={supabase.storage.from('Documents').getPublicUrl(file.file_path).data.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center gap-2 p-3 bg-white border border-gray-100 rounded-xl text-sm text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all shadow-sm truncate"
                      >
                        <FileText size={18} className="shrink-0" />
                        <span className="truncate">{file.display_name}</span>
                      </a>
                      {role === 'student' && (
                          <button 
                              onClick={() => handleDeleteFile(file.id, file.file_path)}
                              className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              title="Удалить файл"
                          >
                              <Trash2 size={18} />
                          </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Materials Section */}
          {(consultation.materials_text || (role === 'student' && consultation.status !== 'cancelled')) && (
            <div className="border-t border-gray-100 pt-6">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <BookText size={16} className="text-purple-500" /> Материалы к занятию
              </h4>
              
              {role === 'student' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Для ученика (видит родитель и ребенок):</label>
                    <textarea
                      value={materialsText}
                      onChange={(e) => setMaterialsText(e.target.value)}
                      rows={3}
                      placeholder="Добавьте полезные ссылки или описание домашнего задания..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors text-xs font-bold">
                          <Upload size={14} />
                          <span>Прикрепить файлы</span>
                          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="hidden" />
                        </label>
                        <button 
                            onClick={() => setShowMaterialsLibrary(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-xs font-bold"
                        >
                            <BookText size={14} /> Библиотека
                        </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Приватные заметки (видите только вы):</label>
                    <textarea
                      value={privateNotes}
                      onChange={(e) => setPrivateNotes(e.target.value)}
                      rows={2}
                      placeholder="План занятия, успехи ученика..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  
                  {files.length > 0 && <p className="text-xs text-gray-500">Выбрано файлов: {files.length}</p>}
                  
                  <button
                    onClick={handleSaveMaterials}
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    <Save size={18} /> {loading ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              ) : (
                consultation.materials_text && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-blue-900 text-sm whitespace-pre-wrap">{consultation.materials_text}</p>
                  </div>
                )
              )}
            </div>
          )}

          {/* Rating Section (for Child/Parent in past) */}
          {consultation.status === 'completed' && (role === 'child' || role === 'parent') && (
            <div className="border-t border-gray-100 pt-6">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Star size={16} className="text-yellow-500" /> Оценка занятия
              </h4>
              {consultation.rating ? (
                 <div className="space-y-3">
                    <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} size={24} className={star <= consultation.rating! ? 'text-yellow-500' : 'text-gray-200'} fill={star <= consultation.rating! ? 'currentColor' : 'none'} />
                        ))}
                    </div>
                    {consultation.rating_comment && (
                        <p className="text-sm text-gray-600 italic bg-gray-50 p-3 rounded-xl border border-gray-100">
                            "{consultation.rating_comment}"
                        </p>
                    )}
                 </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button key={star} onClick={() => setRating(star)} className="transition-transform">
                                <Star size={32} className={star <= rating ? 'text-yellow-500' : 'text-gray-200'} fill={star <= rating ? 'currentColor' : 'none'} />
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={submitRating} 
                        disabled={rating === 0 || loading} 
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-200 transition-all shadow-lg shadow-blue-100"
                    >
                        Оценить
                    </button>
                  </div>
                  
                  {rating > 0 && (
                    <div className="space-y-4">
                        <textarea
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            placeholder="Напишите пару слов о занятии (необязательно)..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            rows={2}
                        />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Video / Call Section */}
          {consultation.status === 'paid' && (
            <div className="border-t border-gray-100 pt-6">
               <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Video size={16} className="text-green-500" /> Видеосвязь
              </h4>
              
              {role === 'student' ? (
                <div className="flex flex-col gap-3">
                  {consultation.video_link ? (
                    <div className="flex gap-2">
                      <a href={consultation.video_link} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100">
                        <Video size={20} /> Войти в конференцию
                      </a>
                      <button onClick={endVideoConference} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors">
                        Завершить
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={generateVideoLink} 
                      disabled={isTooEarlyToGenerate() || loading}
                      className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 transition-all shadow-lg shadow-blue-100"
                    >
                      {isTooEarlyToGenerate() ? 'Ссылка будет доступна за 10 мин до начала' : 'Создать ссылку на видеовстречу'}
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {consultation.video_link ? (
                     <a href={consultation.video_link} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100">
                        <Video size={20} /> Присоединиться к уроку
                     </a>
                  ) : (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 text-sm text-center">
                       Ссылка появится здесь, когда репетитор её создаст (обычно за 10 минут до начала).
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-3">
          {consultation.status === 'pending_payment' && (role === 'child' || role === 'parent') && (
            <button onClick={handlePay} disabled={loading} className="flex-1 py-3 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 shadow-lg shadow-yellow-100">
              Оплатить {consultation.price} ₽
            </button>
          )}
          
          {!isPast && consultation.status !== 'cancelled' && consultation.status !== 'completed' && (
            <>
              {!rescheduling ? (
                <button onClick={() => setRescheduling(true)} className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-colors">
                  Перенести
                </button>
              ) : (
                <div className="w-full space-y-3 bg-white p-4 rounded-xl border border-orange-200">
                   <p className="text-sm font-bold text-orange-900">Выберите новое время</p>
                   <div className="flex gap-3">
                      <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                      <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                   </div>
                   <div className="flex gap-2">
                      <button onClick={handleReschedule} disabled={loading} className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm">Предложить</button>
                      <button onClick={() => setRescheduling(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm">Отмена</button>
                   </div>
                </div>
              )}
              
              {!rescheduling && (
                <button onClick={cancelConsultation} disabled={loading} className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors">
                  Отменить
                </button>
              )}
            </>
          )}
          
          {isPast && (
             <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">
                Закрыть
             </button>
          )}
        </div>
      </div>

      {/* Materials Library Modal */}
      {showMaterialsLibrary && (
        <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Ваша библиотека</h3>
                    <button onClick={() => setShowMaterialsLibrary(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                    {myMaterials.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">Библиотека пуста</p>
                    ) : (
                        myMaterials.map(mat => (
                            <button
                                key={mat.id}
                                onClick={() => addFromLibrary(mat)}
                                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="text-blue-500" size={20} />
                                    <span className="text-sm font-medium text-gray-700">{mat.display_name}</span>
                                </div>
                                <ChevronRight size={16} className="text-gray-400" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}