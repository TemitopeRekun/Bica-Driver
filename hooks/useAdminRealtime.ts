import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface UseAdminRealtimeOptions {
  enabled: boolean;
  adminId?: string;
  onRefresh: () => Promise<void>;
}

export const useAdminRealtime = ({ enabled, adminId, onRefresh }: UseAdminRealtimeOptions) => {
  const adminSocketRef = useRef<Socket | null>(null);
  const adminRefreshTimer = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !adminId) {
      adminSocketRef.current?.disconnect();
      adminSocketRef.current = null;
      if (adminRefreshTimer.current) {
        clearTimeout(adminRefreshTimer.current);
        adminRefreshTimer.current = null;
      }
      return;
    }

    const scheduleAdminRefresh = () => {
      if (adminRefreshTimer.current) {
        clearTimeout(adminRefreshTimer.current);
      }

      adminRefreshTimer.current = setTimeout(() => {
        onRefresh().catch((error: any) => {
          console.error('Failed to refresh admin dashboard:', error);
        });
      }, 250);
    };

    adminSocketRef.current = io(`${API_URL}/admin`, {
      transports: ['websocket'],
    });

    adminSocketRef.current.on('connect', () => {
      adminSocketRef.current?.emit('admin:register', { adminId });
    });

    [
      'admin:dashboard:update',
      'admin:driver:pending_approval',
      'admin:user:updated',
      'admin:trip:updated',
      'admin:settings:updated',
      'admin:payment:updated',
    ].forEach((eventName) => {
      adminSocketRef.current?.on(eventName, scheduleAdminRefresh);
    });

    return () => {
      adminSocketRef.current?.disconnect();
      adminSocketRef.current = null;
      if (adminRefreshTimer.current) {
        clearTimeout(adminRefreshTimer.current);
        adminRefreshTimer.current = null;
      }
    };
  }, [enabled, adminId, onRefresh]);
};
