import React from 'react';
import { Trip } from '@/types';
import { VirtualList } from '../Common/VirtualList';
import { PaginationMeta } from '@/services/api.service';

interface TripsSectionProps {
  trips: Trip[];
  meta: PaginationMeta | null;
  formatCurrency: (amount: number) => string;
  getTripStatusClass: (status: Trip['status']) => string;
  onPageChange: (page: number) => void;
}

const TripsSection: React.FC<TripsSectionProps> = ({
  trips,
  meta,
  formatCurrency,
  getTripStatusClass,
  onPageChange
}) => {
  if (trips.length === 0) {
    return (
      <div className="py-24 text-center opacity-30">
         <span className="material-symbols-outlined text-6xl mb-4">route_off</span>
         <p className="font-black text-sm uppercase tracking-widest">Archive Empty</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ height: 'calc(100vh - 250px)' }}>
       <VirtualList 
         items={trips}
         height={window.innerHeight - 250} // Approximate height adjustment
         itemSize={180} // Estimated height of each trip card
         renderItem={(trip, index, style) => (
           <div key={trip.id} style={style} className="px-1 pb-4">
             <div className="bg-white dark:bg-surface-dark p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-5 hover:shadow-md transition-all active:scale-[0.98]">
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
                            {trip.ownerName?.[0]}
                         </div>
                         <div className="size-10 rounded-2xl bg-indigo-500/10 border-4 border-white dark:border-surface-dark flex items-center justify-center text-[10px] font-black text-indigo-500 overflow-hidden shadow-sm">
                            {trip.driverName?.[0]}
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
           </div>
         )}
       />
    </div>
  );
};

export default TripsSection;
