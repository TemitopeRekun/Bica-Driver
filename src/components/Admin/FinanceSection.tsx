import React from 'react';
import { SystemSettings, PendingPaymentTrip, PaymentHistoryRecord, AdminPaymentsSummaryResponse, SummaryPeriod, DateRangeFilter, RecoveryResult } from '@/types';
import { PaginationMeta } from '@/services/api.service';
import PaymentRecoveryPanel from './PaymentRecoveryPanel';

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
  historyStatusFilter: 'ALL' | 'PAID' | 'FAILED';
  setHistoryStatusFilter: (status: 'ALL' | 'PAID' | 'FAILED') => void;
  historyDateRange: DateRangeFilter;
  setHistoryDateRange: (range: DateRangeFilter) => void;
  onRecover?: (txRef: string, tripId: string) => Promise<RecoveryResult>;
  onFinalize?: (tripId: string) => Promise<any>;
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
  adminSummaryLoading,
  historyStatusFilter,
  setHistoryStatusFilter,
  historyDateRange,
  setHistoryDateRange,
  onRecover,
  onFinalize,
}) => {
  const [expandedHistoryId, setExpandedHistoryId] = React.useState<string | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [recoveryPanelOpen, setRecoveryPanelOpen] = React.useState(false);
  const displayPlatformRevenue = adminSummary?.totals.platformRevenue ?? platformFees;
  const displayGrossThroughput = adminSummary?.totals.grossThroughput ?? totalRevenue;
  const displayDriverPayouts = adminSummary?.totals.driverPayouts;

  return (
    <>
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
              BicaDriver utilizes Monnify Split Payments for real-time driver settlement. <strong>No manual payout approval is required</strong> for standard trips. This ledger serves for reconciliation and operational monitoring only.
            </p>
          </div>
       </div>

       {/* Pending Action Queue */}
       <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-orange-500 animate-pulse"></span>
              <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-500">Settlement Watchlist (Anomalies)</h3>
              {pendingPayments.length > 0 && (
                <span className="size-4 rounded-full bg-orange-500 text-white text-[8px] font-black flex items-center justify-center">
                  {pendingPayments.length > 9 ? '9+' : pendingPayments.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Recovery Console button */}
              {onRecover && onFinalize && (
                <button
                  onClick={() => setRecoveryPanelOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-[9px] font-black uppercase tracking-widest shadow-sm shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">manage_search</span>
                  Recovery Console
                </button>
              )}

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
              <div className="col-span-full relative overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-12 text-center bg-white dark:bg-surface-dark shadow-sm">
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />
                <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                  <span className="material-symbols-outlined text-3xl">verified_user</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                  No transactional anomalies
                </h3>
                <p className="mt-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] max-w-[240px] mx-auto leading-relaxed">
                  Every active trip is currently following standard settlement protocols.
                </p>
              </div>
            )}
          </div>
       </section>

       {/* Archive History */}
       <section className="space-y-4">
           {/* ── Section Header ─────────────────────────────────────── */}
           <div className="flex items-center justify-between px-1">
             <div className="flex items-center gap-2">
               <span className="material-symbols-outlined text-emerald-500 text-base">receipt_long</span>
               <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-500">
                 Settlement Ledger
               </h3>
               {/* Active filter badge */}
               {(historyStatusFilter !== 'ALL' || historyDateRange.from || historyDateRange.to) && (
                 <span className="size-5 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center">
                   {[historyStatusFilter !== 'ALL', !!historyDateRange.from || !!historyDateRange.to].filter(Boolean).length}
                 </span>
               )}
             </div>

             <div className="flex items-center gap-2">
               {/* Pagination */}
               {paymentHistoryMeta && paymentHistoryMeta.totalPages > 1 && (
                 <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                   <button
                     disabled={paymentHistoryMeta.page === 0}
                     onClick={() => onPageChange('history', paymentHistoryMeta.page - 1)}
                     className="size-7 flex items-center justify-center rounded-md text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all"
                   >
                     <span className="material-symbols-outlined text-sm">chevron_left</span>
                   </button>
                   <span className="text-[9px] font-black text-slate-700 dark:text-white px-1">
                     {paymentHistoryMeta.page + 1}/{paymentHistoryMeta.totalPages}
                   </span>
                   <button
                     disabled={paymentHistoryMeta.page >= paymentHistoryMeta.totalPages - 1}
                     onClick={() => onPageChange('history', paymentHistoryMeta.page + 1)}
                     className="size-7 flex items-center justify-center rounded-md text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all"
                   >
                     <span className="material-symbols-outlined text-sm">chevron_right</span>
                   </button>
                 </div>
               )}

               {/* Filter toggle button */}
               <button
                 onClick={() => setFilterOpen(f => !f)}
                 className={`size-8 flex items-center justify-center rounded-xl border transition-all ${
                   filterOpen
                     ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30'
                     : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-200'
                 }`}
               >
                 <span className="material-symbols-outlined text-sm">
                   {filterOpen ? 'filter_list_off' : 'filter_list'}
                 </span>
               </button>
             </div>
           </div>

           {/* ── Active filter summary chip (collapsed state) ────────── */}
           {!filterOpen && (historyStatusFilter !== 'ALL' || historyDateRange.from || historyDateRange.to) && (
             <div className="flex items-center gap-2 px-1 flex-wrap">
               {historyStatusFilter !== 'ALL' && (
                 <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                   historyStatusFilter === 'PAID'
                     ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                     : 'bg-red-500/10 text-red-500 border-red-500/20'
                 }`}>
                   <span className="material-symbols-outlined text-xs">circle</span>
                   {historyStatusFilter}
                 </span>
               )}
               {(historyDateRange.from || historyDateRange.to) && (
                 <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                   <span className="material-symbols-outlined text-xs">date_range</span>
                   {historyDateRange.from || '…'} → {historyDateRange.to || '…'}
                 </span>
               )}
               <button
                 onClick={() => { setHistoryStatusFilter('ALL'); setHistoryDateRange({ from: null, to: null }); }}
                 className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black text-red-500 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all"
               >
                 <span className="material-symbols-outlined text-xs">close</span>
                 Clear
               </button>
             </div>
           )}

           {/* ── Collapsible filter panel ────────────────────────────── */}
           {filterOpen && (
             <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
               {/* Status row */}
               <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</p>
                 <div className="flex gap-2">
                   {(['ALL', 'PAID', 'FAILED'] as const).map((status) => (
                     <button
                       key={status}
                       onClick={() => setHistoryStatusFilter(status)}
                       className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                         historyStatusFilter === status
                           ? status === 'PAID'
                             ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                             : status === 'FAILED'
                             ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
                             : 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                           : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white'
                       }`}
                     >
                       {status}
                     </button>
                   ))}
                 </div>
               </div>

               {/* Date range row — 2-column grid, each input full-width in its cell */}
               <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Date Range</p>
                 <div className="grid grid-cols-2 gap-2">
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">From</p>
                     <input
                       type="date"
                       value={historyDateRange.from || ''}
                       onChange={(e) => setHistoryDateRange({ ...historyDateRange, from: e.target.value })}
                       className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[11px] font-black text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                     />
                   </div>
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To</p>
                     <input
                       type="date"
                       value={historyDateRange.to || ''}
                       onChange={(e) => setHistoryDateRange({ ...historyDateRange, to: e.target.value })}
                       className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[11px] font-black text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                     />
                   </div>
                 </div>
               </div>

               {/* Action row */}
               <div className="p-3 flex items-center justify-between gap-2">
                 <button
                   onClick={() => { setHistoryStatusFilter('ALL'); setHistoryDateRange({ from: null, to: null }); }}
                   className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100 transition-all border border-slate-200 dark:border-white/10"
                 >
                   Clear All
                 </button>
                 <button
                   onClick={() => setFilterOpen(false)}
                   className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary text-white hover:bg-primary/90 transition-all shadow-sm shadow-primary/20"
                 >
                   Apply
                 </button>
               </div>
             </div>
           )}


          <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-black/5">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paymentHistory.map((record) => {
                return (
                 <div key={record.id} className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div 
                    className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setExpandedHistoryId(expandedHistoryId === record.id ? null : record.id)}
                  >
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
                    <div className="flex items-center gap-4">
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(record.totalAmount)}</p>
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1 italic">Verified Clean</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 text-sm">
                        {expandedHistoryId === record.id ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </div>

                  {expandedHistoryId === record.id && (
                    <div className="p-6 bg-slate-50/50 dark:bg-black/20 animate-fade-in border-t border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trip ID</span>
                            <span className="text-xs font-mono font-black text-slate-900 dark:text-white">#{record.tripId.slice(0, 8)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Owner</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{record.trip.owner.name}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{record.trip.driver?.name ?? '—'}</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Fare</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(record.totalAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Net</span>
                            <span className="text-xs font-black text-primary">{formatCurrency(record.platformAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver Payout</span>
                            <span className="text-xs font-black text-emerald-500">{formatCurrency(record.driverAmount)}</span>
                          </div>
                        </div>
                        <div className="md:col-span-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white text-right">{record.trip.pickupAddress} → {record.trip.destAddress}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tx Ref</span>
                            <span className="text-xs font-mono font-bold text-slate-500">{record.monnifyTxRef || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid At</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{new Date(record.paidAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                 </div>
                );
              })}
              {paymentHistory.length === 0 && (
                <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-12 text-center bg-white dark:bg-surface-dark">
                  <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
                  <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <span className="material-symbols-outlined text-3xl">payments</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                    No payment history yet
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-[240px] mx-auto font-medium italic">
                    Verified settlements and transaction records will be archived here.
                  </p>
                </div>
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

    {/* Recovery Console Panel */}
    {recoveryPanelOpen && onRecover && onFinalize && (
      <PaymentRecoveryPanel
        pendingPayments={pendingPayments}
        onRecover={onRecover}
        onFinalize={onFinalize}
        onClose={() => setRecoveryPanelOpen(false)}
        formatCurrency={formatCurrency}
      />
    )}
    </>
  );
};


export default FinanceSection;
