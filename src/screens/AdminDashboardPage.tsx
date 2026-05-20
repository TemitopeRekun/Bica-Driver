import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { useAdminRealtime } from '@/hooks/useAdminRealtime';
import AdminDashboardScreen from './AdminDashboardScreen';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/hooks/useToast';
import { ApprovalStatus, SystemSettings, UserRole, SummaryPeriod, AdminPaymentsSummaryResponse, DateRangeFilter } from '@/types';
import { api } from '@/services/api.service';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuthStore();
  const {
    adminUsers, setAdminUsers, usersMeta, adminTrips, tripsMeta,
    adminPendingDrivers, setAdminPendingDrivers,
    adminStats,
    adminPendingPayments, pendingPaymentsMeta,
    adminPaymentHistory, paymentHistoryMeta,
    adminTickets, ticketsMeta,
    adminSettings, adminDashboardLoading, adminDashboardError, lastUpdated,
    loadAdminDashboard, loadUsersPage, loadTripsPage, loadPendingDrivers,
    loadPendingPaymentsPage, loadPaymentHistoryPage, loadTicketsPage,
    setAdminDashboardError, recoverTransaction, finalizeTrip,
  } = useAdminDashboard();
  const { currentUser } = useAuthStore();

  const [adminSummaryPeriod, setAdminSummaryPeriod] = React.useState<SummaryPeriod>('monthly');
  const [adminSummary, setAdminSummary] = React.useState<AdminPaymentsSummaryResponse | null>(null);
  const [adminSummaryLoading, setAdminSummaryLoading] = React.useState(false);

  const [historyStatusFilter, setHistoryStatusFilter] = React.useState<'ALL' | 'PAID' | 'FAILED'>('ALL');
  const [historyDateRange, setHistoryDateRange] = React.useState<DateRangeFilter>({ from: null, to: null });

  useEffect(() => {
    let cancelled = false;
    const fetchAdminSummary = async () => {
      setAdminSummaryLoading(true);
      try {
        const data = await api.getPaymentsSummary({ period: adminSummaryPeriod });
        if (!cancelled && data.role === 'ADMIN') {
          setAdminSummary(data);
        }
      } catch (e: any) {
        // Non-fatal; existing finance data still renders
      } finally {
        if (!cancelled) setAdminSummaryLoading(false);
      }
    };
    fetchAdminSummary();
    return () => { cancelled = true; };
  }, [adminSummaryPeriod]);

  const dashboardUpdateDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = React.useRef(false);

  React.useEffect(() => {
    isLoadingRef.current = adminDashboardLoading;
  }, [adminDashboardLoading]);

  React.useEffect(() => {
    return () => {
      if (dashboardUpdateDebounceRef.current) clearTimeout(dashboardUpdateDebounceRef.current);
    };
  }, []);

  const handleNewRegistration = React.useCallback(() => {
    loadAdminDashboard().catch(() => { });
  }, [loadAdminDashboard]);

  // Hook up real-time monitoring
  useAdminRealtime({
    adminId: currentUser?.id,
    onNewDriver: handleNewRegistration,
    onTripCompleted: handleNewRegistration,
    onDashboardUpdate: () => {
      if (dashboardUpdateDebounceRef.current) {
        clearTimeout(dashboardUpdateDebounceRef.current);
      }
      dashboardUpdateDebounceRef.current = setTimeout(() => {
        if (!isLoadingRef.current) {
          loadAdminDashboard().catch(console.warn);
        }
      }, 2000);
    },
  });

  useEffect(() => {
    loadAdminDashboard().catch(err => {
      console.error("Critical Admin Init Failed", err);
      toast.error("Failed to synchronize administrative records.");
    });
  }, [loadAdminDashboard]);

  const handlePageChange = (section: 'users' | 'trips' | 'pending' | 'history' | 'tickets', page: number) => {
    switch (section) {
      case 'users': loadUsersPage(page); break;
      case 'trips': loadTripsPage(page); break;
      case 'pending': loadPendingPaymentsPage(page); break;
      case 'history': loadPaymentHistoryPage(page, 20, historyStatusFilter, historyDateRange.from ?? undefined, historyDateRange.to ?? undefined); break;
      case 'tickets': loadTicketsPage(page); break;
    }
  };

  useEffect(() => {
    loadPaymentHistoryPage(0, 20, historyStatusFilter, historyDateRange.from ?? undefined, historyDateRange.to ?? undefined);
  }, [historyStatusFilter, historyDateRange, loadPaymentHistoryPage]);

  const handleUpdateStatus = async (userId: string, approvalStatus: ApprovalStatus) => {
    try {
      // Backend requires key 'approvalStatus' not 'status'
      await api.patch(`/users/${userId}/approval`, { approvalStatus });
      toast.success(`Driver ${approvalStatus === 'APPROVED' ? 'approved' : 'rejected'} successfully`);

      // ── Optimistic update ─────────────────────────────────────────────
      // 1. Immediately remove from pendingDrivers so the Pending tab clears
      setAdminPendingDrivers(prev => prev.filter(d => d.id !== userId));
      // 2. Update the approval status of this driver in the paginated users list
      setAdminUsers(prev =>
        prev.map(u =>
          u.id === userId ? { ...u, approvalStatus } : u
        )
      );
      // ─────────────────────────────────────────────────────────────────

      // Await both refreshes so the list is fully synced with the server
      await Promise.allSettled([loadPendingDrivers(), loadUsersPage(0)]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update approval status');
    }
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await api.patch(`/users/${userId}/block`, { isBlocked: blocked });
      toast.success(`User ${blocked ? 'blocked' : 'unblocked'}`);
      loadUsersPage(0).catch(console.warn);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update block status');
    }
  };

  const handleRetrySubAccount = async (userId: string) => {
    try {
      const response = await api.post<any>(`/admin/users/${userId}/retry-subaccount`);
      toast.success("Sub-account creation re-triggered successfully!");
      await loadAdminDashboard();
      return response;
    } catch (e: any) {
      toast.error(e.message || 'Failed to retry sub-account setup');
      return null;
    }
  };

  const handleUpdateSettings = async (settings: SystemSettings) => {
    try {
      await api.patch('/admin/settings', settings);
      toast.success("Settings saved to cluster");
      await loadAdminDashboard();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update system settings');
    }
  };

  const handleResetWalletBalance = async (driverId: string) => {
    try {
      await api.resetWalletBalance(driverId);
      toast.success('Internal ledger balance has been reset for this driver.');
      await loadAdminDashboard();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reset internal ledger balance.');
    }
  };

  return (
    <AdminDashboardScreen
      users={adminUsers || []}
      usersMeta={usersMeta}
      trips={adminTrips || []}
      tripsMeta={tripsMeta}
      pendingDrivers={adminPendingDrivers || []}
      stats={adminStats}
      pendingPayments={adminPendingPayments || []}
      pendingPaymentsMeta={pendingPaymentsMeta}
      paymentHistory={adminPaymentHistory || []}
      paymentHistoryMeta={paymentHistoryMeta}
      settings={adminSettings || { commission: 25, baseFare: 500, timeRate: 50, pricePerKm: 100, autoApprove: false }}
      isLoading={adminDashboardLoading}
      error={adminDashboardError}
      lastUpdated={lastUpdated}
      onUpdateStatus={handleUpdateStatus}
      onBlockUser={handleBlockUser}
      onRetrySubAccount={handleRetrySubAccount}
      onUpdateSettings={handleUpdateSettings}
      onResetWalletBalance={handleResetWalletBalance}
      onRecover={recoverTransaction}
      onFinalize={finalizeTrip}
      onForcedLogout={() => logout()}
      onRetry={() => loadAdminDashboard()}
      onClearError={() => setAdminDashboardError(null)}
      onBack={() => navigate('/')}
      onSimulate={() => { }}
      onPageChange={handlePageChange}
      adminSummary={adminSummary}
      adminSummaryPeriod={adminSummaryPeriod}
      setAdminSummaryPeriod={setAdminSummaryPeriod}
      adminSummaryLoading={adminSummaryLoading}
      historyStatusFilter={historyStatusFilter}
      setHistoryStatusFilter={setHistoryStatusFilter}
      historyDateRange={historyDateRange}
      setHistoryDateRange={setHistoryDateRange}
      tickets={adminTickets}
      ticketsMeta={ticketsMeta}
      ticketsLoading={adminDashboardLoading}
    />
  );
};

export default AdminDashboardPage;
