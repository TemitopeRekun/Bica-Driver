import React, { useState } from 'react';
import { Trip } from '@/types';
import { PaginationMeta } from '@/services/api.service';

interface TripsSectionProps {
  trips: Trip[];
  meta: PaginationMeta | null;
  formatCurrency: (amount: number) => string;
  getTripStatusClass: (status: Trip['status']) => string;
  onPageChange: (page: number) => void;
  searchTerm?: string;
}

const TripsSection: React.FC<TripsSectionProps> = ({
  trips,
  meta,
  formatCurrency,
  getTripStatusClass,
  onPageChange,
  searchTerm = '',
}) => {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  const filtered = trips.filter(t =>
    !localSearch ||
    t.id.toLowerCase().includes(localSearch.toLowerCase()) ||
    (t.ownerName || '').toLowerCase().includes(localSearch.toLowerCase()) ||
    (t.driverName || '').toLowerCase().includes(localSearch.toLowerCase()) ||
    (t.location || '').toLowerCase().includes(localSearch.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Search bar */}
      <div className="sticky top-0 z-10 pb-1">
        <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center px-4 h-12 shadow-sm">
          <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder="Search by trip ID, owner, driver, location..."
            className="bg-transparent border-none w-full text-sm font-medium focus:ring-0 p-0 text-slate-900 dark:text-white placeholder-slate-400"
          />
          {localSearch && (
            <button onClick={() => setLocalSearch('')} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center flex flex-col items-center justify-center animate-fade-in opacity-50">
          <div className="size-24 bg-slate-100 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-6 border border-slate-200 dark:border-white/5">
            <span className="material-symbols-outlined text-5xl text-slate-400">history</span>
          </div>
          <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2 uppercase tracking-[0.2em]">
            {localSearch ? 'No Matches' : 'Archive Empty'}
          </h4>
          <p className="text-sm text-slate-500 max-w-[280px] leading-relaxed mx-auto font-medium">
            {localSearch
              ? `No trips match "${localSearch}". Try a different search.`
              : 'Every trip managed by the platform will be logged here for permanent record keeping.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {filtered.map((trip) => (
              <div
                key={trip.id}
                className="bg-white dark:bg-surface-dark p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-5 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className={`size-12 rounded-2xl flex items-center justify-center ${getTripStatusClass(trip.status)}`}>
                      <span className="material-symbols-outlined">trip_origin</span>
                    </div>
                    <div>
                      <h4 className="font-black text-base text-slate-900 dark:text-white leading-tight">
                        {trip.location}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">#{trip.id.slice(0, 8)} · {trip.date}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${getTripStatusClass(trip.status)}`}>
                    {trip.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      <div className="size-10 rounded-2xl bg-primary/10 border-4 border-white dark:border-surface-dark flex items-center justify-center text-[10px] font-black text-primary overflow-hidden shadow-sm">
                        {trip.ownerName?.[0] ?? '?'}
                      </div>
                      <div className="size-10 rounded-2xl bg-indigo-500/10 border-4 border-white dark:border-surface-dark flex items-center justify-center text-[10px] font-black text-indigo-500 overflow-hidden shadow-sm">
                        {trip.driverName?.[0] ?? '?'}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Participants</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                        {trip.ownerName} & {trip.driverName || 'UNASSIGNED'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fare Value</p>
                    <p className="font-black text-lg text-slate-900 dark:text-white">{formatCurrency(trip.amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2 pb-4">
              <button
                disabled={meta.page === 0}
                onClick={() => onPageChange(meta.page - 1)}
                className="size-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 transition-all"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest px-2">
                Page {meta.page + 1} of {meta.totalPages}
              </span>
              <button
                disabled={meta.page >= meta.totalPages - 1}
                onClick={() => onPageChange(meta.page + 1)}
                className="size-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 transition-all"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TripsSection;
