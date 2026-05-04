import React from 'react';

interface TripPaymentSummaryProps {
  role?: 'OWNER' | 'DRIVER';
  pickup?: string;
  destination?: string;
  fareBreakdown: {
    distanceKm?: number;
    actualMins?: number;
    totalMins?: number;
    finalFare: number;
    totalAmount?: number;
    driverEarnings?: number;
    platformFee?: number;
  } | null;
  paymentStatus?: 'UNPAID' | 'SUCCESS' | 'FAILED' | 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
  paymentMessage?: string | null;
  onPayNow?: () => void;
  onClose: () => void;
  isInitiatingPayment?: boolean;
}

const TripPaymentSummary: React.FC<TripPaymentSummaryProps> = ({ 
  role = 'OWNER',
  pickup,
  destination,
  fareBreakdown,
  paymentStatus = 'UNPAID',
  paymentMessage,
  onPayNow,
  onClose,
  isInitiatingPayment = false
}) => {
  const isDriver = role === 'DRIVER';
  const isPaid = paymentStatus === 'SUCCESS' || paymentStatus === 'PAID';

  // Calculate platform fee for driver if not provided
  const total = fareBreakdown?.totalAmount || fareBreakdown?.finalFare || 0;
  const earnings = fareBreakdown?.driverEarnings || 0;
  const commission = fareBreakdown?.platformFee || (total - earnings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-display">
      <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up border border-white/10">
        {/* Header */}
        <div className="px-8 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase">
              {isDriver ? 'Earnings' : (isPaid ? 'Settled!' : 'Trip Bill')}
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">
              {isDriver ? 'Performance Audit' : (isPaid ? 'Verification Complete' : 'Awaiting Settlement')}
            </p>
          </div>
          {isPaid && (
            <button 
              onClick={onClose}
              className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all active:scale-90"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div className="p-8 space-y-8">
          {/* Detailed Breakdown */}
          <div className="space-y-4">
             <div className="flex justify-between items-center opacity-70">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Distance / Time</span>
                <span className="text-xs font-black text-slate-900 dark:text-white italic">{fareBreakdown?.distanceKm || 0}km · {fareBreakdown?.actualMins || fareBreakdown?.totalMins || 0}m</span>
             </div>

              {isDriver ? (
               <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center opacity-60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gross Trip Fare</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">₦{total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center opacity-60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">BICA Commission</span>
                    <span className="text-sm font-black text-red-500">- ₦{commission.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 mt-2">
                    <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Net Earnings</span>
                    <span className="text-3xl font-black text-emerald-600 tracking-tighter italic">₦{earnings.toLocaleString()}</span>
                  </div>
               </div>
              ) : (
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                   <div className="flex justify-between items-center p-6 rounded-[2.5rem] bg-primary/5 border border-primary/10">
                      <span className="text-[11px] font-black text-primary uppercase tracking-widest">Total Fare</span>
                      <span className="text-4xl font-black text-primary tracking-tighter italic">₦{total.toLocaleString()}</span>
                   </div>
                </div>
              )}
          </div>

          {/* Contextual Status Info */}
          {isPaid ? (
            <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex gap-4 items-start animate-fade-in">
               <span className="material-symbols-outlined text-emerald-500 mt-0.5">verified</span>
               <div>
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Payment Confirmed</h4>
                  <p className="text-[10px] text-emerald-700/70 font-bold leading-relaxed">
                    {isDriver ? 'Funds have been credited to your internal ledger and will be settled automatically.' : 'Trip settlement has been verified by Monnify and BICA.'}
                  </p>
               </div>
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex gap-4 items-start">
               <span className="material-symbols-outlined text-slate-400 mt-0.5">{isDriver ? 'hourglass_top' : 'account_balance'}</span>
               <div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{isDriver ? 'Awaiting Confirmation' : 'Safe Checkout'}</h4>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed italic">
                    {isDriver ? 'Verification is required before earnings are credited to your active wallet.' : 'BICA uses bank-grade encryption to secure every transaction.'}
                  </p>
               </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {!isDriver && !isPaid && onPayNow && (
              <button 
                onClick={onPayNow}
                disabled={isInitiatingPayment}
                className="w-full bg-primary hover:bg-primary/90 text-white font-black h-16 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
              >
                {isInitiatingPayment ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined">payments</span>
                )}
                {isInitiatingPayment ? 'SECUREING LINK...' : 'Confirm & Pay Now'}
              </button>
            )}

            {isPaid && (
              <button 
                onClick={onClose}
                className="w-full h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95"
              >
                {isDriver ? 'Return Home' : 'Back to Dashboard'}
              </button>
            )}
            
            {!isDriver && !isPaid && (
              <p className="text-center text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-60">
                Payment verified by Monnify Infrastructure
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripPaymentSummary;
