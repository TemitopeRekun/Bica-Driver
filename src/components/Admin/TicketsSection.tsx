import React from 'react';
import { SupportTicket, SupportCategory } from '@/types';
import { PaginationMeta } from '@/services/api.service';

interface TicketsSectionProps {
  tickets: SupportTicket[];
  ticketsMeta: PaginationMeta | null;
  onPageChange: (page: number) => void;
  onViewTrip?: (tripId: string) => void;
  isLoading?: boolean;
}

const TicketsSection: React.FC<TicketsSectionProps> = ({ 
  tickets, ticketsMeta, onPageChange, onViewTrip, isLoading 
}) => {
  const [categoryFilter, setCategoryFilter] = React.useState<'ALL' | SupportCategory>('ALL');
  
  const getCategoryStyles = (cat: SupportCategory) => {
    switch (cat) {
      case 'PAYMENT_ISSUE': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'TRIP_PROBLEM': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'DRIVER_OWNER_COMPLAINT': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'TECHNICAL_ISSUE': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return 'Just now';
    return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const filteredTickets = React.useMemo(() => {
    if (categoryFilter === 'ALL') return tickets;
    return tickets.filter(t => t.category === categoryFilter);
  }, [tickets, categoryFilter]);

  const categories: { label: string; value: 'ALL' | SupportCategory }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Payment', value: 'PAYMENT_ISSUE' },
    { label: 'Trip', value: 'TRIP_PROBLEM' },
    { label: 'Complaint', value: 'DRIVER_OWNER_COMPLAINT' },
    { label: 'Technical', value: 'TECHNICAL_ISSUE' },
    { label: 'Other', value: 'OTHER' },
  ];

  if (isLoading && tickets.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-white/10 rounded" />
                <div className="h-3 w-1/4 bg-white/10 rounded" />
              </div>
            </div>
            <div className="h-12 bg-white/5 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Category Filter Row */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategoryFilter(cat.value)}
            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${
              categoryFilter === cat.value
                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filteredTickets.length === 0 ? (
        <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-12 text-center bg-surface-light dark:bg-surface-dark">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <span className="material-symbols-outlined text-3xl">support_agent</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            No tickets found
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-[240px] mx-auto font-medium">
            {categoryFilter === 'ALL' ? 'User support inquiries will appear here.' : `No ${categoryFilter.toLowerCase().replace('_', ' ')} tickets available.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => (
            <div 
              key={ticket.id} 
              className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-all hover:border-primary/30 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-xl">person</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm uppercase tracking-tight italic">{ticket.userName}</h4>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-widest ${
                        ticket.userRole === 'DRIVER' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
                      }`}>
                        {ticket.userRole}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${getCategoryStyles(ticket.category)}`}>
                        {ticket.category.replace(/_/g, ' ')}
                      </span>
                      {ticket.tripId && (
                        <button 
                          onClick={() => onViewTrip?.(ticket.tripId!)}
                          className="flex items-center gap-1 text-[9px] font-mono font-black text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10 hover:bg-primary/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[10px]">route</span>
                          #{ticket.tripId.slice(0, 8)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                  {formatShortDate(ticket.createdAt)}
                </p>
              </div>

              <div className="mt-4 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 italic leading-relaxed line-clamp-2">
                  "{ticket.firstMessage}"
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between">
                 <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                   <span className="flex items-center gap-1">
                     <span className="material-symbols-outlined text-sm">mail</span>
                     {ticket.user?.email || 'N/A'}
                   </span>
                   <span className="flex items-center gap-1">
                     <span className="material-symbols-outlined text-sm">call</span>
                     {ticket.user?.phone || 'N/A'}
                   </span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {ticketsMeta && ticketsMeta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button 
            disabled={ticketsMeta.page === 0}
            onClick={() => onPageChange(ticketsMeta.page - 1)}
            className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-400 disabled:opacity-20 transition-all active:scale-90"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
            {ticketsMeta.page + 1} / {ticketsMeta.totalPages}
          </span>
          <button 
            disabled={ticketsMeta.page >= ticketsMeta.totalPages - 1}
            onClick={() => onPageChange(ticketsMeta.page + 1)}
            className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-400 disabled:opacity-20 transition-all active:scale-90"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TicketsSection;
