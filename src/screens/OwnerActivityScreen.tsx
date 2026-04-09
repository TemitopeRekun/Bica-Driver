import React, { useEffect, useState } from 'react';
import { mapTrip } from '@/mappers/appMappers';
import { api, PaginatedResponse, PaginationMeta } from '@/services/api.service';
import { OwnerActivityTab, PaymentHistoryRecord, Trip } from '@/types';

interface OwnerActivityScreenProps {
  initialTab: OwnerActivityTab;
  onBack: () => void;
}

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

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadActivity = async () => {
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
  };

  const loadTripsPage = async (page: number) => {
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
  };

  const loadPaymentsPage = async (page: number) => {
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
  };

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

  const renderEmptyState = (tab: OwnerActivityTab) => {
    const theme = ACTIVITY_THEME[tab];
    const isTripTab = tab === 'trips';

    return (
      <div className={`relative overflow-hidden rounded-[1.75rem] border p-8 text-center ${theme.card}`}>
        <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${theme.glow} pointer-events-none`} />
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${theme.iconSurface}`}>
          <span className="material-symbols-outlined">{theme.icon}</span>
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          {isTripTab ? 'No trips yet' : 'No payments yet'}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {isTripTab
            ? 'Your ride history will appear here once you start booking trips.'
            : 'Completed trip payments will be listed here when they are confirmed.'}
        </p>
      </div>
    );
  };

  const renderTripList = () => {
    if (!isLoading && trips.length === 0) {
      return renderEmptyState('trips');
    }

    return (
      <div className="space-y-4">
        {/* Pagination Controls */}
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
            className={`relative overflow-hidden rounded-[1.75rem] border p-4 ${ACTIVITY_THEME.trips.card}`}
          >
            <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${ACTIVITY_THEME.trips.glow} pointer-events-none`} />
            <div className="relative mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${ACTIVITY_THEME.trips.iconSurface}`}>
                  <span className="material-symbols-outlined">route</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900 dark:text-white">{getTripTitle(trip)}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{formatDate(trip.createdAt || trip.date)}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${getStatusClassName(trip.status)}`}>
                {trip.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`rounded-2xl border px-3 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Driver</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{trip.driverName || 'Pending assignment'}</p>
              </div>
              <div className={`rounded-2xl border px-3 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Fare</p>
                <p className={`mt-1 font-black ${ACTIVITY_THEME.trips.accentText}`}>{formatCurrency(trip.amount || 0)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPaymentList = () => {
    if (!isLoading && payments.length === 0) {
      return renderEmptyState('payments');
    }

    return (
      <div className="space-y-4">
        {/* Pagination Controls */}
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
            className={`relative overflow-hidden rounded-[1.75rem] border p-4 ${ACTIVITY_THEME.payments.card}`}
          >
            <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${ACTIVITY_THEME.payments.glow} pointer-events-none`} />
            <div className="relative mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${ACTIVITY_THEME.payments.iconSurface}`}>
                  <span className="material-symbols-outlined">receipt_long</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900 dark:text-white">
                    {payment.trip.pickupAddress.split(',')[0]} to {payment.trip.destAddress.split(',')[0]}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {formatDate(payment.paidAt || payment.createdAt)}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${getStatusClassName('PAID')}`}>
                Paid
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`rounded-2xl border px-3 py-3 ${ACTIVITY_THEME.payments.metricSurface}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Driver</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{payment.trip.driver?.name || 'Driver pending'}</p>
              </div>
              <div className={`rounded-2xl border px-3 py-3 ${ACTIVITY_THEME.payments.metricSurface}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Amount</p>
                <p className={`mt-1 font-black ${ACTIVITY_THEME.payments.accentText}`}>{formatCurrency(payment.totalAmount)}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-bold ${ACTIVITY_THEME.payments.badge}`}>
                {payment.paymentMethod || 'Payment method not provided'}
              </span>
              <span className="rounded-full bg-slate-900/5 px-2.5 py-1 font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {payment.monnifyTxRef || 'Reference unavailable'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const activeTheme = ACTIVITY_THEME[activeTab];

  return (
    <div className="relative min-h-screen bg-background-light text-slate-900 dark:bg-background-dark dark:text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/10 via-amber-500/8 to-transparent" />

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-background-light/88 backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/88">
        <div className="mx-auto flex max-w-md items-center gap-3 p-4">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black">Activity</h1>
            <p className="text-xs text-slate-500">Recent trips and payment history</p>
          </div>
          <button
            onClick={() => loadActivity().catch((loadError) => {
              console.error('Failed to refresh owner activity:', loadError);
              setError('Could not refresh activity right now.');
              setIsLoading(false);
            })}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Refresh activity"
          >
            <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      <div className="relative mx-auto flex max-w-md flex-col gap-4 px-4 pb-8 pt-5">
        <div className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-xl shadow-slate-900/5 ${activeTheme.hero}`}>
          <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${activeTheme.glow} pointer-events-none`} />
          <div className="relative flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${activeTheme.iconSurface}`}>
              <span className="material-symbols-outlined">{activeTheme.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Owner activity</p>
              <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                {activeTab === 'trips' ? 'Track every ride you have booked' : 'See every confirmed payment at a glance'}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {activeTab === 'trips'
                  ? 'Manage your travel history and review your ride details in one place.'
                  : 'Track your confirmed payments and maintain total budget transparency.'}
              </p>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-3">
            <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Trips logged</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{trips.length}</p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.payments.metricSurface}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Payments made</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{payments.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-[1.25rem] border border-slate-200/80 bg-white/70 p-1.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
          <button
            onClick={() => setActiveTab('trips')}
            className={`rounded-[1rem] px-4 py-3 text-sm font-black transition-all ${
              activeTab === 'trips' ? ACTIVITY_THEME.trips.activeTab : ACTIVITY_THEME.trips.inactiveTab
            }`}
          >
            Trips
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`rounded-[1rem] px-4 py-3 text-sm font-black transition-all ${
              activeTab === 'payments' ? ACTIVITY_THEME.payments.activeTab : ACTIVITY_THEME.payments.inactiveTab
            }`}
          >
            Payments
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className={`animate-pulse rounded-[1.75rem] border p-4 ${activeTheme.card}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-2xl ${activeTheme.iconSurface}`} />
                  <div className="flex-1">
                    <div className="mb-2 h-5 w-2/3 rounded bg-slate-200/90 dark:bg-slate-700" />
                    <div className="h-3 w-1/3 rounded bg-slate-200/80 dark:bg-slate-700" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`h-16 rounded-2xl border ${activeTheme.metricSurface}`} />
                  <div className={`h-16 rounded-2xl border ${activeTheme.metricSurface}`} />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'trips' ? (
          renderTripList()
        ) : (
          renderPaymentList()
        )}
      </div>
    </div>
  );
};

export default OwnerActivityScreen;
