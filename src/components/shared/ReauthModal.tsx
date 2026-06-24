import { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';

interface ReauthModalProps {
  title: string;
  description: string;
  onSubmit: (password: string) => Promise<void>;
  onLogout?: () => void;
  onClose?: () => void;
  isLoading?: boolean;
}

export default function ReauthModal({
  title,
  description,
  onSubmit,
  onLogout,
  onClose,
  isLoading
}: ReauthModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(password);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Lock className="text-blue-600" size={24} />
              {title}
            </h3>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            )}
          </div>
          
          <p className="text-gray-600 mb-6">{description}</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите пароль"
                autoFocus
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Проверка...' : 'Подтвердить'}
              </button>
              
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                >
                  Выйти из аккаунта
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
