import React, { useCallback, ReactNode, useMemo } from 'react';
import { ToastContext } from '../../hooks/useToast';
import { ToastItem, ToastVariant } from '../../types/toast';
import { useUIStore } from '../../stores/uiStore';
import ToastItemComponent from './ToastItem';

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const { toasts, addToast: storeAddToast, removeToast } = useUIStore();

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    return storeAddToast(toast.message, toast.variant, {
      title: toast.title,
      duration: toast.duration,
      action: toast.action
    });
  }, [storeAddToast]);

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
      <div className="fixed inset-x-0 bottom-0 z-[100] p-4 pb-8 flex flex-col items-center gap-3 pointer-events-none sm:bottom-4 md:bottom-8">
        <div className="flex flex-col-reverse items-center gap-2 w-full max-w-md mx-auto">
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
