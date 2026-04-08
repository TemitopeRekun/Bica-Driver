import React from 'react';
import { PendingPaymentTrip, PaymentHistoryRecord, SystemSettings } from '@/types';

interface FinanceSectionProps {
  platformFees: number;
  totalRevenue: number;
  settings: SystemSettings;
  pendingPayments: PendingPaymentTrip[];
  paymentHistory: PaymentHistoryRecord[];
  formatCurrency: (amount: number) => string;
  formatShortDate: (value?: string | null) => string;
}

const FinanceSection: React.FC<FinanceSectionProps> = ({
  platformFees,
  totalRevenue,
  settings,
  pendingPayments,
  paymentHistory,
  formatCurrency,
  formatShortDate
}) => {
  return (
    <div className="space-y-8 animate-slide-up">
       {/* Platform Financial Summary */}
       <div className="relative overflow-hidden p-8 rounded-[3rem] bg-slate-900 shadow-2xl group">
          <div className="absolute top-0 right-0 size-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/30 transition-all"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined filled">account_balance</span>
              </div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Operational Liquidity</h3>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 opacity-80">Platform Net Commission</p>
            <h2 className="text-5xl font-black text-white tracking-tighter">{formatCurrency(platformFees)}</h2>
            <div className="flex gap-6 mt-8">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Throughput</p>
                <p className="text-xl font-black text-white">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="w-px h-10 bg-white/10"></div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Fee Rate</p>
                <p className="text-xl font-black text-primary">{settings.commission}%</p>
              </div>
            </div>
          </div>
       </div>

       {/* Settlement Model Info */}
       <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-[2.5rem] flex gap-4 items-start">
          <span className="material-symbols-outlined text-blue-500 mt-1">info</span>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">Auto-Settlement Intelligence</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bica utilizes Monnify Split Payments for real-time driver settlement. <strong>No manual payout approval is required</strong> for standard trips. Monitor this ledger for failed split attempts or dispute resolutions only.
            </p>
          </div>
       </div>

       {/* Pending Action Queue */}
       <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-orange-500 animate-pulse"></span>
              <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Monitoring Queue</h3>
            </div>
            <span className="text-[10px] font-black bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full">{pendingPayments.length} Active Issues</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingPayments.map((payment) => (
              <div key={payment.id} className="bg-white dark:bg-surface-dark border-2 border-slate-100 dark:border-slate-800 p-5 rounded-[2rem] shadow-sm hover:border-orange-500/30 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="size-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                    <span className="material-symbols-outlined">feedback</span>
                  </div>
                  <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg uppercase tracking-tight">Pending Split</span>
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white truncate mb-1">{payment.location}</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase truncate mb-4">
                  Owner: {payment.owner?.name} · Driver: {payment.driver?.name || 'Searching'}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase">{payment.date}</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                </div>
              </div>
            ))}
            {pendingPayments.length === 0 && (
              <div className="col-span-full py-12 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                 <p className="text-xs font-bold uppercase tracking-widest">No transaction issues detected</p>
              </div>
            )}
          </div>
       </section>

       {/* Archive History */}
       <section className="space-y-4">
          <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500 px-2">Settlement Archive</h3>
          <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paymentHistory.slice(0, 10).map((record) => (
                <div key={record.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {record.trip.pickupAddress.split(',')[0]} → {record.trip.destAddress.split(',')[0]}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase truncate">
                        Ref: {record.monnifyTxRef.slice(0, 12)}... · {formatShortDate(record.paidAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(record.totalAmount)}</p>
                    <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-1">Cleared</p>
                  </div>
                </div>
              ))}
              {paymentHistory.length === 0 && (
                <div className="p-16 text-center text-slate-400 italic text-sm">Historical archive is empty.</div>
              )}
            </div>
            {paymentHistory.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-white/5 text-center">
                 <button className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-primary transition-colors">Export Ledger (.csv)</button>
              </div>
            )}
          </div>
       </section>
    </div>
  );
};

export default FinanceSection;
