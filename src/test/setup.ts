import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Run cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mocking Capacitor and other globals if needed
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
  CameraResultType: { Base64: 'base64', Uri: 'uri' },
  CameraSource: { Camera: 'camera', Photos: 'photos', Prompt: 'prompt' },
  CameraDirection: { Front: 'front', Rear: 'rear' },
}));
