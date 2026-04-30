import { renderHook, act } from '@testing-library/react';
import { useDriverManager } from '../useDriverManager';
import { api } from '@/services/api.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the API service
vi.mock('@/services/api.service', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock Zustand stores if needed
vi.mock('@/stores/rideStore', () => ({
  useRideStore: () => ({
    setRideState: vi.fn(),
    setRideMilestone: vi.fn(),
    resetRide: vi.fn(),
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'driver-123' },
  }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    addToast: vi.fn(),
  }),
}));

describe('useDriverManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent concurrent status updates', async () => {
    const { result } = renderHook(() => useDriverManager());
    
    // Mock patch to take some time
    let resolvePatch: (val: any) => void;
    const patchPromise = new Promise((resolve) => { resolvePatch = resolve; });
    vi.mocked(api.patch).mockReturnValue(patchPromise);

    // Trigger first update
    let firstCall: Promise<any>;
    act(() => {
      firstCall = result.current.updateRideStatus('trip-1', 'ARRIVED');
    });

    // Verify it's in updating state
    expect(result.current.isUpdatingStatus).toBe(true);

    // Trigger second update immediately
    let secondCall: Promise<any>;
    act(() => {
      secondCall = result.current.updateRideStatus('trip-1', 'ARRIVED');
    });

    // Second call should resolve to undefined because it hit the guard
    expect(await secondCall!).toBeUndefined();

    // Resolve first call
    await act(async () => {
      resolvePatch!({ success: true });
      await firstCall!;
    });

    expect(result.current.isUpdatingStatus).toBe(false);
    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it('should update milestone when arriving', async () => {
    const { result } = renderHook(() => useDriverManager());
    vi.mocked(api.patch).mockResolvedValue({ success: true });

    await act(async () => {
      await result.current.updateRideStatus('trip-1', 'ARRIVED');
    });

    expect(api.patch).toHaveBeenCalledWith('/rides/trip-1/status', { status: 'ARRIVED' });
  });
});
