import React, { useState, useEffect, useRef } from 'react';
import { useNotifications, Toast as ToastType } from '../../contexts/NotificationContext';
import { CheckCircle, AlertTriangle, XCircle, Info, Clock, User, X } from 'lucide-react';

const Toast: React.FC<{ toast: ToastType; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [remainingTime, setRemainingTime] = useState(toast.duration * 1000);
  const lastTick = useRef<number>(Date.now());

  useEffect(() => {
    if (isHovered) return;

    lastTick.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick.current;
      lastTick.current = now;
      
      setRemainingTime((prev) => {
        const next = prev - delta;
        if (next <= 0) {
          clearInterval(timer);
          onRemove(toast.id);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [isHovered, onRemove, toast.id]);

  const icons = {
    check: CheckCircle,
    alert: AlertTriangle,
    cross: XCircle,
    info: Info,
    clock: Clock,
    user: User,
  };

  const themeStyles = {
    green: {
      bg: 'bg-green-50 border-green-300 shadow-green-100',
      icon: 'text-green-500'
    },
    red: {
      bg: 'bg-red-50 border-red-300 shadow-red-100',
      icon: 'text-red-500'
    },
    yellow: {
      bg: 'bg-amber-50 border-amber-300 shadow-amber-100',
      icon: 'text-amber-500'
    },
    white: {
      bg: 'bg-white border-gray-200 shadow-gray-50',
      icon: 'text-blue-500'
    },
  };

  const IconComponent = icons[toast.icon] || Info;
  const theme = themeStyles[toast.color] || themeStyles.white;

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex items-start gap-4 p-4 rounded-xl shadow-2xl border-2 ${theme.bg} min-w-[320px] max-w-md backdrop-blur-md transition-all duration-300 ${isHovered ? 'ring-2 ring-black/5' : ''}`}
    >
      <div className={`flex-shrink-0 mt-0.5 scale-110 ${theme.icon}`}>
        <IconComponent size={24} />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-gray-900 leading-tight text-lg">{toast.title}</h3>
        {toast.message && <p className="text-sm text-gray-700 font-medium mt-1">{toast.message}</p>}
        <div className="mt-2 h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-current opacity-20 transition-all duration-100 ease-linear ${isHovered ? 'opacity-40' : ''}`}
            style={{ width: `${(remainingTime / (toast.duration * 1000)) * 100}%` }}
          />
        </div>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-gray-400 hover:text-gray-900 transition-colors p-1 hover:bg-black/5 rounded-full"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default function ToastContainer() {
  const { toasts, removeToast } = useNotifications();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-4">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
