import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { UserProfile, UserRole, ApprovalStatus, Trip, TripStatus, SystemSettings, PendingPaymentTrip, PaymentHistoryRecord, AdminDashboardStats, AdminSection, DriverFilter, AdminPaymentsSummaryResponse, SummaryPeriod, DateRangeFilter } from '@/types';
import { mapUser } from '@/mappers/appMappers';
import { useToast } from '@/hooks/useToast';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { InlineError } from '@/components/Common/InlineError';
import { Skeleton, CardSkeleton } from '@/components/Common/Skeleton';

// Sub-components
import OverviewSection from '@/components/Admin/OverviewSection';
import DriversSection from '@/components/Admin/DriversSection';
import OwnersSection from '@/components/Admin/OwnersSection';
import TripsSection from '@/components/Admin/TripsSection';
import FinanceSection from '@/components/Admin/FinanceSection';
import SupportSection from '@/components/Admin/TicketsSection';
import SettingsSection from '@/components/Admin/SettingsSection';
import UserDossierModal from '@/components/Admin/UserDossierModal';

import { api, PaginationMeta } from '@/services/api.service';

interface AdminDashboardScreenProps {
  users: UserProfile[];
  usersMeta: PaginationMeta | null;
  trips: Trip[];
  tripsMeta: PaginationMeta | null;
  pendingDrivers: UserProfile[];
  stats: AdminDashboardStats | null;
  pendingPayments: PendingPaymentTrip[];
  pendingPaymentsMeta: PaginationMeta | null;
  paymentHistory: PaymentHistoryRecord[];
  paymentHistoryMeta: PaginationMeta | null;
  settings: SystemSettings;
  isLoading?: boolean;
  error?: string | null;
  lastUpdated?: Date | null;
  onUpdateStatus: (userId: string, approvalStatus: ApprovalStatus) => Promise<void>;
  onBlockUser: (userId: string, isBlocked: boolean) => Promise<void>;
  onRetrySubAccount: (userId: string) => Promise<any>;
  onUpdateSettings: (settings: SystemSettings) => Promise<void>;
  onResetWalletBalance: (driverId: string) => Promise<void>;
  onForcedLogout: () => void;
  onRetry: () => Promise<void> | void;
  onBack: () => void;
  onSimulate: (role: UserRole) => void;
  onPageChange: (section: 'users' | 'trips' | 'pending' | 'history' | 'tickets', page: number) => void;
  onViewTrip?: (tripId: string) => void;
  adminSummary?: AdminPaymentsSummaryResponse | null;
  adminSummaryPeriod?: SummaryPeriod;
  setAdminSummaryPeriod?: (period: SummaryPeriod) => void;
  adminSummaryLoading?: boolean;
  historyStatusFilter: 'ALL' | 'PAID' | 'FAILED';
  setHistoryStatusFilter: (status: 'ALL' | 'PAID' | 'FAILED') => void;
  historyDateRange: DateRangeFilter;
  setHistoryDateRange: (range: DateRangeFilter) => void;
  tickets: import('@/types').SupportTicket[];
  ticketsMeta: import('@/services/api.service').PaginationMeta | null;
  ticketsLoading?: boolean;
}



const getTripStatusClass = (status: TripStatus) => {
  switch (status) {
    case 'COMPLETED': return 'bg-green-500/10 text-green-500';
    case 'CANCELLED':
    case 'DECLINED': return 'bg-red-500/10 text-red-500';
    case 'IN_PROGRESS':
    case 'ASSIGNED': return 'bg-blue-500/10 text-blue-500';
    default: return 'bg-orange-500/10 text-orange-500';
  }
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 })
    .format(amount)
    .replace('NGN', '₦');

const formatShortDate = (value?: string | null) => {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatJoinedDate = (value?: string | null) => {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ 
  users, usersMeta, trips, tripsMeta, pendingDrivers, stats,
  pendingPayments, pendingPaymentsMeta, paymentHistory, paymentHistoryMeta,
  settings, isLoading, error, lastUpdated,
  onUpdateStatus, onBlockUser, onRetrySubAccount, onUpdateSettings, onForcedLogout,
  onRetry, onBack, onSimulate, onPageChange,
  adminSummary, adminSummaryPeriod, setAdminSummaryPeriod, adminSummaryLoading,
  historyStatusFilter, setHistoryStatusFilter, historyDateRange, setHistoryDateRange,
  onResetWalletBalance,
  tickets, ticketsMeta, ticketsLoading
}) => {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserProfile | null>(null);
  const [selectedUserDetailsLoading, setSelectedUserDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [driverFilter, setDriverFilter] = useState<DriverFilter>('All');
  const [retryingSubAccountIds, setRetryingSubAccountIds] = useState<Set<string>>(new Set());
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const [relativeTime, setRelativeTime] = useState<string>('just now');

  const { isRefreshing, pullHandlers } = usePullToRefresh(async () => {
    if (onRetry) await onRetry();
  });

  const jumpToSection = useCallback((section: AdminSection, filter?: any) => {
    setActiveSection(section);
    if (filter && section === 'drivers') setDriverFilter(filter);
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleViewTrip = useCallback((tripId: string) => {
    setSearchTerm(tripId);
    jumpToSection('trips');
  }, [jumpToSection]);

  // Relative Time Logic
  useEffect(() => {
    if (!lastUpdated) return;

    const updateRelative = () => {
      const diff = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 60000);
      if (diff < 1) setRelativeTime('just now');
      else if (diff === 1) setRelativeTime('1 min ago');
      else setRelativeTime(`${diff} mins ago`);
    };

    updateRelative();
    const interval = setInterval(updateRelative, 60000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Merge pendingDrivers (dedicated list) with paginated users.
  // users is always authoritative — it overwrites pendingDrivers so a freshly
  // approved driver's status from the API is never replaced by a stale pending entry.
  const drivers = useMemo(() => {
    const map = new Map<string, UserProfile>();
    // Seed with pending first (lower priority)
    pendingDrivers.forEach(u => map.set(u.id, u));
    // Users overwrites — APPROVED status from loadUsersPage wins
    users.filter(u => u.role === UserRole.DRIVER).forEach(u => map.set(u.id, u));
    return Array.from(map.values());
  }, [users, pendingDrivers]);

  const owners = useMemo(
    () => users.filter(u => u.role === UserRole.OWNER),
    [users]
  );

  const modalUser = useMemo(
    () => selectedUserDetails?.id === selectedUser?.id ? selectedUserDetails : selectedUser,
    [selectedUserDetails, selectedUser]
  );

  const totalRevenue = stats?.totalEarnings || 0;
  const platformFees = stats?.totalEarnings || 0;

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

  const handleSaveSettings = useCallback(() => {
    onUpdateSettings(localSettings);
    toast.success("System Settings Updated Successfully!");
  }, [onUpdateSettings, localSettings, toast]);

  const handleRetrySubAccountWrap = useCallback(async (userId: string) => {
    setRetryingSubAccountIds(prev => new Set(prev).add(userId));
    try {
      const result: any = await onRetrySubAccount(userId);
      // Immediately reflect successfully created sub-account in dossier without waiting for full dashboard reload
      if (result && result.subAccountActive) {
        setSelectedUserDetails(prev => prev ? { 
          ...prev, 
          subAccountActive: true, 
          canRetrySubAccountSetup: false,
          monnifySubAccountCode: result.monnifySubAccountCode || prev.monnifySubAccountCode
        } : prev);
      }
    } finally {
      setRetryingSubAccountIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }, [onRetrySubAccount]);

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 shrink-0 z-20">
        {activeSection !== 'overview' && (
          <button 
            onClick={() => setActiveSection('overview')} 
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        <div className="flex-1">
          <h1 className="font-black text-lg uppercase tracking-tight">Admin Console</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bicadriver v1.1.0</p>
            {lastUpdated && (
              <>
                <span className="text-[10px] text-slate-300">•</span>
                <p className="text-[10px] text-primary/70 font-black uppercase tracking-widest italic animate-pulse">
                  Last updated {relativeTime}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeSection === 'overview' && (
            <button 
              onClick={onBack} 
              className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center gap-2 transition-all border border-red-500/10"
              title="Exit Admin"
            >
              <span className="text-[10px] font-black uppercase tracking-wider">Exit Admin</span>
              <span className="material-symbols-outlined text-sm">exit_to_app</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined filled">admin_panel_settings</span>
          </div>
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
            { id: 'tickets', icon: 'support_agent', label: 'Support' },
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
      <main 
        {...pullHandlers}
        className="flex-1 overflow-y-auto no-scrollbar p-4 relative"
      >
        {/* Pull-to-refresh spinner overlay */}
        <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
          <div className={`transition-all duration-300 transform ${isRefreshing ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
            <div className="size-10 rounded-full bg-primary shadow-xl flex items-center justify-center border-4 border-white/20">
              <span className="material-symbols-outlined text-white animate-spin">refresh</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <div className="size-20 rounded-[2.5rem] bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
              <span className="material-symbols-outlined text-4xl">error</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase mb-2">Sync Interrupted</h3>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest max-w-[240px] leading-relaxed mb-8">
              {error}
            </p>
            <button 
              onClick={onRetry}
              className="px-10 py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              Force Retry
            </button>
          </div>
        ) : isLoading && users.length === 0 ? (
          <div className="space-y-6 animate-fade-in">
             {activeSection === 'overview' ? (
                <div className="grid grid-cols-2 gap-4">
                   {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} height={80} className="rounded-2xl" />
                   ))}
                </div>
             ) : (
                <div className="space-y-4">
                   {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
                </div>
             )}
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
                lastUpdated={lastUpdated} 
                pendingDrivers={pendingDrivers} 
                stats={stats}
                pendingPayments={pendingPayments}
                platformFees={platformFees} 
                completedTripsCount={trips.filter(t => t.status === 'COMPLETED').length}
                onlineDriversCount={drivers.filter(d => d.isOnline).length} 
                totalOwnersCount={owners.length}
                trips={trips} 
                formatCurrency={formatCurrency} 
                formatShortDate={formatShortDate}
                onJump={jumpToSection} 
                onSimulate={onSimulate}
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
                owners={owners} searchTerm={searchTerm} 
                onBlockUser={onBlockUser}
                setSelectedUser={setSelectedUser}
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
                adminSummary={adminSummary}
                adminSummaryPeriod={adminSummaryPeriod ?? 'monthly'}
                setAdminSummaryPeriod={setAdminSummaryPeriod}
                adminSummaryLoading={adminSummaryLoading ?? false}
                historyStatusFilter={historyStatusFilter}
                setHistoryStatusFilter={setHistoryStatusFilter}
                historyDateRange={historyDateRange}
                setHistoryDateRange={setHistoryDateRange}
              />
            )}

            {activeSection === 'tickets' && (
              <SupportSection 
                tickets={tickets} 
                ticketsMeta={ticketsMeta} 
                onPageChange={(p) => onPageChange('tickets', p)}
                onViewTrip={handleViewTrip}
                isLoading={ticketsLoading}
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
          onResetWalletBalance={onResetWalletBalance}
        />
      )}
    </div>
  );
};

export default AdminDashboardScreen;
