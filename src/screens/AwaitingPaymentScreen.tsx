import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/services/api.service';
import { useAuthStore } from '@/stores/authStore';
import { useDriverRealtime } from '@/hooks/useDriverRealtime';
import { sounds } from '@/services/SoundService';
import { PaymentStatus } from '@/types';

type ScreenState = 'verifying' | 'paid' | 'failed' | 'timeout';

const AwaitingPaymentScreen: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  
  const [screenState, setScreenState] = useState<ScreenState>('verifying');
  const [amount, setAmount] = useState<number | null>(null);

  // Poll intervals
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearInterval_ = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handlePaid = (amt?: number) => {
    clearInterval_();
    if (amt) setAmount(amt);
    setScreenState('paid');
    sounds.playSuccess();
    // Allow driver to read the success message before auto-navigating
    setTimeout(() => {
      navigate('/driver', { replace: true });
    }, 4000);
  };

  // Socket listener for immediate webhook processing
  useDriverRealtime({
    user: currentUser,
    approvalStatus: 'APPROVED',
    onPaymentUpdated: (payload) => {
      if (payload.paymentStatus === 'PAID') {
        handlePaid(payload.amount);
      } else if (payload.paymentStatus === 'FAILED') {
        clearInterval_();
        setScreenState('failed');
      }
    }
  });

  // Polling fallback
  useEffect(() => {
    if (!tripId || screenState !== 'verifying') return;

    const pollStatus = async () => {
      pollCountRef.current += 1;
      try {
        const data = await api.get<{ paymentStatus: PaymentStatus; amount?: number }>(`/payments/status/${tripId}`);
        if (data.paymentStatus === 'PAID') {
          handlePaid(data.amount);
        } else if (data.paymentStatus === 'FAILED') {
          clearInterval_();
          setScreenState('failed');
        } else if (pollCountRef.current > 120) { // 5 minutes max polling
          clearInterval_();
          setScreenState('timeout');
        }
      } catch (err) {
        // Ignore network errors during polling
      }
    };

    pollStatus();
    intervalRef.current = setInterval(pollStatus, 5000);

    return () => clearInterval_();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, screenState]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 px-6 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      {screenState === 'verifying' && (
        <div className="flex flex-col items-center text-center z-10 animate-fade-in">
          {/* Pulsing Icon */}
          <div className="relative flex items-center justify-center w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
            <div className="absolute inset-4 rounded-full border-4 border-amber-500/40 animate-pulse" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/30">
              <span className="material-symbols-outlined text-white text-4xl">payments</span>
            </div>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight mb-3">
            Awaiting Payment
          </h1>
          <p className="text-sm text-slate-400 max-w-[280px] leading-relaxed">
            Please wait while the car owner completes the payment. Do not leave the drop-off location until this is confirmed.
          </p>

          <div className="mt-12 flex items-center gap-3 bg-slate-900/50 px-5 py-3 rounded-2xl border border-slate-800">
            <span className="material-symbols-outlined text-amber-500 animate-spin">refresh</span>
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Verifying transaction...</span>
          </div>
        </div>
      )}

      {screenState === 'paid' && (
        <div className="flex flex-col items-center text-center z-10 animate-fade-in">
          <div className="relative flex items-center justify-center w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <span className="material-symbols-outlined text-white text-5xl">verified</span>
            </div>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            Payment Confirmed!
          </h1>
          <p className="text-sm text-slate-400 max-w-[280px] leading-relaxed mb-6">
            The trip has been fully settled. You are cleared to proceed.
          </p>

          {amount && (
            <div className="bg-slate-900 px-8 py-4 rounded-3xl border border-slate-800 mb-8">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Amount Settled</p>
              <p className="text-3xl font-black text-emerald-400">₦{amount.toLocaleString()}</p>
            </div>
          )}

          <button
            onClick={() => navigate('/driver', { replace: true })}
            className="w-full max-w-xs bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Return to Dashboard
          </button>
        </div>
      )}

      {(screenState === 'failed' || screenState === 'timeout') && (
        <div className="flex flex-col items-center text-center z-10 animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-red-500 text-4xl">error</span>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            Payment Delayed
          </h1>
          <p className="text-sm text-slate-400 max-w-[280px] leading-relaxed mb-8">
            The payment could not be verified automatically. You may contact support or check your dashboard later.
          </p>

          <button
            onClick={() => navigate('/driver', { replace: true })}
            className="w-full max-w-xs bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            Dismiss to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default AwaitingPaymentScreen;
