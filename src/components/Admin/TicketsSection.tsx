import React from 'react';
import { SupportTicket, SupportCategory } from '@/types';
import { PaginationMeta } from '@/services/api.service';

interface TicketsSectionProps {
  tickets: SupportTicket[];
  ticketsMeta: PaginationMeta | null;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

const TicketsSection: React.FC<TicketsSectionProps> = ({ tickets, ticketsMeta, onPageChange, isLoading }) => {
  
  const getCategoryStyles = (cat: SupportCategory) => {
    switch (cat) {
      case 'PAYMENT_ISSUE': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'TRIP_PROBLEM': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return 'Just now';
    return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  if (isLoading && tickets.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl" />)}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="py-20 text-center opacity-40">
        <span className="material-symbols-outlined text-6xl mb-4">support_agent</span>
        <p className="font-black uppercase tracking-widest text-xs italic">No support tickets found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid gap-3">
        {tickets.map((ticket) => (
          <div 
            key={ticket.id} 
            className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-all hover:border-primary/30"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl">person</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-sm uppercase tracking-tight italic">{ticket.userName}</h4>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 uppercase tracking-widest">
                      {ticket.userRole}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${getCategoryStyles(ticket.category)}`}>
                      {ticket.category.replace(/_/g, ' ')}
                    </span>
                    {ticket.tripId && (
                      <span className="text-[9px] font-mono font-black text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-lg">
                        #{ticket.tripId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                {formatShortDate(ticket.createdAt)}
              </p>
            </div>

            <div className="mt-4 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 italic leading-relaxed">
                "{ticket.firstMessage.length > 60 ? ticket.firstMessage.slice(0, 60) + '...' : ticket.firstMessage}"
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
