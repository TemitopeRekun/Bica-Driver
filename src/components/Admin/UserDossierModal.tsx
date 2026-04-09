import React, { useState } from 'react';
import { UserProfile, UserRole, ApprovalStatus } from '@/types';

interface UserDossierModalProps {
  user: UserProfile;
  userDetailsLoading: boolean;
  retryingSubAccountIds: Set<string>;
  onClose: () => void;
  onUpdateStatus: (userId: string, approvalStatus: ApprovalStatus) => Promise<void>;
  onBlockUser: (userId: string, isBlocked: boolean) => Promise<void>;
  onRetrySubAccount: (userId: string) => Promise<any>;
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
  formatJoinedDate
}) => {
  const canApprove = user.role === UserRole.DRIVER
    && user.approvalStatus === 'PENDING'
    && !user.isBlocked
    && !!user.subAccountActive;

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
                  {user.isBlocked && <span className="text-[8px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full uppercase">Blocked</span>}
                  {user.isOnline && <span className="text-[8px] font-black bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full uppercase">Online</span>}
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
                      : (user.nin || <span className="text-slate-400 font-normal text-xs italic">Not provided</span>)
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

                {/* Rating */}
                <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Rating</p>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-yellow-500 text-sm filled">star</span>
                    <p className="font-black text-sm text-slate-900 dark:text-white">{user.rating || 'N/A'}</p>
                    <span className="text-[9px] text-slate-500 font-bold">({user.trips || 0} trips)</span>
                  </div>
                </div>

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
                user.isBlocked
                  ? 'border-green-500/40 text-green-600 hover:bg-green-500/5'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">{user.isBlocked ? 'lock_open' : 'block'}</span>
              {user.isBlocked ? 'RESTORE' : 'SUSPEND'}
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.97] text-sm"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDossierModal;
