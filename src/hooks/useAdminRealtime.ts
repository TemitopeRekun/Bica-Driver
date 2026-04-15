import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Config } from '@/services/Config';
import { sounds } from '@/services/SoundService';
import { useUIStore } from '@/stores/uiStore';

const API_URL = Config.apiUrl;

interface UseAdminRealtimeOptions {
  adminId?: string;
  onNewDriver?: (data: any) => void;
  onTripCompleted?: (data: any) => void;
}

export const useAdminRealtime = ({ adminId, onNewDriver, onTripCompleted }: UseAdminRealtimeOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const { addToast } = useUIStore();

  useEffect(() => {
    if (!adminId || !API_URL) return;

    // Connect to the admin namespace
    socketRef.current = io(`${API_URL}/admin`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current.on('connect', () => {
      console.log('📡 [AdminWS] Connected to monitoring cluster');
      socketRef.current?.emit('admin:register', { adminId });
    });

    // Listen for new driver registrations
    socketRef.current.on('admin:new-driver', (data: any) => {
      console.log('📡 [AdminWS] New driver registered:', data);
      sounds.playNotification();
      addToast(`New chauffeur registered: ${data.name || 'Anonymous'}`, 'info');
      onNewDriver?.(data);
    });

    // Listen for system-wide trip completions (to update stats)
    socketRef.current.on('admin:trip-completed', (data: any) => {
      onTripCompleted?.(data);
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [adminId, onNewDriver, onTripCompleted, addToast]);

  return {
    socket: socketRef.current,
  };
};
