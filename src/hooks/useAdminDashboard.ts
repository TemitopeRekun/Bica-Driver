import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminDashboardStats, PaymentHistoryRecord, PendingPaymentTrip, SystemSettings, Trip, UserProfile } from '@/types';
import { api, PaginatedResponse, PaginationMeta } from '@/services/api.service';
import { mapPaymentHistory, mapPendingPaymentTrip, mapTrip, mapUser } from '@/mappers/appMappers';

interface UseAdminDashboardOptions {
  onSettingsLoaded?: (settings: SystemSettings) => void;
}

export const useAdminDashboard = (options: UseAdminDashboardOptions = {}) => {
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [usersMeta, setUsersMeta] = useState<PaginationMeta | null>(null);
  
  const [adminTrips, setAdminTrips] = useState<Trip[]>([]);
  const [tripsMeta, setTripsMeta] = useState<PaginationMeta | null>(null);

  const [adminPendingDrivers, setAdminPendingDrivers] = useState<UserProfile[]>([]);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);

  const [adminPendingPayments, setAdminPendingPayments] = useState<PendingPaymentTrip[]>([]);
  const [pendingPaymentsMeta, setPendingPaymentsMeta] = useState<PaginationMeta | null>(null);

  const [adminPaymentHistory, setAdminPaymentHistory] = useState<PaymentHistoryRecord[]>([]);
  const [paymentHistoryMeta, setPaymentHistoryMeta] = useState<PaginationMeta | null>(null);

  const [adminSettings, setAdminSettings] = useState<SystemSettings | null>(null);
  const [adminDashboardLoading, setAdminDashboardLoading] = useState(false);
  const [adminDashboardError, setAdminDashboardError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const onSettingsLoadedRef = useRef(options.onSettingsLoaded);

  useEffect(() => {
    onSettingsLoadedRef.current = options.onSettingsLoaded;
  }, [options.onSettingsLoaded]);

  const loadUsersPage = useCallback(async (page: number, limit: number = 20) => {
    try {
      const response = await api.get<PaginatedResponse<any>>(`/admin/users?page=${page}&limit=${limit}`);
      setAdminUsers(response.items.map(mapUser));
      setUsersMeta(response.meta);
    } catch (error: any) {
      setAdminDashboardError(error.message);
      throw error;
    }
  }, []);

  const loadTripsPage = useCallback(async (page: number, limit: number = 20) => {
    try {
      const response = await api.get<PaginatedResponse<any>>(`/admin/trips?page=${page}&limit=${limit}`);
      setAdminTrips(response.items.map(mapTrip));
      setTripsMeta(response.meta);
    } catch (error: any) {
      setAdminDashboardError(error.message);
      throw error;
    }
  }, []);

  const loadPendingDrivers = useCallback(async () => {
    try {
      const response = await api.get<any[]>('/admin/drivers/pending');
      setAdminPendingDrivers(response.map(mapUser));
    } catch (error: any) {
      setAdminDashboardError(error.message);
    }
  }, []);

  const loadPendingPaymentsPage = useCallback(async (page: number, limit: number = 20) => {
    try {
      const response = await api.get<PaginatedResponse<any>>(`/payments/pending?page=${page}&limit=${limit}`);
      setAdminPendingPayments(response.items.map(mapPendingPaymentTrip));
      setPendingPaymentsMeta(response.meta);
    } catch (error: any) {
      setAdminDashboardError(error.message);
      throw error;
    }
  }, []);

  const loadPaymentHistoryPage = useCallback(async (page: number, limit: number = 20) => {
    try {
      const response = await api.get<PaginatedResponse<any>>(`/payments/history?page=${page}&limit=${limit}`);
      setAdminPaymentHistory(response.items.map(mapPaymentHistory));
      setPaymentHistoryMeta(response.meta);
    } catch (error: any) {
      setAdminDashboardError(error.message);
      throw error;
    }
  }, []);

  const loadAdminDashboard = useCallback(async () => {
    setAdminDashboardLoading(true);
    setAdminDashboardError(null);

    try {
      // First load basics and initial pages
      const [dashboard, pendingPayments, paymentHistory] = await Promise.all([
        api.get<{
          users: PaginatedResponse<any>;
          trips: PaginatedResponse<any>;
          settings: SystemSettings;
          stats: AdminDashboardStats;
          pendingDrivers?: any[];
          pending?: any[];
        }>('/admin/dashboard?limit=10'),
        api.get<PaginatedResponse<any>>('/payments/pending?limit=20'),
        api.get<PaginatedResponse<any>>('/payments/history?limit=20'),
      ]);

      setAdminUsers(dashboard.users?.items?.map(mapUser) || []);
      setUsersMeta(dashboard.users?.meta || null);

      setAdminTrips(dashboard.trips?.items?.map(mapTrip) || []);
      setTripsMeta(dashboard.trips?.meta || null);

      setAdminPendingPayments(pendingPayments?.items?.map(mapPendingPaymentTrip) || []);
      setPendingPaymentsMeta(pendingPayments?.meta || null);

      setAdminPaymentHistory(paymentHistory?.items?.map(mapPaymentHistory) || []);
      setPaymentHistoryMeta(paymentHistory?.meta || null);

      setAdminStats(dashboard.stats || null);
      
      const pDrivers = dashboard.pendingDrivers || dashboard.pending || [];
      setAdminPendingDrivers(pDrivers.map(mapUser));

      setAdminSettings(dashboard.settings);
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
    usersMeta,
    adminTrips,
    tripsMeta,
    adminPendingDrivers,
    adminStats,
    adminPendingPayments,
    pendingPaymentsMeta,
    adminPaymentHistory,
    paymentHistoryMeta,
    adminSettings,
    adminDashboardLoading,
    adminDashboardError,
    lastUpdated,
    setAdminDashboardError,
    loadAdminDashboard,
    loadUsersPage,
    loadTripsPage,
    loadPendingDrivers,
    loadPendingPaymentsPage,
    loadPaymentHistoryPage,
  };
};
