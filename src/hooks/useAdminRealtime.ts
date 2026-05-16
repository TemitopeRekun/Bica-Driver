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
  onDashboardUpdate?: (event: string) => void;
}

export const useAdminRealtime = ({ adminId, onNewDriver, onTripCompleted, onDashboardUpdate }: UseAdminRealtimeOptions) => {
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

    // Listen for rating warnings
    socketRef.current.on('admin:driver:rating_warning', (data: any) => {
      console.log('📡 [AdminWS] Rating Warning:', data);
      sounds.playNotification();
      addToast(`⚠️ Rating Warning (Tier ${data.tier}): ${data.driverName} dropped to ${(data.newRating / 100).toFixed(2)}`, 'warning');
      onDashboardUpdate?.('admin:driver:rating_warning');
    });

    // Listen for rating suspensions
    socketRef.current.on('admin:driver:suspended', (data: any) => {
      console.log('📡 [AdminWS] Driver Suspended:', data);
      sounds.playNotification();
      addToast(`🚫 Driver Suspended (Tier ${data.suspensionTier}): ${data.driverName}`, 'error');
      onDashboardUpdate?.('admin:driver:suspended');
    });

    // General dashboard update signal
    socketRef.current.on('admin:dashboard:update', (data: any) => {
      onDashboardUpdate?.(data.event ?? 'unknown');
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [adminId, onNewDriver, onTripCompleted, onDashboardUpdate, addToast]);

  return {
    socket: socketRef.current,
  };
};
