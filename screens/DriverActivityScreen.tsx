import React, { useEffect, useState } from 'react';
import { mapTrip } from '../mappers/appMappers';
import { api } from '../services/api.service';
import { DriverActivityTab, PaymentHistoryRecord, Trip, WalletSummary } from '../types';

interface DriverActivityScreenProps {
  initialTab: DriverActivityTab;
  onBack: () => void;
}

const ACTIVITY_THEME = {
  trips: {
    label: 'Trips',
    icon: 'route',
    activeTab:
      'bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 text-white shadow-lg shadow-sky-500/25',
    inactiveTab:
      'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white',
    hero:
      'border-sky-200/70 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50/80 dark:border-sky-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-sky-950/30 dark:to-cyan-950/20',
    card:
      'border-sky-200/70 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50/80 shadow-lg shadow-sky-900/5 dark:border-sky-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-sky-950/30 dark:to-cyan-950/20',
    iconSurface: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    metricSurface: 'border-white/70 bg-white/75 dark:border-white/5 dark:bg-black/20',
    accentText: 'text-sky-700 dark:text-sky-300',
    badge: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    glow: 'from-sky-500/20 via-cyan-500/12 to-transparent',
  },
  settlements: {
    label: 'Settlements',
    icon: 'account_balance_wallet',
    activeTab:
      'bg-gradient-to-r from-emerald-500 via-emerald-600 to-lime-500 text-white shadow-lg shadow-emerald-500/25',
    inactiveTab:
      'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white',
    hero:
      'border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/90 to-lime-50/80 dark:border-emerald-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-emerald-950/30 dark:to-lime-950/20',
    card:
      'border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/90 to-lime-50/80 shadow-lg shadow-emerald-900/5 dark:border-emerald-500/20 dark:bg-gradient-to-br dark:from-slate-900 dark:via-emerald-950/30 dark:to-lime-950/20',
    iconSurface: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    metricSurface: 'border-white/70 bg-white/75 dark:border-white/5 dark:bg-black/20',
    accentText: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    glow: 'from-emerald-500/20 via-lime-500/10 to-transparent',
  },
} as const;

const DriverActivityScreen: React.FC<DriverActivityScreenProps> = ({
  initialTab,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<DriverActivityTab>(initialTab);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [settlements, setSettlements] = useState<PaymentHistoryRecord[]>([]);
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadActivity = async () => {
    setIsLoading(true);
    setError('');

    const [tripsResult, settlementsResult, walletResult] = await Promise.allSettled([
      api.get<any[]>('/rides/history'),
      api.get<PaymentHistoryRecord[]>('/payments/history'),
      api.get<WalletSummary>('/payments/wallet'),
    ]);

    if (tripsResult.status === 'fulfilled') {
      setTrips(tripsResult.value.map(mapTrip));
    } else {
      setTrips([]);
    }

    if (settlementsResult.status === 'fulfilled') {
      setSettlements(settlementsResult.value);
    } else {
      setSettlements([]);
    }

    if (walletResult.status === 'fulfilled') {
      setWalletSummary(walletResult.value);
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
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadActivity().catch((loadError) => {
      console.error('Failed to load driver activity:', loadError);
      setError('Could not load activity right now.');
      setIsLoading(false);
    });
  }, []);

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

  const totalSettled = settlements.reduce((sum, settlement) => sum + (settlement.driverAmount || 0), 0);

  const renderEmptyState = (tab: DriverActivityTab) => {
    const theme = ACTIVITY_THEME[tab];
    const isTripTab = tab === 'trips';

    return (
      <div className={`relative overflow-hidden rounded-[1.75rem] border p-8 text-center ${theme.card}`}>
        <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${theme.glow} pointer-events-none`} />
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${theme.iconSurface}`}>
          <span className="material-symbols-outlined">{theme.icon}</span>
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          {isTripTab ? 'No trips yet' : 'No settlements yet'}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {isTripTab
            ? 'Completed and active ride history will show up here once owners start booking you.'
            : 'Confirmed payouts from completed rides will appear here as soon as payments are settled.'}
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
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Owner</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{trip.ownerName || trip.owner?.name || 'Owner pending'}</p>
              </div>
              <div className={`rounded-2xl border px-3 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Earnings</p>
                <p className={`mt-1 font-black ${ACTIVITY_THEME.trips.accentText}`}>
                  {formatCurrency(trip.driverEarnings ?? trip.amount ?? 0)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSettlementList = () => {
    if (!isLoading && settlements.length === 0) {
      return renderEmptyState('settlements');
    }

    return (
      <div className="space-y-4">
        {settlements.map((settlement) => (
          <div
            key={settlement.id}
            className={`relative overflow-hidden rounded-[1.75rem] border p-4 ${ACTIVITY_THEME.settlements.card}`}
          >
            <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${ACTIVITY_THEME.settlements.glow} pointer-events-none`} />
            <div className="relative mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${ACTIVITY_THEME.settlements.iconSurface}`}>
                  <span className="material-symbols-outlined">receipt_long</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900 dark:text-white">
                    {settlement.trip.pickupAddress.split(',')[0]} to {settlement.trip.destAddress.split(',')[0]}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{formatDate(settlement.paidAt || settlement.createdAt)}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${getStatusClassName('PAID')}`}>
                Settled
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`rounded-2xl border px-3 py-3 ${ACTIVITY_THEME.settlements.metricSurface}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Owner</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{settlement.trip.owner.name || 'Owner unavailable'}</p>
              </div>
              <div className={`rounded-2xl border px-3 py-3 ${ACTIVITY_THEME.settlements.metricSurface}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Driver share</p>
                <p className={`mt-1 font-black ${ACTIVITY_THEME.settlements.accentText}`}>{formatCurrency(settlement.driverAmount)}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-bold ${ACTIVITY_THEME.settlements.badge}`}>
                {settlement.paymentMethod || 'Payment method not provided'}
              </span>
              <span className="rounded-full bg-slate-900/5 px-2.5 py-1 font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {settlement.monnifyTxRef || 'Reference unavailable'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const activeTheme = ACTIVITY_THEME[activeTab];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background-light text-slate-900 dark:bg-background-dark dark:text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-500/10 via-emerald-500/8 to-transparent" />

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-background-light/88 backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/88">
        <div className="mx-auto flex max-w-md items-center gap-3 p-4">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black">Driver Activity</h1>
            <p className="text-xs text-slate-500">Trips and settlement history</p>
          </div>
          <button
            onClick={() => loadActivity().catch((loadError) => {
              console.error('Failed to refresh driver activity:', loadError);
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
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Driver activity</p>
              <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                {activeTab === 'trips' ? 'Keep your ride history separate from live requests' : 'Review every settled payout in one place'}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {activeTab === 'trips'
                  ? 'Your driver home now stays focused on incoming owner requests while completed ride history lives here.'
                  : 'Settlements are now easier to browse without cluttering the live requests screen.'}
              </p>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-3">
            <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.trips.metricSurface}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Trips logged</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                {walletSummary?.totalTrips ?? trips.length}
              </p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${ACTIVITY_THEME.settlements.metricSurface}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Cleared balance</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                {formatCurrency(walletSummary?.currentBalance ?? totalSettled)}
              </p>
            </div>
          </div>

          {(walletSummary?.accountNumber || walletSummary?.bankName) && (
            <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs">
              {walletSummary?.bankName && (
                <span className={`rounded-full px-2.5 py-1 font-bold ${activeTheme.badge}`}>
                  {walletSummary.bankName}
                </span>
              )}
              {walletSummary?.accountNumber && (
                <span className="rounded-full bg-slate-900/5 px-2.5 py-1 font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  Settled to {walletSummary.accountNumber}
                </span>
              )}
            </div>
          )}
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
            onClick={() => setActiveTab('settlements')}
            className={`rounded-[1rem] px-4 py-3 text-sm font-black transition-all ${
              activeTab === 'settlements' ? ACTIVITY_THEME.settlements.activeTab : ACTIVITY_THEME.settlements.inactiveTab
            }`}
          >
            Settlements
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
          renderSettlementList()
        )}
      </div>
    </div>
  );
};

export default DriverActivityScreen;
