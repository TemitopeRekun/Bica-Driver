import { create } from 'zustand';
import { SystemSettings } from '@/types';
import { api } from '@/services/api.service';

interface SettingsState {
  settings: SystemSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: SystemSettings) => Promise<void>;
}

const DEFAULT_SETTINGS: SystemSettings = {
  baseFare: 500,
  pricePerKm: 100,
  timeRate: 50,
  commission: 25,
  autoApprove: false,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await api.get<SystemSettings>('/settings', false);
      set({ settings, isLoading: false });
    } catch (e) {
      console.warn('Could not load settings, using defaults');
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings) => {
    await api.patch('/settings', newSettings);
    set({ settings: newSettings });
  },
}));
