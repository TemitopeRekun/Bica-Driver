import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface UIState {
  toasts: Toast[];
  isGlobalLoading: boolean;
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  setGlobalLoading: (isLoading: boolean) => void;
  playNotificationSound: () => void;
}

// Low-latency base64 notification chime (short premium "ping")
const NOTIFICATION_CHIME = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPA...'; // Placeholder, will replace with a real short one or use HTML5 Audio if asset is missing

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  isGlobalLoading: false,

  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    // Auto-play sound for toasts as requested
    get().playNotificationSound();

    // Auto-remove after 4 seconds
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),

  setGlobalLoading: (isLoading) => set({ isGlobalLoading: isLoading }),

  playNotificationSound: () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Professional notification sound
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Handle cases where audio play is blocked by browser policy without user gesture
        console.warn('Playback blocked or failed');
      });
    } catch (e) {
      console.error('Sound playback error:', e);
    }
  },
}));
