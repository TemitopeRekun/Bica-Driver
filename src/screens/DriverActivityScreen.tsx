import React, { useEffect, useState } from 'react';
import { mapTrip, mapPaymentHistory } from '@/mappers/appMappers';
import { api, PaginatedResponse, PaginationMeta } from '@/services/api.service';
import { DriverActivityTab, PaymentHistoryRecord, Trip, WalletSummary, SummaryPeriod, DriverPaymentsSummaryResponse, SettlementStatusFilter, DateRangeFilter } from '@/types';
import { Skeleton, CardSkeleton } from '@/components/Common/Skeleton';
import { InlineError } from '@/components/Common/InlineError';
import { useUIStore } from '@/stores/uiStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface DriverActivityScreenProps {
  initialTab: DriverActivityTab;
  onBack: () => void;
  onForcedLogout: (message?: string) => void;
}

const ACTIVITY_THEME = {
  trips: {
    label: 'Trips',
    icon: 'route',
    activeTab:
      'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-500 text-white shadow-lg shadow-sky-500/25',
    inactiveTab:
      'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white',
    hero:
      'border-sky-200/70 bg-gradient-to-br from-white via-sky-50/90 to-indigo-50/80 dark:border-sky-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-sky-950/30 dark:to-indigo-950/20',
    card:
      'border-sky-200/70 bg-gradient-to-br from-white via-sky-50/90 to-indigo-50/80 shadow-lg shadow-sky-900/5 dark:border-sky-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-sky-950/30 dark:to-indigo-950/20',
    iconSurface: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    metricSurface: 'border-white/70 bg-white/75 dark:border-white/5 dark:bg-black/20',
    accentText: 'text-sky-600 dark:text-sky-400',
    glow: 'from-sky-400/25 via-blue-500/12 to-transparent',
  },
  settlements: {
    label: 'Settlements',
    icon: 'account_balance_wallet',
    activeTab:
      'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25',
    inactiveTab:
      'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white',
    hero:
      'border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/90 to-teal-50/80 dark:border-emerald-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-emerald-950/30 dark:to-teal-950/20',
    card:
      'border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/90 to-teal-50/80 shadow-lg shadow-emerald-900/5 dark:border-emerald-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-emerald-950/30 dark:to-teal-950/20',
    iconSurface: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    metricSurface: 'border-white/70 bg-white/75 dark:border-white/5 dark:bg-black/20',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    glow: 'from-emerald-400/25 via-teal-500/12 to-transparent',
  },
} as const;

const DriverActivityScreen: React.FC<DriverActivityScreenProps> = ({
  initialTab,
  onBack,
  onForcedLogout,
}) => {
  const [activeTab, setActiveTab] = useState<DriverActivityTab>(initialTab);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsMeta, setTripsMeta] = useState<PaginationMeta | null>(null);
  const [settlements, setSettlements] = useState<PaymentHistoryRecord[]>([]);
  const [settlementsMeta, setSettlementsMeta] = useState<PaginationMeta | null>(null);
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [period, setPeriod] = useState<SummaryPeriod>('weekly');
  const [driverSummary, setDriverSummary] = useState<DriverPaymentsSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [settlementStatusFilter, setSettlementStatusFilter] = useState<SettlementStatusFilter>('ALL');
  const [pendingDateRange, setPendingDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [settlementDateRange, setSettlementDateRange] = useState<{ from: string; to: string } | null>(null);
  const [expandedSettlementId, setExpandedSettlementId] = useState<string | null>(null);
  const { setSupportOpen, setSupportContext } = useUIStore();

  const handleReportTripIssue = (trip: Trip) => {
    setSupportContext({
      tripId: trip.id,
      tripStatus: trip.status,
      paymentStatus: trip.paymentStatus ?? undefined,
      recentFailureContext: `Wallet Balance: ₦${walletSummary?.currentBalance.toLocaleString() || '---'}. Sub-account Active: ${walletSummary?.subAccountActive ?? 'Unknown'}`,
      openedAt: new Date().toISOString()
    });
    setSupportOpen(true);
  };

  const handleReportSettlementIssue = (settlement: PaymentHistoryRecord) => {
    setSupportContext({
      tripId: settlement.tripId,
      paymentStatus: 'PAID',
      recentFailureContext: `Reporting settlement ${settlement.id}. Wallet Balance: ₦${walletSummary?.currentBalance.toLocaleString() || '---'}.`,
      openedAt: new Date().toISOString()
    });
    setSupportOpen(true);
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadWalletSummary = async () => {
    try {
      const summary = await api.get<WalletSummary>('/wallet/summary');
      setWalletSummary(summary);
      return summary;
    } catch (e) {
      console.warn('Failed to load wallet summary', e);
      throw e;
    }
  };

  const loadActivity = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [tripsResult, settlementsResult, walletResult] = await Promise.allSettled([
        api.get<PaginatedResponse<any>>('/rides/history?limit=20'),
        api.getPaginatedResponse<PaymentHistoryRecord>('/payments/history?limit=20'),
        loadWalletSummary(),
      ]);

      if (tripsResult.status === 'fulfilled') {
        setTrips(tripsResult.value?.items?.map(mapTrip) || []);
        setTripsMeta(tripsResult.value?.meta || null);
      } else {
        setTrips([]);
        setTripsMeta(null);
      }

      if (settlementsResult.status === 'fulfilled') {
        setSettlements(settlementsResult.value?.items || []);
        setSettlementsMeta(settlementsResult.value?.meta || null);
      } else {
        setSettlements([]);
        setSettlementsMeta(null);
      }

      if (walletResult.status === 'fulfilled') {
        setWalletSummary(walletResult.value || null);
      } else {
        setWalletSummary(null);
      }

      const failedSections = [
        tripsResult.status === 'rejected' ? 'trips' : null,
        settlementsResult.status === 'rejected' ? 'settlements' : null,
        walletResult.status === 'rejected' ? 'wallet summary' : null,
      ].filter(Boolean);

      if (failedSections.length > 0) {
        setError(`Could not load ${failedSections.join(' and ')} right now.`);
        
        const authError = [tripsResult, settlementsResult, walletResult].find(
          (res) => res.status === 'rejected' && (res.reason?.message?.includes('401') || res.reason?.message?.includes('403'))
        );
        if (authError && authError.status === 'rejected') {
          onForcedLogout?.(authError.reason?.message);
        }
      }
    } catch (e) {
      setError('An unexpected error occurred while loading activity.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTripsPage = async (page: number) => {
    setIsLoading(true);
    try {
      const result = await api.get<PaginatedResponse<any>>('/rides/history?page=${page}&limit=20');
      setTrips(result?.items?.map(mapTrip) || []);
      setTripsMeta(result?.meta || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load page');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettlementsPage = async (page: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (settlementStatusFilter !== 'ALL') params.set('status', settlementStatusFilter);
      if (settlementDateRange) {
        if (settlementDateRange.from) params.set('from', settlementDateRange.from);
        if (settlementDateRange.to) params.set('to', settlementDateRange.to);
      }
      const result = await api.getPaginatedResponse<PaymentHistoryRecord>(
        `payments/history?${params}`
      );
      setSettlements(result?.items.map(mapPaymentHistory) || []);
      setSettlementsMeta(result?.meta || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load page');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only auto-load on page change or status filter change. Date range requires explicit "Apply".
    loadSettlementsPage(0);
  }, [settlementStatusFilter, settlementDateRange]);

  useEffect(() => {
    loadActivity().catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async () => {
      setSummaryLoading(true);
      try {
        const data = await api.getPaymentsSummary({ period });
        if (!cancelled && data.role === 'DRIVER') {
          setDriverSummary(data);
        }
      } catch {
        // Non-fatal: leave existing summary in place; do not setError
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };
    fetchSummary();
    return () => { cancelled = true; };
  }, [period]);

  const { isRefreshing, pullHandlers } = usePullToRefresh(async () => {
    await loadActivity();
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);

  const formatDate = (value?: string | null) => {
    if (!value) return 'Just now';
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTripTitle = (trip: Trip) =>
    trip.location ||
    `${trip.pickupAddress?.split(',')[0] || 'Unknown'} → ${trip.destAddress?.split(',')[0] || 'Unknown'}`;

  const getStatusClassName = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'PAID':
        return 'bg-green-500/12 text-green-700 dark:text-green-300';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
      case 'PENDING':
      case 'PENDING_ACCEPTANCE':
        return 'bg-amber-500/12 text-amber-700 dark:text-amber-300';
      case 'FAILED':
      case 'CANCELLED':
      case 'DECLINED':
        return 'bg-red-500/12 text-red-700 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const renderEmptyState = (tab: DriverActivityTab) => {
    const theme = ACTIVITY_THEME[tab];
    return (
      <div className={`relative overflow-hidden rounded-[2.5rem] border p-12 text-center ${theme.card}`}>
        <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${theme.glow} pointer-events-none`} />
        <div className={`mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl ${theme.iconSurface}`}>
          <span className="material-symbols-outlined text-3xl">{theme.icon}</span>
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
          {tab === 'trips' ? 'No trips yet' : 'No settlements yet'}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-[240px] mx-auto font-medium">
          {tab === 'trips'
            ? 'Completed ride history will show up here once owners start booking you.'
            : 'Confirmed payouts will appear here as soon as payments are settled.'}
        </p>
      </div>
    );
  };

  const renderTripList = () => {
    if (isLoading && trips.length === 0) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      );
    }
    if (trips.length === 0) return renderEmptyState('trips');
    return (
      <div className="space-y-4">
        {tripsMeta && tripsMeta.totalPages > 1 && (
          <div className="flex items-center justify-between mb-4 bg-white/40 dark:bg-white/5 p-2 rounded-2xl border border-sky-100 dark:border-sky-500/20">
            <button 
              disabled={tripsMeta.page === 0}
              onClick={() => loadTripsPage(tripsMeta.page - 1)}
              className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-600 disabled:opacity-30 shadow-sm"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
              Page {tripsMeta.page + 1} of {tripsMeta.totalPages}
            </span>
            <button 
              disabled={tripsMeta.page >= tripsMeta.totalPages - 1}
              onClick={() => loadTripsPage(tripsMeta.page + 1)}
              className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-600 disabled:opacity-30 shadow-sm"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        )}
        {trips.map((trip) => (
          <div key={trip.id} className={`relative overflow-hidden rounded-[2rem] border p-5 ${ACTIVITY_THEME.trips.card}`}>
            <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${ACTIVITY_THEME.trips.glow} pointer-events-none`} />
            <div className="relative mb-5 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-4">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${ACTIVITY_THEME.trips.iconSurface}`}>
                  <span className="material-symbols-outlined">route</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">{getTripTitle(trip)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-widest">{formatDate(trip.createdAt || trip.date)}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${getStatusClassName(trip.status)}`}>
                {trip.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Owner</p>
                <p className="mt-1 font-black text-sm text-slate-800 dark:text-slate-100 truncate">{trip.ownerName || trip.owner?.name || 'Pending'}</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Earnings</p>
                <p className={`mt-1 font-black text-sm ${ACTIVITY_THEME.trips.accentText}`}>{formatCurrency(trip.driverEarnings ?? trip.amount ?? 0)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
               <button 
                 onClick={() => handleReportTripIssue(trip)}
                 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-primary transition-colors"
               >
                 <span className="material-symbols-outlined text-sm">flag</span>
                 Report Issue
               </button>
               <span className="text-[10px] font-mono text-slate-400">ID: {trip.id.slice(0, 8)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSettlementList = () => {
    if (isLoading && settlements.length === 0) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      );
    }
    if (settlements.length === 0) return renderEmptyState('settlements');
    return (
      <div className="space-y-4">
        {settlementsMeta && settlementsMeta.totalPages > 1 && (
          <div className="flex items-center justify-between mb-4 bg-white/40 dark:bg-white/5 p-2 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
            <button 
              disabled={settlementsMeta.page === 0}
              onClick={() => loadSettlementsPage(settlementsMeta.page - 1)}
              className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-600 disabled:opacity-30 shadow-sm"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
              Page {settlementsMeta.page + 1} of {settlementsMeta.totalPages}
            </span>
            <button 
              disabled={settlementsMeta.page >= settlementsMeta.totalPages - 1}
              onClick={() => loadSettlementsPage(settlementsMeta.page + 1)}
              className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-600 disabled:opacity-30 shadow-sm"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        )}
        {settlements.map((settlement) => (
          <div key={settlement.id} className={`relative overflow-hidden rounded-[2rem] border p-5 ${ACTIVITY_THEME.settlements.card}`}>
            <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${ACTIVITY_THEME.settlements.glow} pointer-events-none`} />
            <div 
              className="relative mb-5 flex items-start justify-between gap-3 cursor-pointer"
              onClick={() => setExpandedSettlementId(expandedSettlementId === settlement.id ? null : settlement.id)}
            >
              <div className="flex min-w-0 items-start gap-4">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${ACTIVITY_THEME.settlements.iconSurface}`}>
                  <span className="material-symbols-outlined">receipt_long</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {settlement.trip.pickupAddress.split(',')[0]} → {settlement.trip.destAddress.split(',')[0]}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-widest">{formatDate(settlement.paidAt || settlement.createdAt)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${getStatusClassName('PAID')}`}>
                  Settled
                </span>
                <span className="material-symbols-outlined text-slate-400 text-sm">
                  {expandedSettlementId === settlement.id ? 'expand_less' : 'expand_more'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.settlements.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Owner</p>
                <p className="mt-1 font-black text-sm text-slate-800 dark:text-slate-100 truncate">{settlement.trip.owner.name || 'Unavailable'}</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.settlements.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Share</p>
                <p className={`mt-1 font-black text-sm ${ACTIVITY_THEME.settlements.accentText}`}>{formatCurrency(settlement.driverAmount)}</p>
              </div>
            </div>

            {expandedSettlementId === settlement.id && (
              <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trip ID</span>
                    <span className="text-xs font-mono font-black text-slate-900 dark:text-white">#{settlement.tripId.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white text-right">{settlement.trip.pickupAddress} → {settlement.trip.destAddress}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trip Date</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{formatDate(settlement.paidAt || settlement.createdAt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Fare</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(settlement.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver Earnings</span>
                    <span className="text-xs font-black text-emerald-500">{formatCurrency(settlement.driverAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Cut</span>
                    <span className="text-xs font-black text-slate-600 dark:text-slate-400">{formatCurrency(settlement.platformAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{settlement.paymentMethod || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tx Ref</span>
                    <span className="text-xs font-mono font-bold text-slate-500 truncate ml-4">{settlement.monnifyTxRef || '—'}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleReportSettlementIssue(settlement)}
                  className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:border-primary transition-all"
                >
                  <span className="material-symbols-outlined text-sm">help_outline</span>
                  Dispute Settlement
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const activeTheme = ACTIVITY_THEME[activeTab];

  return (
    <div 
      {...pullHandlers}
      className="relative h-screen flex flex-col bg-background-light text-slate-900 dark:bg-background-dark dark:text-white font-display overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-500/10 via-emerald-500/8 to-transparent" />
      
      {/* Pull-to-refresh spinner overlay */}
      <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
        <div className={`transition-all duration-300 transform ${isRefreshing ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
          <div className="size-10 rounded-full bg-primary shadow-xl flex items-center justify-center border-4 border-white/20">
            <span className="material-symbols-outlined text-white animate-spin">refresh</span>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-background-light/88 backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/88">
        <div className="mx-auto flex max-w-md items-center gap-4 p-4">
          <button onClick={onBack} className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 active:scale-90 dark:bg-white/5 dark:text-slate-200">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black italic uppercase tracking-tighter">Driver Activity</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">History & Settlements</p>
          </div>
          <button onClick={() => loadActivity()} className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 active:scale-90 dark:bg-white/5 dark:text-slate-200">
            <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative">
        <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-6">
          <div className={`relative overflow-hidden rounded-[2.5rem] p-6 shadow-2xl shadow-black/5 border ${activeTheme.hero}`}>
            <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${activeTheme.glow} pointer-events-none`} />
            <div className="relative flex items-start gap-5">
              <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-lg ${activeTheme.iconSurface}`}>
                <span className="material-symbols-outlined text-2xl">{activeTheme.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Financial Overview</p>
                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
                  {activeTab === 'trips' ? 'Performance history' : 'Earnings Dashboard'}
                </h2>
              </div>
            </div>
            <div className="relative mt-6 grid grid-cols-3 gap-3">
              <div className={`rounded-2xl border p-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Total Rides</p>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{walletSummary?.totalTrips ?? 0}</p>
              </div>
              <div className={`rounded-2xl border p-3 ${ACTIVITY_THEME.settlements.metricSurface}`}>
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Lifetime</p>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{formatCurrency(walletSummary?.totalEarned ?? 0)}</p>
              </div>
              <div className={`rounded-2xl border p-3 ${ACTIVITY_THEME.settlements.metricSurface}`}>
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Current</p>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{formatCurrency(walletSummary?.currentBalance ?? 0)}</p>
              </div>
            </div>
          </div>

          {activeTab === 'settlements' && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <div className="flex gap-2 p-1 bg-white/40 dark:bg-white/5 rounded-2xl w-fit border border-emerald-100 dark:border-emerald-500/10">
                {(['daily', 'weekly', 'monthly'] as SummaryPeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      period === p
                        ? 'bg-emerald-500 text-white shadow'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className={`rounded-2xl border px-3 py-3.5 ${ACTIVITY_THEME.settlements.metricSurface}`}>
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Period Earnings</p>
                  {summaryLoading ? (
                    <div className="mt-1 h-7 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
                  ) : (
                    <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                      {formatCurrency(driverSummary?.totals.driverEarnings ?? 0)}
                    </p>
                  )}
                </div>
                <div className={`rounded-2xl border px-3 py-3.5 ${ACTIVITY_THEME.settlements.metricSurface}`}>
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Cleared Trips</p>
                  {summaryLoading ? (
                    <div className="mt-1 h-7 w-16 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
                  ) : (
                    <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                      {driverSummary?.totals.clearedTrips ?? 0}
                    </p>
                  )}
                </div>
              </div>

              {driverSummary?.buckets && driverSummary.buckets.length > 0 && (
                <div className="mt-3 rounded-2xl border border-white/70 bg-white/75 dark:border-white/5 dark:bg-black/20 overflow-hidden">
                  {driverSummary.buckets.map((bucket) => (
                    <div
                      key={bucket.label}
                      className="flex items-center justify-between px-4 py-3 border-b border-slate-100/80 dark:border-slate-800 last:border-none"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {bucket.label}
                      </span>
                      <div className="flex items-center gap-4 text-right">
                        <span className="text-[10px] text-slate-400 font-bold">{bucket.clearedTrips} trips</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {formatCurrency(bucket.driverEarnings)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Wallet Clarity Card */}
          <div className="bg-primary/5 border border-primary/10 rounded-3xl p-5 flex gap-4 items-start animate-fade-in shadow-sm shadow-primary/5">
             <div className="size-10 shrink-0 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">account_balance</span>
             </div>
             <div>
                <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">Autonomous Settlement Policy</h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                  Your current balance tracks cleared earnings for the active period. BICA settles funds <strong>directly to your bank account</strong> via Monnify split-payments. No manual withdrawal is required.
                </p>
             </div>
          </div>

          {activeTab === 'settlements' && (
            <div className="flex flex-col gap-4 p-5 rounded-[2rem] bg-white/40 dark:bg-white/5 border border-emerald-100 dark:border-emerald-500/10 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-black/20 rounded-xl">
                  {(['ALL', 'PAID', 'FAILED'] as SettlementStatusFilter[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setSettlementStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        settlementStatusFilter === status
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setSettlementStatusFilter('ALL');
                    setPendingDateRange({ from: '', to: '' });
                    setSettlementDateRange(null);
                    // Reset back to walletSummary.recentPayments
                    if (walletSummary?.recentPayments) {
                      setSettlements(walletSummary.recentPayments.map(mapPaymentHistory));
                    } else {
                      loadSettlementsPage(0);
                    }
                  }}
                  className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:underline"
                >
                  Clear Filters
                </button>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">From</p>
                    <input
                      type="date"
                      value={pendingDateRange.from}
                      onChange={(e) => setPendingDateRange({ ...pendingDateRange, from: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">To</p>
                    <input
                      type="date"
                      value={pendingDateRange.to}
                      onChange={(e) => setPendingDateRange({ ...pendingDateRange, to: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setSettlementDateRange({ ...pendingDateRange })}
                  className="px-4 h-9 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-white/5">
            <button onClick={() => setActiveTab('trips')} className={`rounded-xl py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'trips' ? ACTIVITY_THEME.trips.activeTab : ACTIVITY_THEME.trips.inactiveTab}`}>History</button>
            <button onClick={() => setActiveTab('settlements')} className={`rounded-xl py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'settlements' ? ACTIVITY_THEME.settlements.activeTab : ACTIVITY_THEME.settlements.inactiveTab}`}>Ledger</button>
          </div>

          {error ? (
             <InlineError message={error} onRetry={loadActivity} />
          ) : activeTab === 'trips' ? (
            <>
              {renderTripList()}
              <button 
                 onClick={() => {
                   setSupportContext({ openedAt: new Date().toISOString() });
                   setSupportOpen(true);
                 }}
                 className="mt-4 w-full flex items-center justify-center gap-3 p-5 rounded-3xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 group shadow-sm active:scale-[0.98] transition-all"
              >
                 <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <span className="material-symbols-outlined">live_help</span>
                 </div>
                 <div className="flex-1 text-left">
                    <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest italic">Help & Support</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Need help with trips?</p>
                 </div>
                 <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </button>
            </>
          ) : (
            renderSettlementList()
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverActivityScreen;
