import { useNotifications } from '../../contexts/NotificationContext';
import { AlertCircle } from 'lucide-react';

export default function ConfirmModal() {
  const { confirmState, closeConfirm } = useNotifications();

  if (!confirmState) return null;

  const handleConfirm = () => {
    confirmState.onConfirm();
    closeConfirm();
  };

  const handleCancel = () => {
    if (confirmState.onCancel) confirmState.onCancel();
    closeConfirm();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-full">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{confirmState.title}</h2>
          </div>
          <p className="text-gray-600 leading-relaxed">
            {confirmState.message}
          </p>
        </div>
        <div className="bg-gray-50 p-4 flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-colors"
          >
            {confirmState.cancelText || 'Отмена'}
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            {confirmState.confirmText || 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  );
}
