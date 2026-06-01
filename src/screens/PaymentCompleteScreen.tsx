import React, { useEffect, useRef, useState } from 'react';
import { LOGO } from '@/constants';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api.service';
import { useRatingGateStore } from '@/stores/ratingGateStore';
import { useUIStore } from '@/stores/uiStore';
import { useOwnerRealtime } from '@/hooks/useOwnerRealtime';
import { PollingManager, DEFAULT_POLLING_CONFIG, PollMetrics } from '@/utils/pollingUtil';
import { Capacitor } from '@capacitor/core';

// ─── Constants ────────────────────────────────────────────────────────────────
// 🏢 Enterprise polling config: Spread load across distributed users
// - Start at 1s, back off to max 16s
// - Jitter prevents thundering herd when Monnify is slow
const PAYMENT_POLLING_CONFIG = {
  initialIntervalMs: 1000,
  maxIntervalMs: 16000,
  backoffMultiplier: 1.5,
  maxAttempts: 48, // ~5 min total with exponential backoff
  jitterFactor: 0.2, // ±20% jitter
};

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
  const pollingManagerRef = useRef<PollingManager | null>(null);
  const tripIdRef = useRef<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);
  const isSuccessHandledRef = useRef(false);  // 🛡️ Idempotency guard: prevent double handleSuccess

  // Pull-to-refresh state
  const [pullY, setPullY] = useState(0);
  const touchStartYRef = useRef(0);
  const isPullingRef = useRef(false);

  const handleSuccess = (data: any) => {
    // 🛡️ Idempotency check: if already handled, ignore subsequent calls
    if (isSuccessHandledRef.current) return;
    isSuccessHandledRef.current = true;

    clearPolling();
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
      clearPolling();
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Block hardware back button on Android — going back mid-payment is illogical
  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;
    let handle: any;
    import('@capacitor/app').then(({ App }) => {
      handle = App.addListener('backButton', () => { /* intentionally blocked */ });
    });
    return () => { handle?.then?.((h: any) => h.remove()); };
  }, []);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartYRef.current = touch.clientY;
    isPullingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || touchStartYRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const delta = touch.clientY - touchStartYRef.current;
    if (delta > 0) setPullY(Math.min(delta, 72));
  };

  const handleTouchEnd = () => {
    if (pullY >= 60 && (screenState === 'polling' || screenState === 'timeout' || screenState === 'error')) {
      hasStartedRef.current = false;
      isSuccessHandledRef.current = false;  // 🛡️ Reset idempotency guard for retry
      pollCountRef.current = 0;
      setPollCount(0);
      setErrorMsg(null);
      const tripId = localStorage.getItem(STORAGE_KEY) || tripIdRef.current;
      if (tripId) startPolling(tripId);
    }
    setPullY(0);
    isPullingRef.current = false;
  };

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

  const clearPolling = () => {
    if (pollingManagerRef.current) {
      pollingManagerRef.current.stop();
      pollingManagerRef.current = null;
    }
  };

  const startPolling = (tripId: string) => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    setScreenState('polling');
    
    // 🏢 Enterprise polling: exponential backoff prevents API spike
    pollingManagerRef.current = new PollingManager(
      async () => {
        // Poll function: returns true to stop polling, false to continue
        try {
          const data: PollResult = await api.get(`/payments/status/${tripId}`);
          
          if (data.paymentStatus === 'PAID' || data.paymentStatus === 'OVERPAID') {
            handleSuccess(data);
            return true; // Stop polling
          }

          if (data.paymentStatus === 'PARTIALLY_PAID') {
            localStorage.removeItem(STORAGE_KEY);
            setResult(data);
            setScreenState('partial');
            return true; // Stop polling
          }

          if (data.paymentStatus === 'FAILED' || data.paymentStatus === 'CANCELLED') {
            localStorage.removeItem(STORAGE_KEY);
            setResult(data);
            setScreenState('failed');
            return true; // Stop polling
          }

          return false; // Continue polling
        } catch (err: any) {
          const msg = err?.message || 'Could not verify payment status.';
          if (err?.status === 401) {
            navigate('/login', { replace: true });
            return true; // Stop polling
          }
          setErrorMsg(msg);
          return false; // Retry with backoff
        }
      },
      PAYMENT_POLLING_CONFIG,
      (metrics: PollMetrics) => {
        // Update UI with current poll count
        setPollCount(metrics.totalAttempts);
      },
      (error: Error, attemptNumber: number) => {
        // Log backoff attempts (for observability)
        console.warn(`[PaymentPolling] Attempt ${attemptNumber} failed:`, error.message);
      }
    );

    pollingManagerRef.current.start();
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
      clearPolling();
      hasStartedRef.current = false;
      pollCountRef.current = 0;
      setPollCount(0);
      startInitialization();
    };

    window.addEventListener('bica-app-resumed', handleResume);

    return () => {
      clearPolling();
      window.removeEventListener('bica-app-resumed', handleResume);
    };
  }, [isInitializing, isAuthenticated]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-start bg-background-light dark:bg-background-dark px-6 pt-32 pb-12 font-display"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullY > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all"
          style={{ height: pullY }}
        >
          <div className={`flex items-center gap-2 transition-opacity ${pullY >= 60 ? 'opacity-100' : 'opacity-40'}`}>
            <span className={`material-symbols-outlined text-primary text-lg ${pullY >= 60 ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              {pullY >= 60 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

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
                <span className="bg-slate-100 dark:bg-white/10 text-slate-500 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest animate-pulse">Step 2: BicaDriver Verification</span>
             </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase tracking-tighter">
              Verifying Payment
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              You've completed checkout! We're now confirming the transaction with Monnify and your bank.
            </p>
          </div>

          <ProgressDots count={pollCount} max={PAYMENT_POLLING_CONFIG.maxAttempts} />

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
              {errorMsg || 'Unable to reach the BicaDriver verification server. Please check your connection.'}
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
        <img src={LOGO} alt="BicaDriver" className="h-6 w-auto object-contain rounded-lg" />
      </div>
    </div>
  );
};

export default PaymentCompleteScreen;
