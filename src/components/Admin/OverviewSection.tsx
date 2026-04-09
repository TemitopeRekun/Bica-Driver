import { Trip, PendingPaymentTrip, UserProfile, UserRole, AdminDashboardStats } from '@/types';

interface OverviewSectionProps {
  lastUpdated: Date | null;
  pendingDrivers: UserProfile[];
  stats: AdminDashboardStats | null;
  pendingPayments: PendingPaymentTrip[];
  platformFees: number;
  completedTripsCount: number;
  onlineDriversCount: number;
  totalOwnersCount: number;
  trips: Trip[];
  formatCurrency: (amount: number) => string;
  formatShortDate: (value?: string | null) => string;
  setActiveSection: (section: any) => void;
  onSimulate: (role: UserRole) => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  lastUpdated,
  pendingDrivers,
  stats,
  pendingPayments,
  platformFees,
  completedTripsCount,
  onlineDriversCount,
  totalOwnersCount,
  trips,
  formatCurrency,
  formatShortDate,
  setActiveSection,
  onSimulate
}) => {
  // Use server side stats if available
  const displayPendingDriversCount = stats?.pendingDriversCount ?? pendingDrivers.length;
  const displayTotalRevenue = stats?.totalEarnings ? (stats.totalEarnings * 0.15) : platformFees; // Assume 15% fee for display if using total earnings
  const displayCompletedTrips = stats?.totalTrips ?? completedTripsCount;
  const displayTotalDrivers = stats?.totalDrivers ?? onlineDriversCount;
  const displayTotalOwners = stats?.totalOwners ?? totalOwnersCount;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Platform Status Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Platform Snapshot</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Operational Dashboard
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Last Updated</p>
          <p className="text-xs font-black text-slate-900 dark:text-white">
            {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Synchronizing...'}
          </p>
        </div>
      </div>

      {/* Immediate Attention Area */}
      {(displayPendingDriversCount > 0 || pendingPayments.length > 0) && (
        <div className="bg-red-500/5 border-2 border-red-500/20 rounded-[2rem] p-5 shadow-inner">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-red-500 filled">priority_high</span>
            <h3 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Immediate Attention</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayPendingDriversCount > 0 && (
              <button 
                onClick={() => setActiveSection('drivers')}
                className="bg-white dark:bg-red-950/20 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between group hover:border-red-500 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-600">
                    <span className="material-symbols-outlined">badge</span>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Pending Drivers</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{displayPendingDriversCount}</p>
                  </div>
                </div>
                <div className="size-8 rounded-full border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </div>
              </button>
            )}
            {pendingPayments.length > 0 && (
              <button 
                onClick={() => setActiveSection('finance')}
                className="bg-white dark:bg-red-950/20 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between group hover:border-red-500 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-600">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Pending Payments</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{pendingPayments.length}</p>
                  </div>
                </div>
                <div className="size-8 rounded-full border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="size-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </span>
            <span className="text-[9px] font-black text-green-500 px-2 py-0.5 bg-green-500/10 rounded-full italic">+12%</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Revenue</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{formatCurrency(displayTotalRevenue)}</p>
        </div>

        {/* Trips Volume */}
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">route</span>
            </span>
            <span className="text-[9px] font-black text-primary px-2 py-0.5 bg-primary/10 rounded-full italic">Volume</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Completed Trips</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{displayCompletedTrips}</p>
        </div>

        {/* Active Drivers */}
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="size-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">sports_motorsports</span>
            </span>
            <span className="text-[9px] font-black text-blue-500 px-2 py-0.5 bg-blue-500/10 rounded-full italic">Total</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Registered Drivers</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{displayTotalDrivers}</p>
        </div>

        {/* Registered Owners */}
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="size-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">groups</span>
            </span>
            <span className="text-[9px] font-black text-purple-500 px-2 py-0.5 bg-purple-500/10 rounded-full italic">Users</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Owners</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{displayTotalOwners}</p>
        </div>
      </div>


      {/* Recent Activity Mini-Feed */}
      <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Live Activity Feed</h3>
          <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View All Trips</button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {trips.slice(0, 5).map(trip => (
            <div key={trip.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`size-10 rounded-2xl flex items-center justify-center ${
                  trip.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'
                }`}>
                  <span className="material-symbols-outlined text-base">trip_origin</span>
                </div>
                <div>
                   <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">{trip.location}</p>
                   <p className="text-xs text-slate-500 font-medium">Trip {trip.id.slice(0, 8)} · {formatShortDate(trip.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(trip.amount)}</p>
                <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                  trip.status === 'COMPLETED' ? 'text-green-500' : 'text-slate-500'
                }`}>
                  {trip.status}
                </div>
              </div>
            </div>
          ))}
          {trips.length === 0 && (
            <div className="py-20 px-8 text-center flex flex-col items-center justify-center animate-fade-in">
              <div className="size-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 relative">
                 <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">monitor_heart</span>
                 <div className="absolute top-0 right-0 size-4 bg-green-500 rounded-full border-4 border-white dark:border-surface-dark animate-pulse"></div>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white mb-2">Awaiting Live Activity</h4>
              <p className="text-sm text-slate-500 max-w-[240px] leading-relaxed mx-auto font-medium">
                The platform is active and monitoring for ride requests. Activity will appear here in real-time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewSection;
