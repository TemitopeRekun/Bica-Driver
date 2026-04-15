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
      // Load the consolidated dashboard + role-specific user pages in parallel
      const [dashboard, ownersRes, pendingPayments, paymentHistory] = await Promise.all([
        api.get<{
          users: any;
          trips: any;
          settings: SystemSettings;
          stats: AdminDashboardStats;
          pendingDrivers?: any[];
          pending?: any[];
          driversPending?: any[];
          payouts?: any[];
        }>('/admin/dashboard'),
        // Load all users separately so the Owners and Drivers tabs are always populated
        // Note: backend /admin/users does NOT support ?role= filter — we filter client-side
        api.get<any>('/admin/users?limit=50').catch(() => null),
        api.get<any>('/payments/pending?limit=20').catch(() => ({ items: [], meta: null })),
        api.get<any>('/payments/history?limit=20').catch(() => ({ items: [], meta: null })),
      ]);

      // ── Users (from dashboard snapshot — latest 10 mixed) ──
      const rawUsers: any[] = Array.isArray(dashboard.users)
        ? dashboard.users
        : (dashboard.users?.items ?? []);
      setAdminUsers(rawUsers.map(mapUser));
      setUsersMeta(
        Array.isArray(dashboard.users) ? null : (dashboard.users?.meta ?? null)
      );

      // ── If dedicated owner endpoint returned data, prefer that ──
      if (ownersRes) {
        const rawOwners: any[] = Array.isArray(ownersRes)
          ? ownersRes
          : (ownersRes?.items ?? []);
        // Merge owners into adminUsers so the Owners tab is always populated
        setAdminUsers(prev => {
          const existing = new Map(prev.map(u => [u.id, u]));
          rawOwners.map(mapUser).forEach(o => existing.set(o.id, o));
          return Array.from(existing.values());
        });
      }

      // ── Trips ──
      const rawTrips: any[] = Array.isArray(dashboard.trips)
        ? dashboard.trips
        : (dashboard.trips?.items ?? []);
      setAdminTrips(rawTrips.map(mapTrip));
      setTripsMeta(
        Array.isArray(dashboard.trips) ? null : (dashboard.trips?.meta ?? null)
      );

      // ── Pending drivers (dedicated server-side list) ──
      const pDrivers = dashboard.pendingDrivers || dashboard.pending || dashboard.driversPending || [];
      setAdminPendingDrivers(pDrivers.map(mapUser));

      // ── Stats ──
      setAdminStats(dashboard.stats || null);

      // ── Settings ──
      setAdminSettings(dashboard.settings);
      onSettingsLoadedRef.current?.(dashboard.settings);

      // ── Payments ──
      setAdminPendingPayments(pendingPayments?.items?.map(mapPendingPaymentTrip) ?? []);
      setPendingPaymentsMeta(pendingPayments?.meta ?? null);
      setAdminPaymentHistory(paymentHistory?.items?.map(mapPaymentHistory) ?? []);
      setPaymentHistoryMeta(paymentHistory?.meta ?? null);

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
