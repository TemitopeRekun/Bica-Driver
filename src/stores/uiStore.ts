import { create } from 'zustand';
import { ToastItem, ToastVariant } from '@/types/toast';

interface UIState {
  toasts: ToastItem[];
  isGlobalLoading: boolean;
  addToast: (message: string, variant?: ToastVariant, options?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => string;
  removeToast: (id: string) => void;
  setGlobalLoading: (isLoading: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  isGlobalLoading: false,

  addToast: (message, variant = 'info', options = {}) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    set((state) => ({
      toasts: [...state.toasts, { 
        id, 
        message, 
        variant,
        ...options 
      }],
    }));

    // Auto-remove after 4-6 seconds based on variant
    const duration = options.duration || (variant === 'error' ? 6000 : 4000);
    setTimeout(() => {
      get().removeToast(id);
    }, duration + 500); // Buffer for animation

    return id;
  },

  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),

  setGlobalLoading: (isLoading) => set({ isGlobalLoading: isLoading }),
}));
