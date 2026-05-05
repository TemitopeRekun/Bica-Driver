import { create } from 'zustand';
import { ToastItem, ToastVariant } from '@/types/toast';

import { SupportContext } from '@/types';

interface UIState {
  toasts: ToastItem[];
  isGlobalLoading: boolean;
  supportOpen: boolean;
  supportContext: SupportContext | null;
  addToast: (message: string, variant?: ToastVariant, options?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => string;
  removeToast: (id: string) => void;
  setGlobalLoading: (isLoading: boolean) => void;
  setSupportOpen: (open: boolean) => void;
  setSupportContext: (ctx: SupportContext | null) => void;
  // Deprecated: migrate to setSupportOpen/setSupportContext
  openSupport: (context?: SupportContext) => void;
  closeSupport: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  isGlobalLoading: false,
  supportOpen: false,
  supportContext: null,

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

  setSupportOpen: (open) => set({ supportOpen: open }),
  
  setSupportContext: (ctx) => set({ supportContext: ctx }),

  openSupport: (context) => set({ 
    supportOpen: true, 
    supportContext: context || null 
  }),

  closeSupport: () => set({ 
    supportOpen: false, 
    supportContext: null 
  }),
}));
