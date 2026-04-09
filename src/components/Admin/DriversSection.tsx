import React from 'react';
import { UserProfile, UserRole, DriverFilter } from '@/types';
import { PaginationMeta } from '@/services/api.service';

interface DriversSectionProps {
  drivers: UserProfile[];
  meta: PaginationMeta | null;
  driverFilter: DriverFilter;
  searchTerm: string;
  setDriverFilter: (filter: DriverFilter) => void;
  setSelectedUser: (user: UserProfile) => void;
  retryingSubAccountIds: Set<string>;
  onPageChange: (page: number) => void;
  onRetrySubAccount: (userId: string) => Promise<void>;
}

const DriversSection: React.FC<DriversSectionProps> = ({
  drivers,
  meta,
  driverFilter,
  searchTerm,
  setDriverFilter,
  setSelectedUser,
  retryingSubAccountIds,
  onPageChange,
  onRetrySubAccount
}) => {
  const filteredDrivers = drivers
    .filter((driver) => {
      switch (driverFilter) {
        case 'Pending':
          return driver.approvalStatus === 'PENDING';
        case 'Active':
          return !driver.isBlocked && driver.isOnline && driver.approvalStatus === 'APPROVED';
        case 'Blocked':
          return !!driver.isBlocked;
        default:
          return true;
      }
    })
    .filter(d => (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        {/* Filter Tabs */}
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit">
           {(['All', 'Pending', 'Active', 'Blocked'] as const).map((filter) => (
             <button
               key={filter}
               onClick={() => setDriverFilter(filter)}
               className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 driverFilter === filter
                   ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                   : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
               }`}
             >
               {filter}
             </button>
           ))}
        </div>

        {/* Pagination Controls */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button 
              disabled={meta.page === 0}
              onClick={() => onPageChange(meta.page - 1)}
              className="size-8 flex items-center justify-center rounded-lg text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 transition-all"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <span className="text-[10px] font-black text-slate-900 dark:text-white px-2 uppercase tracking-widest">
              Page {meta.page + 1} of {meta.totalPages}
            </span>
            <button 
              disabled={meta.page >= meta.totalPages - 1}
              onClick={() => onPageChange(meta.page + 1)}
              className="size-8 flex items-center justify-center rounded-lg text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 transition-all"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {/* Driver List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredDrivers.map(driver => {
          const isPending = driver.approvalStatus === 'PENDING';
          const isBlocked = !!driver.isBlocked;
          const isApproved = driver.approvalStatus === 'APPROVED';

          return (
            <div 
              key={driver.id}
              onClick={() => setSelectedUser(driver)}
              className={`group bg-white dark:bg-surface-dark rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.99] hover:shadow-lg ${
                isPending ? 'border-orange-400/30 bg-orange-500/[0.02]'
                : isBlocked ? 'border-red-400/20 opacity-80'
                : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              {/* Card body */}
              <div className="p-4 flex items-center gap-3">
                {/* Avatar + status dot */}
                <div className="relative shrink-0">
                  <img src={driver.avatar} className="size-12 rounded-xl object-cover shadow-sm" alt="" />
                  <div className={`absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-white dark:border-surface-dark ${
                    isApproved ? 'bg-green-500' : isPending ? 'bg-orange-400 animate-pulse' : 'bg-red-500'
                  }`} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{driver.name}</h4>
                    {isBlocked && <span className="shrink-0 text-[8px] font-black bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full uppercase border border-red-500/20">Blocked</span>}
                    {driver.isOnline && !isBlocked && <span className="shrink-0 text-[8px] font-black bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full uppercase border border-green-500/20">Online</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">{driver.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg text-slate-500 font-black uppercase">
                      {driver.transmission || 'Manual'}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase ${
                      isPending ? 'bg-orange-500/10 text-orange-600' 
                      : isApproved ? 'bg-green-500/10 text-green-600' 
                      : 'bg-red-500/10 text-red-500'
                    }`}>
                      {driver.approvalStatus || 'PENDING'}
                    </span>
                  </div>
                </div>

                {/* Tap chevron */}
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors text-lg shrink-0">
                  chevron_right
                </span>
              </div>

              {/* Pending CTA — full width at bottom of card */}
              {isPending && (
                <div className="px-4 pb-4" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setSelectedUser(driver)}
                    className="w-full bg-orange-500/10 hover:bg-orange-500 border border-orange-400/30 text-orange-600 hover:text-white font-black py-3 rounded-xl text-[11px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">folder_open</span>
                    Open Dossier — Review Required
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredDrivers.length === 0 && (
        <div className="py-24 text-center flex flex-col items-center justify-center animate-fade-in">
           <div className="size-24 bg-primary/5 rounded-[2.5rem] flex items-center justify-center mb-6 border border-primary/10">
              <span className="material-symbols-outlined text-5xl text-primary/40">badge</span>
           </div>
           <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">
             {searchTerm ? 'No search results' : `No ${driverFilter} Chauffeurs`}
           </h4>
           <p className="text-sm text-slate-500 max-w-[280px] leading-relaxed mx-auto font-medium">
             {searchTerm 
               ? `We couldn't find any driver matching "${searchTerm}". Try a different name or email.`
               : `New driver registrations will appear here for your review and approval.`}
           </p>
        </div>
      )}
    </div>
  );
};

export default DriversSection;
