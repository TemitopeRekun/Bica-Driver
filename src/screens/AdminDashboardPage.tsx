import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import AdminDashboardScreen from './AdminDashboardScreen';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/hooks/useToast';
import { ApprovalStatus, SystemSettings, UserRole } from '@/types';
import { api } from '@/services/api.service';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuthStore();
  const {
    adminUsers, usersMeta, adminTrips, tripsMeta,
    adminPendingPayments, pendingPaymentsMeta, 
    adminPaymentHistory, paymentHistoryMeta,
    adminSettings, adminDashboardLoading, adminDashboardError, lastUpdated,
    loadAdminDashboard, loadUsersPage, loadTripsPage, 
    loadPendingPaymentsPage, loadPaymentHistoryPage
  } = useAdminDashboard();

  useEffect(() => {
    loadAdminDashboard().catch(err => {
      console.error("Critical Admin Init Failed", err);
      toast.error("Failed to synchronize administrative records.");
    });
  }, [loadAdminDashboard]);

  const handlePageChange = (section: 'users' | 'trips' | 'pending' | 'history', page: number) => {
    switch(section) {
      case 'users': loadUsersPage(page); break;
      case 'trips': loadTripsPage(page); break;
      case 'pending': loadPendingPaymentsPage(page); break;
      case 'history': loadPaymentHistoryPage(page); break;
    }
  };

  const handleUpdateStatus = async (userId: string, status: ApprovalStatus) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { status });
      toast.success(`User status updated to ${status}`);
      await loadAdminDashboard();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update user status');
    }
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/block`, { blocked });
      toast.success(`User ${blocked ? 'blocked' : 'unblocked'}`);
      await loadAdminDashboard();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update block status');
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

  return (
    <AdminDashboardScreen 
      users={adminUsers || []}
      usersMeta={usersMeta}
      trips={adminTrips || []}
      tripsMeta={tripsMeta}
      pendingPayments={adminPendingPayments || []}
      pendingPaymentsMeta={pendingPaymentsMeta}
      paymentHistory={adminPaymentHistory || []}
      paymentHistoryMeta={paymentHistoryMeta}
      settings={adminSettings || { commission: 15, baseFare: 500, timeRate: 50, pricePerKm: 200, autoApprove: true }}
      isLoading={adminDashboardLoading}
      error={adminDashboardError}
      lastUpdated={lastUpdated}
      onUpdateStatus={handleUpdateStatus}
      onBlockUser={handleBlockUser}
      onRetrySubAccount={async () => {}}
      onUpdateSettings={handleUpdateSettings}
      onForcedLogout={() => logout()}
      onRetry={() => loadAdminDashboard()}
      onBack={() => navigate('/')}
      onSimulate={() => {}}
      onPageChange={handlePageChange}
    />
  );
};

export default AdminDashboardPage;
