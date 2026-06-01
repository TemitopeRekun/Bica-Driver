import React, { useState, useEffect, useCallback } from 'react';
import { PendingPaymentTrip, OrphanedTransaction, OrphanedTransactionsResponse, RecoveryResult } from '@/types';
import { api } from '@/services/api.service';
import { useToast } from '@/hooks/useToast';

// ─── Types ───────────────────────────────────────────────────────────────────

type PanelTab = 'watchlist' | 'orphaned' | 'manual';

interface ConfirmState {
  type: 'recover' | 'finalize';
  tripId: string;
  txRef?: string;
  tripLabel?: string;
  amount?: number;
  customerName?: string;
}

interface TripLookupResult {
  id: string;
  paymentStatus: string;
  monnifyTxRef: string | null;
  amount: number;
  pickupAddress?: string;
  destAddress?: string;
  owner?: { name: string };
  driver?: { name: string } | null;
  driverEarnings?: number;
  createdAt?: string;
}

interface PaymentRecoveryPanelProps {
  pendingPayments: PendingPaymentTrip[];
  onRecover: (txRef: string, tripId: string) => Promise<RecoveryResult>;
  onFinalize: (tripId: string) => Promise<any>;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const tripIdFromPaymentRef = (paymentRef: string): string | null => {
  // paymentReference format: BICA-{tripIdNoHyphens}-{random}
  const match = paymentRef.match(/^BICA-([a-f0-9]{32})-/i);
  if (!match) return null;
  const raw = match[1]!;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
};

const timeAgo = (isoDate: string) => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const shortRef = (ref: string) => ref.slice(-12);

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    PAID: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    PENDING: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
    EXPIRED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status] ?? map.PENDING}`}>
      {status}
    </span>
  );
};

const Spinner: React.FC<{ className?: string }> = ({ className = 'size-4' }) => (
  <span className={`material-symbols-outlined animate-spin text-current ${className}`}>refresh</span>
);

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1.5 size-5 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
    >
      <span className="material-symbols-outlined text-[12px]">{copied ? 'check' : 'content_copy'}</span>
    </button>
  );
};

// ─── Confirm Sheet ────────────────────────────────────────────────────────────

const ConfirmSheet: React.FC<{
  state: ConfirmState;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  formatCurrency: (n: number) => string;
}> = ({ state, loading, onConfirm, onCancel, formatCurrency }) => (
  <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 animate-fade-in">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
    <div className="relative w-full max-w-md bg-white dark:bg-surface-dark rounded-[2rem] p-6 shadow-2xl space-y-5 animate-slide-up">
      <div className="flex items-center gap-3">
        <div className={`size-10 rounded-2xl flex items-center justify-center ${state.type === 'recover' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-500'}`}>
          <span className="material-symbols-outlined">{state.type === 'recover' ? 'link' : 'task_alt'}</span>
        </div>
        <div>
          <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">
            {state.type === 'recover' ? 'Confirm Recovery' : 'Confirm Finalization'}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
            {state.type === 'recover' ? 'This will link the Monnify txRef to the trip and mark it PAID.' : 'This will credit the driver wallet and create the settlement record.'}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trip</span>
          <span className="text-xs font-mono font-black text-slate-700 dark:text-white">#{state.tripId.slice(0, 8)}</span>
        </div>
        {state.txRef && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Tx Ref</span>
            <div className="flex items-center min-w-0">
              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate">{state.txRef}</span>
              <CopyButton value={state.txRef} />
            </div>
          </div>
        )}
        {state.amount !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(state.amount)}</span>
          </div>
        )}
        {state.customerName && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">{state.customerName}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="py-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/10 hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`py-3.5 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest shadow-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2 ${state.type === 'recover' ? 'bg-primary shadow-primary/20 hover:bg-primary/90' : 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600'}`}
        >
          {loading ? <Spinner /> : <span className="material-symbols-outlined text-sm">{state.type === 'recover' ? 'link' : 'task_alt'}</span>}
          {loading ? 'Processing…' : state.type === 'recover' ? 'Recover' : 'Finalize'}
        </button>
      </div>
    </div>
  </div>
);

// ─── Watchlist Tab ────────────────────────────────────────────────────────────

const WatchlistTab: React.FC<{
  pendingPayments: PendingPaymentTrip[];
  orphaned: OrphanedTransaction[];
  orphanedLoading: boolean;
  formatCurrency: (n: number) => string;
  onRequestRecover: (tripId: string, txRef: string, amount: number, customerName: string) => void;
  onRequestFinalize: (tripId: string, amount: number) => void;
}> = ({ pendingPayments, orphaned, orphanedLoading, formatCurrency, onRequestRecover, onRequestFinalize }) => {
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, OrphanedTransaction | null>>({});

  const autoMatch = useCallback((tripId: string) => {
    setMatchingId(tripId);
    const tripIdNoHyphens = tripId.replace(/-/g, '');
    const match = orphaned.find(t =>
      t.paymentReference.includes(tripIdNoHyphens) && t.paymentStatus === 'PAID'
    );
    setTimeout(() => {
      setMatchResults(prev => ({ ...prev, [tripId]: match ?? null }));
      setMatchingId(null);
    }, 400);
  }, [orphaned]);

  if (pendingPayments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="size-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
          <span className="material-symbols-outlined text-3xl">verified_user</span>
        </div>
        <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm italic mb-1">All Clear</h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[200px] leading-relaxed">
          No stuck payments detected on the watchlist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {pendingPayments.map((trip) => {
        const isMatching = matchingId === trip.id;
        const match = matchResults[trip.id];
        const hasMatch = match !== undefined;

        return (
          <div key={trip.id} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-[1.5rem] overflow-hidden">
            {/* Trip Header */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight italic truncate">
                    {trip.pickupAddress?.split(',')[0] ?? trip.location} → {trip.destAddress?.split(',')[0] ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase truncate mt-0.5">
                    {trip.owner?.name} · {trip.driver?.name ?? 'No driver'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(trip.amount)}</p>
                  <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mt-0.5">
                    {trip.createdAt ? timeAgo(trip.createdAt) : '—'}
                  </p>
                </div>
              </div>

              {/* Trip ID + txRef row */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trip</span>
                  <span className="text-[10px] font-mono font-black text-slate-600 dark:text-slate-300">#{trip.id.slice(0, 8)}</span>
                  <CopyButton value={trip.id} />
                </div>
                {trip.monnifyTxRef && (
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Ref</span>
                    <span className="text-[10px] font-mono text-slate-500 truncate">{shortRef(trip.monnifyTxRef)}</span>
                    <CopyButton value={trip.monnifyTxRef} />
                  </div>
                )}
              </div>

              {/* Auto-match result */}
              {hasMatch && match && (
                <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-xl animate-fade-in">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">Match Found on Monnify</span>
                    </div>
                    <StatusPill status={match.paymentStatus} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tx Ref</p>
                      <div className="flex items-center">
                        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate">{shortRef(match.transactionReference)}</p>
                        <CopyButton value={match.transactionReference} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Paid</p>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white">{formatCurrency(match.amount)}</p>
                    </div>
                  </div>
                </div>
              )}

              {hasMatch && match === null && (
                <div className="mb-3 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-400 text-sm">search_off</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No paid match found on Monnify</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold mt-1">Check the Orphaned tab or use Manual Recovery.</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {!hasMatch ? (
                  <button
                    onClick={() => autoMatch(trip.id)}
                    disabled={isMatching || orphanedLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/5 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all disabled:opacity-60"
                  >
                    {isMatching ? <Spinner className="size-3.5" /> : <span className="material-symbols-outlined text-sm">travel_explore</span>}
                    {isMatching ? 'Searching…' : 'Find on Monnify'}
                  </button>
                ) : match ? (
                  <button
                    onClick={() => onRequestRecover(trip.id, match.transactionReference, match.amount, match.customerName)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-sm shadow-primary/20 hover:bg-primary/90 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    Recover Payment
                  </button>
                ) : (
                  <button
                    onClick={() => setMatchResults(prev => { const n = { ...prev }; delete n[trip.id]; return n; })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    Try Again
                  </button>
                )}

                <button
                  onClick={() => onRequestFinalize(trip.id, trip.amount)}
                  className="flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                  title="Finalize settlement (use if trip is already PAID but driver wallet not credited)"
                >
                  <span className="material-symbols-outlined text-sm">task_alt</span>
                  <span className="hidden sm:block">Finalize</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Orphaned Transactions Tab ────────────────────────────────────────────────

const OrphanedTab: React.FC<{
  orphaned: OrphanedTransaction[];
  loading: boolean;
  checkedAt: string | null;
  onRefresh: () => void;
  formatCurrency: (n: number) => string;
  onRequestRecover: (tripId: string, txRef: string, amount: number, customerName: string) => void;
}> = ({ orphaned, loading, checkedAt, onRefresh, formatCurrency, onRequestRecover }) => {
  const [manualTripIds, setManualTripIds] = useState<Record<string, string>>({});

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Spinner className="size-8 text-primary" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cross-referencing Monnify…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Last checked banner */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
          {checkedAt ? `Last checked ${timeAgo(checkedAt)}` : 'Not yet checked'}
        </p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 text-[9px] font-black text-primary uppercase tracking-widest hover:opacity-70 transition-all"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Refresh
        </button>
      </div>

      {orphaned.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <div className="size-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
            <span className="material-symbols-outlined text-3xl">cloud_done</span>
          </div>
          <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm italic mb-1">No Orphaned Transactions</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[220px] leading-relaxed">
            Every recent Monnify transaction has a matching DB record.
          </p>
        </div>
      ) : (
        orphaned.map((tx) => {
          const autoTripId = tripIdFromPaymentRef(tx.paymentReference);
          const manualId = manualTripIds[tx.transactionReference] ?? '';
          const effectiveTripId = autoTripId ?? manualId;

          return (
            <div key={tx.transactionReference} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                    {tx.customerName}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase truncate mt-0.5">{tx.customerEmail}</p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(tx.amount)}</p>
                  <StatusPill status={tx.paymentStatus} />
                </div>
              </div>

              {/* Tx ref + date */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tx Ref</p>
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate">{shortRef(tx.transactionReference)}</p>
                    <CopyButton value={tx.transactionReference} />
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Time</p>
                  <p className="text-[10px] font-black text-slate-600 dark:text-slate-300">{timeAgo(tx.createdOn)}</p>
                </div>
              </div>

              {/* Trip ID section */}
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  {autoTripId ? 'Trip ID (auto-detected)' : 'Trip ID (enter manually)'}
                </p>
                {autoTripId ? (
                  <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                    <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
                    <span className="text-[10px] font-mono font-black text-primary flex-1 truncate">{autoTripId}</span>
                    <CopyButton value={autoTripId} />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualTripIds(prev => ({ ...prev, [tx.transactionReference]: e.target.value }))}
                    placeholder="Paste trip UUID here…"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[11px] font-mono text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                )}
              </div>

              {tx.paymentStatus === 'PAID' && effectiveTripId && (
                <button
                  onClick={() => onRequestRecover(effectiveTripId, tx.transactionReference, tx.amount, tx.customerName)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-sm shadow-primary/20 hover:bg-primary/90 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  Recover to Trip
                </button>
              )}

              {tx.paymentStatus !== 'PAID' && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl">
                  <span className="material-symbols-outlined text-slate-400 text-sm">info</span>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Transaction not yet PAID — nothing to recover.
                  </p>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

// ─── Manual Recovery Tab ──────────────────────────────────────────────────────

const ManualTab: React.FC<{
  formatCurrency: (n: number) => string;
  onRequestRecover: (tripId: string, txRef: string, amount: number, customerName: string) => void;
  onRequestFinalize: (tripId: string, amount: number) => void;
}> = ({ formatCurrency, onRequestRecover, onRequestFinalize }) => {
  const [tripId, setTripId] = useState('');
  const [txRef, setTxRef] = useState('');
  const [tripLookup, setTripLookup] = useState<TripLookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const lookUpTrip = useCallback(async () => {
    if (!tripId.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setTripLookup(null);
    try {
      const trip = await api.getTripById(tripId.trim());
      setTripLookup(trip);
    } catch (e: any) {
      setLookupError(e.message ?? 'Trip not found');
    } finally {
      setLookupLoading(false);
    }
  }, [tripId]);

  const isAlreadyPaid = tripLookup?.paymentStatus === 'PAID';
  const canRecover = !!tripLookup && !isAlreadyPaid && txRef.trim().length > 5;
  const canFinalize = !!tripLookup && isAlreadyPaid;

  return (
    <div className="space-y-4 pb-4">
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 flex gap-3">
        <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">warning</span>
        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
          Use this tab only when auto-detection fails. Always verify the transaction reference on the{' '}
          <strong>Monnify merchant dashboard</strong> before proceeding.
        </p>
      </div>

      {/* Trip ID lookup */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Trip ID</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tripId}
            onChange={(e) => { setTripId(e.target.value); setTripLookup(null); setLookupError(null); }}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="flex-1 px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-mono text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
          />
          <button
            onClick={lookUpTrip}
            disabled={!tripId.trim() || lookupLoading}
            className="px-4 py-3 rounded-2xl bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 transition-all flex items-center gap-1.5 shrink-0"
          >
            {lookupLoading ? <Spinner className="size-4" /> : <span className="material-symbols-outlined text-sm">search</span>}
            Look Up
          </button>
        </div>
        {lookupError && (
          <p className="text-[10px] font-black text-red-500 px-1 uppercase tracking-widest">{lookupError}</p>
        )}
      </div>

      {/* Trip detail card */}
      {tripLookup && (
        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trip Details</span>
            <StatusPill status={tripLookup.paymentStatus} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(tripLookup.amount)}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver Earnings</p>
              <p className="text-sm font-black text-emerald-500">{tripLookup.driverEarnings ? formatCurrency(tripLookup.driverEarnings) : '—'}</p>
            </div>
            {tripLookup.owner && (
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Owner</p>
                <p className="text-xs font-black text-slate-900 dark:text-white">{tripLookup.owner.name}</p>
              </div>
            )}
            {tripLookup.driver !== undefined && (
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver</p>
                <p className="text-xs font-black text-slate-900 dark:text-white">{tripLookup.driver?.name ?? 'None'}</p>
              </div>
            )}
          </div>
          {tripLookup.monnifyTxRef && (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Existing Tx Ref</p>
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-mono text-slate-500 truncate">{tripLookup.monnifyTxRef}</p>
                <CopyButton value={tripLookup.monnifyTxRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tx Ref input — only shown when trip is found and not yet PAID */}
      {tripLookup && !isAlreadyPaid && (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            Monnify Transaction Reference
          </label>
          <input
            type="text"
            value={txRef}
            onChange={(e) => setTxRef(e.target.value)}
            placeholder="MNFY|xx|xxxxxxxxxxxxxxxx|xxxxxx"
            className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-mono text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
          />
          <p className="text-[9px] font-bold text-slate-400 px-1">
            Find this on the Monnify dashboard under Transactions → search by customer email or date.
          </p>
        </div>
      )}

      {/* Action buttons */}
      {canRecover && (
        <button
          onClick={() => onRequestRecover(tripLookup!.id, txRef.trim(), tripLookup!.amount, tripLookup!.owner?.name ?? 'Customer')}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
        >
          <span className="material-symbols-outlined text-sm">link</span>
          Recover Payment
        </button>
      )}

      {canFinalize && (
        <button
          onClick={() => onRequestFinalize(tripLookup!.id, tripLookup!.amount)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
        >
          <span className="material-symbols-outlined text-sm">task_alt</span>
          Finalize Settlement
        </button>
      )}

      {tripLookup && isAlreadyPaid && !tripLookup.monnifyTxRef && (
        <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl flex gap-3">
          <span className="material-symbols-outlined text-amber-500 text-lg shrink-0">info</span>
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
            This trip is marked PAID. Use <strong>Finalize Settlement</strong> to credit the driver's in-app wallet if it hasn't been done yet.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

const PaymentRecoveryPanel: React.FC<PaymentRecoveryPanelProps> = ({
  pendingPayments,
  onRecover,
  onFinalize,
  onClose,
  formatCurrency,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<PanelTab>('watchlist');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Orphaned transactions state
  const [orphanedData, setOrphanedData] = useState<OrphanedTransactionsResponse | null>(null);
  const [orphanedLoading, setOrphanedLoading] = useState(false);
  const [orphanedError, setOrphanedError] = useState<string | null>(null);

  const fetchOrphaned = useCallback(async () => {
    setOrphanedLoading(true);
    setOrphanedError(null);
    try {
      const data = await api.getOrphanedTransactions();
      setOrphanedData(data);
    } catch (e: any) {
      setOrphanedError(e.message ?? 'Failed to fetch orphaned transactions');
    } finally {
      setOrphanedLoading(false);
    }
  }, []);

  // Pre-fetch orphaned on mount so Watchlist auto-match works immediately
  useEffect(() => { fetchOrphaned(); }, [fetchOrphaned]);

  const handleConfirm = useCallback(async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      if (confirmState.type === 'recover') {
        await onRecover(confirmState.txRef!, confirmState.tripId);
        toast.success('Payment recovered and driver wallet credited.');
      } else {
        const result = await onFinalize(confirmState.tripId);
        if (result?.alreadySettled) {
          toast.success('Already settled — no duplicate credit issued.');
        } else {
          toast.success(`Settlement finalized. Driver credited ${result?.driverCredited ? formatCurrency(result.driverCredited) : ''}.`);
        }
      }
      setConfirmState(null);
      await fetchOrphaned();
    } catch (e: any) {
      toast.error(e.message ?? 'Operation failed. Please try again.');
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmState, onRecover, onFinalize, toast, formatCurrency, fetchOrphaned]);

  const requestRecover = useCallback((tripId: string, txRef: string, amount: number, customerName: string) => {
    setConfirmState({ type: 'recover', tripId, txRef, amount, customerName });
  }, []);

  const requestFinalize = useCallback((tripId: string, amount: number) => {
    setConfirmState({ type: 'finalize', tripId, amount });
  }, []);

  const tabs: { id: PanelTab; label: string; icon: string; count?: number }[] = [
    { id: 'watchlist', label: 'Watchlist', icon: 'query_stats', count: pendingPayments.length },
    { id: 'orphaned', label: 'Orphaned', icon: 'link_off', count: orphanedData?.total },
    { id: 'manual', label: 'Manual', icon: 'build' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Slide-up panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background-light dark:bg-background-dark rounded-t-[2.5rem] shadow-2xl animate-slide-up max-h-[92dvh]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Panel header */}
        <div className="px-5 pt-2 pb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-lg">manage_search</span>
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Recovery Console</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Payment reconciliation &amp; settlement ops</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/20 transition-all"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-slate-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (tab.id === 'orphaned' && !orphanedData) fetchOrphaned(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                <span className="hidden sm:block">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`size-4 rounded-full text-[8px] font-black flex items-center justify-center ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {tab.count > 9 ? '9+' : tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Orphaned error banner */}
        {orphanedError && activeTab !== 'manual' && (
          <div className="mx-5 mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-red-500 text-sm">error</span>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest flex-1">{orphanedError}</p>
            <button onClick={fetchOrphaned} className="text-red-500 hover:opacity-70">
              <span className="material-symbols-outlined text-sm">refresh</span>
            </button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-1">
          {activeTab === 'watchlist' && (
            <WatchlistTab
              pendingPayments={pendingPayments}
              orphaned={orphanedData?.orphaned ?? []}
              orphanedLoading={orphanedLoading}
              formatCurrency={formatCurrency}
              onRequestRecover={requestRecover}
              onRequestFinalize={requestFinalize}
            />
          )}
          {activeTab === 'orphaned' && (
            <OrphanedTab
              orphaned={orphanedData?.orphaned ?? []}
              loading={orphanedLoading}
              checkedAt={orphanedData?.checkedAt ?? null}
              onRefresh={fetchOrphaned}
              formatCurrency={formatCurrency}
              onRequestRecover={requestRecover}
            />
          )}
          {activeTab === 'manual' && (
            <ManualTab
              formatCurrency={formatCurrency}
              onRequestRecover={requestRecover}
              onRequestFinalize={requestFinalize}
            />
          )}
        </div>
      </div>

      {/* Confirm sheet */}
      {confirmState && (
        <ConfirmSheet
          state={confirmState}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onCancel={() => !confirmLoading && setConfirmState(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </>
  );
};

export default PaymentRecoveryPanel;
