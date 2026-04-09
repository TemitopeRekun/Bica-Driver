import React from 'react';
import { UserProfile, UserRole } from '@/types';
import MonnifyStatus from './MonnifyStatus';
import { PaginationMeta } from '@/services/api.service';

interface DriversSectionProps {
  drivers: UserProfile[];
  meta: PaginationMeta | null;
  driverFilter: 'All' | 'Pending' | 'Active' | 'Blocked';
  searchTerm: string;
  setDriverFilter: (filter: any) => void;
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
      <div className="grid grid-cols-1 gap-4">
        {filteredDrivers.map(driver => (
          <div 
            key={driver.id}
            onClick={() => setSelectedUser(driver)}
            className={`group bg-white dark:bg-surface-dark p-5 rounded-[2rem] border-2 transition-all cursor-pointer hover:shadow-xl active:scale-[0.99] ${
              driver.approvalStatus === 'PENDING' 
                ? 'border-orange-500/20 bg-orange-500/[0.02]' 
                : driver.isBlocked 
                  ? 'border-red-500/20 opacity-80' 
                  : 'border-slate-100 dark:border-slate-800'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <img src={driver.avatar} className="size-14 rounded-2xl object-cover shadow-md" alt="" />
                <div className={`absolute -top-1 -right-1 size-4 rounded-full border-2 border-white dark:border-surface-dark shadow-sm ${
                  driver.approvalStatus === 'APPROVED' ? 'bg-green-500' : driver.approvalStatus === 'PENDING' ? 'bg-orange-500 animate-pulse' : 'bg-red-500'
                }`}></div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-black text-base text-slate-900 dark:text-white truncate pr-2">
                    {driver.name}
                  </h4>
                  <div className="flex gap-1.5 shrink-0">
                    {driver.isBlocked && (
                      <span className="text-[8px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-red-500/20">Blocked</span>
                    )}
                    {driver.isOnline && (
                      <span className="text-[8px] font-black bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-green-500/20">Online</span>
                    )}
                    {driver.approvalStatus === 'PENDING' && (
                      <span className="text-[8px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">Review Required</span>
                    )}
                  </div>
                </div>
                
                <p className="text-xs text-slate-500 font-medium truncate mb-2">{driver.email}</p>
                
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg text-slate-500 font-black uppercase tracking-widest">
                    {driver.transmission || 'Manual'}
                  </span>
                  <span className="text-[9px] bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg text-slate-500 font-black uppercase tracking-widest">
                    {driver.id.slice(0, 8)}
                  </span>
                </div>
              </div>
              
              <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-primary">arrow_forward</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/5">
              <MonnifyStatus 
                driver={driver} 
                retryingSubAccountIds={retryingSubAccountIds} 
                onRetrySubAccount={onRetrySubAccount} 
              />
            </div>
          </div>
        ))}
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
