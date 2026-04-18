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
  } | null;
  paymentStatus?: 'UNPAID' | 'SUCCESS' | 'FAILED' | 'PENDING' | 'PAID' | 'PARTIALLY_PAID';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {isDriver ? 'Trip Earnings' : (paymentStatus === 'SUCCESS' ? 'Trip Paid!' : 'Trip Result')}
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {isDriver ? 'Performance Summary' : (paymentStatus === 'SUCCESS' ? 'Thank you for riding' : 'Final Settlement')}
            </p>
          </div>
          {/* Only allow closing if driver OR if owner has paid. Prevents "mistaken dismiss" before payment. */}
          {(isDriver || paymentStatus === 'SUCCESS') && (
            <button 
              onClick={onClose}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors animate-in fade-in"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        <div className="p-8 space-y-6">
          {/* Route Summary (Optional for Owner) */}
          {!isDriver && pickup && destination && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
              <div className="flex flex-col items-center gap-1">
                <div className="size-2 rounded-full bg-primary" />
                <div className="w-0.5 h-4 bg-slate-200 dark:bg-slate-700" />
                <div className="size-2 rounded-full bg-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{pickup}</p>
                <div className="h-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{destination}</p>
              </div>
            </div>
          )}

          {/* Detailed Breakdown */}
          <div className="space-y-4">
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distance traveled</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{fareBreakdown?.distanceKm || 0} km</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Elapsed Time</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{fareBreakdown?.actualMins || fareBreakdown?.totalMins || 0} mins</span>
             </div>

              {isDriver ? (
               <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center opacity-70">
                    <span className="text-xs font-bold text-slate-500 uppercase">Trip Fare</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">₦{(fareBreakdown?.totalAmount || fareBreakdown?.finalFare || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Your Earnings</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₦{(fareBreakdown?.driverEarnings || 0).toLocaleString()}</span>
                  </div>
               </div>
             ) : (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                   <span className="text-sm font-black text-slate-900 dark:text-white">Total Amount</span>
                   <span className="text-3xl font-black text-primary">₦{(fareBreakdown?.totalAmount || fareBreakdown?.finalFare || 0).toLocaleString()}</span>
                </div>
             )}
          </div>

          {/* Payment Status Alert */}
          {(paymentMessage || paymentStatus === 'SUCCESS' || paymentStatus === 'PAID' || paymentStatus === 'PARTIALLY_PAID') ? (
            <div className={`p-4 rounded-2xl flex gap-3 items-start border-2 animate-in slide-in-from-top-4 duration-500 ${
              (paymentStatus === 'SUCCESS' || paymentStatus === 'PAID') 
                ? 'bg-green-500/5 border-green-500/20 text-green-600' 
                : (paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-500/5 border-amber-500/20 text-amber-600' : 'bg-red-500/5 border-red-500/20 text-red-600')
            }`}>
              <span className="material-symbols-outlined text-base">
                {(paymentStatus === 'SUCCESS' || paymentStatus === 'PAID') 
                  ? 'verified' 
                  : (paymentStatus === 'PARTIALLY_PAID' ? 'warning' : 'error')}
              </span>
              <p className="text-[10px] font-black uppercase leading-relaxed">
                {(paymentStatus === 'SUCCESS' || paymentStatus === 'PAID') 
                  ? (isDriver ? 'Payment received and Wallet updated!' : 'Trip settlement confirmed successfully!')
                  : paymentMessage}
              </p>
            </div>
          ) : (
            isDriver && (
              <div className="p-4 rounded-2xl flex gap-3 items-start border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 text-slate-500 animate-pulse">
                <span className="material-symbols-outlined text-base">hourglass_empty</span>
                <p className="text-[10px] font-black uppercase leading-relaxed">
                  Awaiting customer payment confirmation...
                </p>
              </div>
            )
          )}    )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {!isDriver && paymentStatus !== 'SUCCESS' && onPayNow && (
              <button 
                onClick={onPayNow}
                disabled={isInitiatingPayment}
                className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isInitiatingPayment ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined">payments</span>
                )}
                {isInitiatingPayment ? 'VERIFYING WITH MONNIFY...' : 'PAY NGN ' + (fareBreakdown?.totalAmount || fareBreakdown?.finalFare || 0).toLocaleString()}
              </button>
            )}

            {(isDriver || paymentStatus === 'SUCCESS') && (
              <button 
                onClick={onClose}
                className={`w-full font-black py-4 rounded-2xl hover:opacity-90 transition-all uppercase tracking-widest text-xs animate-in zoom-in duration-300 ${
                  paymentStatus === 'SUCCESS' 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                }`}
              >
                {isDriver ? 'Complete and Go Online' : 'Finish & Return Home'}
              </button>
            )}
            
            {!isDriver && paymentStatus !== 'SUCCESS' && (
              <p className="text-center text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-60">
                Payment is required to complete engagement
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripPaymentSummary;
