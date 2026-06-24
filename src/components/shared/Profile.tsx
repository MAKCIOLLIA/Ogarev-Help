import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { updateUserProfile } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Camera, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { getErrorMessage } from '../../lib/utils';

const Profile = () => {
  const { user, token, updateUser } = useAuth();
  const { showToast, confirm } = useNotifications();

  // Original state
  const [originalFullName, setOriginalFullName] = useState(user?.full_name || '');
  const [originalAbout, setOriginalAbout] = useState(user?.bio || '');
  const [originalAvatar, setOriginalAvatar] = useState<string | null>(null);

  // Editable state
  const [fullName, setFullName] = useState('');
  const [about, setAbout] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      const initialName = user.full_name || '';
      const initialBio = user.bio || '';
      
      setOriginalFullName(initialName);
      setFullName(initialName);
      
      setOriginalAbout(initialBio);
      setAbout(initialBio);

      if (user.profile_photo_path) {
        const { data } = supabase.storage.from('Documents').getPublicUrl(user.profile_photo_path);                                                                                     
        setOriginalAvatar(data.publicUrl);                                                                                                                                             
        setAvatarPreview(data.publicUrl);
      } else {
        setOriginalAvatar(null);
        setAvatarPreview(null);
      }
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            setAvatarPreview(canvas.toDataURL('image/png'));

            canvas.toBlob((blob) => {
                if (blob) {
                    const newFile = new File([blob], 'avatar.png', { type: 'image/png' });
                    setNewAvatarFile(newFile);
                }
            }, 'image/png');
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  
  const handleCancelAvatarChange = () => {
      setNewAvatarFile(null);
      setAvatarPreview(originalAvatar);
      if(fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleSaveAvatar = async () => {
    if (!token || !user || !newAvatarFile) {
      showToast('Внимание', 'Нет файла для загрузки или вы не авторизованы.', 'yellow', 'alert');
      return;
    }
    setUploading(true);

    try {
      // Path construction based on gemini.md
      const fileName = `avatars/${user.id}/${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
         .from('Documents')
         .upload(fileName, newAvatarFile, {
           cacheControl: '3600', 
           upsert: true,
         });

      if (uploadError) throw uploadError;

      const { error: updatePathError } = await supabase.rpc('update_user_photo', {
        p_token: token,
        p_photo_path: fileName
      });

      if (updatePathError) throw new Error('Не удалось обновить путь к фотографии в профиле.');
      const { data } = supabase.storage.from('Documents').getPublicUrl(fileName);
      updateUser({ profile_photo_path: fileName });
      setOriginalAvatar(data.publicUrl);
      setAvatarPreview(data.publicUrl);
      setNewAvatarFile(null);
      if(fileInputRef.current) fileInputRef.current.value = '';

      showToast('Успешно', 'Фотография профиля обновлена.', 'green', 'check');

    } catch (err) {
      showToast('Ошибка', getErrorMessage(err), 'red', 'cross');
      setAvatarPreview(originalAvatar);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!token) {
        showToast('Внимание', 'Вы не авторизованы.', 'yellow', 'alert');
        return;
    }
    
    confirm({
      title: 'Удалить фото',
      message: 'Вы уверены, что хотите удалить фото профиля?',
      onConfirm: async () => {
        try {
            const { error: deleteError } = await supabase.rpc('delete_avatar', { p_token: token });
            if (deleteError) throw deleteError;

            updateUser({ profile_photo_path: null });
            setAvatarPreview(null);
            setOriginalAvatar(null);
            setNewAvatarFile(null);
            if(fileInputRef.current) fileInputRef.current.value = '';
            showToast('Успешно', 'Фотография профиля удалена.', 'green', 'check');
        } catch (err) {
            showToast('Ошибка', getErrorMessage(err), 'red', 'cross');
        }
      }
    });
  }

  const handleEdit = () => {
      setIsEditing(true);
      setFullName(originalFullName);
      setAbout(originalAbout);
  }

  const handleCancelEdit = () => {
      setIsEditing(false);
      setFullName(originalFullName);
      setAbout(originalAbout);
  }

  const handleSaveProfile = async () => {
    if (!token) {
      showToast('Внимание', 'Вы не авторизованы.', 'yellow', 'alert');
      return;
    }
    setSaving(true);

    try {
      const updatedUserData = await updateUserProfile(token, fullName, about);
      updateUser(updatedUserData);
      setOriginalAbout(updatedUserData.bio || '');
      showToast('Успешно', 'Профиль успешно обновлен.', 'green', 'check');
      setIsEditing(false);
    } catch (err) {
      showToast('Ошибка', getErrorMessage(err), 'red', 'cross');
      // Revert changes on error
      setFullName(originalFullName);
      setAbout(originalAbout);
    } finally {
        setSaving(false);
    }
  };
  
  const isProfileChanged = fullName !== originalFullName || about !== originalAbout;

  if (!user) {
    return <div>Загрузка данных пользователя...</div>;
  }

  const displayedEmail = user.role === 'child' && user.email.includes('.child.')
    ? user.email.split('.child.')[0]
    : user.email;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Профиль</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex items-center space-x-6 mb-6">
          <div className="relative group">
            <div
              className="w-24 h-24 rounded-full cursor-pointer"
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <Avatar imageUrl={avatarPreview} name={originalFullName} size={96} />
               {!newAvatarFile && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    <Camera className="text-white" size={32} />
                </div>
               )}
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/png, image/jpeg"
              disabled={uploading}
            />

            {uploading && <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center rounded-full"><div className="loader"></div></div>}

            {originalAvatar && !newAvatarFile && (
                <button
                onClick={handleDeleteAvatar}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Удалить фото"
                >
                <Trash2 size={16} />
                </button>
            )}
          </div>
          
          <div className='flex-1'>
            {newAvatarFile ? (
                <div className='space-y-2'>
                    <p className='text-sm text-gray-700'>Выбрано новое фото. Сохранить?</p>
                    <div className='flex items-center space-x-2'>
                        <button
                            onClick={handleSaveAvatar}
                            disabled={uploading}
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm disabled:bg-gray-400"
                        >
                            {uploading ? 'Сохр...' : 'Сохранить'}
                        </button>
                        <button
                            onClick={handleCancelAvatarChange}
                            disabled={uploading}
                            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            ) : (
                <div>
                    <h2 className="text-xl font-semibold">{originalFullName}</h2>
                    <p className="text-gray-600">{displayedEmail}</p>
                    <p className="text-gray-500 capitalize">{user.role}</p>
                </div>
            )}
          </div>
        </div>

        {!isEditing ? (
          <div>
            <div className="mb-4">
              <label className="block text-gray-700 font-bold mb-2">О себе:</label>
              <p className="text-gray-800 whitespace-pre-wrap">{originalAbout || 'Нет информации.'}</p>
            </div>
            <button
              onClick={handleEdit}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Редактировать профиль
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <label htmlFor="fullName" className="block text-gray-700 font-bold mb-2">ФИО:</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                disabled={saving}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="about" className="block text-gray-700 font-bold mb-2">О себе:</label>
              <textarea
                id="about"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32"
                disabled={saving}
              />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSaveProfile}
                disabled={!isProfileChanged || saving}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
