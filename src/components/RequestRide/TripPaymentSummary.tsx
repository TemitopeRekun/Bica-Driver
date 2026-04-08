import React from 'react';

interface TripPaymentSummaryProps {
  fareBreakdown: {
    distanceKm?: number;
    actualMins?: number;
    totalMins?: number;
    finalFare: number;
  } | null;
  paymentStatus?: 'UNPAID' | 'SUCCESS' | 'FAILED' | 'PENDING';
  paymentMessage?: string | null;
  onPayNow?: () => void;
  onClose: () => void;
  isInitiatingPayment?: boolean;
}

const TripPaymentSummary: React.FC<TripPaymentSummaryProps> = ({ 
  fareBreakdown,
  paymentStatus = 'UNPAID',
  paymentMessage,
  onPayNow,
  onClose,
  isInitiatingPayment = false
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Trip Result</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Final Settlement</p>
          </div>
          <button 
            onClick={onClose}
            className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Detailed Breakdown */}
          <div className="space-y-3">
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distance traveled</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{fareBreakdown?.distanceKm || 0} km</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Elapsed Time</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{fareBreakdown?.actualMins || fareBreakdown?.totalMins || 0} mins</span>
             </div>
             <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-sm font-black text-slate-900 dark:text-white">Amount Due</span>
                <span className="text-2xl font-black text-primary">₦{(fareBreakdown?.finalFare || 0).toLocaleString()}</span>
             </div>
          </div>

          {/* Payment Status Alert */}
          {paymentMessage && (
            <div className={`p-4 rounded-2xl flex gap-3 items-start border-2 ${
              paymentStatus === 'SUCCESS' ? 'bg-green-500/5 border-green-500/20 text-green-600' : 'bg-red-500/5 border-red-500/20 text-red-600'
            }`}>
              <span className="material-symbols-outlined text-base">
                {paymentStatus === 'SUCCESS' ? 'check_circle' : 'error'}
              </span>
              <p className="text-[10px] font-black uppercase leading-relaxed">{paymentMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {paymentStatus !== 'SUCCESS' && onPayNow && (
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
                {isInitiatingPayment ? 'SECURE CONNECTION...' : 'PAY NGN ' + (fareBreakdown?.finalFare || 0).toLocaleString()}
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              DISMISS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripPaymentSummary;
