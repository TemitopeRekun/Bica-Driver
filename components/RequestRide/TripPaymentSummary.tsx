import React from 'react';

interface TripPaymentSummaryProps {
  fareBreakdown: {
    distanceKm?: number;
    actualMins?: number;
    totalMins?: number;
    finalFare: number;
  };
}

const TripPaymentSummary: React.FC<TripPaymentSummaryProps> = ({ fareBreakdown }) => {
  return (
    <div className="bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Trip Summary</p>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-500 text-sm">Distance</span>
          <span className="font-bold text-sm">
            {fareBreakdown.distanceKm ?? 0} km
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 text-sm">Total Time</span>
          <span className="font-bold text-sm">
            {fareBreakdown.actualMins ?? fareBreakdown.totalMins ?? 0} mins
          </span>
        </div>
      </div>

      <div className="mx-4 border-t border-slate-200 dark:border-slate-700"></div>

      <div className="px-4 py-3 flex justify-between items-center">
        <span className="font-black text-slate-900 dark:text-white">Total Paid/Due</span>
        <span className="text-2xl font-black text-primary">
          NGN {fareBreakdown.finalFare.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default TripPaymentSummary;
