import { create } from 'zustand';
import { PendingRatingTrip } from '@/types';
import { api } from '@/services/api.service';

type RatingGateState = {
  pendingRating: PendingRatingTrip | null;
  isChecking: boolean;
  setPendingRating: (trip: PendingRatingTrip | null) => void;
  setIsChecking: (value: boolean) => void;
  clearPendingRating: () => void;
  checkPendingRating: () => Promise<PendingRatingTrip | null>;
};

export const useRatingGateStore = create<RatingGateState>((set) => ({
  pendingRating: null,
  isChecking: false,
  setPendingRating: (trip) => set({ pendingRating: trip }),
  setIsChecking: (value) => set({ isChecking: value }),
  clearPendingRating: () => set({ pendingRating: null }),
  checkPendingRating: async () => {
    set({ isChecking: true });
    try {
      const pending = await api.getPendingRating();
      set({ pendingRating: pending, isChecking: false });
      return pending;
    } catch (e: any) {
      if (e?.status === 403) {
        set({ isChecking: false });
        return null;
      }
      console.warn('Failed to check pending ratings', e);
      set({ isChecking: false });
      return null;
    }
  },
}));
