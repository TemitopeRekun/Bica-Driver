import React, { useState, useCallback, ReactNode, useMemo } from 'react';
import { ToastContext } from '../../hooks/useToast';
import { ToastItem, ToastVariant } from '../../types/toast';
import ToastItemComponent from './ToastItem';

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    
    // Simple deduplication: don't add the same message/variant if it's already there
    setToasts((prev) => {
      const isDuplicate = prev.some(
        (t) => t.message === toast.message && t.variant === toast.variant
      );
      if (isDuplicate) return prev;
      return [...prev, { ...toast, id }];
    });

    return id;
  }, []);

  const toastApi = useMemo(() => ({
    success: (message: string, options?: any) => addToast({ ...options, message, variant: 'success' }),
    error: (message: string, options?: any) => addToast({ ...options, message, variant: 'error' }),
    warning: (message: string, options?: any) => addToast({ ...options, message, variant: 'warning' }),
    info: (message: string, options?: any) => addToast({ ...options, message, variant: 'info' }),
  }), [addToast]);

  const contextValue = useMemo(() => ({
    toasts,
    addToast,
    removeToast,
    toast: toastApi,
  }), [toasts, addToast, removeToast, toastApi]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Viewport/Container */}
      <div className="fixed inset-x-0 bottom-0 z-[100] p-4 flex flex-col items-center gap-3 pointer-events-none sm:bottom-4 md:bottom-8">
        <div className="flex flex-col-reverse items-center gap-2 w-full">
          {toasts.map((toast) => (
            <ToastItemComponent
              key={toast.id}
              toast={toast}
              onRemove={removeToast}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};
