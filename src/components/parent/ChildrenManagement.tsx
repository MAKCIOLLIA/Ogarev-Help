import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { UserPlus, Edit, Trash2, Eye } from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';

interface ChildData {
  id: string;
  child_user_id: string;
  full_name: string;
  age: number;
  grade: number;
  password: string;
}

export default function ChildrenManagement() {
  const { user, token, switchToChild } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildData | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    grade: '',
    password: '',
  });

  const loadChildren = useCallback(async () => {
    if (!token) return;

    const { data, error } = await supabase.rpc('get_children', { p_token: token });
    if (error) {
      console.error('get_children error:', error);
      return;
    }
    if (data) setChildren(data as ChildData[]);
  }, [token]);

  useEffect(() => {
    if (token) loadChildren();
  }, [token, loadChildren]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      if (editingChild) {
        const { error } = await supabase.rpc('update_child', {
          p_token: token,
          p_child_id: editingChild.id,
          p_full_name: formData.full_name,
          p_age: parseInt(formData.age),
          p_grade: parseInt(formData.grade),
          p_password: formData.password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('create_child', {
          p_token: token,
          p_full_name: formData.full_name,
          p_age: parseInt(formData.age),
          p_grade: parseInt(formData.grade),
          p_password: formData.password,
        });
        if (error) throw error;
      }

      setShowAddForm(false);
      setEditingChild(null);
      setFormData({ full_name: '', age: '', grade: '', password: '' });
      await loadChildren();
      showToast('Успешно', editingChild ? 'Профиль обновлен' : 'Ребёнок добавлен', 'green', 'check');
    } catch (error) {
      console.error('Ошибка:', error);
      showToast('Ошибка', getErrorMessage(error), 'red', 'cross');
    }
  };

  const handleDelete = async (childId: string) => {
    if (!token) return;

    confirm({
      title: 'Удаление профиля',
      message: 'Вы уверены, что хотите удалить профиль ребёнка?',
      onConfirm: async () => {
        const { error } = await supabase.rpc('delete_child', {
          p_token: token,
          p_child_id: childId,
        });

        if (error) {
          console.error('delete_child error:', error);
          showToast('Ошибка', 'Произошла ошибка при удалении', 'red', 'cross');
          return;
        }

        await loadChildren();
        showToast('Удалено', 'Профиль ребёнка успешно удален', 'green', 'check');
      }
    });
  };

  const handleEdit = (child: ChildData) => {
    setEditingChild(child);
    setFormData({
      full_name: child.full_name,
      age: child.age.toString(),
      grade: child.grade.toString(),
      password: child.password,
    });
    setShowAddForm(true);
  };

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Мои дети</h1>
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingChild(null);
            setFormData({ full_name: '', age: '', grade: '', password: '' });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={20} />
          Добавить ребёнка
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {editingChild ? 'Редактировать профиль' : 'Добавить ребёнка'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Возраст</label>
                <input
                  type="number"
                  min="1"
                  max="18"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Класс</label>
                <input
                  type="number"
                  min="1"
                  max="11"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль для входа</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={4}
              />
              <p className="text-xs text-blue-600 font-medium mt-1">
                Используйте почту {user?.email} и этот пароль для входа ребёнка
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingChild ? 'Сохранить' : 'Добавить'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingChild(null);
                  setFormData({ full_name: '', age: '', grade: '', password: '' });
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {children.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
            Нет добавленных детей
          </div>
        ) : (
          children.map((child) => (
            <div key={child.id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{child.full_name}</h3>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <span>Возраст: {child.age}</span>
                    <span>Класс: {child.grade}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    Пароль: {child.password}
                  </div>
                  <div className="mt-2 text-xs text-blue-600 font-medium">
                    Используйте почту {user?.email} и этот пароль для входа ребёнка
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => switchToChild(child.child_user_id)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Перейти в профиль"
                  >
                    <Eye size={20} />
                  </button>
                  <button
                    onClick={() => handleEdit(child)}
                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                    title="Редактировать"
                  >
                    <Edit size={20} />
                  </button>
                  <button
                    onClick={() => handleDelete(child.id)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}