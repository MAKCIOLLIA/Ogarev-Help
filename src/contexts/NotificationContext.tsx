import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type ToastColor = 'green' | 'red' | 'yellow' | 'white';
export type ToastIcon = 'check' | 'alert' | 'cross' | 'info' | 'clock' | 'user';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  color: ToastColor;
  icon: ToastIcon;
  duration: number;
  sound?: boolean;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface NotificationContextType {
  toasts: Toast[];
  showToast: (title: string, message?: string, color?: ToastColor, icon?: ToastIcon, sound?: boolean, duration?: number) => void;
  removeToast: (id: string) => void;
  confirm: (options: ConfirmOptions) => void;
  confirmState: ConfirmOptions | null;
  closeConfirm: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      oscillator.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.error('Failed to play notification sound:', e);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((
    title: string, 
    message?: string, 
    color: ToastColor = 'white', 
    icon: ToastIcon = 'info', 
    sound: boolean = false,
    duration: number = 5
  ) => {
    const id = uuidv4();
    if (sound) {
      playNotificationSound();
    }
    setToasts((prev) => [...prev, { id, title, message, color, icon, duration, sound }]);
  }, [playNotificationSound]);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState(options);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        confirm,
        confirmState,
        closeConfirm,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
