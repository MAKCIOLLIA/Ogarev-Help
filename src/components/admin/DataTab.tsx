import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Plus, Edit, Trash2, BookOpen, Settings, ShieldAlert } from 'lucide-react';
import { Specialization } from '../../types';

export default function SpecializationsTab() {
  const { token } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [newSpec, setNewSpec] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  const [blockSetting, setBlockSetting] = useState(false);
  const [commissionSetting, setCommissionSetting] = useState(20);
  const [tempCommission, setTempCommission] = useState(20);
  const [aiUrl, setAiUrl] = useState('');
  const [tempAiUrl, setTempAiUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [tempVideoUrl, setTempVideoUrl] = useState('');
  const [studentCodeUrl, setStudentCodeUrl] = useState('');
  const [tempStudentCodeUrl, setTempStudentCodeUrl] = useState('');

  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'none' | 'ok' | 'error'>('none');
  const [isVideoHealthChecking, setIsVideoHealthChecking] = useState(false);
  const [videoHealthStatus, setVideoHealthStatus] = useState<'none' | 'ok' | 'error'>('none');
  const [loadingSettings, setLoadingSettings] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;

    const { data, error } = await supabase.rpc('get_specializations_admin', { p_token: token });
    if (error) console.error('get_specializations_admin error:', error);
    else setSpecializations(data || []);

    const { data: statsData, error: statsError } = await supabase.rpc('get_admin_dashboard_stats', { p_token: token });
    if (!statsError && statsData) {
        if (statsData.financial_stats) {
            setBlockSetting(statsData.financial_stats['Блокировка студента, если рейтинг ниже 20%'] === 1);
            const comm = Number(statsData.financial_stats['Комиссия платформы'] || 20);
            setCommissionSetting(comm);
            setTempCommission(comm);
        }
        if (statsData.text_settings) {
            const aiUrlVal = statsData.text_settings['Адрес ИИ рекомендаций'] || '';
            setAiUrl(aiUrlVal);
            setTempAiUrl(aiUrlVal);

            const videoUrlVal = statsData.text_settings['Адрес сервиса видеосвязи'] || '';
            setVideoUrl(videoUrlVal);
            setTempVideoUrl(videoUrlVal);

            const codeUrlVal = statsData.text_settings['Кодекс студента'] || '';
            setStudentCodeUrl(codeUrlVal);
            setTempStudentCodeUrl(codeUrlVal);
        }
    }
  }, [token]);

  useEffect(() => {
    if (token) loadData();
  }, [token, loadData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (file.type !== 'application/pdf') {
        showToast('Ошибка', 'Пожалуйста, загрузите PDF файл', 'red', 'cross');
        return;
    }

    setLoadingSettings(true);
    try {
        const filePath = `system/student_code.pdf`;
        const { error: uploadError } = await supabase.storage
            .from('Documents')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('Documents')
            .getPublicUrl(filePath);

        await handleUpdateSetting('Кодекс студента', null, publicUrl);
        setStudentCodeUrl(publicUrl);
        setTempStudentCodeUrl(publicUrl);
    } catch (err) {
        showToast('Ошибка загрузки', (err as Error).message, 'red', 'cross');
    } finally {
        setLoadingSettings(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: number | null, textValue: string | null = null) => {
    if (!token) return;
    
    if (key === 'Комиссия платформы' && value !== null) {
        if (value < 0 || value > 100) {
            showToast('Ошибка', 'Комиссия должна быть от 0 до 100%', 'red', 'cross');
            return;
        }
    }

    setLoadingSettings(true);
    try {
        const { error } = await supabase.rpc('update_system_stat', {
            p_token: token,
            p_key: key,
            p_value: value,
            p_text_value: textValue
        });
        if (error) throw error;
        
        if (key === 'Блокировка студента, если рейтинг ниже 20%') setBlockSetting(value === 1);
        if (key === 'Комиссия платформы') {
            setCommissionSetting(value || 20);
            setTempCommission(value || 20);
        }
        if (key === 'Адрес ИИ рекомендаций') {
            setAiUrl(textValue || '');
            setTempAiUrl(textValue || '');
            setHealthStatus('none');
        }
        if (key === 'Адрес сервиса видеосвязи') {
            setVideoUrl(textValue || '');
            setTempVideoUrl(textValue || '');
            setVideoHealthStatus('none');
        }
        if (key === 'Кодекс студента') {
            setStudentCodeUrl(textValue || '');
            setTempStudentCodeUrl(textValue || '');
        }
        
        showToast('Настройка сохранена', '', 'green', 'check');
    } catch (err) {
        showToast('Ошибка', (err as Error).message, 'red', 'cross');
    } finally {
        setLoadingSettings(false);
    }
  };

  const checkVideoHealth = async () => {
    if (!tempVideoUrl.trim()) return;
    setIsVideoHealthChecking(true);
    setVideoHealthStatus('none');
    
    try {
        const { data, error } = await supabase.rpc('check_ai_api_health', {
            p_token: token,
            p_url: tempVideoUrl
        });
        
        if (!error && data) {
            setVideoHealthStatus('ok');
            showToast('Сервис доступен', 'Связь с сервером видеосвязи установлена', 'green', 'check');
        } else {
            setVideoHealthStatus('error');
            showToast('Ошибка связи', 'Не удалось получить ответ от сервера видеосвязи.', 'red', 'alert');
        }
    } catch {
        setVideoHealthStatus('error');
    } finally {
        setIsVideoHealthChecking(false);
    }
  };

  const checkAiHealth = async () => {
      if (!tempAiUrl.trim()) return;
      setIsHealthChecking(true);
      setHealthStatus('none');
      
      try {
          const { data, error } = await supabase.rpc('check_ai_api_health', {
              p_token: token,
              p_url: tempAiUrl
          });
          
          if (!error && data) {
              setHealthStatus('ok');
              showToast('API доступно', 'Связь с сервисом рекомендаций установлена', 'green', 'check');
          } else {
              setHealthStatus('error');
              showToast('Ошибка связи', 'Не удалось получить ответ от API. Проверьте адрес.', 'red', 'alert');
          }
      } catch {
          setHealthStatus('error');
      } finally {
          setIsHealthChecking(false);
      }
  };

  const handleAdd = async () => {
    if (!token || !newSpec.name.trim()) {
      showToast('Внимание', 'Введите название предмета', 'yellow', 'alert');
      return;
    }

    const { error } = await supabase.rpc('add_specialization', {
      p_token: token,
      p_name: newSpec.name,
      p_description: newSpec.description || null,
    });

    if (error) {
      showToast('Ошибка', error.message, 'red', 'cross');
    } else {
      showToast('Успешно', 'Предмет добавлен', 'green', 'check');
      setNewSpec({ name: '', description: '' });
      loadData();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!token) return;

    const { error } = await supabase.rpc('update_specialization', {
      p_token: token,
      p_id: id,
      p_name: editForm.name,
      p_description: editForm.description || null,
    });

    if (error) {
      showToast('Ошибка', error.message, 'red', 'cross');
    } else {
      showToast('Успешно', 'Данные обновлены', 'green', 'check');
      setEditingId(null);
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;

    confirm({
      title: 'Удалить предмет',
      message: 'Вы уверены, что хотите удалить этот предмет?',
      onConfirm: async () => {
        const { error } = await supabase.rpc('delete_specialization', {
          p_token: token,
          p_id: id,
        });

        if (!error) {
          showToast('Успешно', 'Предмет удален', 'green', 'check');
          loadData();
        } else {
          showToast('Ошибка', error.message, 'red', 'cross');
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Форма добавления */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Plus size={20} />
            Добавить предмет
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название предмета *
              </label>
              <input
                type="text"
                value={newSpec.name}
                onChange={(e) => setNewSpec({ ...newSpec, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Например: Математика"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={newSpec.description}
                onChange={(e) => setNewSpec({ ...newSpec, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Описание предмета..."
              />
            </div>
            <button
              onClick={handleAdd}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Добавить предмет
            </button>
          </div>
        </div>

        {/* Список предметов */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BookOpen size={20} />
            Список предметов ({specializations.length})
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {specializations.map((spec) => (
              <div key={spec.id} className="border rounded-lg p-4 hover:bg-gray-50">
                {editingId === spec.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-2 py-1 border rounded"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(spec.id)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{spec.name}</h3>
                      {spec.description && (
                        <p className="text-sm text-gray-600 mt-1">{spec.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(spec.id);
                          setEditForm({ name: spec.name, description: spec.description || '' });
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(spec.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Системные настройки */}
      <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-orange-500">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Settings size={22} className="text-gray-400" />
          Системные настройки и безопасность
        </h2>
        
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-lg text-orange-600 shadow-sm">
                        <ShieldAlert size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900">Автоматическая модерация репетиторов</h4>
                        <p className="text-sm text-gray-600 max-w-md">
                            Если включено, система будет автоматически блокировать аккаунты студентов, чей рекомендательный рейтинг опустится ниже 20% в ходе ежедневного обслуживания.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${blockSetting ? 'text-orange-600' : 'text-gray-400'}`}>
                        {blockSetting ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}
                    </span>
                    <button
                        disabled={loadingSettings}
                        onClick={() => handleUpdateSetting('Блокировка студента, если рейтинг ниже 20%', blockSetting ? 0 : 1)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${blockSetting ? 'bg-orange-600' : 'bg-gray-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${blockSetting ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-lg text-blue-600 shadow-sm">
                        <Settings size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900">Комиссия платформы</h4>
                        <p className="text-sm text-gray-600 max-w-md">
                            Процент от суммы оплаты консультации, который удерживается системой. Остальные средства зачисляются на замороженный счет репетитора.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white border rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={tempCommission}
                            onChange={(e) => setTempCommission(parseInt(e.target.value) || 0)}
                            disabled={loadingSettings}
                            className="w-20 px-4 py-2 border-none text-center font-bold text-lg focus:outline-none disabled:bg-gray-50"
                        />
                        <span className="pr-4 font-bold text-gray-400 select-none">%</span>
                    </div>
                    
                    <button
                        onClick={() => handleUpdateSetting('Комиссия платформы', tempCommission)}
                        disabled={loadingSettings || tempCommission === commissionSetting}
                        className={`px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm
                            ${tempCommission === commissionSetting 
                                ? 'bg-gray-100 text-gray-400 cursor-default' 
                                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                            }`}
                    >
                        {loadingSettings ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Сохранить'
                        )}
                    </button>
                </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-lg text-purple-600 shadow-sm">
                            <ShieldAlert size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900">Сервис рекомендаций по проблеме заказчика</h4>
                            <p className="text-sm text-gray-600 max-w-md">
                                Базовый URL микросервиса для рекомендаций. Система будет добавлять <code>/recommend</code> к этому адресу для получения подбора.
                            </p>
                        </div>
                    </div>
                    {healthStatus !== 'none' && (
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            healthStatus === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {healthStatus === 'ok' ? 'Онлайн' : 'Оффлайн'}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white border rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-purple-500 transition-all">
                        <input
                            type="text"
                            value={tempAiUrl}
                            onChange={(e) => setTempAiUrl(e.target.value)}
                            disabled={loadingSettings}
                            placeholder="http://host.docker.internal:8000/"
                            className="w-full px-4 py-2 border-none font-medium focus:outline-none disabled:bg-gray-50"
                        />
                    </div>
                    
                    <button
                        onClick={checkAiHealth}
                        disabled={loadingSettings || isHealthChecking || !tempAiUrl.trim()}
                        className="px-4 py-2 bg-white border-2 border-purple-200 text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-all disabled:opacity-50"
                    >
                        {isHealthChecking ? 'Проверка...' : 'Проверить связь'}
                    </button>

                    <button
                        onClick={() => handleUpdateSetting('Адрес ИИ рекомендаций', null, tempAiUrl)}
                        disabled={loadingSettings || tempAiUrl === aiUrl}
                        className={`px-8 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm
                            ${tempAiUrl === aiUrl 
                                ? 'bg-gray-100 text-gray-400 cursor-default' 
                                : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
                            }`}
                    >
                        {loadingSettings ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Сохранить'
                        )}
                    </button>
                </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-lg text-blue-600 shadow-sm">
                            <Settings size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900">Сервис видеосвязи</h4>
                            <p className="text-sm text-gray-600 max-w-md">
                                Базовый URL для создания комнат консультаций. Система будет добавлять <code>/ID_консультации</code> к этому адресу.
                            </p>
                        </div>
                    </div>
                    {videoHealthStatus !== 'none' && (
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            videoHealthStatus === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {videoHealthStatus === 'ok' ? 'Онлайн' : 'Оффлайн'}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white border rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                        <input
                            type="text"
                            value={tempVideoUrl}
                            onChange={(e) => setTempVideoUrl(e.target.value)}
                            disabled={loadingSettings}
                            placeholder="https://meet.ogarev-help.ru/"
                            className="w-full px-4 py-2 border-none font-medium focus:outline-none disabled:bg-gray-50"
                        />
                    </div>
                    
                    <button
                        onClick={checkVideoHealth}
                        disabled={loadingSettings || isVideoHealthChecking || !tempVideoUrl.trim()}
                        className="px-4 py-2 bg-white border-2 border-blue-200 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all disabled:opacity-50"
                    >
                        {isVideoHealthChecking ? 'Проверка...' : 'Проверить связь'}
                    </button>

                    <button
                        onClick={() => handleUpdateSetting('Адрес сервиса видеосвязи', null, tempVideoUrl)}
                        disabled={loadingSettings || tempVideoUrl === videoUrl}
                        className={`px-8 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm
                            ${tempVideoUrl === videoUrl 
                                ? 'bg-gray-100 text-gray-400 cursor-default' 
                                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                            }`}
                    >
                        {loadingSettings ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Сохранить'
                        )}
                    </button>
                </div>
            </div>

            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-lg text-green-600 shadow-sm">
                        <BookOpen size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900">Кодекс студента</h4>
                        <p className="text-sm text-gray-600 max-w-md">
                            PDF-файл с правилами платформы, который каждый студент обязан прочитать и принять после успешного прохождения вступительного теста.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white border rounded-xl overflow-hidden shadow-sm flex items-center px-4 py-2">
                        <span className="text-sm text-gray-500 truncate flex-1">
                            {studentCodeUrl ? 'Кодекс загружен' : 'Кодекс не загружен'}
                        </span>
                        {studentCodeUrl && (
                            <a 
                                href={studentCodeUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-2 text-xs text-blue-600 hover:underline font-bold"
                            >
                                Просмотреть
                            </a>
                        )}
                    </div>
                    
                    <label className={`px-6 py-2 rounded-xl font-bold transition-all cursor-pointer shadow-sm
                        ${loadingSettings ? 'bg-gray-100 text-gray-400' : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'}`}
                    >
                        {loadingSettings ? 'Загрузка...' : (studentCodeUrl ? 'Обновить файл' : 'Загрузить PDF')}
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            disabled={loadingSettings}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}