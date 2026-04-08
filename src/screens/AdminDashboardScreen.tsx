import React, { useEffect, useState } from 'react';
import { UserProfile, UserRole, ApprovalStatus, Trip, SystemSettings, PendingPaymentTrip, PaymentHistoryRecord } from '@/types';
import { mapUser } from '@/mappers/appMappers';
import { useToast } from '@/hooks/useToast';

// Sub-components
import OverviewSection from '@/components/Admin/OverviewSection';
import DriversSection from '@/components/Admin/DriversSection';
import OwnersSection from '@/components/Admin/OwnersSection';
import TripsSection from '@/components/Admin/TripsSection';
import FinanceSection from '@/components/Admin/FinanceSection';
import SettingsSection from '@/components/Admin/SettingsSection';
import UserDossierModal from '@/components/Admin/UserDossierModal';

import { api, PaginationMeta } from '@/services/api.service';

interface AdminDashboardScreenProps {
  users: UserProfile[];
  usersMeta: PaginationMeta | null;
  trips: Trip[];
  tripsMeta: PaginationMeta | null;
  pendingPayments: PendingPaymentTrip[];
  pendingPaymentsMeta: PaginationMeta | null;
  paymentHistory: PaymentHistoryRecord[];
  paymentHistoryMeta: PaginationMeta | null;
  settings: SystemSettings;
  isLoading?: boolean;
  error?: string | null;
  lastUpdated?: Date | null;
  onUpdateStatus: (userId: string, status: ApprovalStatus) => void;
  onBlockUser: (userId: string, blocked: boolean) => void;
  onRetrySubAccount: (userId: string) => Promise<void>;
  onUpdateSettings: (settings: SystemSettings) => void;
  onForcedLogout: () => void;
  onRetry: () => Promise<void> | void;
  onBack: () => void;
  onSimulate: (role: UserRole) => void;
  onPageChange: (section: 'users' | 'trips' | 'pending' | 'history', page: number) => void;
}

type AdminSection = 'overview' | 'drivers' | 'owners' | 'trips' | 'finance' | 'settings';

const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ 
  users, usersMeta, trips, tripsMeta, pendingPayments, pendingPaymentsMeta, paymentHistory, paymentHistoryMeta,
  settings, isLoading, error, lastUpdated,
  onUpdateStatus, onBlockUser, onRetrySubAccount, onUpdateSettings, onForcedLogout,
  onRetry, onBack, onSimulate, onPageChange
}) => {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserProfile | null>(null);
  const [selectedUserDetailsLoading, setSelectedUserDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [driverFilter, setDriverFilter] = useState<'All' | 'Pending' | 'Active' | 'Blocked'>('All');
  const [retryingSubAccountIds, setRetryingSubAccountIds] = useState<Set<string>>(new Set());
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);

  const modalUser = selectedUserDetails && selectedUserDetails.id === selectedUser?.id
      ? selectedUserDetails
      : selectedUser;

  // Statistics & Derived Data
  const drivers = users.filter(u => u.role === UserRole.DRIVER);
  const owners = users.filter(u => u.role === UserRole.OWNER);
  const pendingDrivers = drivers.filter(u => u.approvalStatus === 'PENDING');
  const totalRevenue = trips.reduce((acc, t) => t.status === 'COMPLETED' ? acc + t.amount : acc, 0);
  const platformFees = totalRevenue * (settings.commission / 100);

  // Profile Detail Sync
  useEffect(() => {
    if (!selectedUser) {
      setSelectedUserDetails(null);
      setSelectedUserDetailsLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedUserDetails(selectedUser);
    setSelectedUserDetailsLoading(true);

    api.get<any>(`/users/${selectedUser.id}`)
      .then((user) => {
        if (!cancelled) setSelectedUserDetails(mapUser(user));
      })
      .catch((err: any) => {
        toast.error("We couldn't refresh this user's latest details. Some information might be slightly out of date.");
      })
      .finally(() => {
        if (!cancelled) setSelectedUserDetailsLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedUser]);

  const handleSaveSettings = () => {
    onUpdateSettings(localSettings);
    toast.success("System Settings Updated Successfully!");
  };

  const getTripStatusClass = (status: Trip['status']) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/10 text-green-500';
      case 'CANCELLED':
      case 'DECLINED': return 'bg-red-500/10 text-red-500';
      case 'IN_PROGRESS':
      case 'ASSIGNED': return 'bg-blue-500/10 text-blue-500';
      default: return 'bg-orange-500/10 text-orange-500';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount).replace('NGN', '₦');
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return 'Just now';
    return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatJoinedDate = (value?: string | null) => {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleRetrySubAccountWrap = async (userId: string) => {
    setRetryingSubAccountIds(prev => new Set(prev).add(userId));
    try {
      await onRetrySubAccount(userId);
    } finally {
      setRetryingSubAccountIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 shrink-0 z-20">
        <button onClick={onBack} className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="font-black text-lg uppercase tracking-tight">Admin Console</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bicadriver v1.1.0</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined filled">admin_panel_settings</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="px-4 py-3 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 bg-background-light dark:bg-background-dark shrink-0">
        <div className="flex gap-4 min-w-max">
          {[
            { id: 'overview', icon: 'dashboard', label: 'Overview' },
            { id: 'drivers', icon: 'badge', label: 'Drivers' },
            { id: 'owners', icon: 'groups', label: 'Owners' },
            { id: 'trips', icon: 'route', label: 'Trips' },
            { id: 'finance', icon: 'account_balance', label: 'Finance' },
            { id: 'settings', icon: 'settings', label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as AdminSection)}
              className={`flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-all ${
                activeSection === item.id ? 'text-primary bg-primary/5' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className={`material-symbols-outlined ${activeSection === item.id ? 'filled' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 relative">
        {isLoading && users.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <span className="material-symbols-outlined animate-spin text-4xl mb-2">refresh</span>
            <p className="font-black uppercase tracking-widest text-xs">Synchronizing Records...</p>
          </div>
        ) : (
          <>
            {(activeSection === 'drivers' || activeSection === 'owners') && (
              <div className="mb-6 sticky top-0 z-10">
                <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center px-4 h-12 shadow-sm">
                  <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
                  <input 
                    type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder={`Search ${activeSection}...`}
                    className="bg-transparent border-none w-full text-sm font-medium focus:ring-0 p-0"
                  />
                </div>
              </div>
            )}

            {activeSection === 'overview' && (
              <OverviewSection 
                lastUpdated={lastUpdated} pendingDrivers={pendingDrivers} pendingPayments={pendingPayments}
                platformFees={platformFees} completedTripsCount={trips.filter(t => t.status === 'COMPLETED').length}
                onlineDriversCount={drivers.filter(d => d.isOnline).length} totalOwnersCount={owners.length}
                trips={trips} formatCurrency={formatCurrency} formatShortDate={formatShortDate}
                setActiveSection={setActiveSection} onSimulate={onSimulate}
              />
            )}

            {activeSection === 'drivers' && (
              <DriversSection 
                drivers={drivers} driverFilter={driverFilter} searchTerm={searchTerm}
                meta={usersMeta} onPageChange={(p) => onPageChange('users', p)}
                setDriverFilter={setDriverFilter} setSelectedUser={setSelectedUser}
                retryingSubAccountIds={retryingSubAccountIds} onRetrySubAccount={handleRetrySubAccountWrap}
              />
            )}

            {activeSection === 'owners' && (
              <OwnersSection 
                owners={owners} searchTerm={searchTerm} onBlockUser={onBlockUser} 
                meta={usersMeta} onPageChange={(p) => onPageChange('users', p)}
              />
            )}

            {activeSection === 'trips' && (
              <TripsSection 
                trips={trips} meta={tripsMeta} onPageChange={(p) => onPageChange('trips', p)}
                formatCurrency={formatCurrency} getTripStatusClass={getTripStatusClass} 
              />
            )}

            {activeSection === 'finance' && (
              <FinanceSection 
                platformFees={platformFees} totalRevenue={totalRevenue} settings={settings}
                pendingPayments={pendingPayments} pendingPaymentsMeta={pendingPaymentsMeta}
                paymentHistory={paymentHistory} paymentHistoryMeta={paymentHistoryMeta}
                onPageChange={onPageChange}
                formatCurrency={formatCurrency} formatShortDate={formatShortDate}
              />
            )}

            {activeSection === 'settings' && (
              <SettingsSection 
                localSettings={localSettings} setLocalSettings={setLocalSettings} handleSaveSettings={handleSaveSettings}
              />
            )}
          </>
        )}
      </main>

      {/* Profile Dossier Modal */}
      {selectedUser && modalUser && (
        <UserDossierModal 
          user={modalUser} userDetailsLoading={selectedUserDetailsLoading}
          retryingSubAccountIds={retryingSubAccountIds} onClose={() => setSelectedUser(null)}
          onUpdateStatus={onUpdateStatus} onBlockUser={onBlockUser}
          onRetrySubAccount={handleRetrySubAccountWrap} formatJoinedDate={formatJoinedDate}
        />
      )}
    </div>
  );
};

export default AdminDashboardScreen;
