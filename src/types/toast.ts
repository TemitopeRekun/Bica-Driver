import { ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  variant: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'variant' | 'message'>>) => string;
    error: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'variant' | 'message'>>) => string;
    warning: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'variant' | 'message'>>) => string;
    info: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'variant' | 'message'>>) => string;
  };
}
