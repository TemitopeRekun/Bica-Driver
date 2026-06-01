import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import localforage from 'localforage';

vi.mock('localforage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    createInstance: vi.fn(() => ({
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })),
  },
}));

vi.mock('@/services/TelemetryService', () => ({
  telemetry: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  useAuthStore.setState({
    currentUser: null,
    isAuthenticated: false,
    isInitializing: true,
  });
});

describe('AuthStore', () => {
  it('starts with no user and not authenticated', () => {
    const state = useAuthStore.getState();
    expect(state.currentUser).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitializing).toBe(true);
  });

  it('setInitializing updates state', () => {
    useAuthStore.getState().setInitializing(false);
    expect(useAuthStore.getState().isInitializing).toBe(false);
  });

  it('setCurrentUser sets user and marks authenticated', () => {
    const user = { id: '1', name: 'Test', email: 'test@test.com', role: 'OWNER' as any, phone: '123', trips: 0, avatar: '' };
    useAuthStore.getState().setCurrentUser(user);
    expect(useAuthStore.getState().currentUser).toEqual(user);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('setCurrentUser(null) clears auth', () => {
    const user = { id: '1', name: 'Test', email: 'test@test.com', role: 'OWNER' as any, phone: '123', trips: 0, avatar: '' };
    useAuthStore.getState().setCurrentUser(user);
    useAuthStore.getState().setCurrentUser(null);
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('updateProfile merges partial updates', () => {
    const user = { id: '1', name: 'Test', email: 'test@test.com', role: 'OWNER' as any, phone: '123', trips: 0, avatar: '' };
    useAuthStore.getState().setCurrentUser(user);
    useAuthStore.getState().updateProfile({ name: 'Updated Name', phone: '999' });
    expect(useAuthStore.getState().currentUser?.name).toBe('Updated Name');
    expect(useAuthStore.getState().currentUser?.email).toBe('test@test.com');
  });
});
