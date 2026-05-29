import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, ApprovalStatus, RatingAuditEntry } from '@/types';
import { api } from '@/services/api.service';

interface UserDossierModalProps {
  user: UserProfile;
  userDetailsLoading: boolean;
  retryingSubAccountIds: Set<string>;
  onClose: () => void;
  onUpdateStatus: (userId: string, approvalStatus: ApprovalStatus) => Promise<void>;
  onBlockUser: (userId: string, isBlocked: boolean) => Promise<void>;
  onRetrySubAccount: (userId: string) => Promise<any>;
  onResetWalletBalance: (driverId: string) => Promise<void>;
  formatJoinedDate: (value?: string | null) => string;
}

// ─── Tappable document image with tap-to-open ────────────────────────────────
const DocImage: React.FC<{ src?: string | null; label: string; icon: string }> = ({ src, label, icon }) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
    <div className="w-full bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative" style={{ aspectRatio: '4/3' }}>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" className="block size-full group">
          <img src={src} alt={label} className="size-full object-cover transition-transform duration-300 group-active:scale-95" />
          <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-end justify-end p-2">
            <span className="bg-black/50 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              Tap to expand
            </span>
          </div>
        </a>
      ) : (
        <div className="size-full flex flex-col items-center justify-center text-slate-400 gap-2 py-8">
          <span className="material-symbols-outlined text-3xl">{icon}</span>
          <span className="text-[10px] font-black uppercase">Not submitted</span>
        </div>
      )}
    </div>
  </div>
);

// ─── Sub-account banking status banner (3 states) ────────────────────────────
const SubAccountBanner: React.FC<{
  user: UserProfile;
  retryingSubAccountIds: Set<string>;
  onRetrySubAccount: (userId: string) => Promise<void>;
}> = ({ user, retryingSubAccountIds, onRetrySubAccount }) => {
  const isRetrying = retryingSubAccountIds.has(user.id);

  // State 1: Active ✅
  if (user.subAccountActive) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
        <div className="size-9 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-green-600 filled">verified</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-green-700 dark:text-green-400">Payment Account Active</p>
          {user.bankName && (
            <p className="text-[10px] text-green-600/70 dark:text-green-500/70 font-bold mt-0.5 truncate">
              {user.bankName} · ****{user.accountNumber?.slice(-4)}
            </p>
          )}
          {user.monnifySubAccountCode && (
            <code className="text-[9px] text-green-600/60 font-mono">{user.monnifySubAccountCode}</code>
          )}
        </div>
        <span className="text-[9px] font-black bg-green-500 text-white px-2.5 py-1 rounded-full uppercase tracking-widest shrink-0">Ready</span>
      </div>
    );
  }

  // State 2: Can retry — bank details exist but sub-account creation failed ⚠️
  if (user.canRetrySubAccountSetup) {
    return (
      <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
        <div className="size-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-orange-600">account_balance</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-orange-700 dark:text-orange-400">Sub-Account Creation Failed</p>
          {user.bankName && (
            <p className="text-[10px] text-orange-600/70 font-bold mt-0.5 truncate">
              {user.bankName} · ****{user.accountNumber?.slice(-4)}
            </p>
          )}
          <p className="text-[10px] text-orange-600/60 mt-0.5">Bank details available — tap Retry to create account</p>
        </div>
        <button
          onClick={() => onRetrySubAccount(user.id)}
          disabled={isRetrying}
          className="shrink-0 flex items-center gap-1.5 bg-orange-500 disabled:bg-orange-300 text-white text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all active:scale-95"
        >
          {isRetrying ? (
            <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[13px]">refresh</span>
          )}
          {isRetrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  // State 3: No bank details at all ❌
  return (
    <div className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
      <div className="size-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-red-600">account_balance_wallet</span>
      </div>
      <div className="flex-1">
        <p className="text-xs font-black text-red-700 dark:text-red-400">Bank Details Incomplete</p>
        <p className="text-[10px] text-red-600/60 mt-0.5">Driver must complete bank setup before approval is possible</p>
      </div>
      <span className="text-[9px] font-black bg-red-500/15 text-red-600 px-2.5 py-1 rounded-full uppercase tracking-widest shrink-0">Blocked</span>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const UserDossierModal: React.FC<UserDossierModalProps> = ({
  user,
  userDetailsLoading,
  retryingSubAccountIds,
  onClose,
  onUpdateStatus,
  onBlockUser,
  onRetrySubAccount,
  onResetWalletBalance,
  formatJoinedDate
}) => {
  const canApprove = user.role === UserRole.DRIVER
    && user.approvalStatus === 'PENDING'
    && !user.isBlocked
    && !!user.subAccountActive;

  const [resetPending, setResetPending] = useState(false);
  const [resettingLedger, setResettingLedger] = useState(false);

  const [ratingHistory, setRatingHistory] = useState<RatingAuditEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [lifting, setLifting] = useState(false);

  useEffect(() => {
    if (user.role === UserRole.DRIVER) {
      setLoadingHistory(true);
      api.get(`/admin/drivers/${user.id}/rating-history`)
         .then(res => setRatingHistory(Array.isArray(res) ? res : []))
         .catch(console.error)
         .finally(() => setLoadingHistory(false));
    }
  }, [user.id, user.role]);

  const handleLiftSuspension = async () => {
    setLifting(true);
    try {
      await api.post(`/admin/drivers/${user.id}/lift-suspension`);
      onClose();
    } catch (e) {
      console.error(e);
      setLifting(false);
    }
  };

  const handleTerminate = async () => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY terminate ${user.name}? This cannot be undone.`)) return;
    setTerminating(true);
    try {
      await api.post(`/admin/drivers/${user.id}/terminate`);
      onClose();
    } catch (e) {
      console.error(e);
      setTerminating(false);
    }
  };

  return (
    // Backdrop - darkened, tapping closes
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Bottom Sheet — max height 94% of viewport, scrollable inside */}
      <div
        className="w-full max-w-2xl mx-auto bg-white dark:bg-surface-dark rounded-t-[2.5rem] shadow-2xl flex flex-col animate-slide-up"
        style={{ maxHeight: '94dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 pt-2 flex items-center justify-between shrink-0 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined filled">folder_shared</span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">User Dossier</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{user.role} · {user.id.slice(0, 12)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-all text-slate-500"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-5 space-y-6 pb-2">

            {/* ── 1. Identity ── */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="size-16 rounded-2xl object-cover ring-2 ring-primary/10 shadow-lg"
                />
                <div className={`absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-white dark:border-surface-dark flex items-center justify-center ${
                  user.approvalStatus === 'APPROVED' ? 'bg-green-500' : user.approvalStatus === 'REJECTED' ? 'bg-red-500' : 'bg-orange-400'
                }`}>
                  <span className="material-symbols-outlined text-white text-[10px] filled">
                    {user.approvalStatus === 'APPROVED' ? 'verified' : user.approvalStatus === 'REJECTED' ? 'cancel' : 'pending'}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">{user.name}</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{user.phone}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">{user.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                    user.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                    : user.approvalStatus === 'REJECTED' ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                    : 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                  }`}>{user.approvalStatus}</span>
                  {user.isBlocked && !user.suspendedUntil && <span className="text-[8px] font-black bg-slate-500/10 border border-slate-500/20 text-slate-500 px-2 py-0.5 rounded-full uppercase">Blocked</span>}
                  {!!user.suspendedUntil && <span className="text-[8px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full uppercase">Suspended</span>}
                  {user.isOnline && !user.isBlocked && <span className="text-[8px] font-black bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full uppercase">Online</span>}
                </div>
              </div>
            </div>

            {/* Syncing indicator */}
            {userDetailsLoading && (
              <div className="flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3 text-xs font-black text-primary border border-primary/10">
                <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                Fetching latest registration data…
              </div>
            )}

            {/* ── 2. Banking Status (Drivers only) ── */}
            {user.role === UserRole.DRIVER && (
              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Payment Setup</p>
                <SubAccountBanner
                  user={user}
                  retryingSubAccountIds={retryingSubAccountIds}
                  onRetrySubAccount={onRetrySubAccount}
                />
              </section>
            )}

            {/* ── 3. Compliance Documents (Drivers only) ── */}
            {user.role === UserRole.DRIVER && (
              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Compliance Documents</p>
                <div className="space-y-4">
                  <DocImage src={user.selfieImage} label="Verification Selfie" icon="face_retouching_off" />
                  <DocImage src={user.licenseImage} label="Driver's License" icon="document_scanner" />
                  <DocImage src={user.ninImage} label="NIN / ID Card" icon="badge" />
                </div>
              </section>
            )}

            {/* ── 4. Profile Details ── */}
            <section className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Demographics & Profile</p>
              <div className="grid grid-cols-2 gap-3">

                {/* NIN — Drivers AND Owners (both register with NIN in this app) */}
                <div className={`bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 col-span-2 transition-opacity ${userDetailsLoading ? 'opacity-50' : ''}`}>
                  <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">NIN Reference</p>
                  <p className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    {userDetailsLoading && !user.nin
                      ? <span className="inline-block w-28 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      : (user.nin ? (user.nin.length > 4 ? '*'.repeat(user.nin.length - 4) + user.nin.slice(-4) : user.nin) : <span className="text-slate-400 font-normal text-xs italic">Not provided</span>)
                    }
                  </p>
                </div>

                {/* Age */}
                <div className={`bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 transition-opacity ${userDetailsLoading ? 'opacity-50' : ''}`}>
                  <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Age</p>
                  <p className="font-black text-sm text-slate-900 dark:text-white">
                    {userDetailsLoading && !user.age
                      ? <span className="inline-block w-10 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      : (user.age ? `${user.age} yrs` : <span className="text-slate-400 font-normal text-xs italic">—</span>)
                    }
                  </p>
                </div>

                {/* Gender */}
                <div className={`bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 transition-opacity ${userDetailsLoading ? 'opacity-50' : ''}`}>
                  <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Gender</p>
                  <p className="font-black text-sm text-slate-900 dark:text-white capitalize">
                    {user.gender || <span className="text-slate-400 font-normal text-xs italic">—</span>}
                  </p>
                </div>

                {/* Joined */}
                <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Joined</p>
                  <p className="font-black text-sm text-slate-900 dark:text-white truncate">{formatJoinedDate(user.createdAt)}</p>
                </div>

                {/* Rating Points */}
                <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Rating</p>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-yellow-500 text-sm filled">star</span>
                    <p className="font-black text-sm text-slate-900 dark:text-white">
                      {user.ratingPoints !== undefined ? (user.ratingPoints / 100).toFixed(2) : '5.00'}
                    </p>
                    <span className="text-[9px] text-slate-500 font-bold">({user.ratingCount || 0} trips)</span>
                  </div>
                </div>

                {/* Suspension Status */}
                {user.role === UserRole.DRIVER && (
                  <div className={`bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border ${user.suspendedUntil ? 'border-red-500/30' : 'border-slate-100 dark:border-slate-800'}`}>
                    <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Suspension Tier</p>
                    <p className={`font-black text-sm ${user.suspendedUntil ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                      Tier {user.suspensionTier || 0}
                      {user.suspendedUntil && <span className="block text-[10px] text-red-500/80 font-bold mt-0.5">Until {new Date(user.suspendedUntil).toLocaleString()}</span>}
                    </p>
                  </div>
                )}

                {/* Address — shown for owners, also for drivers if available */}
                {(user.role === UserRole.OWNER || user.address) && (
                  <div className={`bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 col-span-2 transition-opacity ${userDetailsLoading ? 'opacity-50' : ''}`}>
                    <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Address</p>
                    <p className="font-black text-sm text-slate-900 dark:text-white">
                      {userDetailsLoading && !user.address
                        ? <span className="inline-block w-40 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        : (user.address || <span className="text-slate-400 font-normal text-xs italic">Not provided</span>)
                      }
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* ── 4.5. Rating History (Drivers only) ── */}
            {user.role === UserRole.DRIVER && (
              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Rating History</p>
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {loadingHistory ? (
                    <div className="p-8 flex justify-center"><span className="material-symbols-outlined animate-spin text-slate-400">progress_activity</span></div>
                  ) : ratingHistory.length === 0 ? (
                    <div className="p-8 text-center text-[11px] text-slate-400 font-bold uppercase tracking-widest">No ratings yet</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {ratingHistory.map((log, i) => {
                        const delta = log.newPoints - log.previousPoints;
                        const isCritical = !!log.actionTriggered;
                        const isPositive = delta >= 0;
                        return (
                          <div key={log.id} className="relative flex gap-3 px-3 py-3">
                            {/* Timeline spine */}
                            {i < ratingHistory.length - 1 && (
                              <div className="absolute left-[1.85rem] top-8 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
                            )}
                            {/* Icon dot */}
                            <div className={`shrink-0 size-6 rounded-full flex items-center justify-center z-10 mt-0.5 ${
                              isCritical ? 'bg-red-500/20 border border-red-500/40' :
                              log.score === 5 ? 'bg-green-500/15 border border-green-500/30' :
                              'bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600'
                            }`}>
                              <span className={`material-symbols-outlined text-[11px] ${
                                isCritical ? 'text-red-500' :
                                log.score === 5 ? 'text-green-500' : 'text-slate-400'
                              }`}>
                                {isCritical ? 'gavel' : log.score === 5 ? 'star' : 'star_half'}
                              </span>
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-black text-[11px] ${
                                  log.score === 5 ? 'text-green-600 dark:text-green-400' :
                                  log.score === 1 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
                                }`}>
                                  {log.score} Star{log.score !== 1 && 's'}
                                </span>
                                <span className="text-[9px] text-slate-400 shrink-0">
                                  {new Date(log.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-slate-500">
                                  {log.previousPoints} → {log.newPoints}
                                </span>
                                <span className={`text-[9px] font-black ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                  {isPositive ? '+' : ''}{delta}
                                </span>
                              </div>
                              {isCritical && (
                                <span className="inline-block mt-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                                  {log.actionTriggered}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── 5. Vehicle (Owners only) ── */}
            {user.role === UserRole.OWNER && (
              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Vehicle Detail</p>
                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-11 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm text-primary">
                      <span className="material-symbols-outlined text-2xl">directions_car</span>
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900 dark:text-white">{user.carYear} {user.carModel}</p>
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary/70">{user.carType}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Address</p>
                      <p className="font-black text-slate-900 dark:text-white text-xs mt-0.5 truncate">{user.address || '—'}</p>
                    </div>
                    <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nationality</p>
                      <p className="font-black text-slate-900 dark:text-white text-xs mt-0.5">{user.nationality || '—'}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Extra bottom spacing so the sticky footer doesn't cover last content */}
            <div className="h-2" />
          </div>
        </div>

        {/* ── Sticky Action Footer (thumb zone) ── */}
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white dark:bg-surface-dark border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-3">
          {/* APPROVE button — only for PENDING drivers */}
          {user.role === UserRole.DRIVER && user.approvalStatus === 'PENDING' && !user.isBlocked && (
            <button
              onClick={() => {
                if (!canApprove) return;
                onUpdateStatus(user.id, 'APPROVED');
                onClose();
              }}
              disabled={!canApprove}
              className={`w-full font-black py-4 rounded-2xl shadow-lg transition-all active:scale-[0.97] flex items-center justify-center gap-2 text-sm ${
                canApprove
                  ? 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <span className="material-symbols-outlined">verified_user</span>
              {canApprove ? 'APPROVE REGISTRATION' : 'PAYMENT SETUP REQUIRED'}
            </button>
          )}

          {/* Reject button — only for PENDING drivers */}
          {user.role === UserRole.DRIVER && user.approvalStatus === 'PENDING' && !user.isBlocked && (
            <button
              onClick={() => { onUpdateStatus(user.id, 'REJECTED'); onClose(); }}
              className="w-full font-black py-3.5 rounded-2xl border-2 border-red-400/40 text-red-500 hover:bg-red-500/5 transition-all active:scale-[0.97] flex items-center justify-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined">cancel</span>
              REJECT APPLICATION
            </button>
          )}

          {/* Block / Restore + Close */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { onBlockUser(user.id, !user.isBlocked); onClose(); }}
              className={`font-black py-3.5 rounded-2xl transition-all active:scale-[0.97] flex items-center justify-center gap-2 text-sm border-2 ${
                user.isBlocked && !user.suspendedUntil
                  ? 'border-green-500/40 text-green-600 hover:bg-green-500/5'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">{user.isBlocked && !user.suspendedUntil ? 'lock_open' : 'block'}</span>
              {user.isBlocked && !user.suspendedUntil ? 'RESTORE' : 'BLOCK'}
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.97] text-sm"
            >
              CLOSE
            </button>
          </div>

          {/* Rating Engine Actions (Drivers Only) */}
          {user.role === UserRole.DRIVER && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                onClick={handleLiftSuspension}
                disabled={!user.suspendedUntil || lifting}
                className="font-black py-3.5 rounded-2xl border-2 border-orange-500/40 text-orange-500 hover:bg-orange-500/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97] flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-base">gavel</span>
                {lifting ? 'LIFTING...' : 'LIFT SUSPENSION'}
              </button>
              <button
                onClick={handleTerminate}
                disabled={terminating}
                className="font-black py-3.5 rounded-2xl border-2 border-red-500/40 text-red-500 hover:bg-red-500/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97] flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-base">person_remove</span>
                {terminating ? 'TERMINATING...' : 'TERMINATE DRIVER'}
              </button>
            </div>
          )}

          {/* ── Reset Internal Ledger Balance (DRIVER only) ── */}
          {user.role === UserRole.DRIVER && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
              {!resetPending ? (
                <button
                  onClick={() => setResetPending(true)}
                  className="w-full font-black py-3 rounded-2xl border-2 border-amber-400/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/5 transition-all active:scale-[0.97] flex items-center justify-center gap-2 text-xs"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  RESET INTERNAL LEDGER BALANCE
                </button>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-400/40 rounded-2xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 shrink-0 mt-0.5">warning</span>
                    <div>
                      <p className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-1">
                        Confirm Ledger Reset
                      </p>
                      <p className="text-[10px] text-amber-700/80 dark:text-amber-400/70 font-bold leading-relaxed">
                        This zeroes <strong>{user.name}'s</strong> internal cleared-earnings tracker for the current period. It does <strong>not</strong> reverse any processed payouts or affect Monnify transactions.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setResetPending(false)}
                      disabled={resettingLedger}
                      className="font-black py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-[10px] uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setResettingLedger(true);
                        try {
                          await onResetWalletBalance(user.id);
                          setResetPending(false);
                          onClose();
                        } finally {
                          setResettingLedger(false);
                        }
                      }}
                      disabled={resettingLedger}
                      className="font-black py-2.5 rounded-xl bg-amber-500 disabled:bg-amber-300 text-white transition-all active:scale-95 text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                    >
                      {resettingLedger ? (
                        <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[13px]">check</span>
                      )}
                      {resettingLedger ? 'Resetting…' : 'Confirm Reset'}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-[9px] text-slate-400 text-center font-bold px-2">
                Admin-only · Affects internal ledger tracker only · Irreversible
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDossierModal;
