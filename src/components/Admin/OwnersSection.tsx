import React from 'react';
import { UserProfile } from '@/types';
import { PaginationMeta } from '@/services/api.service';

interface OwnersSectionProps {
  owners: UserProfile[];
  meta: PaginationMeta | null;
  searchTerm: string;
  onBlockUser: (userId: string, blocked: boolean) => void;
  onPageChange: (page: number) => void;
}

const OwnersSection: React.FC<OwnersSectionProps> = ({
  owners,
  meta,
  searchTerm,
  onBlockUser,
  onPageChange
}) => {
  const filteredOwners = owners
    .filter(o => (o.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex justify-between items-center px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Owner Index</p>
        
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

      <div className="space-y-4">
        {filteredOwners.map(owner => (
          <div key={owner.id} className="group bg-white dark:bg-surface-dark p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center gap-5 transition-all hover:shadow-lg">
            <div className="relative">
              <img src={owner.avatar} className="size-14 rounded-2xl object-cover shadow-sm ring-2 ring-slate-50 dark:ring-white/5" alt="" />
              <div className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white dark:border-surface-dark ${owner.isBlocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-black text-base text-slate-900 dark:text-white truncate">
                  {owner.name}
                </h4>
                {owner.isBlocked && (
                  <span className="text-[8px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">Suspended</span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">phone_iphone</span>
                {owner.phone}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-lg">
                  <span className="material-symbols-outlined text-yellow-500 text-[12px] filled">star</span>
                  <span className="text-[10px] font-black text-yellow-600 uppercase">{owner.rating}</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg">
                  <span className="material-symbols-outlined text-slate-400 text-[12px]">directions_car</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase">{owner.trips} Trips</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => onBlockUser(owner.id, !owner.isBlocked)}
              className={`size-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                owner.isBlocked 
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                  : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
              }`}
              title={owner.isBlocked ? "Unblock Account" : "Block Account"}
            >
              <span className="material-symbols-outlined text-xl">{owner.isBlocked ? 'lock_open' : 'block'}</span>
            </button>
          </div>
        ))}
        {filteredOwners.length === 0 && (
          <div className="py-20 text-center opacity-40">
             <span className="material-symbols-outlined text-5xl mb-4">person_off</span>
             <p className="font-bold">No owners found matching search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnersSection;
