import { useCallback, useEffect, useRef, useState } from 'react';
import { PaymentHistoryRecord, PendingPaymentTrip, SystemSettings, Trip, UserProfile } from '../types';
import { api } from '../services/api.service';
import { mapPaymentHistory, mapPendingPaymentTrip, mapTrip, mapUser } from '../mappers/appMappers';

interface UseAdminDashboardOptions {
  onSettingsLoaded?: (settings: SystemSettings) => void;
}

export const useAdminDashboard = (options: UseAdminDashboardOptions = {}) => {
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminTrips, setAdminTrips] = useState<Trip[]>([]);
  const [adminPendingPayments, setAdminPendingPayments] = useState<PendingPaymentTrip[]>([]);
  const [adminPaymentHistory, setAdminPaymentHistory] = useState<PaymentHistoryRecord[]>([]);
  const [adminDashboardLoading, setAdminDashboardLoading] = useState(false);
  const [adminDashboardError, setAdminDashboardError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const onSettingsLoadedRef = useRef(options.onSettingsLoaded);

  useEffect(() => {
    onSettingsLoadedRef.current = options.onSettingsLoaded;
  }, [options.onSettingsLoaded]);

  const loadAdminDashboard = useCallback(async () => {
    setAdminDashboardLoading(true);
    setAdminDashboardError(null);

    try {
      const [dashboard, pendingPayments, paymentHistory] = await Promise.all([
        api.get<{
          users: any[];
          trips: any[];
          settings: SystemSettings;
        }>('/admin/dashboard'),
        api.get<any[]>('/payments/pending'),
        api.get<any[]>('/payments/history'),
      ]);

      setAdminUsers(dashboard.users.map(mapUser));
      setAdminTrips(dashboard.trips.map(mapTrip));
      setAdminPendingPayments(pendingPayments.map(mapPendingPaymentTrip));
      setAdminPaymentHistory(paymentHistory.map(mapPaymentHistory));
      onSettingsLoadedRef.current?.(dashboard.settings);
      setLastUpdated(new Date());
    } catch (error: any) {
      setAdminDashboardError(error.message || 'Could not load admin dashboard.');
      throw error;
    } finally {
      setAdminDashboardLoading(false);
    }
  }, []);

  return {
    adminUsers,
    adminTrips,
    adminPendingPayments,
    adminPaymentHistory,
    adminDashboardLoading,
    adminDashboardError,
    lastUpdated,
    setAdminDashboardError,
    loadAdminDashboard,
  };
};
