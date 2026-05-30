import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { mapTrip } from '@/mappers/appMappers';
import { api, PaginatedResponse, PaginationMeta } from '@/services/api.service';
import { OwnerActivityTab, PaymentHistoryRecord, Trip } from '@/types';
import { Skeleton, CardSkeleton } from '@/components/Common/Skeleton';
import { InlineError } from '@/components/Common/InlineError';
import { useAuthStore } from '@/stores/authStore';
import { useRideStore } from '@/stores/rideStore';
import { useUIStore } from '@/stores/uiStore';
import { useRideManager } from '@/hooks/useRideManager';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface OwnerActivityScreenProps {
  initialTab: OwnerActivityTab;
  onBack: () => void;
}

const formatCurrency = (value: number) => `NGN ${value.toLocaleString('en-NG')}`;

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
  `${trip.pickupAddress?.split(',')[0] || 'Unknown'} -> ${trip.destAddress?.split(',')[0] || 'Unknown'}`;

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

const ACTIVITY_THEME = {
  trips: {
    label: 'Trips',
    icon: 'route',
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
    accentText: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    glow: 'from-emerald-500/20 via-teal-500/12 to-transparent',
  },
  payments: {
    label: 'Payments',
    icon: 'payments',
    activeTab:
      'bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25',
    inactiveTab:
      'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white',
    hero:
      'border-amber-200/70 bg-gradient-to-br from-white via-amber-50/90 to-orange-50/80 dark:border-amber-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-amber-950/25 dark:to-orange-950/20',
    card:
      'border-amber-200/70 bg-gradient-to-br from-white via-amber-50/90 to-orange-50/80 shadow-lg shadow-orange-900/5 dark:border-amber-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-amber-950/25 dark:to-orange-950/20',
    iconSurface: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    metricSurface: 'border-white/70 bg-white/75 dark:border-white/5 dark:bg-black/20',
    accentText: 'text-orange-700 dark:text-amber-300',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    glow: 'from-amber-400/25 via-orange-500/12 to-transparent',
  },
} as const;

const OwnerActivityScreen: React.FC<OwnerActivityScreenProps> = ({
  initialTab,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<OwnerActivityTab>(initialTab);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsMeta, setTripsMeta] = useState<PaginationMeta | null>(null);
  const [payments, setPayments] = useState<PaymentHistoryRecord[]>([]);
  const [paymentsMeta, setPaymentsMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { setSupportOpen, setSupportContext } = useUIStore();

  const handleReportPaymentIssue = useCallback((payment: PaymentHistoryRecord) => {
    setSupportContext({
      tripId: payment.tripId,
      paymentStatus: 'PAID',
      openedAt: new Date().toISOString()
    });
    setSupportOpen(true);
  }, [setSupportContext, setSupportOpen]);

  const loadActivity = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [tripsResult, paymentsResult] = await Promise.allSettled([
        api.get<PaginatedResponse<any>>('/rides/history?limit=20'),
        api.get<PaginatedResponse<PaymentHistoryRecord>>('/payments/history?limit=20'),
      ]);

      if (tripsResult.status === 'fulfilled') {
        const items = tripsResult.value?.items || [];
        setTrips(items.map(mapTrip));
        setTripsMeta(tripsResult.value?.meta || null);
      } else {
        setTrips([]);
        setTripsMeta(null);
      }

      if (paymentsResult.status === 'fulfilled') {
        setPayments(paymentsResult.value?.items || []);
        setPaymentsMeta(paymentsResult.value?.meta || null);
      } else {
        setPayments([]);
        setPaymentsMeta(null);
      }

      const failedSections = [
        tripsResult.status === 'rejected' ? 'trips' : null,
        paymentsResult.status === 'rejected' ? 'payments' : null,
      ].filter(Boolean);

      if (failedSections.length > 0) {
        setError(`Could not load ${failedSections.join(' and ')} right now.`);
      }
    } catch (e) {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { isRefreshing, pullHandlers } = usePullToRefresh(async () => {
    await loadActivity();
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadTripsPage = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      const result = await api.get<PaginatedResponse<any>>(`/rides/history?page=${page}&limit=20`);
      setTrips(result?.items?.map(mapTrip) || []);
      setTripsMeta(result?.meta || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load page');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPaymentsPage = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      const result = await api.get<PaginatedResponse<any>>(`/payments/history?page=${page}&limit=20`);
      setPayments(result?.items || []);
      setPaymentsMeta(result?.meta || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load page');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renderEmptyState = (tab: OwnerActivityTab) => {
    const theme = ACTIVITY_THEME[tab];
    const isTripTab = tab === 'trips';

    return (
      <div className={`relative overflow-hidden rounded-[2.5rem] border p-12 text-center ${theme.card}`}>
        <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${theme.glow} pointer-events-none`} />
        <div className={`mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl ${theme.iconSurface}`}>
          <span className="material-symbols-outlined text-3xl">{theme.icon}</span>
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
          {isTripTab ? 'No trips yet' : 'No payments yet'}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-[240px] mx-auto font-medium">
          {isTripTab
            ? 'Your ride history will appear here once you start booking trips.'
            : 'Completed trip payments will be listed here when they are confirmed.'}
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
          <div className="flex items-center justify-between mb-4 bg-white/40 dark:bg-white/5 p-2 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
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
          <div
            key={trip.id}
            className={`relative overflow-hidden rounded-[2rem] border p-5 ${ACTIVITY_THEME.trips.card}`}
          >
            {/* Payment Status Mapping for Banner support */}
            {(() => {
              const bannerStatus = trip.paymentStatus === 'PAID' ? 'confirmed'
                : trip.paymentStatus === 'FAILED' ? 'failed'
                : trip.paymentStatus === 'CANCELLED' ? 'cancelled'
                : 'unpaid';
              // Not rendering banner yet, but mapping is now ready/audited
              return null;
            })()}
            <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${ACTIVITY_THEME.trips.glow} pointer-events-none`} />
            <div className="relative mb-5 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-4">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${ACTIVITY_THEME.trips.iconSurface}`}>
                  <span className="material-symbols-outlined">route</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900 dark:text-white uppercase tracking-tight italic">{getTripTitle(trip)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-widest italic">{formatDate(trip.createdAt || trip.date)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                 <span className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${getStatusClassName(trip.status)}`}>
                   {trip.status.replace(/_/g, ' ')}
                 </span>
                 {trip.paymentStatus === 'PAID' && (
                    <span className="bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-lg flex items-center gap-1">
                       <span className="material-symbols-outlined text-[10px]">verified</span>
                       Confirmed
                    </span>
                 )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Driver</p>
                <p className="mt-1 font-black text-sm text-slate-800 dark:text-slate-100 truncate">{trip.driverName || 'Pending'}</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Fare</p>
                <p className={`mt-1 font-black text-sm ${ACTIVITY_THEME.trips.accentText}`}>{formatCurrency(trip.amount || 0)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPaymentList = () => {
    if (isLoading && payments.length === 0) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      );
    }
    if (payments.length === 0) return renderEmptyState('payments');

    return (
      <div className="space-y-4">
        {paymentsMeta && paymentsMeta.totalPages > 1 && (
          <div className="flex items-center justify-between mb-4 bg-white/40 dark:bg-white/5 p-2 rounded-2xl border border-amber-100 dark:border-amber-500/20">
            <button 
              disabled={paymentsMeta.page === 0}
              onClick={() => loadPaymentsPage(paymentsMeta.page - 1)}
              className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-600 disabled:opacity-30 shadow-sm"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
              Page {paymentsMeta.page + 1} of {paymentsMeta.totalPages}
            </span>
            <button 
              disabled={paymentsMeta.page >= paymentsMeta.totalPages - 1}
              onClick={() => loadPaymentsPage(paymentsMeta.page + 1)}
              className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-600 disabled:opacity-30 shadow-sm"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        )}

        {payments.map((payment) => (
          <div
            key={payment.id}
            className={`relative overflow-hidden rounded-[2rem] border p-5 ${ACTIVITY_THEME.payments.card}`}
          >
            <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${ACTIVITY_THEME.payments.glow} pointer-events-none`} />
            <div className="relative mb-5 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-4">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${ACTIVITY_THEME.payments.iconSurface}`}>
                  <span className="material-symbols-outlined">receipt_long</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                    {payment.trip.pickupAddress.split(',')[0]} → {payment.trip.destAddress.split(',')[0]}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-widest italic">
                    {formatDate(payment.paidAt || payment.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                 <span className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${getStatusClassName('PAID')}`}>
                   Cleared
                 </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.payments.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Merchant</p>
                <p className="mt-1 font-black text-sm text-slate-800 dark:text-slate-100 truncate">BicaDriver · Monnify</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.payments.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Paid</p>
                <p className={`mt-1 font-black text-sm ${ACTIVITY_THEME.payments.accentText}`}>{formatCurrency(payment.totalAmount)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px]">
              <span className={`rounded-lg px-2.5 py-1.5 font-black uppercase tracking-widest ${ACTIVITY_THEME.payments.badge}`}>
                {payment.paymentMethod || 'SECURE CHECKOUT'}
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono font-black text-slate-500 dark:bg-white/5 dark:text-slate-400">
                REF: {payment.monnifyTxRef?.slice(-12) || 'N/A'}
              </span>
              <button 
                 onClick={() => handleReportPaymentIssue(payment)}
                 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-orange-500 transition-colors ml-auto"
              >
                 <span className="material-symbols-outlined text-sm">flag</span>
                 Report Issue
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const totalSpent = useMemo(
    () => payments.reduce((acc, curr) => acc + curr.totalAmount, 0),
    [payments]
  );

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
            <h1 className="text-lg font-black italic uppercase tracking-tighter">Owner Activity</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">History & Payments</p>
          </div>
          <button onClick={() => loadActivity()} className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 active:scale-90 dark:bg-white/5 dark:text-slate-200">
            <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative">
        <div className="relative mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-6">
          <div className={`relative overflow-hidden rounded-[2.5rem] p-6 shadow-2xl shadow-black/5 border ${activeTheme.hero}`}>
            <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${activeTheme.glow} pointer-events-none`} />
            <div className="relative flex items-start gap-5">
              <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-lg ${activeTheme.iconSurface}`}>
                <span className="material-symbols-outlined text-2xl">{activeTheme.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Engagement History</p>
                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight italic">
                  {activeTab === 'trips' ? 'Track your ride records' : 'Verified settlement ledger'}
                </h2>
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-2 gap-4">
              <div className={`rounded-2xl border p-4 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Trips</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">{trips.length}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${ACTIVITY_THEME.payments.metricSurface}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Spent</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">
                   ₦{totalSpent.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-white/5">
            <button
              onClick={() => setActiveTab('trips')}
              className={`rounded-xl py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                activeTab === 'trips' ? activeTheme.activeTab : activeTheme.inactiveTab
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`rounded-xl py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                activeTab === 'payments' ? activeTheme.activeTab : activeTheme.inactiveTab
              }`}
            >
              Ledger
            </button>
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
                  <div className="size-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                     <span className="material-symbols-outlined">live_help</span>
                  </div>
                  <div className="flex-1 text-left">
                     <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest italic">Help & Support</p>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Need help with rides?</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
               </button>
             </>
          ) : (
             <>
               {renderPaymentList()}
               <button 
                  onClick={() => {
                    setSupportContext({ openedAt: new Date().toISOString() });
                    setSupportOpen(true);
                  }}
                  className="mt-4 w-full flex items-center justify-center gap-3 p-5 rounded-3xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 group shadow-sm active:scale-[0.98] transition-all"
               >
                  <div className="size-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                     <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div className="flex-1 text-left">
                     <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest italic">Help & Support</p>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Billing inquiries?</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
               </button>
             </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerActivityScreen;
