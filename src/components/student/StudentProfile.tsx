import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Upload, Video, X, Camera, Trash2, Award, Plus, Eye, Star } from 'lucide-react';
import Avatar from '../shared/Avatar';
import { getErrorMessage } from '../../lib/utils';
import TestingInterface from '../shared/TestingInterface';

const MAX_VIDEO_SIZE_MB = 20;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

interface Specialization {
  id: string;
  name: string;
}

interface SelectedSpec {
  id: string;
  specialization_id: string;
  name: string;
}

interface Achievement {
  id: string;
  file_path: string;
  title: string;
  description: string;
}

interface Review {
    id: string;
    rating: number;
    rating_comment?: string | null;
    date: string;
    child_name: string;
    specialization_name: string;
}

interface StudentProfileData {
  grade_average: number;
  bio: string;
  video_greeting: string | null;
  average_rating: number;
  total_ratings: number;
  specializations: SelectedSpec[];
  profile_photo_path: string | null;
  grade_book_archive_path: string | null;
  full_name?: string;
  recommendation_rating: number;
  skills: string | null;
  anti_skills: string | null;
}

export default function StudentProfile() {
  const { user, token, updateUser } = useAuth();
  const { showToast, confirm } = useNotifications();

  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');

  const [skills, setSkills] = useState<string[]>([]);
  const [antiSkills, setAntiSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [newAntiSkill, setNewAntiSkill] = useState('');
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const [saving, setSaving] = useState(false);

  const [allSpecs, setAllSpecs] = useState<Specialization[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<SelectedSpec[]>([]);
  const [specsWithTests, setSpecsWithTests] = useState<Set<string>>(new Set());
  const [passedSpecs, setPassedSpecs] = useState<Set<string>>(new Set());
  const [testToStart, setTestToStart] = useState<string | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [showAddAchievement, setShowAddAchievement] = useState(false);
  const [newAchievement, setNewAchievement] = useState({ title: '', description: '', file: null as File | null });

  const loadProfile = useCallback(async () => {
    if (!token) return;
    const { data, error: rpcError } = await supabase.rpc('get_student_profile', { p_token: token });
    if (rpcError) {
      console.error('get_student_profile error:', rpcError);
      showToast('Ошибка загрузки', 'Не удалось загрузить профиль.', 'red', 'cross');
      return;
    }
    if (data && data.length > 0) {
      const p = data[0] as StudentProfileData;
      const specs: SelectedSpec[] = typeof p.specializations === 'string'
          ? JSON.parse(p.specializations)
          : (p.specializations ?? []);

      setProfile({ ...p, specializations: specs });
      setBio(p.bio ?? '');
      setSelectedSpecs(specs);
      setFullName(p.full_name ?? '');

      setSkills(p.skills ? p.skills.split(',').map(s => s.trim()).filter(Boolean) : []);
      setAntiSkills(p.anti_skills ? p.anti_skills.split(',').map(s => s.trim()).filter(Boolean) : []);

      if (p.profile_photo_path) {
        const { data: avatarUrlData } = supabase.storage.from('Documents').getPublicUrl(p.profile_photo_path);
        setAvatarPreview(avatarUrlData.publicUrl);
      } else {
          setAvatarPreview(null);
      }

      if (p.video_greeting) {
        const { data: videoUrlData } = supabase.storage.from('Documents').getPublicUrl(p.video_greeting);
        setVideoPreview(videoUrlData.publicUrl);
      }
    }
  }, [token, showToast]);
  
  const loadAllSpecs = useCallback(async () => {
    if (!token) return;
    const [specRes, specsWithTestsRes, testStatusRes] = await Promise.all([
        supabase.rpc('get_all_specializations', { p_token: token }),
        supabase.rpc('get_specializations_with_tests'),
        supabase.rpc('get_student_test_status', { p_token: token })
    ]);

    if (specRes.data) setAllSpecs(specRes.data as Specialization[]);
    if (specsWithTestsRes.data) {
        setSpecsWithTests(new Set(specsWithTestsRes.data.map((s: any) => s.specialization_id)));
    }
    if (testStatusRes.data?.subject_tests) {
        const passed = testStatusRes.data.subject_tests
            .filter((t: any) => t.status === 'passed')
            .map((t: any) => t.id);
        setPassedSpecs(new Set(passed));
    }
  }, [token]);

  const loadAchievements = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc('manage_student_achievement', { p_token: token, p_action: 'list' });
    if (!error) setAchievements((data as Achievement[]) || []);
  }, [token]);

  const loadReviews = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc('get_my_reviews', { p_token: token });
    if (!error) setReviews((data as Review[]) || []);
  }, [token]);

  useEffect(() => {
    if (token) {
      loadProfile();
      loadAllSpecs();
      loadAchievements();
      loadReviews();
    }
  }, [token, loadProfile, loadAllSpecs, loadAchievements, loadReviews]);
  
  useEffect(() => {
    if (user) {
        setFullName(user.full_name ?? '');
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 512;
            const MAX_HEIGHT = 512;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            setAvatarPreview(canvas.toDataURL('image/png'));
            canvas.toBlob((blob) => {
                if (blob) setAvatarFile(new File([blob], 'avatar.png', { type: 'image/png' }));
            }, 'image/png');
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAvatar = async () => {
    if (!token) return;
    
    confirm({
      title: 'Удаление фото',
      message: 'Вы уверены, что хотите удалить фото профиля?',
      onConfirm: async () => {
        setSaving(true);
        try {
          const { error: deleteError } = await supabase.rpc('delete_avatar', { p_token: token });
          if (deleteError) throw deleteError;
          updateUser({ profile_photo_path: null });
          setAvatarPreview(null);
          setAvatarFile(null);
          showToast('Фото удалено', '', 'green', 'check');
        } catch(err: unknown) { 
          showToast('Ошибка', err instanceof Error ? err.message : String(err), 'red', 'cross'); 
        } finally { 
          setSaving(false); 
        }
      }
    });
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_SIZE_BYTES) { 
      showToast('Файл слишком большой', `Максимальный размер видео — ${MAX_VIDEO_SIZE_MB} МБ`, 'red', 'cross'); 
      return; 
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!token || !user) return;
    setSaving(true);
    try {
      let videoGreetingPath: string | undefined = profile?.video_greeting ?? undefined;
      
      // Определяем новые специализации, требующие теста
      const currentSpecIds = new Set(profile?.specializations?.map(s => s.specialization_id) || []);
      const selectedSpecIds = selectedSpecs.map(s => s.specialization_id);
      
      // Требуют теста: ID в списке specsWithTests AND НЕ в списке passedSpecs
      const newlySelectedWithTests = selectedSpecIds.filter(id => 
        !currentSpecIds.has(id) && // Новый для профиля
        specsWithTests.has(id) &&  // У него есть тест
        !passedSpecs.has(id)       // Студент его НЕ проходил успешно раньше
      );
      
      // Сохраняем только те, что НЕ требуют теста ИЛИ уже были пройдены
      const specsToSaveDirectly = selectedSpecIds.filter(id => 
        !specsWithTests.has(id) || // Теста нет
        currentSpecIds.has(id) ||  // Уже в профиле
        passedSpecs.has(id)        // Был успешно пройден раньше
      );

      if (avatarFile) {
        const fileName = `avatars/${user.id}/${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from('Documents').upload(fileName, avatarFile, { upsert: true });
        if (uploadError) throw new Error('Ошибка загрузки фото.');
        await supabase.rpc('update_user_photo', { p_token: token, p_photo_path: fileName });
        updateUser({ profile_photo_path: fileName });
      }
      if (videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const fileName = `videos/${user.id}/intro-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('Documents').upload(fileName, videoFile, { upsert: true });
        if (uploadError) throw new Error('Ошибка загрузки видео.');
        videoGreetingPath = fileName;
      }
      const { error: saveError } = await supabase.rpc('save_student_profile', {
        p_token: token,
        p_full_name: fullName,
        p_bio: bio,
        p_video_greeting: videoGreetingPath,
        p_specialization_ids: specsToSaveDirectly,
        p_skills: skills.join(','),
        p_anti_skills: antiSkills.join(','),
      });
      if (saveError) throw saveError;
      
      updateUser({ full_name: fullName });
      await loadProfile();

      if (newlySelectedWithTests.length > 0) {
        const names = newlySelectedWithTests.map(id => allSpecs.find(s => s.id === id)?.name).join(', ');
        confirm({
          title: 'Требуется тестирование',
          message: `Для добавления предметов: "${names}" необходимо пройти тестирование. Начать сейчас?`,
          onConfirm: async () => {
            const { data: testStatusData } = await supabase.rpc('get_student_test_status', { p_token: token });
            // Находим первый тест из списка newlySelectedWithTests
            // В testStatusData.subject_tests поле называется 'id' (специализация) и 'test_id'
            const test = testStatusData?.subject_tests?.find((t: any) => newlySelectedWithTests.includes(t.id));
            if (test) {
              setTestToStart(test.test_id);
            } else {
              showToast('Внимание', 'Тест для этой дисциплины еще не настроен администратором', 'yellow', 'alert');
            }
          }
        });
      } else {
        showToast('Успешно', 'Изменения сохранены!', 'green', 'check');
      }
    } catch (err: unknown) { 
      showToast('Ошибка сохранения', getErrorMessage(err), 'red', 'cross'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleAddAchievement = async () => {
    if (!token || !user || !newAchievement.file || !newAchievement.title) return;
    setSaving(true);
    try {
        const fileExt = newAchievement.file.name.split('.').pop();
        const fileName = `achievements/${user.id}/${Date.now()}.${fileExt}`;
        await supabase.storage.from('Documents').upload(fileName, newAchievement.file);
        await supabase.rpc('manage_student_achievement', {
            p_token: token,
            p_action: 'add',
            p_file_path: fileName,
            p_title: newAchievement.title,
            p_description: newAchievement.description
        });
        setShowAddAchievement(false);
        setNewAchievement({ title: '', description: '', file: null });
        loadAchievements();
        showToast('Достижение добавлено', '', 'green', 'check');
    } catch (err: unknown) { 
      showToast('Ошибка', err instanceof Error ? err.message : String(err), 'red', 'cross'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleDeleteAchievement = async (id: string, path: string) => {
    confirm({
      title: 'Удаление достижения',
      message: 'Вы уверены, что хотите удалить это достижение?',
      onConfirm: async () => {
        try {
          await supabase.storage.from('Documents').remove([path]);
          await supabase.rpc('manage_student_achievement', { p_token: token, p_action: 'delete', p_id: id });
          loadAchievements();
          showToast('Достижение удалено', '', 'green', 'check');
        } catch (err: unknown) {
          showToast('Ошибка при удалении', getErrorMessage(err), 'red', 'cross');
        }
      }
    });
  };

  const availableSpecs = allSpecs.filter(s => !selectedSpecs.find(sel => sel.specialization_id === s.id));
  const handleAddSpec = (specId: string) => {
    const spec = allSpecs.find(s => s.id === specId);
    if (spec) setSelectedSpecs(prev => [...prev, { id: crypto.randomUUID(), specialization_id: spec.id, name: spec.name }]);
  };
  const handleRemoveSpec = (specId: string) => setSelectedSpecs(prev => prev.filter(s => s.specialization_id !== specId));

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Мой профиль</h1>
        <button 
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-blue-100 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-bold"
        >
            <Eye size={20} /> Предпросмотр (как видят родители)
        </button>
      </div>
      
      <div className="space-y-6">
        {/* Основная инфа */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start gap-6 pb-6 border-b">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <Avatar imageUrl={avatarPreview} name={fullName} size={96}/>
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    <Camera className="text-white" size={28}/>
                </div>
              </div>
              <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*"/>
               {avatarPreview && (
                  <button onClick={handleDeleteAvatar} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600" title="Удалить фото">
                      <Trash2 size={14} />
                  </button>
              )}
            </div>

            <div className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ФИО</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                  <input type="text" value={user?.email || ''} disabled className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500 text-2xl font-black">★ {profile?.average_rating?.toFixed(1) ?? '0.0'}</span>
                  <span className="text-gray-400 text-sm">({profile?.total_ratings ?? 0} оценок)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 text-2xl font-black">{profile?.grade_average?.toFixed(2) ?? '0.00'}</span>
                  <span className="text-gray-400 text-sm">средний балл</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-2xl font-black">{profile?.recommendation_rating ?? 50}%</span>
                    <span className="text-gray-400 text-sm">рейтинг</span>
                  </div>
                  <span className="text-[10px] text-gray-400 leading-none">виден только вам</span>
                </div>
              </div>
            </div>
          </div>

          <div className="py-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Предметы и специализация</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedSpecs.map(spec => (
                <div key={spec.specialization_id} className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                  <span className="font-bold text-blue-700 text-sm">{spec.name}</span>
                  <button onClick={() => handleRemoveSpec(spec.specialization_id)} className="text-blue-300 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
            <select value="" onChange={(e) => { if (e.target.value) { handleAddSpec(e.target.value); e.target.value = ''; } }} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Добавить предмет...</option>
              {availableSpecs.map(spec => <option key={spec.id} value={spec.id}>{spec.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b mb-6">
            <div>
              <label className="block text-lg font-bold text-gray-900 mb-2 text-green-600">Мои сильные стороны (Теги)</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {skills.map((s, i) => (
                  <span key={i} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    {s}
                    <button onClick={() => setSkills(skills.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X size={14} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newSkill} 
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newSkill.trim()) { setSkills([...skills, newSkill.trim()]); setNewSkill(''); } } }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" 
                  placeholder="Напр. Python, Асинхронность..." 
                />
                <button 
                  onClick={() => { if (newSkill.trim()) { setSkills([...skills, newSkill.trim()]); setNewSkill(''); } }}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-bold"
                >
                  <Plus size={20} />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Нажмите Enter или +, чтобы добавить</p>
            </div>

            <div>
              <label className="block text-lg font-bold text-gray-900 mb-2 text-red-600">Что я не люблю/не умею (Антитеги)</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {antiSkills.map((s, i) => (
                  <span key={i} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    {s}
                    <button onClick={() => setAntiSkills(antiSkills.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X size={14} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newAntiSkill} 
                  onChange={(e) => setNewAntiSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newAntiSkill.trim()) { setAntiSkills([...antiSkills, newAntiSkill.trim()]); setNewAntiSkill(''); } } }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500" 
                  placeholder="Напр. Математика, Frontend..." 
                />
                <button 
                  onClick={() => { if (newAntiSkill.trim()) { setAntiSkills([...antiSkills, newAntiSkill.trim()]); setNewAntiSkill(''); } }}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-bold"
                >
                  <Plus size={20} />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Нажмите Enter или +, чтобы добавить</p>
            </div>
          </div>

          <div className="pb-6 border-b mb-6">
            <label className="block text-lg font-bold text-gray-900 mb-2 text-blue-600 flex items-center gap-2">
                <Video size={20} /> Видео-приветствие
            </label>
            {videoPreview && (
              <div className="mb-4 rounded-xl overflow-hidden shadow-lg border-4 border-white max-w-md">
                  <video src={videoPreview} controls className="w-full"></video>
              </div>
            )}
            <label className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl cursor-pointer hover:bg-gray-200 transition-colors w-fit font-bold">
              <Upload size={20} />
              <span>{videoFile ? 'Выбрано новое видео' : (videoPreview ? 'Загрузить другое' : 'Загрузить приветствие')}</span>
              <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-900 mb-2">О себе</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Расскажите о своём опыте..." />
          </div>

        </div>

        {/* Достижения */}
        <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Award size={24} className="text-yellow-500" /> Достижения и сертификаты
                </h3>
                <button 
                    onClick={() => setShowAddAchievement(true)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-sm"
                >
                    <Plus size={18} /> Добавить
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievements.map(a => (
                    <div key={a.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex gap-4 group">
                        <div className="w-16 h-16 bg-white rounded-lg border flex items-center justify-center text-blue-600 flex-shrink-0 overflow-hidden">
                            <img src={supabase.storage.from('Documents').getPublicUrl(a.file_path).data.publicUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <h4 className="font-bold text-gray-900 truncate">{a.title}</h4>
                            <p className="text-xs text-gray-500 line-clamp-2">{a.description}</p>
                        </div>
                        <button onClick={() => handleDeleteAchievement(a.id, a.file_path)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
            </div>

            {showAddAchievement && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-6">Новое достижение</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="Заголовок (напр. Диплом олимпиады)" className="w-full px-4 py-2 border rounded-lg" value={newAchievement.title} onChange={e => setNewAchievement({...newAchievement, title: e.target.value})} />
                            <textarea placeholder="Описание..." className="w-full px-4 py-2 border rounded-lg" rows={3} value={newAchievement.description} onChange={e => setNewAchievement({...newAchievement, description: e.target.value})} />
                            <input type="file" accept="image/*" onChange={e => setNewAchievement({...newAchievement, file: e.target.files?.[0] || null})} />
                            <div className="flex gap-4 pt-4">
                                <button onClick={handleAddAchievement} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">Добавить</button>
                                <button onClick={() => setShowAddAchievement(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold">Отмена</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Отзывы */}
        <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Star size={24} className="text-yellow-500" /> Последние отзывы
            </h3>
            <div className="space-y-4">
                {reviews.length > 0 ? reviews.slice(0, 5).map(r => (
                    <div key={r.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="font-bold text-gray-900">{r.child_name}</p>
                                <p className="text-xs text-gray-500">{r.specialization_name} • {new Date(r.date).toLocaleDateString('ru-RU')}</p>
                            </div>
                            <div className="flex text-yellow-500">
                                {[...Array(r.rating)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                            </div>
                        </div>
                        {r.rating_comment && (
                            <p className="text-sm text-gray-600 italic bg-white p-3 rounded-lg border border-gray-100 mt-2">
                                "{r.rating_comment}"
                            </p>
                        )}
                    </div>
                )) : (
                    <p className="text-center text-gray-500 py-8">У вас пока нет отзывов.</p>
                )}
            </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 transition-all font-black text-lg shadow-xl shadow-blue-200 disabled:bg-gray-400">
          {saving ? 'Сохранение...' : 'СОХРАНИТЬ ВСЕ ИЗМЕНЕНИЯ'}
        </button>
      </div>

      {/* Модалка предпросмотра */}
      {showPreview && (
          <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col duration-200">
                <div className="relative h-32 bg-blue-600">
                    <button onClick={() => setShowPreview(false)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"><X size={24} /></button>
                    <div className="absolute -bottom-12 left-8">
                        <Avatar imageUrl={avatarPreview} name={fullName} size={96} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto pt-16 px-8 pb-8">
                    <div className="mb-6">
                        <h2 className="text-3xl font-black text-gray-900">{fullName}</h2>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1 text-yellow-500 font-bold"><Star size={20} fill="currentColor" /><span>{profile?.average_rating.toFixed(1)}</span></div>
                            <div className="flex items-center gap-1 text-blue-600 font-bold"><Award size={20} /><span>{profile?.grade_average.toFixed(2)}</span></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            {skills.length > 0 && (
                                <section>
                                    <h3 className="text-sm font-bold text-green-600 uppercase mb-2">Сильные стороны</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map((s, i) => <span key={i} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold">{s}</span>)}
                                    </div>
                                </section>
                            )}
                            {antiSkills.length > 0 && (
                                <section>
                                    <h3 className="text-sm font-bold text-red-600 uppercase mb-2">Не любит / Не умеет</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {antiSkills.map((s, i) => <span key={i} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold">{s}</span>)}
                                    </div>
                                </section>
                            )}
                            {videoPreview && (
                                <section>
                                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Video size={20} className="text-blue-600" /> Видео-приветствие</h3>
                                    <div className="max-w-md">
                                        <video src={videoPreview} controls className="w-full rounded-xl shadow-md" />
                                    </div>
                                </section>
                            )}
                            <section>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">О себе</h3>
                                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{bio || 'Нет описания'}</p>
                            </section>
                            <section>
                                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Plus size={20} className="text-blue-600" /> Специализация</h3>
                                <div className="flex flex-wrap gap-2">{selectedSpecs.map(s => <span key={s.id} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">{s.name}</span>)}</div>
                            </section>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Достижения</h3>
                            <div className="space-y-3">
                                {achievements.map(a => (
                                    <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <img src={supabase.storage.from('Documents').getPublicUrl(a.file_path).data.publicUrl} className="w-12 h-12 object-cover rounded-lg" />
                                        <div><p className="font-bold text-gray-900 text-sm">{a.title}</p></div>
                                    </div>
                                ))}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mt-8 mb-4">Отзывы</h3>
                            <div className="space-y-3">
                                {reviews.slice(0, 3).map(r => (
                                    <div key={r.id} className="p-3 border rounded-xl text-sm">
                                        <div className="flex justify-between font-bold mb-1">
                                            <span>{r.child_name}</span>
                                            <span className="text-yellow-500">★ {r.rating}</span>
                                        </div>
                                        <p className="text-gray-400 text-xs mb-2">{r.specialization_name}</p>
                                        {r.rating_comment && (
                                            <p className="text-gray-600 italic leading-relaxed">
                                                "{r.rating_comment}"
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>
      )}

      {testToStart && (
        <TestingInterface 
            testId={testToStart} 
            onComplete={() => {
                setTestToStart(null);
                loadProfile();
                showToast('Успешно', 'Тестирование завершено', 'green', 'check');
            }}
            onCancel={() => setTestToStart(null)}
        />
      )}
    </div>
  );
}
