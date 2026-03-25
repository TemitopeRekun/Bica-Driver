
import React, { useState } from 'react';
import { UserProfile, UserRole, ApprovalStatus, Trip, SystemSettings, PendingPaymentTrip, PaymentHistoryRecord } from '../types';

interface AdminDashboardScreenProps {
  users: UserProfile[];
  trips: Trip[];
  pendingPayments: PendingPaymentTrip[];
  paymentHistory: PaymentHistoryRecord[];
  settings: SystemSettings;
  isLoading?: boolean;
  error?: string | null;
  onUpdateStatus: (userId: string, status: ApprovalStatus) => void;
  onBlockUser: (userId: string, blocked: boolean) => void;
  onUpdateSettings: (settings: SystemSettings) => void;
  onRetry: () => Promise<void> | void;
  onBack: () => void;
  onSimulate: (role: UserRole) => void;
}

type AdminSection = 'overview' | 'drivers' | 'owners' | 'trips' | 'finance' | 'settings';
type DriverFilter = 'All' | 'Pending' | 'Active' | 'Blocked';

const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ 
  users, trips, pendingPayments, paymentHistory, settings, isLoading, error,
  onUpdateStatus, onBlockUser, onUpdateSettings, 
  onRetry, onBack, onSimulate 
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [driverFilter, setDriverFilter] = useState<DriverFilter>('All');
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);

  // Derived Data
  const drivers = users.filter(u => u.role === UserRole.DRIVER);
  const owners = users.filter(u => u.role === UserRole.OWNER);
  const pendingDrivers = drivers.filter(u => u.approvalStatus === 'PENDING');
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
  
  const totalRevenue = trips.reduce((acc, t) => t.status === 'COMPLETED' ? acc + t.amount : acc, 0);
  const platformFees = totalRevenue * (settings.commission / 100);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount).replace('NGN', '₦');
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return 'Just now';
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };


  const handleSaveSettings = () => {
    onUpdateSettings(localSettings);
    alert("System Settings Updated Successfully!");
  };

  const getTripStatusClass = (status: Trip['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-500';
      case 'CANCELLED':
      case 'DECLINED':
        return 'bg-red-500/10 text-red-500';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-orange-500/10 text-orange-500';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-slide-up">
      {/* Simulation Card */}
      <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-6 rounded-3xl border border-slate-700 shadow-xl relative overflow-hidden group">
         <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-[100px] text-white">smartphone</span>
         </div>
         <div className="relative z-10">
            <h3 className="text-white font-bold text-lg mb-1">Live App Simulator</h3>
            <p className="text-slate-400 text-xs mb-4 max-w-[70%]">Access user dashboards directly to verify functionality and user experience.</p>
            <div className="flex gap-3">
               <button 
                 onClick={() => onSimulate(UserRole.DRIVER)}
                 className="flex items-center gap-2 bg-primary hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all active:scale-95 shadow-lg shadow-primary/25"
               >
                 <span className="material-symbols-outlined text-sm">sports_motorsports</span>
                 View as Driver
               </button>
               <button 
                 onClick={() => onSimulate(UserRole.OWNER)}
                 className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all active:scale-95 border border-white/10"
               >
                 <span className="material-symbols-outlined text-sm">directions_car</span>
                 View as Owner
               </button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-green-500/10 rounded-lg text-green-500 material-symbols-outlined">payments</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Revenue</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(platformFees)}</p>
          <p className="text-xs text-green-500 font-bold mt-1">+12% this week</p>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-primary/10 rounded-lg text-primary material-symbols-outlined">directions_car</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Trips</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{trips.filter(t => t.status === 'COMPLETED').length}</p>
          <p className="text-xs text-slate-400 font-bold mt-1">Total volume</p>
        </div>
      </div>

      <div className="bg-primary text-white p-6 rounded-3xl shadow-xl shadow-primary/20 relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
          <div>
             <p className="text-sm font-medium opacity-80 mb-1">Pending Verifications</p>
             <h3 className="text-4xl font-black">{pendingDrivers.length}</h3>
          </div>
          <button 
            onClick={() => setActiveSection('drivers')}
            className="bg-white text-primary px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-100 transition-colors"
          >
            Review Now
          </button>
        </div>
        <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl opacity-10">badge</span>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold text-lg mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {trips.slice(0, 3).map(trip => (
            <div key={trip.id} className="flex items-center justify-between py-2 border-b border-dashed border-slate-200 dark:border-slate-700 last:border-0">
              <div className="flex items-center gap-3">
                 <div className={`w-2 h-2 rounded-full ${trip.status === 'COMPLETED' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                 <div>
                    <p className="text-sm font-bold">{trip.location}</p>
                    <p className="text-xs text-slate-500">{(trip.date || '').split(' ')[1] || trip.date}</p>
                 </div>
              </div>
              <span className="text-sm font-mono font-medium">{formatCurrency(trip.amount)}</span>
            </div>
          ))}
          {trips.length === 0 && <p className="text-slate-500 text-sm italic">No recent trips.</p>}
        </div>
      </div>
    </div>
  );

  const renderDrivers = () => (
    <div className="space-y-4 animate-slide-up">
      <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-2">
         {(['All', 'Pending', 'Active', 'Blocked'] as DriverFilter[]).map((filter) => (
           <button
             key={filter}
             onClick={() => setDriverFilter(filter)}
             className={`px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap transition-colors ${
               driverFilter === filter
                 ? 'bg-primary text-white border border-primary'
                 : 'bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 hover:border-primary'
             }`}
           >
             {filter}
           </button>
         ))}
      </div>
      {filteredDrivers.map(driver => (
        <div 
          key={driver.id}
          onClick={() => setSelectedUser(driver)}
          className={`bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all ${driver.isBlocked ? 'border-red-500/50 opacity-75' : 'border-slate-200 dark:border-slate-800'}`}
        >
          <div className="relative">
            <img src={driver.avatar} className="w-12 h-12 rounded-xl object-cover" alt="" />
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-surface-dark ${driver.approvalStatus === 'APPROVED' ? 'bg-green-500' : driver.approvalStatus === 'PENDING' ? 'bg-orange-500 animate-pulse' : 'bg-red-500'}`}></div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm truncate flex items-center gap-2">
              {driver.name}
              {driver.isBlocked && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Blocked</span>}
              {!driver.isBlocked && driver.isOnline && <span className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded uppercase">Online</span>}
            </h4>
            <p className="text-xs text-slate-500 truncate">{driver.email}</p>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-mono">{driver.carType || 'No Car'}</span>
               {driver.approvalStatus === 'PENDING' && <span className="text-[10px] text-orange-500 font-bold uppercase">Review Needed</span>}
            </div>
          </div>
          <span className="material-symbols-outlined text-slate-300">chevron_right</span>
        </div>
      ))}
      {filteredDrivers.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-6">No drivers match the current filter.</p>
      )}
    </div>
  );

  const renderOwners = () => (
    <div className="space-y-4 animate-slide-up">
      {owners.filter(o => (o.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map(owner => (
        <div key={owner.id} className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <img src={owner.avatar} className="w-12 h-12 rounded-full object-cover" alt="" />
          <div className="flex-1">
            <h4 className="font-bold text-sm flex items-center gap-2">
               {owner.name}
               {owner.isBlocked && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Blocked</span>}
            </h4>
            <p className="text-xs text-slate-500">{owner.phone}</p>
            <div className="flex items-center gap-1 mt-1">
               <span className="material-symbols-outlined text-yellow-500 text-[14px] filled">star</span>
               <span className="text-xs font-bold">{owner.rating}</span>
               <span className="text-xs text-slate-500">• {owner.trips} trips</span>
            </div>
          </div>
          <button 
             onClick={() => onBlockUser(owner.id, !owner.isBlocked)}
             className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${owner.isBlocked ? 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'}`}
             title={owner.isBlocked ? "Unblock" : "Block"}
          >
            <span className="material-symbols-outlined text-sm">{owner.isBlocked ? 'check_circle' : 'block'}</span>
          </button>
        </div>
      ))}
    </div>
  );

  const renderTrips = () => (
    <div className="space-y-4 animate-slide-up">
       {trips.map(trip => (
         <div key={trip.id} className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
            <div className="flex justify-between items-start">
               <div>
                  <h4 className="font-bold text-sm">{trip.location}</h4>
                  <p className="text-xs text-slate-500">{trip.date}</p>
               </div>
               <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getTripStatusClass(trip.status)}`}>{trip.status.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
               <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                     <div className="w-6 h-6 rounded-full bg-slate-300 border-2 border-surface-dark flex items-center justify-center text-[8px] overflow-hidden">{trip.ownerName?.[0]}</div>
                     <div className="w-6 h-6 rounded-full bg-slate-500 border-2 border-surface-dark flex items-center justify-center text-[8px] overflow-hidden">{trip.driverName?.[0]}</div>
                  </div>
                  <span className="text-xs text-slate-500 truncate max-w-[150px]">{trip.ownerName} & {trip.driverName}</span>
               </div>
               <p className="font-black text-sm">{formatCurrency(trip.amount)}</p>
            </div>
         </div>
       ))}
       {trips.length === 0 && (
         <div className="text-center py-10 opacity-50">
            <span className="material-symbols-outlined text-4xl mb-2">trip_origin</span>
            <p className="text-sm">No trips recorded yet.</p>
         </div>
       )}
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-6 animate-slide-up">
       <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-800 to-black text-white shadow-lg">
          <p className="text-xs font-medium opacity-70 uppercase tracking-widest mb-1">Total Platform Balance</p>
          <h2 className="text-3xl font-black">{formatCurrency(platformFees)}</h2>
          <p className="text-[10px] text-slate-400 mt-2">Accrued form {settings.commission}% commission on {trips.length} trips</p>
       </div>

       <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div>
             <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Driver Settlement Model</h3>
             <p className="text-sm text-slate-500 mt-2 leading-relaxed">
               Drivers are settled directly through Monnify split payments. The in-app wallet balance is only a cleared-earnings ledger for reporting and period resets.
             </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div className="rounded-2xl bg-slate-50 dark:bg-black/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Completed Trips</p>
                <p className="text-2xl font-black mt-1">{trips.filter(trip => trip.status === 'COMPLETED').length}</p>
             </div>
             <div className="rounded-2xl bg-slate-50 dark:bg-black/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending Payments</p>
                <p className="text-2xl font-black mt-1">{pendingPayments.length}</p>
             </div>
          </div>
          <p className="text-xs text-slate-500">
            Admin finance actions should focus on payment monitoring and ledger resets, not manual payout approvals.
          </p>
       </div>

       <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Pending Trip Payments</h3>
            <span className="text-xs font-bold text-slate-400">{pendingPayments.length} open</span>
          </div>
          <div className="space-y-3">
            {pendingPayments.slice(0, 6).map((paymentTrip) => (
              <div key={paymentTrip.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{paymentTrip.location}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {paymentTrip.owner?.name} • {paymentTrip.driver?.name || 'Driver pending'}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 uppercase">
                    {paymentTrip.paymentStatus || 'PENDING'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{paymentTrip.date}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(paymentTrip.amount)}</span>
                </div>
              </div>
            ))}
            {pendingPayments.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-4">No pending trip payments right now.</p>
            )}
          </div>
       </div>

       <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Recent Payment History</h3>
            <span className="text-xs font-bold text-slate-400">{paymentHistory.length} records</span>
          </div>
          <div className="space-y-3">
            {paymentHistory.slice(0, 8).map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {payment.trip.pickupAddress.split(',')[0]} to {payment.trip.destAddress.split(',')[0]}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {payment.trip.owner.name} • {payment.trip.driver?.name || 'Driver pending'}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-500/10 text-green-500 uppercase">
                    Paid
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{formatShortDate(payment.paidAt)}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(payment.totalAmount)}</span>
                </div>
              </div>
            ))}
            {paymentHistory.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-4">No payment history available yet.</p>
            )}
          </div>
       </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6 animate-slide-up">
       <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold border-b border-slate-100 dark:border-slate-700 pb-2">Pricing Configuration</h3>
          
          <div className="flex flex-col gap-2">
             <label className="text-xs font-bold text-slate-500 uppercase">Base Fare (₦)</label>
             <input 
               type="number" 
               value={localSettings.baseFare}
               onChange={(e) => setLocalSettings({...localSettings, baseFare: Number(e.target.value)})}
               className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white"
             />
          </div>

          <div className="flex flex-col gap-2">
             <label className="text-xs font-bold text-slate-500 uppercase">Price Per KM (₦)</label>
             <input 
               type="number" 
               value={localSettings.pricePerKm}
               onChange={(e) => setLocalSettings({...localSettings, pricePerKm: Number(e.target.value)})}
               className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white"
             />
          </div>

          <div className="flex flex-col gap-2">
             <label className="text-xs font-bold text-slate-500 uppercase">Platform Commission (%)</label>
             <input 
               type="number" 
               value={localSettings.commission}
               onChange={(e) => setLocalSettings({...localSettings, commission: Number(e.target.value)})}
               className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white"
             />
          </div>

          <div className="flex flex-col gap-2">
             <label className="text-xs font-bold text-slate-500 uppercase">Time Rate (â‚¦ / min)</label>
             <input 
               type="number" 
               value={localSettings.timeRate ?? 50}
               onChange={(e) => setLocalSettings({...localSettings, timeRate: Number(e.target.value)})}
               className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white"
             />
          </div>
       </div>

       <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
             <h4 className="font-bold text-sm">Auto-Approve Drivers</h4>
             <p className="text-xs text-slate-500">Skip manual verification (Not Recommended)</p>
          </div>
          <button 
            onClick={() => setLocalSettings({...localSettings, autoApprove: !localSettings.autoApprove})}
            className={`w-12 h-7 rounded-full transition-colors relative ${localSettings.autoApprove ? 'bg-green-500' : 'bg-slate-600'}`}
          >
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${localSettings.autoApprove ? 'left-6' : 'left-1'}`}></div>
          </button>
       </div>

       <button 
         onClick={handleSaveSettings}
         className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
       >
          Save System Changes
       </button>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 shrink-0 z-20">
        <button onClick={onBack} className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="font-black text-lg uppercase tracking-tight">Admin Console</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bicadriver v1.0.4</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined filled">admin_panel_settings</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="px-4 py-3 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 bg-background-light dark:bg-background-dark shrink-0">
        <div className="flex gap-4 min-w-max">
          {[
            { id: 'overview', icon: 'dashboard', label: 'Overview' },
            { id: 'drivers', icon: 'badge', label: 'Drivers' },
            { id: 'owners', icon: 'groups', label: 'Owners' },
            { id: 'trips', icon: 'route', label: 'Trips' },
            { id: 'finance', icon: 'account_balance', label: 'Finance' },
            { id: 'settings', icon: 'settings', label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as AdminSection)}
              className={`flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-all ${
                activeSection === item.id 
                  ? 'text-primary bg-primary/5' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span className={`material-symbols-outlined ${activeSection === item.id ? 'filled' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 relative">
        {isLoading && users.length === 0 && trips.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 opacity-80">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">refresh</span>
            <p className="font-bold">Loading admin dashboard...</p>
          </div>
        )}

        {!isLoading && error && users.length === 0 && trips.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
            <div>
              <p className="font-bold text-red-500">Could not load admin data</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
            <button
              onClick={onRetry}
              className="px-5 py-3 rounded-xl bg-primary text-white font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {!((isLoading && users.length === 0 && trips.length === 0) || (!isLoading && error && users.length === 0 && trips.length === 0)) && (
          <>
        {/* Global Search (visible on lists) */}
        {(activeSection === 'drivers' || activeSection === 'owners') && (
           <div className="mb-6 sticky top-0 z-10">
              <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center px-4 h-12 shadow-sm">
                 <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
                 <input 
                   type="text" 
                   placeholder={`Search ${activeSection}...`}
                   className="bg-transparent border-none w-full text-sm font-medium focus:ring-0 p-0 text-slate-900 dark:text-white placeholder-slate-400"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>
           </div>
        )}

        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'drivers' && renderDrivers()}
        {activeSection === 'owners' && renderOwners()}
        {activeSection === 'trips' && renderTrips()}
        {activeSection === 'finance' && renderFinance()}
        {activeSection === 'settings' && renderSettings()}
          </>
        )}
      </main>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-8 flex flex-col gap-6 overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">User Dossier</h3>
                <button onClick={() => setSelectedUser(null)} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90">
                   <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="flex items-center gap-5 p-2">
                <img src={selectedUser.avatar} className="w-20 h-20 rounded-3xl object-cover ring-4 ring-primary/20" alt="" />
                <div>
                   <h4 className="text-2xl font-black leading-tight flex items-center gap-2">
                     {selectedUser.name}
                     {selectedUser.isBlocked && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Blocked</span>}
                   </h4>
                   <p className="text-slate-500 font-bold">{selectedUser.phone}</p>
                   <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-500 uppercase">ID: {selectedUser.id.slice(0, 6)}</span>
                      {selectedUser.approvalStatus === 'PENDING' && <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-[10px] font-bold uppercase">Pending Review</span>}
                   </div>
                </div>
              </div>

              {/* ... (existing fields) ... */}
              <div className="space-y-6">
                 {/* Only show Driver Specifics if driver */}
                 {selectedUser.role === UserRole.DRIVER && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">NIN Number</p>
                            <p className="font-mono font-bold text-sm truncate">{selectedUser.nin || 'Not Provided'}</p>
                         </div>
                         <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Car Type</p>
                            <p className="font-bold text-sm truncate">{selectedUser.carType || 'Not Provided'}</p>
                         </div>
                         <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Transmission</p>
                            <p className="font-bold text-sm truncate">{selectedUser.transmission || 'Not Provided'}</p>
                         </div>
                         <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Age</p>
                            <p className="font-bold text-sm truncate">{selectedUser.age || 'Not Provided'}</p>
                         </div>
                      </div>

                      {/* Driver Documents Section */}
                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Uploaded Documents</h4>
                        
                        <div className="space-y-4">
                          {/* License Image */}
                          <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">Driver's License</p>
                            {selectedUser.licenseImage ? (
                              <img src={selectedUser.licenseImage} alt="Driver License" className="w-full h-40 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                            ) : (
                              <div className="w-full h-20 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 text-xs font-medium">No License Uploaded</div>
                            )}
                          </div>

                          {/* NIN Image */}
                          <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">NIN Document</p>
                            {selectedUser.ninImage ? (
                              <img src={selectedUser.ninImage} alt="NIN Document" className="w-full h-40 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                            ) : (
                              <div className="w-full h-20 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 text-xs font-medium">No NIN Uploaded</div>
                            )}
                          </div>

                          {/* Selfie Image */}
                          <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl">
                            <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">Verification Selfie</p>
                            {selectedUser.selfieImage ? (
                              <img src={selectedUser.selfieImage} alt="Selfie" className="w-full h-40 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                            ) : (
                              <div className="w-full h-20 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 text-xs font-medium">No Selfie Uploaded</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                 )}
                 <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Email</p>
                    <p className="font-bold text-sm truncate">{selectedUser.email}</p>
                 </div>
              </div>

              <div className="flex gap-4 mt-2 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => {
                     onBlockUser(selectedUser.id, !selectedUser.isBlocked);
                     setSelectedUser(null);
                  }}
                  className={`flex-1 py-4 rounded-2xl font-black hover:brightness-110 transition-all active:scale-[0.98] ${selectedUser.isBlocked ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                >
                  {selectedUser.isBlocked ? 'Unblock Account' : 'Block Account'}
                </button>
                
                {selectedUser.role === UserRole.DRIVER && selectedUser.approvalStatus !== 'APPROVED' && !selectedUser.isBlocked && (
                  <button 
                    onClick={() => {
                      onUpdateStatus(selectedUser.id, 'APPROVED');
                      setSelectedUser(null);
                    }}
                    className="flex-1 py-4 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/25 hover:brightness-110 transition-all active:scale-[0.98]"
                  >
                    Approve Driver
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardScreen;
