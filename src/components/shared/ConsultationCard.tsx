import { Calendar, Clock, CheckCircle, AlertCircle, XCircle, Video } from 'lucide-react';

export interface ExtendedConsultation {
  id: string;
  date: string;
  start_time: string;
  duration?: number;
  status?: string;
  price?: number;
  description?: string;
  is_immediate?: boolean;
  
  // Naming variations across different RPCs
  student_id?: string;
  specialization_id?: string;
  student_full_name?: string;
  student_name?: string;
  student_photo?: string | null;
  child_id?: string;
  child_full_name?: string;
  child_name?: string;
  child_photo?: string | null;
  parent_id?: string;
  parent_full_name?: string;
  parent_name?: string;
  rating?: number;
  rating_comment?: string;
  private_notes?: string;
  materials_text?: string;
  video_link?: string | null;
  commission_pct?: number;
  spec_name?: string;
  files?: string | { id: string; display_name: string; file_path: string; }[];
  
  is_rescheduling?: boolean;
  proposed_new_date?: string;
  proposed_new_time?: string;

  // Optional payload
  [key: string]: unknown;
}

interface ConsultationCardProps {
  consultation: ExtendedConsultation;
  role: 'student' | 'child' | 'parent' | 'admin';
  onClick: (consultation: ExtendedConsultation) => void;
}

export default function ConsultationCard({ consultation, role, onClick }: ConsultationCardProps) {
  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'paid': return { color: 'bg-green-100 text-green-800', dot: 'bg-green-500', label: 'Оплачено', icon: CheckCircle };
      case 'pending_payment': return { color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500', label: 'Ожидает оплаты', icon: AlertCircle };
      case 'completed': return { color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500', label: 'Завершено', icon: CheckCircle };
      case 'cancelled': return { color: 'bg-red-100 text-red-800', dot: 'bg-red-500', label: 'Отменено', icon: XCircle };
      case 'pending': return { color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', label: 'Ожидает', icon: AlertCircle };
      case 'pending_approval': return { color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', label: 'На проверке', icon: AlertCircle };
      case 'searching': return { color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500', label: 'Поиск репетитора', icon: Clock };
      default: return { color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400', label: status || 'Неизвестно', icon: CheckCircle };
    }
  };

  const statusConfig = getStatusConfig(consultation.status);
  const isPast = new Date(consultation.date + 'T' + consultation.start_time) < new Date();
  const startTime = new Date(consultation.date + 'T' + consultation.start_time);
  const tenMinutesBefore = new Date(startTime.getTime() - 10 * 60000);
  const isLive = consultation.status === 'paid' && new Date() >= tenMinutesBefore;

  // Determine who the "other party" is based on role
  let title = '';
  let subtitle = '';

  if (role === 'student') {
    title = consultation.child_full_name || consultation.child_name || 'Ученик';
    if (consultation.parent_full_name || consultation.parent_name) {
      subtitle = `Родитель: ${consultation.parent_full_name || consultation.parent_name}`;
    }
  } else if (role === 'child' || role === 'parent') {
    title = consultation.student_full_name || consultation.student_name || (consultation.status === 'searching' ? 'Поиск репетитора...' : 'Репетитор');
    if (role === 'parent' && (consultation.child_full_name || consultation.child_name)) {
      subtitle = `Ребёнок: ${consultation.child_full_name || consultation.child_name}`;
    }
  } else if (role === 'admin') {
    title = consultation.student_full_name || consultation.student_name || (consultation.status === 'searching' ? 'Поиск репетитора...' : 'Репетитор');
    subtitle = `Ученик: ${consultation.child_full_name || consultation.child_name || 'Неизвестно'}`;
  }

  return (
    <div
      onClick={() => onClick(consultation)}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer relative ${isPast && consultation.status !== 'paid' ? 'opacity-80' : ''}`}
    >
      {consultation.is_immediate && (
        <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg z-10">
           СРОЧНО
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex-1">
          {consultation.status && (
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {statusConfig.label}
              </span>
            </div>
          )}
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {consultation.spec_name && <p className="text-sm text-blue-600 font-medium mt-1">{consultation.spec_name}</p>}
        </div>

        <div className="text-right">
          <div className="flex items-center gap-2 text-gray-900 font-bold mb-1 justify-end">
            <Calendar size={16} className={consultation.is_rescheduling ? 'text-orange-500' : 'text-blue-600'} />
            <span>{new Date(consultation.date).toLocaleDateString('ru-RU')}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm justify-end">
            <Clock size={16} />
            <span>{consultation.start_time.substring(0, 5)} {consultation.duration ? `(${consultation.duration} мин)` : ''}</span>
          </div>
        </div>
      </div>

      {consultation.is_rescheduling && (
        <div className="mt-4 p-3 bg-orange-50 rounded-xl border border-orange-100 flex items-center gap-2">
          <Clock className="text-orange-500" size={16} />
          <span className="text-xs font-medium text-orange-800">
            Ожидается ответ по переносу
          </span>
        </div>
      )}

      {isLive && (
        <div className={`mt-4 p-3 rounded-xl border flex items-center justify-between ${consultation.video_link ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
          <div className="flex items-center gap-2">
            <Video className={`${consultation.video_link ? 'text-green-600 animate-bounce' : 'text-blue-600 animate-pulse'}`} size={16} />
            <span className={`text-xs font-bold uppercase tracking-wider ${consultation.video_link ? 'text-green-700' : 'text-blue-700'}`}>
              {consultation.video_link ? 'Урок идет' : (role === 'student' ? 'Готово к началу' : 'Ожидаем репетитора')}
            </span>
          </div>
          {consultation.video_link && (
            <button 
               onClick={(e) => { e.stopPropagation(); window.open(consultation.video_link!, '_blank'); }}
               className="px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
               Войти
            </button>
          )}
        </div>
      )}
    </div>
  );
}