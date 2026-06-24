import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Repeat, Info } from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';

interface ConsultationInfo {
  id: string;
  childName: string;
  duration: number;
  status?: string;
  startTime: string;
}

interface TimeSlot {
  id: string;
  time: string;
  date: string;
  datetime: Date;
  available: boolean;
  booked_minutes: number;
  consultations: ConsultationInfo[];
  isPast: boolean;
}

export default function StudentSchedule() {
  const { token } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [currentWeek, setCurrentWeek] = useState(getStartOfWeek(new Date()));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [originalSlots, setOriginalSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredSlotData, setHoveredSlotData] = useState<{
    consultations: ConsultationInfo[];
    x: number;
    y: number;
  } | null>(null);

  const hasUnsavedChanges = useMemo(() => 
    JSON.stringify(slots) !== JSON.stringify(originalSlots),
    [slots, originalSlots]
  );

  function getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getWeekDates(startDate: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return d;
    });
  }

  function generateTimeSlots(): string[] {
    return Array.from({ length: 15 }, (_, i) =>
      `${(i + 8).toString().padStart(2, '0')}:00`
    );
  }

  function getDayName(date: Date): string {
    return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()];
  }

  function getDateString(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isPastSlot(date: Date, time: string): boolean {
    const moscowNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
    const slot = new Date(date);
    const [h, min] = time.split(':').map(Number);
    slot.setHours(h, min, 0, 0);
    
    // Слот считается прошедшим только если с его начала прошло более 40 минут
    const fortyMinsAgo = new Date(moscowNow.getTime() - 40 * 60 * 1000);
    return slot < fortyMinsAgo;
  }

  const loadSchedule = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);

    const weekDates = getWeekDates(currentWeek);
    const dateFrom = getDateString(weekDates[0]);
    const dateTo = getDateString(weekDates[6]);

    const { data, error } = await supabase.rpc('get_student_schedule', {
      p_token: token,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      console.error('get_student_schedule error:', error);
      if (!isSilent) setLoading(false);
      return;
    }

    interface ScheduleRow {
      slot_type: 'availability' | 'consultation';
      date: string;
      start_time: string;
      consultation_id?: string;
      child_full_name?: string;
      duration?: number;
      status?: string;
      booked_minutes?: number;
    }

    const rows = (data as ScheduleRow[]) ?? [];
    const timeSlotsList = generateTimeSlots();
    const newSlots: TimeSlot[] = [];

    weekDates.forEach((date) => {
      const dateStr = getDateString(date);

      timeSlotsList.forEach((time) => {
        const isPast = isPastSlot(date, time);

        const availRow = rows.find(
          (r) =>
            r.slot_type === 'availability' &&
            r.date === dateStr &&
            r.start_time.substring(0, 5) === time
        );

        const consultRows = rows.filter(
          (r) =>
            r.slot_type === 'consultation' &&
            r.date === dateStr &&
            r.start_time.substring(0, 2) === time.substring(0, 2) // Match by hour
        );

        newSlots.push({
          id: `${dateStr}_${time}`,
          time,
          date: dateStr,
          datetime: new Date(`${dateStr}T${time}`),
          available: !!availRow && !isPast,
          booked_minutes: availRow?.booked_minutes || 0,
          consultations: consultRows
            .map(c => ({
              id: c.consultation_id!,
              childName: c.child_full_name ?? 'Ученик',
              duration: c.duration!,
              status: c.status,
              startTime: c.start_time.substring(0, 5)
            }))
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
          isPast,
        });
      });
    });

    setSlots(newSlots);
    setOriginalSlots(newSlots);
    if (!isSilent) setLoading(false);
  }, [token, currentWeek]);

  useEffect(() => {
    loadSchedule();

    const handleSync = () => {
      loadSchedule(true);
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [loadSchedule]);

  const toggleSlot = (slot: TimeSlot) => {
    if (slot.consultations.length > 0 || slot.isPast) return;

    setSlots((currentSlots) =>
      currentSlots.map((s) =>
        s.id === slot.id ? { ...s, available: !s.available } : s
      )
    );
  };

  const handleDiscardChanges = () => {
    setSlots(originalSlots);
  };

  const handleSave = async () => {
    if (!token || !hasUnsavedChanges) return;

    setIsSaving(true);

    const changes = slots.filter((slot) => {
      const originalSlot = originalSlots.find(os => os.id === slot.id);
      return originalSlot && slot.available !== originalSlot.available && !slot.isPast && slot.consultations.length === 0;
    });

    const payload = changes.map(slot => ({
      date: slot.date,
      time: slot.time,
      action: slot.available ? 'add' : 'remove'
    }));

    const { error } = await supabase.rpc('batch_toggle_availability_slots', {
      p_token: token,
      p_slots: payload
    });

    if (error) {
      console.error('handleSave error:', error);
      showToast('Ошибка сохранения', getErrorMessage(error), 'red', 'cross');
      await loadSchedule();
    } else {
      showToast('Успешно', 'Изменения сохранены', 'green', 'check');
      await loadSchedule();
    }
    setIsSaving(false);
  };

  const handleCopyNextWeek = async () => {
    if (!token) return;
    if (hasUnsavedChanges) {
      showToast('Внимание', 'Сначала сохраните текущие изменения!', 'red', 'cross');
      return;
    }

    confirm({
      title: 'Копировать расписание',
      message: 'Скопировать расписание текущей недели на следующую?',
      onConfirm: async () => {
        setIsSaving(true);
        const dateFrom = getDateString(getWeekDates(currentWeek)[0]);
        
        const { error } = await supabase.rpc('copy_schedule_to_next_week', {
          p_token: token,
          p_source_week_start: dateFrom
        });

        if (error) {
          console.error('copy_schedule_to_next_week error:', error);
          showToast('Ошибка', 'Ошибка при копировании', 'red', 'cross');
        } else {
          showToast('Успешно', 'Расписание успешно скопировано на следующую неделю', 'green', 'check');
        }
        setIsSaving(false);
      }
    });
  };

  const goToPreviousWeek = () => {
    if (hasUnsavedChanges) {
      confirm({
        title: 'Несохраненные изменения',
        message: 'У вас есть несохраненные изменения. Вы уверены, что хотите уйти? Изменения будут потеряны.',
        onConfirm: () => {
          const prev = new Date(currentWeek);
          prev.setDate(prev.getDate() - 7);
          if (prev >= getStartOfWeek(new Date())) setCurrentWeek(prev);
        }
      });
      return;
    }
    const prev = new Date(currentWeek);
    prev.setDate(prev.getDate() - 7);
    if (prev >= getStartOfWeek(new Date())) setCurrentWeek(prev);
  };

  const goToNextWeek = () => {
    if (hasUnsavedChanges) {
      confirm({
        title: 'Несохраненные изменения',
        message: 'У вас есть несохраненные изменения. Вы уверены, что хотите уйти? Изменения будут потеряны.',
        onConfirm: () => {
          const next = new Date(currentWeek);
          next.setDate(next.getDate() + 7);
          setCurrentWeek(next);
        }
      });
      return;
    }
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + 7);
    setCurrentWeek(next);
  };

  const weekDates = getWeekDates(currentWeek);
  const timeSlotsList = generateTimeSlots();
  const canGoPrevious = currentWeek.getTime() > getStartOfWeek(new Date()).getTime();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Моё расписание</h1>
          <p className="text-gray-500 mt-1">Управляйте временем вашей доступности для занятий</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyNextWeek}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-all disabled:opacity-50 font-semibold border border-indigo-100 shadow-sm"
          >
            <Repeat size={18} />
            Копировать на след. неделю
          </button>
          
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <button
                onClick={handleDiscardChanges}
                disabled={isSaving}
                className="px-4 py-1.5 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                Сбросить
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 text-sm font-bold shadow-sm"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Navigation Header */}
        <div className="flex items-center justify-between p-6 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              disabled={!canGoPrevious}
              className={`p-2.5 rounded-xl transition-all ${
                canGoPrevious
                  ? 'bg-white hover:bg-gray-100 text-gray-700 shadow-sm border border-gray-200'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'
              }`}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2.5 bg-white hover:bg-gray-100 text-gray-700 rounded-xl shadow-sm border border-gray-200 transition-all"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="flex items-center gap-3 px-6 py-2 bg-white rounded-xl border border-gray-200 shadow-sm">
            <CalendarIcon className="text-blue-500" size={20} />
            <span className="text-lg font-bold text-gray-800">
              {weekDates[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} —{' '}
              {weekDates[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                confirm({
                  title: 'Несохраненные изменения',
                  message: 'У вас есть несохраненные изменения. Вы уверены, что хотите уйти? Изменения будут потеряны.',
                  onConfirm: () => setCurrentWeek(getStartOfWeek(new Date()))
                });
                return;
              }
              setCurrentWeek(getStartOfWeek(new Date()))
            }}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all font-bold shadow-md shadow-blue-200"
          >
            Сегодня
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 px-6 py-4 bg-white border-b border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-gray-100 rounded-full border border-gray-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Недоступно</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-emerald-400 rounded-full shadow-sm shadow-emerald-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Свободно</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-orange-400 rounded-full shadow-sm shadow-orange-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ожидает одобрения</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-amber-400 rounded-full shadow-sm shadow-amber-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ожидает оплаты</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-blue-500 rounded-full shadow-sm shadow-blue-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Консультация</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-red-100 rounded-full border border-red-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Прошло</span>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="overflow-x-auto relative z-30 flex justify-center bg-gray-50/50 py-4">
          <table className="border-collapse table-fixed bg-white shadow-lg rounded-xl overflow-hidden" style={{ width: 'calc(8 * 9rem)' }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 p-2 bg-gray-50 backdrop-blur-sm border-b border-r border-gray-100 text-center text-[12px] font-black text-gray-400 uppercase tracking-widest w-[9rem]">
                  Время
                </th>
                {weekDates.map((date) => {
                  const isToday = getDateString(date) === getDateString(new Date());
                  return (
                    <th
                      key={date.toISOString()}
                      className={`p-2 border-b border-gray-100 text-center transition-colors w-[9rem] ${
                        isToday ? 'bg-blue-50/30' : 'bg-gray-50/50'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-black uppercase tracking-tighter ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                          {getDayName(date)}
                        </span>
                        <span className={`text-xl font-black mt-0.5 ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                          {date.getDate()}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlotsList.map((time) => (
                <tr key={time} className="group">
                  <td className="sticky left-0 z-20 p-2 bg-gray-50 backdrop-blur-sm border-r border-b border-gray-100 text-[18px] font-black text-gray-700 text-center group-hover:text-blue-600 transition-colors w-[9rem]">
                    {time}
                  </td>
                  {weekDates.map((date) => {
                    const dateStr = getDateString(date);
                    const slot = slots.find((s) => s.date === dateStr && s.time === time);
                    if (!slot) return <td key={`${dateStr}_${time}`} className="w-[9rem] h-[5rem] border-b border-gray-50 bg-gray-50/30" />;

                    const hasPendingApproval = slot.consultations.some(c => c.status === 'pending_approval');
                    const hasPendingPayment = slot.consultations.some(c => c.status === 'pending_payment');
                    const hasPaid = slot.consultations.some(c => c.status === 'paid');
                    const isToday = dateStr === getDateString(new Date());

                    let bgColor = 'bg-gray-100 hover:bg-gray-200';
                    
                    // Priority 1: Active consultations (even if the hour has started)
                    if (hasPaid) bgColor = 'bg-blue-500 hover:bg-blue-600 shadow-md shadow-blue-200';
                    else if (hasPendingPayment) bgColor = 'bg-amber-400 hover:bg-amber-500 shadow-md shadow-amber-200';
                    else if (hasPendingApproval) bgColor = 'bg-orange-400 hover:bg-orange-500 shadow-md shadow-orange-200';
                    // Priority 2: Past state (only if no active consultations)
                    else if (slot.isPast) bgColor = 'bg-red-100/70 border border-red-200 opacity-80 cursor-not-allowed';
                    // Priority 3: Available/Booked states
                    else if (slot.available) {
                      bgColor = slot.booked_minutes > 0 
                        ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-inner' 
                        : 'bg-emerald-400 hover:bg-emerald-500 shadow-md shadow-emerald-200';
                    } else if (slot.consultations.length > 0) {
                      bgColor = 'bg-gray-50 border border-gray-100';
                    }

                    return (
                      <td 
                        key={`${dateStr}_${time}`} 
                        className={`p-1 border-b border-gray-50 relative transition-colors w-[9rem] ${isToday ? 'bg-blue-50/10' : ''}`}
                      >
                        <div
                          onClick={() => toggleSlot(slot)}
                          onMouseEnter={(e) => {
                            if (slot.consultations.length > 0) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredSlotData({
                                consultations: slot.consultations,
                                x: rect.left + rect.width / 2,
                                y: rect.top
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredSlotData(null)}
                          className={`w-full h-[5rem] rounded-xl cursor-pointer relative transition-all ${bgColor} ${
                            slot.consultations.length > 0 ? 'p-1 grid grid-rows-3 gap-0.5' : ''
                          }`}
                        >
                          {slot.consultations.map((c) => {
                            const mins = parseInt(c.startTime.split(':')[1]);
                            const gridRow = c.duration === 45 ? 'row-span-3' : 
                                            mins === 20 ? 'row-start-2' : 
                                            mins === 40 ? 'row-start-3' : 'row-start-1';
                            return (
                              <div 
                                key={c.id}
                                className={`rounded-md px-1 flex flex-col justify-center leading-tight shadow-sm border transition-all ${gridRow} ${
                                  c.status === 'pending_payment' 
                                    ? 'bg-amber-400 border-amber-500 text-amber-950' 
                                    : c.status === 'pending_approval'
                                    ? 'bg-orange-400 border-orange-500 text-orange-950'
                                    : 'bg-blue-500 border-blue-600 text-white'
                                }`}
                              >
                                <div className="flex items-center justify-center">
                                  <span className={`font-bold opacity-90 ${c.duration === 45 ? 'text-[17px]' : 'text-[12px]'}`}>{c.startTime}</span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Partials Indicator for Available Slot */}
                          {!slot.isPast && slot.available && slot.booked_minutes > 0 && slot.consultations.length === 0 && (
                            <div
                              className="absolute bottom-0 left-0 bg-emerald-600 h-1 rounded-b-xl"
                              style={{ width: `${(slot.booked_minutes / 60) * 100}%` }}
                            />
                          )}

                          {/* Empty Slot Interactive State */}
                          {!slot.isPast && slot.consultations.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-white/10">
                              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Fixed Tooltip Rendered Outside Clipping Containers */}
        {hoveredSlotData && (
          <div 
            className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full mb-3 w-64 bg-gray-900 text-white p-4 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] duration-200"
            style={{ 
              left: hoveredSlotData.x, 
              top: hoveredSlotData.y,
            }}
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-800">
              <Info size={14} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Детали консультаций</span>
            </div>
            <div className="space-y-4">
              {hoveredSlotData.consultations.map((c, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-sm text-white">{c.childName}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase ${
                      c.status === 'pending_payment' ? 'bg-amber-500 text-amber-950' : 
                      c.status === 'pending_approval' ? 'bg-orange-500 text-orange-950' : 
                      'bg-blue-500 text-white'
                    }`}>
                      {c.status === 'pending_payment' ? 'Оплата' : 
                       c.status === 'pending_approval' ? 'Заявка' : 'Ок'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="font-semibold text-gray-300">{c.startTime}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-700" />
                    <span>{c.duration} мин</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
          </div>
        )}

        <div className="p-6 bg-blue-50/50 border-t border-blue-100 flex items-center gap-3">
          <div className="p-2 bg-blue-500 text-white rounded-lg shadow-md shadow-blue-200">
            <Info size={20} />
          </div>
          <p className="text-sm text-blue-800 font-medium leading-relaxed">
            Нажмите на ячейку, чтобы открыть или закрыть время для записи. 
            <strong> Свободное время</strong> отображается зеленым цветом. 
            Наведите на ячейку с занятым временем, чтобы увидеть детали консультаций.
          </p>
        </div>
      </div>
    </div>
  );
}
