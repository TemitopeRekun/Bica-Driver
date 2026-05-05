import React from 'react';
import { SystemSettings, PendingPaymentTrip, PaymentHistoryRecord, AdminPaymentsSummaryResponse, SummaryPeriod } from '@/types';
import { PaginationMeta } from '@/services/api.service';

interface FinanceSectionProps {
  platformFees: number;
  totalRevenue: number;
  settings: SystemSettings;
  pendingPayments: PendingPaymentTrip[];
  pendingPaymentsMeta: PaginationMeta | null;
  paymentHistory: PaymentHistoryRecord[];
  paymentHistoryMeta: PaginationMeta | null;
  formatCurrency: (amount: number) => string;
  formatShortDate: (value?: string | null) => string;
  onPageChange: (section: 'pending' | 'history', page: number) => void;
  adminSummary?: AdminPaymentsSummaryResponse | null;
  adminSummaryPeriod: SummaryPeriod;
  setAdminSummaryPeriod?: (period: SummaryPeriod) => void;
  adminSummaryLoading?: boolean;
}

const FinanceSection: React.FC<FinanceSectionProps> = ({
  platformFees,
  totalRevenue,
  settings,
  pendingPayments,
  pendingPaymentsMeta,
  paymentHistory,
  paymentHistoryMeta,
  formatCurrency,
  formatShortDate,
  onPageChange,
  adminSummary,
  adminSummaryPeriod,
  setAdminSummaryPeriod,
  adminSummaryLoading
}) => {
  const displayPlatformRevenue = adminSummary?.totals.platformRevenue ?? platformFees;
  const displayGrossThroughput = adminSummary?.totals.grossThroughput ?? totalRevenue;
  const displayDriverPayouts = adminSummary?.totals.driverPayouts;

  return (
    <div className="space-y-8 animate-slide-up font-display">
       {/* Platform Financial Summary */}
       <div className="relative overflow-hidden p-8 rounded-[3rem] bg-slate-900 shadow-2xl group">
          <div className="absolute top-0 right-0 size-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/30 transition-all"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined filled">account_balance</span>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Operational Liquidity</h3>
              </div>
            </div>

            {setAdminSummaryPeriod && (
              <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-2xl w-fit">
                {(['daily', 'weekly', 'monthly'] as SummaryPeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setAdminSummaryPeriod(p)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      adminSummaryPeriod === p
                        ? 'bg-primary text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 opacity-80">
              Platform Net Commission
            </p>
            <h2 className="text-5xl font-black text-white tracking-tighter">
              {adminSummaryLoading ? (
                <span className="text-3xl text-slate-500 animate-pulse">—</span>
              ) : (
                formatCurrency(displayPlatformRevenue)
              )}
            </h2>

            <div className="flex gap-6 mt-8">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Gross Throughput
                </p>
                <p className="text-xl font-black text-white">
                  {adminSummaryLoading ? '—' : formatCurrency(displayGrossThroughput)}
                </p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              {displayDriverPayouts !== undefined && (
                <>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Driver Payouts
                    </p>
                    <p className="text-xl font-black text-white">
                      {adminSummaryLoading ? '—' : formatCurrency(displayDriverPayouts)}
                    </p>
                  </div>
                  <div className="w-px h-10 bg-white/10" />
                </>
              )}
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Fee Rate
                </p>
                <p className="text-xl font-black text-primary">{settings.commission}%</p>
              </div>
            </div>
          </div>
       </div>

       {adminSummary?.buckets && adminSummary.buckets.length > 0 && (
         <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
           <div className="p-5 border-b border-slate-100 dark:border-slate-800">
             <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">
               Period Breakdown
             </h3>
           </div>
           <div className="divide-y divide-slate-100 dark:divide-slate-800">
             {adminSummary.buckets.map((bucket) => (
               <div
                 key={bucket.label}
                 className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
               >
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                   {bucket.label}
                 </span>
                 <div className="flex items-center gap-6 text-right">
                   <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Throughput</p>
                     <p className="text-sm font-black text-slate-900 dark:text-white">
                       {formatCurrency(bucket.grossThroughput)}
                     </p>
                   </div>
                   <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Commission</p>
                     <p className="text-sm font-black text-primary">
                       {formatCurrency(bucket.platformRevenue)}
                     </p>
                   </div>
                   <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Payouts</p>
                     <p className="text-sm font-black text-emerald-500">
                       {formatCurrency(bucket.driverPayouts)}
                     </p>
                   </div>
                 </div>
               </div>
             ))}
           </div>
         </div>
       )}

       {/* Settlement Model Info */}
       <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-[2.5rem] flex gap-4 items-start shadow-sm shadow-emerald-500/5">
          <span className="material-symbols-outlined text-emerald-500 mt-0.5">verified_user</span>
          <div>
            <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">Autonomous Settlement Policy</h4>
            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
              BICA utilizes Monnify Split Payments for real-time driver settlement. <strong>No manual payout approval is required</strong> for standard trips. This ledger serves for reconciliation and operational monitoring only.
            </p>
          </div>
       </div>

       {/* Pending Action Queue */}
       <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-orange-500 animate-pulse"></span>
              <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-500">Settlement Watchlist (Anomalies)</h3>
            </div>
            
            {/* Pagination Controls */}
            {pendingPaymentsMeta && pendingPaymentsMeta.totalPages > 1 && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button 
                  disabled={pendingPaymentsMeta.page === 0}
                  onClick={() => onPageChange('pending', pendingPaymentsMeta.page - 1)}
                  className="size-7 flex items-center justify-center rounded-lg text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <span className="text-[9px] font-black text-slate-900 dark:text-white px-1 uppercase tracking-tighter">
                  {pendingPaymentsMeta.page + 1} / {pendingPaymentsMeta.totalPages}
                </span>
                <button 
                  disabled={pendingPaymentsMeta.page >= pendingPaymentsMeta.totalPages - 1}
                  onClick={() => onPageChange('pending', pendingPaymentsMeta.page + 1)}
                  className="size-7 flex items-center justify-center rounded-lg text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingPayments.map((payment) => (
              <div key={payment.id} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] shadow-lg shadow-black/5 hover:border-orange-500/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="size-10 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <span className="material-symbols-outlined">query_stats</span>
                  </div>
                  <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">Pending Verification</span>
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white truncate mb-1 uppercase tracking-tight italic">{payment.location}</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase truncate mb-4 italic">
                   {payment.owner?.name} <span className="text-slate-300 mx-1">→</span> {payment.driver?.name || 'Searching'}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{payment.date}</p>
                  <p className="text-base font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(payment.amount)}</p>
                </div>
              </div>
            ))}
            {pendingPayments.length === 0 && (
              <div className="col-span-full py-16 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                 <span className="material-symbols-outlined text-3xl mb-2 opacity-30">verified_user</span>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em]">No transactional anomalies detected</p>
              </div>
            )}
          </div>
       </section>

       {/* Archive History */}
       <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-500">Confirmed Settlement Ledger</h3>
            
            {/* Pagination Controls */}
            {paymentHistoryMeta && paymentHistoryMeta.totalPages > 1 && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button 
                  disabled={paymentHistoryMeta.page === 0}
                  onClick={() => onPageChange('history', paymentHistoryMeta.page - 1)}
                  className="size-7 flex items-center justify-center rounded-lg text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <span className="text-[9px] font-black text-slate-900 dark:text-white px-1 uppercase tracking-tighter">
                  {paymentHistoryMeta.page + 1} / {paymentHistoryMeta.totalPages}
                </span>
                <button 
                  disabled={paymentHistoryMeta.page >= paymentHistoryMeta.totalPages - 1}
                  onClick={() => onPageChange('history', paymentHistoryMeta.page + 1)}
                  className="size-7 flex items-center justify-center rounded-lg text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-black/5">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paymentHistory.map((record) => (
                <div key={record.id} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                      <span className="material-symbols-outlined text-lg">payments</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate uppercase tracking-tight italic">
                        {record.trip.pickupAddress.split(',')[0]} → {record.trip.destAddress.split(',')[0]}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase truncate italic opacity-70">
                        Ref: {record.monnifyTxRef.slice(-12)} · {formatShortDate(record.paidAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(record.totalAmount)}</p>
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1 italic">Verified Clean</p>
                  </div>
                </div>
              ))}
              {paymentHistory.length === 0 && (
                <div className="p-16 text-center text-slate-400 italic text-sm font-bold uppercase tracking-widest opacity-30">Archive empty</div>
              )}
            </div>
            {paymentHistory.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-white/5 text-center">
                 <button className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-primary transition-all">Download Settlement Log (.csv)</button>
              </div>
            )}
          </div>
       </section>
    </div>
  );
};

export default FinanceSection;
