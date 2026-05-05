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
    adminUsers, usersMeta, adminTrips, tripsMeta, adminPendingDrivers, adminStats,
    adminPendingPayments, pendingPaymentsMeta,
    adminPaymentHistory, paymentHistoryMeta,
    adminSettings, adminDashboardLoading, adminDashboardError, lastUpdated,
    loadAdminDashboard, loadUsersPage, loadTripsPage,
    loadPendingPaymentsPage, loadPaymentHistoryPage
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

  const handleNewRegistration = React.useCallback(() => {
    loadAdminDashboard().catch(() => { });
  }, [loadAdminDashboard]);

  // Hook up real-time monitoring
  useAdminRealtime({
    adminId: currentUser?.id,
    onNewDriver: handleNewRegistration,
    onTripCompleted: handleNewRegistration,
  });

  useEffect(() => {
    loadAdminDashboard().catch(err => {
      console.error("Critical Admin Init Failed", err);
      toast.error("Failed to synchronize administrative records.");
    });
  }, [loadAdminDashboard]);

  const handlePageChange = (section: 'users' | 'trips' | 'pending' | 'history', page: number) => {
    switch (section) {
      case 'users': loadUsersPage(page); break;
      case 'trips': loadTripsPage(page); break;
      case 'pending': loadPendingPaymentsPage(page); break;
      case 'history': loadPaymentHistoryPage(page, 20, historyStatusFilter, historyDateRange.from ?? undefined, historyDateRange.to ?? undefined); break;
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
      await loadAdminDashboard();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update approval status');
    }
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await api.patch(`/users/${userId}/block`, { isBlocked: blocked });
      toast.success(`User ${blocked ? 'blocked' : 'unblocked'}`);
      await loadAdminDashboard();
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
      onForcedLogout={() => logout()}
      onRetry={() => loadAdminDashboard()}
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
    />
  );
};

export default AdminDashboardPage;
