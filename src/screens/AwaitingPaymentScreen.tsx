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

  useEffect(() => {
    if (!tripId) {
      navigate('/driver', { replace: true });
    }
  }, []);

  const { currentUser } = useAuthStore();
  
  const [screenState, setScreenState] = useState<ScreenState>('verifying');
  const [amount, setAmount] = useState<number | null>(null);

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
    setTimeout(() => {
      navigate('/driver', { replace: true });
    }, 4000);
  };

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

  useEffect(() => {
    if (!tripId) return;
    if (screenState !== 'verifying') return;

    const pollStatus = async () => {
      pollCountRef.current += 1;
      try {
        const data = await api.get<{ paymentStatus: PaymentStatus; amount?: number }>(`/payments/status/${tripId}`);
        if (data.paymentStatus === 'PAID') {
          handlePaid(data.amount);
        } else if (data.paymentStatus === 'FAILED') {
          clearInterval_();
          setScreenState('failed');
        } else if (pollCountRef.current > 120) { 
          clearInterval_();
          setScreenState('timeout');
        }
      } catch (err) {}
    };

    pollStatus();
    intervalRef.current = setInterval(pollStatus, 5000);

    return () => clearInterval_();
  }, [tripId, screenState]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 px-6 py-12 relative overflow-hidden font-display">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      {screenState === 'verifying' && (
        <div className="flex flex-col items-center text-center z-10 animate-fade-in w-full max-w-xs">
          <div className="relative flex items-center justify-center w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
            <div className="absolute inset-4 rounded-full border-4 border-amber-500/40 animate-pulse" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/30">
              <span className="material-symbols-outlined text-white text-4xl">payments</span>
            </div>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tighter italic uppercase mb-3">
            Payment Pending
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed font-medium px-4">
            The owner is currently completing checkout. Your wallet will credit automatically once confirmed.
          </p>

          {/* Payment Roadmap Visual */}
          <div className="mt-6 w-full grid grid-cols-4 gap-2 px-2 opacity-80">
             <div className="flex flex-col items-center gap-2">
                <div className="size-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                   <span className="material-symbols-outlined text-sm">check</span>
                </div>
                <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Finished</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <div className="size-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                   <span className="material-symbols-outlined text-sm">shopping_cart</span>
                </div>
                <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Checkout</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <div className="size-8 rounded-xl bg-amber-500 flex items-center justify-center text-white animate-pulse">
                   <span className="material-symbols-outlined text-sm">sync</span>
                </div>
                <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest">Verifying</span>
             </div>
             <div className="flex flex-col items-center gap-2 opacity-30">
                <div className="size-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500">
                   <span className="material-symbols-outlined text-sm">verified_user</span>
                </div>
                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Cleared</span>
             </div>
          </div>

          <div className="mt-8 p-4 bg-slate-900/80 rounded-3xl border border-slate-800 backdrop-blur-md">
             <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
               <strong className="text-slate-200">Safety Policy:</strong> Please do not leave the drop-off point until verification is complete.
             </p>
          </div>
        </div>
      )}

      {screenState === 'paid' && (
        <div className="flex flex-col items-center text-center z-10 animate-fade-in w-full max-w-xs">
          <div className="relative flex items-center justify-center w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <span className="material-symbols-outlined text-white text-5xl">verified</span>
            </div>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tighter italic uppercase mb-2">
            Payment Cleared!
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed font-bold mb-6">
            Verification 100% complete. Your wallet has been updated.
          </p>

          {amount && (
            <div className="bg-slate-900/80 backdrop-blur-xl px-10 py-6 rounded-[2.5rem] border border-white/5 mb-8 w-full shadow-2xl">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Earnings Settled</p>
              <p className="text-4xl font-black text-emerald-400 tracking-tighter">₦{amount.toLocaleString()}</p>
            </div>
          )}

          <button
            onClick={() => navigate('/driver', { replace: true })}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
          >
            Dashboard
          </button>
        </div>
      )}

      {(screenState === 'failed' || screenState === 'timeout') && (
        <div className="flex flex-col items-center text-center z-10 animate-fade-in w-full max-w-xs">
          <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-red-500 text-4xl">error</span>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tighter italic uppercase mb-2">
            Verification Lag
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed font-bold mb-8">
            Monnify is taking longer to verify this payment. You may dismiss this screen and check your Ledger later.
          </p>

          <button
            onClick={() => navigate('/driver', { replace: true })}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
          >
            Check Ledger Later
          </button>
        </div>
      )}
    </div>
  );
};

export default AwaitingPaymentScreen;
