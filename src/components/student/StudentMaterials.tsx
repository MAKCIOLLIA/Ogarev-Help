import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  FileText, 
  Trash2, 
  Plus,
  ExternalLink,
  Search,
  Loader2
} from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';

interface Material {
  id: string;
  file_path: string;
  display_name: string;
  created_at: string;
}

export default function StudentMaterials() {
  const { token, user } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadMaterials = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('manage_student_material', { 
        p_token: token,
        p_action: 'list'
    });
    if (error) {
      console.error('loadMaterials error:', error);
    } else {
      setMaterials((data as Material[]) || []);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadMaterials();
  }, [token, loadMaterials]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `student_materials/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('Documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: rpcError } = await supabase.rpc('manage_student_material', {
        p_token: token,
        p_action: 'add',
        p_file_path: fileName,
        p_display_name: file.name
      });

      if (rpcError) throw rpcError;

      loadMaterials();
      showToast('Файл загружен', undefined, 'green', 'check');
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Ошибка загрузки', getErrorMessage(err), 'red', 'cross');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!token) return;

    confirm({
      title: 'Удаление материала',
      message: 'Вы уверены, что хотите удалить этот материал?',
      onConfirm: async () => {
        try {
          // 1. Delete from DB first
          const { error } = await supabase.rpc('manage_student_material', {
            p_token: token,
            p_action: 'delete',
            p_material_id: id
          });

          if (error) throw error;

          // 2. Then delete from storage
          await supabase.storage.from('Documents').remove([filePath]);

          loadMaterials();
          showToast('Материал удален', undefined, 'green', 'check');
        } catch (err) {
          console.error('Delete error:', err);
          showToast('Ошибка при удалении', getErrorMessage(err), 'red', 'cross');
        }
      }
    });
  };

  const filteredMaterials = materials.filter(m => 
    m.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Мои материалы</h1>
          <p className="text-gray-600 mt-2">Ваша личная библиотека учебных пособий и файлов.</p>
        </div>
        
        <label className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 transition-all font-bold shadow-md w-fit">
          {uploading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
          <span>{uploading ? 'Загрузка...' : 'Загрузить файл'}</span>
          <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Поиск по названию файла..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-blue-500" size={40} />
          </div>
        ) : filteredMaterials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaterials.map((material) => (
              <div key={material.id} className="group border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition-all bg-gray-50 bg-opacity-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600 flex-shrink-0">
                      <FileText size={24} />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-gray-900 truncate" title={material.display_name}>
                        {material.display_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(material.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
                  <a 
                    href={supabase.storage.from('Documents').getPublicUrl(material.file_path).data.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Открыть"
                  >
                    <ExternalLink size={18} />
                  </a>
                  <button 
                    onClick={() => handleDelete(material.id, material.file_path)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'Ничего не найдено' : 'В вашей библиотеке пока нет файлов.'}
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-100">
        <h3 className="font-bold text-blue-900 mb-2">Зачем нужны материалы?</h3>
        <p className="text-blue-800 text-sm leading-relaxed">
          Здесь вы можете хранить свои методички, сборники задач и презентации. 
          В будущем вы сможете быстро прикреплять их к занятиям с учениками прямо из этого списка.
        </p>
      </div>
    </div>
  );
}
