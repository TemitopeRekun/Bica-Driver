import React, { useEffect, useRef, useState } from 'react';
import { LOGO } from '@/constants';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api.service';
import { useRatingGateStore } from '@/stores/ratingGateStore';
import { useUIStore } from '@/stores/uiStore';
import { useOwnerRealtime } from '@/hooks/useOwnerRealtime';

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 48; // 2 minutes total
const STORAGE_KEY = 'bica_pending_payment_tripId';

// ─── Types ────────────────────────────────────────────────────────────────────
type ScreenState =
  | 'waiting_session'   // App is still restoring auth from localforage
  | 'polling'           // Actively checking payment status
  | 'paid'              // Confirmed PAID
  | 'partial'           // PARTIALLY_PAID
  | 'failed'            // FAILED or CANCELLED
  | 'timeout'           // 30 s elapsed, still PENDING
  | 'no_trip'           // No tripId found in localStorage
  | 'error';            // Unexpected network/auth error

interface PollResult {
  paymentStatus: string;
  amountPaid?: number;
  amountRemaining?: number;
  amount?: number;
  postTripAction?: string;
}

// ─── Animated Spinner ─────────────────────────────────────────────────────────
const PulsingLogo: React.FC = () => (
  <div className="relative flex items-center justify-center w-28 h-28">
    <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
    <div className="absolute inset-2 rounded-full border-4 border-primary/30" />
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/30">
      <span className="material-symbols-outlined text-white text-3xl">payments</span>
    </div>
  </div>
);

// ─── Progress Dots ────────────────────────────────────────────────────────────
const ProgressDots: React.FC<{ count: number; max: number }> = ({ count, max }) => (
  <div className="flex gap-1.5 justify-center mt-6">
    {Array.from({ length: max }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-500 ${
          i < count
            ? 'w-4 bg-primary'
            : 'w-1.5 bg-slate-300 dark:bg-slate-700'
        }`}
      />
    ))}
  </div>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const PaymentCompleteScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isInitializing, isAuthenticated, currentUser } = useAuthStore();

  const [screenState, setScreenState] = useState<ScreenState>('waiting_session');
  const [pollCount, setPollCount] = useState(0);
  const [result, setResult] = useState<PollResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripIdRef = useRef<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);

  const handleSuccess = (data: any) => {
    clearInterval_();
    localStorage.removeItem(STORAGE_KEY);
    setResult(data);
    setScreenState('paid');
    
    // Clear any existing timeout
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);

    successTimeoutRef.current = setTimeout(async () => {
      try {
        const pending = await useRatingGateStore.getState().checkPendingRating();
        if (pending) {
          navigate(`/rate-driver/${pending.tripId}`, { replace: true });
        } else {
          navigate('/owner', { replace: true });
        }
      } catch (err) {
        console.error('Failed to check rating gate after success', err);
        navigate('/owner', { replace: true });
      }
    }, 4500);
  };

  useEffect(() => {
    return () => {
      clearInterval_();
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // 🛡️ Real-time Success Handshake
  useOwnerRealtime({
    ownerId: currentUser?.id,
    rideState: 'COMPLETED',
    trackedDriverIdRef: { current: null },
    pickupRef: { current: null },
    rideStateRef: { current: 'COMPLETED' },
    showDriverPickerRef: { current: false },
    refreshAvailableDriversRef: { current: async () => {} },
    onDriverAccepted: () => {},
    onDriverDeclined: () => {},
    onTripCompleted: () => {},
    onLocationUpdated: () => {},
    onPaymentUpdated: (payload) => {
      if (payload.paymentStatus === 'PAID' || payload.message?.toLowerCase().includes('success')) {
        handleSuccess(payload);
      }
    }
  });

  const clearInterval_ = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startPolling = (tripId: string) => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    setScreenState('polling');

    const poll = async () => {
      pollCountRef.current += 1;
      setPollCount(pollCountRef.current);

      try {
        const data: PollResult = await api.get(`/payments/status/${tripId}`);

        if (data.paymentStatus === 'PAID' || data.paymentStatus === 'OVERPAID') {
          if (data.postTripAction === 'REQUIRE_RATING') {
            handleSuccess(data);
          } else {
            handleSuccess(data); // fallback: still navigate away
          }
          return;
        }

        if (data.paymentStatus === 'PARTIALLY_PAID') {
          clearInterval_();
          localStorage.removeItem(STORAGE_KEY);
          setResult(data);
          setScreenState('partial');
          return;
        }

        if (data.paymentStatus === 'FAILED' || data.paymentStatus === 'CANCELLED') {
          clearInterval_();
          localStorage.removeItem(STORAGE_KEY);
          setResult(data);
          setScreenState('failed');
          return;
        }

        if (pollCountRef.current >= MAX_POLLS) {
          clearInterval_();
          setScreenState('timeout');
        }
      } catch (err: any) {
        clearInterval_();
        const msg = err?.message || 'Could not verify payment status.';
        if (err?.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setErrorMsg(msg);
        setScreenState('error');
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    if (isInitializing) return;

    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    const startInitialization = async () => {
      let tripId = localStorage.getItem(STORAGE_KEY);
      
      if (!tripId) {
        try {
          const currentRide = await api.get<any>('/rides/current');
          if (currentRide && (currentRide.postTripAction === 'REQUIRE_PAYMENT' || currentRide.postTripAction === 'VERIFYING_PAYMENT' || currentRide.postTripAction === 'REQUIRE_RATING' || currentRide.paymentStatus !== 'PAID')) {
            tripId = currentRide.id;
          }
        } catch (e) {
          console.warn('Failed to fetch fallback tripId from /rides/current', e);
        }
      }

      if (!tripId) {
        setScreenState('no_trip');
        return;
      }

      startPolling(tripId);
    };

    startInitialization();

    const handleResume = () => {
      clearInterval_();
      hasStartedRef.current = false;
      pollCountRef.current = 0;
      setPollCount(0);
      startInitialization();
    };

    window.addEventListener('bica-app-resumed', handleResume);

    return () => {
      clearInterval_();
      window.removeEventListener('bica-app-resumed', handleResume);
    };
  }, [isInitializing, isAuthenticated]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-background-light dark:bg-background-dark px-6 pt-32 pb-12 font-display">

      {/* ── WAITING FOR SESSION ─────────────────────────────────────────── */}
      {(screenState === 'waiting_session') && (
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-400 text-2xl animate-spin">progress_activity</span>
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Restoring session…</p>
        </div>
      )}

      {/* ── POLLING ─────────────────────────────────────────────────────── */}
      {screenState === 'polling' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <PulsingLogo />

          <div className="space-y-1">
             <div className="flex items-center justify-center gap-2 mb-2">
                <span className="bg-primary/10 text-primary text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest border border-primary/20">Step 1: Checkout Done</span>
                <span className="material-symbols-outlined text-slate-300 text-xs">arrow_forward</span>
                <span className="bg-slate-100 dark:bg-white/10 text-slate-500 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest animate-pulse">Step 2: BICA Verification</span>
             </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase tracking-tighter">
              Verifying Payment
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              You've completed checkout! We're now confirming the transaction with Monnify and your bank.
            </p>
          </div>

          <ProgressDots count={pollCount} max={MAX_POLLS} />

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed">
               Please stay on this page.<br/>Confirmation usually takes 5-15 seconds.
             </p>
          </div>
        </div>
      )}

      {/* ── PAID ────────────────────────────────────────────────────────── */}
      {screenState === 'paid' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <span className="material-symbols-outlined text-white text-4xl">verified</span>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter italic uppercase">
              Settled!
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
              Verification successful. Your trip is fully paid and your chauffeur has been notified.
            </p>
            {result?.amountPaid && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-[10px] font-black text-emerald-600/50 uppercase tracking-widest mb-1">Total Verified Amount</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                  ₦{result.amountPaid.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="w-full p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-500 text-lg">auto_mode</span>
            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-left leading-tight">
              Auto-redirecting to dashboard<br/>for your receipt...
            </p>
          </div>

          <button
            onClick={async () => {
              const pending = await useRatingGateStore.getState().checkPendingRating();
              if (pending) {
                navigate(`/rate-driver/${pending.tripId}`, { replace: true });
              } else {
                navigate('/owner', { replace: true });
              }
            }}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
          >
            Dashboard
          </button>
        </div>
      )}

      {/* ── PARTIALLY PAID ──────────────────────────────────────────────── */}
      {screenState === 'partial' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-500 text-4xl">warning</span>
          </div>

          <div>
            <h1 className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight italic uppercase">
              Incomplete Payment
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
              We received a partial amount. The remaining balance must be settled to clear this trip.
            </p>
          </div>

          {result && (
            <div className="w-full space-y-3">
              <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Amount Paid</span>
                <span className="text-lg font-black text-emerald-600">₦{(result.amountPaid ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20">
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Balance Due</span>
                <span className="text-lg font-black text-amber-600">₦{(result.amountRemaining ?? 0).toLocaleString()}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
          >
            Review Balance
          </button>
        </div>
      )}

      {/* ── FAILED ──────────────────────────────────────────────────────── */}
      {screenState === 'failed' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-4xl">cancel</span>
          </div>

          <div>
            <h1 className="text-2xl font-black text-red-600 dark:text-red-400 tracking-tight italic uppercase">
              Verification Failed
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
              Monnify could not confirm this payment. If you have been debited, please wait 5 minutes and refresh your dashboard.
            </p>
          </div>

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
          >
            Retry from Summary
          </button>

          <button
            onClick={() => {
              useUIStore.getState().setSupportContext({
                tripId: localStorage.getItem(STORAGE_KEY) || undefined,
                paymentStatus: 'FAILED',
                recentFailureContext: `Payment failed for trip. Verification count: ${pollCount}.`,
                openedAt: new Date().toISOString()
              });
              useUIStore.getState().setSupportOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-sm">support_agent</span>
            Contact Support
          </button>
        </div>
      )}

      {/* ── TIMEOUT (Extended Verification) ────────────────────────────── */}
      {screenState === 'timeout' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-500 text-4xl animate-pulse">hourglass_top</span>
          </div>
          
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase tracking-tighter">
              Awaiting Bank Confirmation
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
              We've been polling for 2 minutes and your bank hasn't confirmed yet. 
              <span className="text-primary block mt-2">Please stay with your driver until we receive the success signal.</span>
            </p>
          </div>

          <div className="w-full p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 space-y-3">
             <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Driver Instructions</p>
             <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 text-left leading-relaxed italic">
               "Ask the driver to check their wallet in a few minutes. If you have been debited, do not pay again."
             </p>
          </div>

          <button
            onClick={() => {
              hasStartedRef.current = false;
              pollCountRef.current = 0;
              setPollCount(0);
              const tripId = localStorage.getItem(STORAGE_KEY);
              if (tripId) startPolling(tripId);
            }}
            className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
          >
            Retry Verification Now
          </button>

          <button
            onClick={() => {
              useUIStore.getState().setSupportContext({
                tripId: localStorage.getItem(STORAGE_KEY) || undefined,
                paymentStatus: 'TIMEOUT',
                recentFailureContext: 'Verification timed out after 30 seconds.',
                openedAt: new Date().toISOString()
              });
              useUIStore.getState().setSupportOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-sm">support_agent</span>
            Contact Support
          </button>
        </div>
      )}

      {/* ── NO TRIP ID ──────────────────────────────────────────────────── */}
      {screenState === 'no_trip' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-400 text-4xl">search_off</span>
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
              Record Not Found
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
              We couldn't identify an active payment to verify.
            </p>
          </div>

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-primary text-white font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
          >
            Dashboard
          </button>
        </div>
      )}

      {/* ── ERROR ───────────────────────────────────────────────────────── */}
      {screenState === 'error' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-4xl">wifi_off</span>
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
              Network Issue
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
              {errorMsg || 'Unable to reach the BICA verification server. Please check your connection.'}
            </p>
          </div>

          <button
            onClick={() => {
              hasStartedRef.current = false;
              pollCountRef.current = 0;
              setPollCount(0);
              setErrorMsg(null);
              const tripId = localStorage.getItem(STORAGE_KEY);
              if (tripId) {
                startPolling(tripId);
              } else {
                setScreenState('no_trip');
              }
            }}
            className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
          >
            Retry Verification
          </button>
        </div>
      )}

      {/* ── Branding footer ─────────────────────────────────────────────── */}
      <div className="absolute bottom-8 flex flex-col items-center gap-1 opacity-40">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">
          Secure Verification
        </p>
        <img src={LOGO} alt="Bica Driver" className="h-6 w-auto object-contain rounded-lg" />
      </div>
    </div>
  );
};

export default PaymentCompleteScreen;
