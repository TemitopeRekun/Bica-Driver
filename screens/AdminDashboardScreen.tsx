
import React, { useEffect, useState } from 'react';
import { UserProfile, UserRole, ApprovalStatus, Trip, SystemSettings, PendingPaymentTrip, PaymentHistoryRecord } from '../types';
import { mapUser } from '../mappers/appMappers';
import { api } from '../services/api.service';

interface AdminDashboardScreenProps {
  users: UserProfile[];
  trips: Trip[];
  pendingPayments: PendingPaymentTrip[];
  paymentHistory: PaymentHistoryRecord[];
  settings: SystemSettings;
  isLoading?: boolean;
  error?: string | null;
  lastUpdated?: Date | null;
  onUpdateStatus: (userId: string, status: ApprovalStatus) => void;
  onBlockUser: (userId: string, blocked: boolean) => void;
  onRetrySubAccount: (userId: string) => Promise<void>;
  onUpdateSettings: (settings: SystemSettings) => void;
  onRetry: () => Promise<void> | void;
  onBack: () => void;
  onSimulate: (role: UserRole) => void;
}

type AdminSection = 'overview' | 'drivers' | 'owners' | 'trips' | 'finance' | 'settings';
type DriverFilter = 'All' | 'Pending' | 'Active' | 'Blocked';

const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ 
  users, trips, pendingPayments, paymentHistory, settings, isLoading, error, lastUpdated,
  onUpdateStatus, onBlockUser, onRetrySubAccount, onUpdateSettings, 
  onRetry, onBack, onSimulate 
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserProfile | null>(null);
  const [selectedUserDetailsLoading, setSelectedUserDetailsLoading] = useState(false);
  const [selectedUserDetailsError, setSelectedUserDetailsError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [driverFilter, setDriverFilter] = useState<DriverFilter>('All');
  const [retryingSubAccountIds, setRetryingSubAccountIds] = useState<Set<string>>(new Set());
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const modalUser =
    selectedUserDetails && selectedUserDetails.id === selectedUser?.id
      ? selectedUserDetails
      : selectedUser;

  // Derived Data
  const drivers = users.filter(u => u.role === UserRole.DRIVER);
  const owners = users.filter(u => u.role === UserRole.OWNER);
  const pendingDrivers = drivers.filter(u => u.approvalStatus === 'PENDING');
  const filteredDrivers = drivers
    .filter((driver) => {
      switch (driverFilter) {
        case 'Pending':
          return driver.approvalStatus === 'PENDING';
        case 'Active':
          return !driver.isBlocked && driver.isOnline && driver.approvalStatus === 'APPROVED';
        case 'Blocked':
          return !!driver.isBlocked;
        default:
          return true;
      }
    })
    .filter(d => (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  
  const totalRevenue = trips.reduce((acc, t) => t.status === 'COMPLETED' ? acc + t.amount : acc, 0);
  const platformFees = totalRevenue * (settings.commission / 100);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount).replace('NGN', '₦');
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return 'Just now';
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatJoinedDate = (value?: string | null) => {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const hasText = (value?: string | null) => Boolean(value?.trim());

  useEffect(() => {
    if (!selectedUser) {
      setSelectedUserDetails(null);
      setSelectedUserDetailsLoading(false);
      setSelectedUserDetailsError(null);
      return;
    }

    let cancelled = false;

    setSelectedUserDetails(selectedUser);
    setSelectedUserDetailsError(null);
    setSelectedUserDetailsLoading(true);

    api.get<any>(`/users/${selectedUser.id}`)
      .then((user) => {
        if (cancelled) return;
        setSelectedUserDetails(mapUser(user));
      })
      .catch((error: any) => {
        if (cancelled) return;
        setSelectedUserDetailsError(error.message || 'Could not refresh the full user profile.');
      })
      .finally(() => {
        if (cancelled) return;
        setSelectedUserDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUser]);


  const handleSaveSettings = () => {
    onUpdateSettings(localSettings);
    alert("System Settings Updated Successfully!");
  };

  const getTripStatusClass = (status: Trip['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-500';
      case 'CANCELLED':
      case 'DECLINED':
        return 'bg-red-500/10 text-red-500';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-orange-500/10 text-orange-500';
    }
  };

  const renderMonnifyStatus = (driver: UserProfile, isModal = false) => {
    if (driver.role !== UserRole.DRIVER) return null;

    const isRetrying = retryingSubAccountIds.has(driver.id);
    const hasSubAccount = !!driver.subAccountActive;
    const canRetry = !!driver.canRetrySubAccountSetup;

    const handleRetry = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setRetryingSubAccountIds(prev => new Set(prev).add(driver.id));
      try {
        await onRetrySubAccount(driver.id);
      } finally {
        setRetryingSubAccountIds(prev => {
          const next = new Set(prev);
          next.delete(driver.id);
          return next;
        });
      }
    };

    return (
      <div className={`mt-2 p-3 rounded-2xl border ${hasSubAccount ? 'bg-green-500/5 border-green-500/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hasSubAccount ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></span>
            <span className="text-[10px] font-black uppercase tracking-wider">
              {hasSubAccount ? 'Sub Account Configured' : 'Sub Account Missing'}
            </span>
          </div>
          {canRetry && !hasSubAccount && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-2 py-1 bg-primary hover:bg-primary-dark disabled:bg-slate-400 text-white text-[9px] font-bold uppercase rounded-lg transition-colors flex items-center gap-1"
            >
              {isRetrying ? (
                <span className="material-symbols-outlined text-[10px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[10px]">refresh</span>
              )}
              {isRetrying ? 'Retrying...' : 'Retry Setup'}
            </button>
          )}
        </div>

        {hasSubAccount && driver.monnifySubAccountCode && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-slate-500 font-medium">Monnify Code:</span>
            <code className="text-[10px] font-mono bg-white dark:bg-black/20 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800" title={driver.monnifySubAccountCode}>
              {driver.monnifySubAccountCode}
            </code>
          </div>
        )}

        {(driver.bankName || driver.accountNumber) && (
          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium italic">
            <span className="material-symbols-outlined text-[12px]">account_balance</span>
            {driver.bankName} • ****{driver.accountNumber?.slice(-4) || '****'}
          </div>
        )}
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-slide-up">
      {/* Platform Status Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Platform Snapshot</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Operational Dashboard
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Last Updated</p>
          <p className="text-xs font-black text-slate-900 dark:text-white">
            {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Synchronizing...'}
          </p>
        </div>
      </div>

      {/* Immediate Attention Area */}
      {(pendingDrivers.length > 0 || pendingPayments.length > 0) && (
        <div className="bg-red-500/5 border-2 border-red-500/20 rounded-[2rem] p-5 shadow-inner">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-red-500 filled">priority_high</span>
            <h3 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Immediate Attention</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingDrivers.length > 0 && (
              <button 
                onClick={() => setActiveSection('drivers')}
                className="bg-white dark:bg-red-950/20 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between group hover:border-red-500 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-600">
                    <span className="material-symbols-outlined">badge</span>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Pending Drivers</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{pendingDrivers.length}</p>
                  </div>
                </div>
                <div className="size-8 rounded-full border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </div>
              </button>
            )}
            {pendingPayments.length > 0 && (
              <button 
                onClick={() => setActiveSection('finance')}
                className="bg-white dark:bg-red-950/20 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between group hover:border-red-500 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-600">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Pending Payments</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{pendingPayments.length}</p>
                  </div>
                </div>
                <div className="size-8 rounded-full border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="size-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </span>
            <span className="text-[9px] font-black text-green-500 px-2 py-0.5 bg-green-500/10 rounded-full italic">+12%</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Revenue</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{formatCurrency(platformFees)}</p>
        </div>

        {/* Trips Volume */}
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">route</span>
            </span>
            <span className="text-[9px] font-black text-primary px-2 py-0.5 bg-primary/10 rounded-full italic">Volume</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Completed Trips</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{trips.filter(t => t.status === 'COMPLETED').length}</p>
        </div>

        {/* Active Drivers */}
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="size-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">sports_motorsports</span>
            </span>
            <span className="text-[9px] font-black text-blue-500 px-2 py-0.5 bg-blue-500/10 rounded-full italic">Online</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Drivers</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{drivers.filter(d => d.isOnline).length}</p>
        </div>

        {/* Registered Owners */}
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="size-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">groups</span>
            </span>
            <span className="text-[9px] font-black text-purple-500 px-2 py-0.5 bg-purple-500/10 rounded-full italic">Users</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Owners</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{owners.length}</p>
        </div>
      </div>

      {/* Simulator Quick Access */}
      <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 size-48 bg-primary/20 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none group-hover:bg-primary/30 transition-all"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-md">
            <h3 className="text-xl font-black flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">terminal</span>
              Operations Simulator
            </h3>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
              Verify the platform as a live user. Switch roles instantly to inspect the Driver or Owner dashboard functionality.
            </p>
          </div>
          <div className="flex gap-3">
             <button 
               onClick={() => onSimulate(UserRole.DRIVER)}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-primary/20"
             >
               <span className="material-symbols-outlined text-sm">sports_motorsports</span>
               As Driver
             </button>
             <button 
               onClick={() => onSimulate(UserRole.OWNER)}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-white/10"
             >
               <span className="material-symbols-outlined text-sm">directions_car</span>
               As Owner
             </button>
          </div>
        </div>
      </div>

      {/* Recent Activity Mini-Feed */}
      <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Live Activity Feed</h3>
          <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View All Trips</button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {trips.slice(0, 5).map(trip => (
            <div key={trip.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`size-10 rounded-2xl flex items-center justify-center ${
                  trip.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'
                }`}>
                  <span className="material-symbols-outlined text-base">trip_origin</span>
                </div>
                <div>
                   <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">{trip.location}</p>
                   <p className="text-xs text-slate-500 font-medium">Trip {trip.id.slice(0, 8)} · {formatShortDate(trip.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(trip.amount)}</p>
                <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                  trip.status === 'COMPLETED' ? 'text-green-500' : 'text-slate-500'
                }`}>
                  {trip.status}
                </div>
              </div>
            </div>
          ))}
          {trips.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-20">cloud_off</span>
              <p className="italic text-sm">No recent activity detected.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDrivers = () => (
    <div className="space-y-6 animate-slide-up">
      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit">
         {(['All', 'Pending', 'Active', 'Blocked'] as DriverFilter[]).map((filter) => (
           <button
             key={filter}
             onClick={() => setDriverFilter(filter)}
             className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
               driverFilter === filter
                 ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                 : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
             }`}
           >
             {filter}
           </button>
         ))}
      </div>

      {/* Driver List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredDrivers.map(driver => (
          <div 
            key={driver.id}
            onClick={() => setSelectedUser(driver)}
            className={`group bg-white dark:bg-surface-dark p-5 rounded-[2rem] border-2 transition-all cursor-pointer hover:shadow-xl active:scale-[0.99] ${
              driver.approvalStatus === 'PENDING' 
                ? 'border-orange-500/20 bg-orange-500/[0.02]' 
                : driver.isBlocked 
                  ? 'border-red-500/20 opacity-80' 
                  : 'border-slate-100 dark:border-slate-800'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <img src={driver.avatar} className="size-14 rounded-2xl object-cover shadow-md" alt="" />
                <div className={`absolute -top-1 -right-1 size-4 rounded-full border-2 border-white dark:border-surface-dark shadow-sm ${
                  driver.approvalStatus === 'APPROVED' ? 'bg-green-500' : driver.approvalStatus === 'PENDING' ? 'bg-orange-500 animate-pulse' : 'bg-red-500'
                }`}></div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-black text-base text-slate-900 dark:text-white truncate pr-2">
                    {driver.name}
                  </h4>
                  <div className="flex gap-1.5 shrink-0">
                    {driver.isBlocked && (
                      <span className="text-[8px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-red-500/20">Blocked</span>
                    )}
                    {driver.isOnline && (
                      <span className="text-[8px] font-black bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-green-500/20">Online</span>
                    )}
                    {driver.approvalStatus === 'PENDING' && (
                      <span className="text-[8px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">Review Required</span>
                    )}
                  </div>
                </div>
                
                <p className="text-xs text-slate-500 font-medium truncate mb-2">{driver.email}</p>
                
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg text-slate-500 font-black uppercase tracking-widest">
                    {driver.transmission || 'Manual'}
                  </span>
                  <span className="text-[9px] bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg text-slate-500 font-black uppercase tracking-widest">
                    {driver.id.slice(0, 8)}
                  </span>
                </div>
              </div>
              
              <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-primary">arrow_forward</span>
              </div>
            </div>

            {/* Payout Readiness / Monnify Status integration */}
            {driver.role === UserRole.DRIVER && (
              <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/5">
                {renderMonnifyStatus(driver)}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredDrivers.length === 0 && (
        <div className="py-20 text-center flex flex-col items-center gap-4 text-slate-400">
           <span className="material-symbols-outlined text-5xl opacity-20">person_search</span>
           <p className="font-bold text-sm">No drivers found matching "{driverFilter}"</p>
        </div>
      )}
    </div>
  );

  const renderOwners = () => (
    <div className="space-y-4 animate-slide-up">
      {owners
        .filter(o => (o.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
        .map(owner => (
          <div key={owner.id} className="group bg-white dark:bg-surface-dark p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center gap-5 transition-all hover:shadow-lg">
            <div className="relative">
              <img src={owner.avatar} className="size-14 rounded-2xl object-cover shadow-sm ring-2 ring-slate-50 dark:ring-white/5" alt="" />
              <div className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white dark:border-surface-dark ${owner.isBlocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-black text-base text-slate-900 dark:text-white truncate">
                  {owner.name}
                </h4>
                {owner.isBlocked && (
                  <span className="text-[8px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">Suspended</span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">phone_iphone</span>
                {owner.phone}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-lg">
                  <span className="material-symbols-outlined text-yellow-500 text-[12px] filled">star</span>
                  <span className="text-[10px] font-black text-yellow-600 uppercase">{owner.rating}</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg">
                  <span className="material-symbols-outlined text-slate-400 text-[12px]">directions_car</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase">{owner.trips} Trips</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => onBlockUser(owner.id, !owner.isBlocked)}
              className={`size-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                owner.isBlocked 
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                  : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
              }`}
              title={owner.isBlocked ? "Unblock Account" : "Block Account"}
            >
              <span className="material-symbols-outlined text-xl">{owner.isBlocked ? 'lock_open' : 'block'}</span>
            </button>
          </div>
        ))}
      {owners.length === 0 && (
        <div className="py-20 text-center opacity-40">
           <span className="material-symbols-outlined text-5xl mb-4">person_off</span>
           <p className="font-bold">No owners registered yet.</p>
        </div>
      )}
    </div>
  );

  const renderTrips = () => (
    <div className="space-y-4 animate-slide-up">
       {trips.map(trip => (
         <div key={trip.id} className="bg-white dark:bg-surface-dark p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-5 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
               <div className="flex items-center gap-4">
                  <div className={`size-12 rounded-2xl flex items-center justify-center ${getTripStatusClass(trip.status)}`}>
                    <span className="material-symbols-outlined">trip_origin</span>
                  </div>
                  <div>
                    <h4 className="font-black text-base text-slate-900 dark:text-white leading-tight">
                      {trip.location}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">#{trip.id.slice(0, 8)} · {trip.date}</p>
                  </div>
               </div>
               <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${getTripStatusClass(trip.status)}`}>
                 {trip.status.replace(/_/g, ' ')}
               </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5">
               <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                     <div className="size-10 rounded-2xl bg-primary/10 border-4 border-white dark:border-surface-dark flex items-center justify-center text-[10px] font-black text-primary overflow-hidden shadow-sm">
                        {trip.ownerName?.[0]}
                     </div>
                     <div className="size-10 rounded-2xl bg-indigo-500/10 border-4 border-white dark:border-surface-dark flex items-center justify-center text-[10px] font-black text-indigo-500 overflow-hidden shadow-sm">
                        {trip.driverName?.[0]}
                     </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Participants</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                      {trip.ownerName} & {trip.driverName || 'UNASSIGNED'}
                    </p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fare Value</p>
                  <p className="font-black text-lg text-slate-900 dark:text-white">{formatCurrency(trip.amount)}</p>
               </div>
            </div>
         </div>
       ))}
       {trips.length === 0 && (
         <div className="py-24 text-center opacity-30">
            <span className="material-symbols-outlined text-6xl mb-4">route_off</span>
            <p className="font-black text-sm uppercase tracking-widest">Archive Empty</p>
         </div>
       )}
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-8 animate-slide-up">
       {/* Platform Financial Summary */}
       <div className="relative overflow-hidden p-8 rounded-[3rem] bg-slate-900 shadow-2xl group">
          <div className="absolute top-0 right-0 size-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/30 transition-all"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined filled">account_balance</span>
              </div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Operational Liquidity</h3>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 opacity-80">Platform Net Commission</p>
            <h2 className="text-5xl font-black text-white tracking-tighter">{formatCurrency(platformFees)}</h2>
            <div className="flex gap-6 mt-8">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Throughput</p>
                <p className="text-xl font-black text-white">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="w-px h-10 bg-white/10"></div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Fee Rate</p>
                <p className="text-xl font-black text-primary">{settings.commission}%</p>
              </div>
            </div>
          </div>
       </div>

       {/* Settlement Model Info */}
       <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-[2.5rem] flex gap-4 items-start">
          <span className="material-symbols-outlined text-blue-500 mt-1">info</span>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">Auto-Settlement Intelligence</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bica utilizes Monnify Split Payments for real-time driver settlement. <strong>No manual payout approval is required</strong> for standard trips. Monitor this ledger for failed split attempts or dispute resolutions only.
            </p>
          </div>
       </div>

       {/* Pending Action Queue */}
       <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-orange-500 animate-pulse"></span>
              <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Monitoring Queue</h3>
            </div>
            <span className="text-[10px] font-black bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full">{pendingPayments.length} Active Issues</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingPayments.map((payment) => (
              <div key={payment.id} className="bg-white dark:bg-surface-dark border-2 border-slate-100 dark:border-slate-800 p-5 rounded-[2rem] shadow-sm hover:border-orange-500/30 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="size-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                    <span className="material-symbols-outlined">feedback</span>
                  </div>
                  <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg uppercase tracking-tight">Pending Split</span>
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white truncate mb-1">{payment.location}</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase truncate mb-4">
                  Owner: {payment.owner?.name} · Driver: {payment.driver?.name || 'Searching'}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase">{payment.date}</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                </div>
              </div>
            ))}
            {pendingPayments.length === 0 && (
              <div className="col-span-full py-12 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                 <p className="text-xs font-bold uppercase tracking-widest">No transaction issues detected</p>
              </div>
            )}
          </div>
       </section>

       {/* Archive History */}
       <section className="space-y-4">
          <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500 px-2">Settlement Archive</h3>
          <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paymentHistory.slice(0, 10).map((record) => (
                <div key={record.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {record.trip.pickupAddress.split(',')[0]} → {record.trip.destAddress.split(',')[0]}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase truncate">
                        Ref: {record.monnifyTxRef.slice(0, 12)}... · {formatShortDate(record.paidAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(record.totalAmount)}</p>
                    <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-1">Cleared</p>
                  </div>
                </div>
              ))}
              {paymentHistory.length === 0 && (
                <div className="p-16 text-center text-slate-400 italic text-sm">Historical archive is empty.</div>
              )}
            </div>
            {paymentHistory.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-white/5 text-center">
                 <button className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-primary transition-colors">Export Ledger (.csv)</button>
              </div>
            )}
          </div>
       </section>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-8 animate-slide-up pb-20">
       {/* Pricing Engine */}
       <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-primary">payments</span>
            <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Pricing Engine</h3>
          </div>
          
          <div className="bg-white dark:bg-surface-dark p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Base Fare (₦)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₦</span>
                    <input 
                      type="number" 
                      value={localSettings.baseFare}
                      onChange={(e) => setLocalSettings({...localSettings, baseFare: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/30 rounded-2xl pl-10 pr-4 py-4 font-black text-lg text-slate-900 dark:text-white transition-all outline-none"
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Distance Rate (₦ / km)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₦</span>
                    <input 
                      type="number" 
                      value={localSettings.pricePerKm}
                      onChange={(e) => setLocalSettings({...localSettings, pricePerKm: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/30 rounded-2xl pl-10 pr-4 py-4 font-black text-lg text-slate-900 dark:text-white transition-all outline-none"
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Platform Commission (%)</label>
                 <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                    <input 
                      type="number" 
                      value={localSettings.commission}
                      onChange={(e) => setLocalSettings({...localSettings, commission: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/30 rounded-2xl px-4 py-4 font-black text-lg text-slate-900 dark:text-white transition-all outline-none"
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Time Rate (₦ / min)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₦</span>
                    <input 
                      type="number" 
                      value={localSettings.timeRate}
                      onChange={(e) => setLocalSettings({...localSettings, timeRate: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/30 rounded-2xl pl-10 pr-4 py-4 font-black text-lg text-slate-900 dark:text-white transition-all outline-none"
                    />
                 </div>
              </div>
            </div>
          </div>
       </section>

       {/* Safety & Automation */}
       <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-primary">security</span>
            <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Safety & Automation</h3>
          </div>

          <div className={`p-6 rounded-[2.5rem] border-2 transition-all flex items-center justify-between shadow-sm ${
            localSettings.autoApprove 
              ? 'bg-red-500/[0.02] border-red-500/20' 
              : 'bg-white dark:bg-surface-dark border-slate-100 dark:border-slate-800'
          }`}>
             <div className="flex gap-4 items-center">
                <div className={`size-12 rounded-2xl flex items-center justify-center ${localSettings.autoApprove ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                   <span className="material-symbols-outlined">{localSettings.autoApprove ? 'warning' : 'verified_user'}</span>
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">Auto-Approve Drivers</h4>
                  <p className="text-xs text-slate-500 font-medium">Instantly approve new registrations</p>
                </div>
             </div>
             <button 
               onClick={() => setLocalSettings({...localSettings, autoApprove: !localSettings.autoApprove})}
               className={`w-14 h-8 rounded-full transition-all relative p-1 ${localSettings.autoApprove ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'}`}
             >
               <div className={`size-6 bg-white rounded-full transition-all shadow-sm ${localSettings.autoApprove ? 'ml-6' : 'ml-0'}`}></div>
             </button>
          </div>
          
          {localSettings.autoApprove && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex gap-3 items-start animate-pulse">
               <span className="material-symbols-outlined text-red-500 text-sm">error</span>
               <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest leading-relaxed">
                 Critical: Auto-approval bypasses identity verification. This increases platform liability.
               </p>
            </div>
          )}
       </section>

       <div className="pt-4">
          <button 
            onClick={handleSaveSettings}
            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
             <span className="material-symbols-outlined">save</span>
             COMMIT SYSTEM CHANGES
          </button>
       </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 shrink-0 z-20">
        <button onClick={onBack} className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="font-black text-lg uppercase tracking-tight">Admin Console</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bicadriver v1.0.4</p>
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
                activeSection === item.id 
                  ? 'text-primary bg-primary/5' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span className={`material-symbols-outlined ${activeSection === item.id ? 'filled' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 relative">
        {isLoading && users.length === 0 && trips.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 opacity-80">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">refresh</span>
            <p className="font-bold">Loading admin dashboard...</p>
          </div>
        )}

        {!isLoading && error && users.length === 0 && trips.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
            <div>
              <p className="font-bold text-red-500">Could not load admin data</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
            <button
              onClick={onRetry}
              className="px-5 py-3 rounded-xl bg-primary text-white font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {!((isLoading && users.length === 0 && trips.length === 0) || (!isLoading && error && users.length === 0 && trips.length === 0)) && (
          <>
        {/* Global Search (visible on lists) */}
        {(activeSection === 'drivers' || activeSection === 'owners') && (
           <div className="mb-6 sticky top-0 z-10">
              <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center px-4 h-12 shadow-sm">
                 <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
                 <input 
                   type="text" 
                   placeholder={`Search ${activeSection}...`}
                   className="bg-transparent border-none w-full text-sm font-medium focus:ring-0 p-0 text-slate-900 dark:text-white placeholder-slate-400"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>
           </div>
        )}

        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'drivers' && renderDrivers()}
        {activeSection === 'owners' && renderOwners()}
        {activeSection === 'trips' && renderTrips()}
        {activeSection === 'finance' && renderFinance()}
        {activeSection === 'settings' && renderSettings()}
          </>
        )}
      </main>

      {/* User Detail Modal / Dossier */}
      {selectedUser && modalUser && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-xl bg-white dark:bg-surface-dark rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined filled text-xl">folder_shared</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">User Dossier</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{modalUser.role} · {modalUser.id.slice(0, 12)}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-all text-slate-500 hover:text-slate-900 dark:hover:text-white">
                   <span className="material-symbols-outlined text-base">close</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="p-8 space-y-10">
                {/* 1. Identity & Core Profile */}
                <section>
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <img src={modalUser.avatar} className="size-24 rounded-[2.5rem] object-cover ring-4 ring-primary/10 shadow-xl" alt="" />
                      <div className={`absolute -bottom-1 -right-1 size-8 rounded-full border-4 border-white dark:border-surface-dark shadow-md flex items-center justify-center ${
                        modalUser.approvalStatus === 'APPROVED' ? 'bg-green-500' : 'bg-orange-500'
                      }`}>
                        <span className="material-symbols-outlined text-white text-[16px] filled">
                          {modalUser.approvalStatus === 'APPROVED' ? 'verified' : 'pending'}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                       <h4 className="text-3xl font-black text-slate-900 dark:text-white leading-tight truncate">
                         {modalUser.name}
                       </h4>
                       <p className="text-slate-500 font-bold text-sm mt-0.5 flex items-center gap-2">
                         <span className="material-symbols-outlined text-base">phone_iphone</span>
                         {modalUser.phone}
                       </p>
                       <div className="flex flex-wrap gap-2 mt-3">
                          <span className="bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {modalUser.email}
                          </span>
                          {modalUser.isBlocked && (
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">Blocked</span>
                          )}
                       </div>
                    </div>
                  </div>
                </section>

                {/* Status Alerts */}
                {selectedUserDetailsLoading && (
                  <div className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-4 text-xs font-black text-primary border border-primary/10 animate-pulse">
                    <span className="material-symbols-outlined text-lg animate-spin">refresh</span>
                    Synchronizing latest registration records...
                  </div>
                )}

                {/* 2. Operational & Financial Status (Drivers Only) */}
                {modalUser.role === UserRole.DRIVER && (
                  <section className="space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pl-1">Financial Consistency</h5>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800">
                      {renderMonnifyStatus(modalUser, true)}
                    </div>
                  </section>
                )}

                {/* 3. Verification Assets (Drivers Only) */}
                {modalUser.role === UserRole.DRIVER && (
                  <section className="space-y-6">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pl-1">Compliance Documents</h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Selfie */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Verification Selfie</p>
                        <div className="aspect-square bg-slate-100 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden relative group">
                          {modalUser.selfieImage ? (
                            <>
                              <img src={modalUser.selfieImage} alt="Selfie" className="size-full object-cover group-hover:scale-105 transition-transform" />
                              <a href={modalUser.selfieImage} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">
                                Full View
                              </a>
                            </>
                          ) : (
                            <div className="size-full flex flex-col items-center justify-center text-slate-400 gap-2">
                              <span className="material-symbols-outlined">face_retouching_off</span>
                              <span className="text-[10px] font-black uppercase">Missing</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* License */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Driver's License</p>
                        <div className="aspect-square bg-slate-100 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden relative group shadow-sm transition-all hover:shadow-md">
                          {modalUser.licenseImage ? (
                            <>
                              <img src={modalUser.licenseImage} alt="License" className="size-full object-cover group-hover:scale-105 transition-transform" />
                              <a href={modalUser.licenseImage} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">
                                Expand
                              </a>
                            </>
                          ) : (
                            <div className="size-full flex flex-col items-center justify-center text-slate-400 gap-2">
                              <span className="material-symbols-outlined">document_scanner</span>
                              <span className="text-[10px] font-black uppercase">Missing</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* NIN */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">NIN ID</p>
                        <div className="aspect-square bg-slate-100 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden relative group">
                          {modalUser.ninImage ? (
                            <>
                              <img src={modalUser.ninImage} alt="NIN" className="size-full object-cover group-hover:scale-105 transition-transform" />
                              <a href={modalUser.ninImage} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">
                                Expand
                              </a>
                            </>
                          ) : (
                            <div className="size-full flex flex-col items-center justify-center text-slate-400 gap-2">
                              <span className="material-symbols-outlined">badge</span>
                              <span className="text-[10px] font-black uppercase">Missing</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* 4. Details Grid (Role Agnostic) */}
                <section className="space-y-4">
                   <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pl-1">Demographics & Profile</h5>
                   <div className="grid grid-cols-2 gap-4">
                      {/* NIN Text */}
                      <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">NIN Reference</p>
                         <p className="font-mono font-black text-sm text-slate-900 dark:text-white truncate">{modalUser.nin || 'Unspecified'}</p>
                      </div>
                      {/* Age */}
                      <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Declared Age</p>
                         <p className="font-black text-sm text-slate-900 dark:text-white">{modalUser.age || 'Not Disclosed'}</p>
                      </div>
                      {/* Member Since */}
                      <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Registration Date</p>
                         <p className="font-black text-sm text-slate-900 dark:text-white truncate">{formatJoinedDate(modalUser.createdAt)}</p>
                      </div>
                      {/* Rating/Trip Volume */}
                      <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Operational Tier</p>
                         <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-yellow-500 text-sm filled">star</span>
                            <p className="font-black text-sm text-slate-900 dark:text-white">{modalUser.rating || 'N/A'}</p>
                            <span className="text-[10px] text-slate-500 font-bold ml-1">({modalUser.trips || 0} trips)</span>
                         </div>
                      </div>
                   </div>
                </section>

                {/* 5. Vehicle Specifications (Owners Only) */}
                {modalUser.role === UserRole.OWNER && (
                  <section className="space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pl-1">Vehicle Fleet Detail</h5>
                    <div className="bg-primary/5 p-6 rounded-[2.5rem] border border-primary/10 text-primary">
                       <div className="flex items-center gap-4 mb-6">
                         <div className="size-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
                           <span className="material-symbols-outlined text-3xl">directions_car</span>
                         </div>
                         <div>
                            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                              {modalUser.carYear} {modalUser.carModel}
                            </p>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{modalUser.carType}</span>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fleet Status</p>
                            <p className="font-black text-slate-900 dark:text-white text-xs">Operational</p>
                          </div>
                          <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Commission</p>
                            <p className="font-black text-slate-900 dark:text-white text-xs">Standard Tier</p>
                          </div>
                       </div>
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div className="p-8 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-slate-800 shrink-0">
               <div className="flex flex-col gap-3">
                  {modalUser.role === UserRole.DRIVER && modalUser.approvalStatus === 'PENDING' && !modalUser.isBlocked && (
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => {
                          onUpdateStatus(modalUser.id, 'APPROVED');
                          setSelectedUser(null);
                        }}
                        disabled={!modalUser.subAccountActive}
                        className={`w-full font-black py-5 rounded-[1.5rem] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                          !modalUser.subAccountActive 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                            : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xl">verified_user</span>
                        APPROVE REGISTRATION
                      </button>
                      {!modalUser.subAccountActive && (
                        <div className="flex items-center justify-center gap-1.5 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                          <span className="material-symbols-outlined text-orange-500 text-sm">info</span>
                          <p className="text-[10px] text-orange-600 dark:text-orange-400 font-black uppercase tracking-widest">
                            Configure Sub-Account Before Approval
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        onBlockUser(modalUser.id, !modalUser.isBlocked);
                        setSelectedUser(null);
                      }}
                      className={`flex-1 font-black py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border-2 ${
                        modalUser.isBlocked 
                          ? 'border-green-500 text-green-600 hover:bg-green-500/5' 
                          : 'border-red-500/20 text-red-500 hover:bg-red-500/5'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">{modalUser.isBlocked ? 'lock_open' : 'block'}</span>
                      {modalUser.isBlocked ? 'RESTORE ACCESS' : 'SUSPEND USER'}
                    </button>
                    <button 
                      onClick={() => setSelectedUser(null)}
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                      CLOSE DOSSIER
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardScreen;
