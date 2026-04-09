import React from 'react';
import { UserProfile } from '@/types';
import { PaginationMeta } from '@/services/api.service';

interface OwnersSectionProps {
  owners: UserProfile[];
  meta: PaginationMeta | null;
  searchTerm: string;
  onBlockUser: (userId: string, isBlocked: boolean) => Promise<void>;
  onPageChange: (page: number) => void;
  setSelectedUser: (user: UserProfile) => void;
}

const OwnersSection: React.FC<OwnersSectionProps> = ({
  owners,
  meta,
  searchTerm,
  onBlockUser,
  onPageChange,
  setSelectedUser,
}) => {
  const filteredOwners = owners
    .filter(o => (o.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex justify-between items-center px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
          Owner Index ({filteredOwners.length})
        </p>

        {/* Pagination */}
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
              {meta.page + 1} / {meta.totalPages}
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

      <div className="space-y-3">
        {filteredOwners.map(owner => (
          <div
            key={owner.id}
            onClick={() => setSelectedUser(owner)}
            className={`group bg-white dark:bg-surface-dark rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.99] hover:shadow-lg ${
              owner.isBlocked
                ? 'border-red-400/20 opacity-80'
                : 'border-slate-100 dark:border-slate-800'
            }`}
          >
            <div className="p-4 flex items-center gap-3">
              {/* Avatar */}
              <div className="relative shrink-0">
                <img
                  src={owner.avatar}
                  className="size-12 rounded-xl object-cover shadow-sm ring-1 ring-slate-100 dark:ring-white/5"
                  alt=""
                />
                <div className={`absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-white dark:border-surface-dark ${
                  owner.isBlocked ? 'bg-red-500' : 'bg-green-500'
                }`} />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{owner.name}</h4>
                  {owner.isBlocked && (
                    <span className="shrink-0 text-[8px] font-black bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full uppercase border border-red-500/20">
                      Suspended
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate">{owner.phone}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-lg">
                    <span className="material-symbols-outlined text-yellow-500 text-[11px] filled">star</span>
                    <span className="text-[9px] font-black text-yellow-600">{owner.rating ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg">
                    <span className="material-symbols-outlined text-slate-400 text-[11px]">directions_car</span>
                    <span className="text-[9px] font-black text-slate-500">{owner.trips ?? 0} trips</span>
                  </div>
                </div>
              </div>

              {/* Quick block toggle + tap chevron */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBlockUser(owner.id, !owner.isBlocked);
                  }}
                  className={`size-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                    owner.isBlocked
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                      : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
                  }`}
                  title={owner.isBlocked ? 'Restore Access' : 'Suspend Account'}
                >
                  <span className="material-symbols-outlined text-lg">
                    {owner.isBlocked ? 'lock_open' : 'block'}
                  </span>
                </button>
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors text-lg">
                  chevron_right
                </span>
              </div>
            </div>
          </div>
        ))}

        {filteredOwners.length === 0 && (
          <div className="py-24 text-center flex flex-col items-center justify-center animate-fade-in">
            <div className="size-24 bg-purple-500/5 rounded-[2.5rem] flex items-center justify-center mb-6 border border-purple-500/10">
              <span className="material-symbols-outlined text-5xl text-purple-500/40">groups</span>
            </div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">
              {searchTerm ? 'No search results' : 'No Registered Owners'}
            </h4>
            <p className="text-sm text-slate-500 max-w-[280px] leading-relaxed mx-auto font-medium">
              {searchTerm
                ? `No owner matched "${searchTerm}".`
                : 'Owner accounts will appear here as they register.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnersSection;
