import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api.service';

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 12; // 30 seconds total
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
}

// ─── Animated Spinner ─────────────────────────────────────────────────────────
const PulsingLogo: React.FC = () => (
  <div className="relative flex items-center justify-center w-28 h-28">
    {/* Outer ring */}
    <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
    <div className="absolute inset-2 rounded-full border-4 border-primary/30" />
    {/* Inner card */}
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
  const { isInitializing, isAuthenticated } = useAuthStore();

  const [screenState, setScreenState] = useState<ScreenState>('waiting_session');
  const [pollCount, setPollCount] = useState(0);
  const [result, setResult] = useState<PollResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef(false);

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
          clearInterval_();
          localStorage.removeItem(STORAGE_KEY);
          setResult(data);
          setScreenState('paid');
          // Auto-navigate after 3s
          setTimeout(() => navigate('/owner', { replace: true }), 3000);
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

        // Still PENDING — check if we've exhausted retries
        if (pollCountRef.current >= MAX_POLLS) {
          clearInterval_();
          setScreenState('timeout');
        }
      } catch (err: any) {
        clearInterval_();
        const msg = err?.message || 'Could not verify payment status.';
        if (err?.status === 401) {
          // Auth expired mid-poll — bounce to login
          navigate('/login', { replace: true });
          return;
        }
        setErrorMsg(msg);
        setScreenState('error');
      }
    };

    // Run immediately, then on interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  };

  // ── Effect: wait for session, then start polling ───────────────────────────
  useEffect(() => {
    // Don't start until App.tsx has finished restoring session
    if (isInitializing) return;

    if (!isAuthenticated) {
      // Preserve where they came from so login can redirect back
      navigate('/login', { replace: true });
      return;
    }

    const tripId = localStorage.getItem(STORAGE_KEY);
    if (!tripId) {
      setScreenState('no_trip');
      return;
    }

    startPolling(tripId);

    return () => clearInterval_();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing, isAuthenticated]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background-light dark:bg-background-dark px-6 py-12">

      {/* ── WAITING FOR SESSION ─────────────────────────────────────────── */}
      {(screenState === 'waiting_session') && (
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-400 text-2xl animate-spin">progress_activity</span>
          </div>
          <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Restoring session…</p>
        </div>
      )}

      {/* ── POLLING ─────────────────────────────────────────────────────── */}
      {screenState === 'polling' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <PulsingLogo />

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Verifying Payment
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              We're confirming your payment with Monnify. This usually takes a few seconds.
            </p>
          </div>

          <ProgressDots count={pollCount} max={MAX_POLLS} />

          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
            Please don't close this page…
          </p>
        </div>
      )}

      {/* ── PAID ────────────────────────────────────────────────────────── */}
      {screenState === 'paid' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          {/* Success icon */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <span className="material-symbols-outlined text-white text-4xl">verified</span>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              Payment Confirmed!
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Your trip has been settled successfully. Thank you for riding with BICA.
            </p>
            {result?.amountPaid && (
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                ₦{result.amountPaid.toLocaleString()}
              </p>
            )}
          </div>

          <div className="w-full p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-500 text-lg">schedule_send</span>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-left">
              Redirecting to dashboard in 3 seconds…
            </p>
          </div>

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Go to Dashboard Now
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
            <h1 className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              Partial Payment
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              We received part of your payment. Please settle the remaining balance to complete the trip.
            </p>
          </div>

          {result && (
            <div className="w-full space-y-3">
              <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount Paid</span>
                <span className="text-lg font-black text-emerald-600">₦{(result.amountPaid ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Balance Due</span>
                <span className="text-lg font-black text-amber-600">₦{(result.amountRemaining ?? 0).toLocaleString()}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Return to Dashboard
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
            <h1 className="text-2xl font-black text-red-600 dark:text-red-400 tracking-tight">
              Payment Failed
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Your payment could not be completed. Please try again from the trip summary.
            </p>
          </div>

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── TIMEOUT ─────────────────────────────────────────────────────── */}
      {screenState === 'timeout' && (
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-xs text-center">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border-2 border-blue-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-500 text-4xl">hourglass_bottom</span>
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Still Processing
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Your payment is being processed by Monnify. It may take a couple more minutes to reflect. You can check your trip status from the dashboard.
            </p>
          </div>

          <div className="w-full p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-400 text-lg">info</span>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 leading-relaxed text-left">
              Your status will update automatically once Monnify confirms the transaction.
            </p>
          </div>

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Check Later
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
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Nothing to Verify
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              We couldn't find a pending payment to check. Head back to the dashboard to view your trips.
            </p>
          </div>

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-primary text-white font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Go to Dashboard
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
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Connection Error
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {errorMsg || 'Unable to reach the server. Please check your connection and try again.'}
            </p>
          </div>

          <button
            onClick={() => {
              // Reset and retry
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
            className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Retry
          </button>

          <button
            onClick={() => navigate('/owner', { replace: true })}
            className="w-full bg-transparent border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black py-3 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs"
          >
            Go to Dashboard
          </button>
        </div>
      )}

      {/* ── Branding footer ─────────────────────────────────────────────── */}
      <div className="absolute bottom-8 flex flex-col items-center gap-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
          Powered by
        </p>
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 italic tracking-tight">
          BICA<span className="text-primary not-italic">DRIVE</span>
        </span>
      </div>
    </div>
  );
};

export default PaymentCompleteScreen;
