import React from 'react';
import { UserProfile, UserRole } from '@/types';
import MonnifyStatus from './MonnifyStatus';

interface UserDossierModalProps {
  user: UserProfile;
  userDetailsLoading: boolean;
  retryingSubAccountIds: Set<string>;
  onClose: () => void;
  onUpdateStatus: (userId: string, status: any) => void;
  onBlockUser: (userId: string, blocked: boolean) => void;
  onRetrySubAccount: (userId: string) => Promise<void>;
  formatJoinedDate: (value?: string | null) => string;
}

const UserDossierModal: React.FC<UserDossierModalProps> = ({
  user,
  userDetailsLoading,
  retryingSubAccountIds,
  onClose,
  onUpdateStatus,
  onBlockUser,
  onRetrySubAccount,
  formatJoinedDate
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-xl bg-white dark:bg-surface-dark rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined filled text-xl">folder_shared</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">User Dossier</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{user.role} · {user.id.slice(0, 12)}</p>
              </div>
            </div>
            <button onClick={onClose} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-all text-slate-500 hover:text-slate-900 dark:hover:text-white">
               <span className="material-symbols-outlined text-base">close</span>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="p-8 space-y-10">
            {/* 1. Identity & Core Profile */}
            <section>
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <img src={user.avatar} className="size-24 rounded-[2.5rem] object-cover ring-4 ring-primary/10 shadow-xl" alt="" />
                  <div className={`absolute -bottom-1 -right-1 size-8 rounded-full border-4 border-white dark:border-surface-dark shadow-md flex items-center justify-center ${
                    user.approvalStatus === 'APPROVED' ? 'bg-green-500' : 'bg-orange-500'
                  }`}>
                    <span className="material-symbols-outlined text-white text-[16px] filled">
                      {user.approvalStatus === 'APPROVED' ? 'verified' : 'pending'}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                   <h4 className="text-3xl font-black text-slate-900 dark:text-white leading-tight truncate">
                     {user.name}
                   </h4>
                   <p className="text-slate-500 font-bold text-sm mt-0.5 flex items-center gap-2">
                     <span className="material-symbols-outlined text-base">phone_iphone</span>
                     {user.phone}
                   </p>
                   <div className="flex flex-wrap gap-2 mt-3">
                      <span className="bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {user.email}
                      </span>
                      {user.isBlocked && (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">Blocked</span>
                      )}
                   </div>
                </div>
              </div>
            </section>

            {/* Status Alerts */}
            {userDetailsLoading && (
              <div className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-4 text-xs font-black text-primary border border-primary/10 animate-pulse">
                <span className="material-symbols-outlined text-lg animate-spin">refresh</span>
                Synchronizing latest registration records...
              </div>
            )}

            {/* 2. Operational & Financial Status (Drivers Only) */}
            {user.role === UserRole.DRIVER && (
              <section className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pl-1">Financial Consistency</h5>
                <div className="bg-slate-50 dark:bg-white/5 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800">
                  <MonnifyStatus 
                    driver={user} 
                    retryingSubAccountIds={retryingSubAccountIds} 
                    onRetrySubAccount={onRetrySubAccount} 
                  />
                </div>
              </section>
            )}

            {/* 3. Verification Assets (Drivers Only) */}
            {user.role === UserRole.DRIVER && (
              <section className="space-y-6">
                <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pl-1">Compliance Documents</h5>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Selfie */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Verification Selfie</p>
                    <div className="aspect-square bg-slate-100 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden relative group">
                      {user.selfieImage ? (
                        <>
                          <img src={user.selfieImage} alt="Selfie" className="size-full object-cover group-hover:scale-105 transition-transform" />
                          <a href={user.selfieImage} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">
                            Full View
                          </a>
                        </>
                      ) : (
                        <div className="size-full flex flex-col items-center justify-center text-slate-400 gap-2">
                          <span className="material-symbols-outlined">face_retouching_off</span>
                          <span className="text-[10px] font-black uppercase">Missing</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* License */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Driver's License</p>
                    <div className="aspect-square bg-slate-100 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden relative group shadow-sm transition-all hover:shadow-md">
                      {user.licenseImage ? (
                        <>
                          <img src={user.licenseImage} alt="License" className="size-full object-cover group-hover:scale-105 transition-transform" />
                          <a href={user.licenseImage} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">
                            Expand
                          </a>
                        </>
                      ) : (
                        <div className="size-full flex flex-col items-center justify-center text-slate-400 gap-2">
                          <span className="material-symbols-outlined">document_scanner</span>
                          <span className="text-[10px] font-black uppercase">Missing</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* NIN */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">NIN ID</p>
                    <div className="aspect-square bg-slate-100 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden relative group">
                      {user.ninImage ? (
                        <>
                          <img src={user.ninImage} alt="NIN" className="size-full object-cover group-hover:scale-105 transition-transform" />
                          <a href={user.ninImage} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">
                            Expand
                          </a>
                        </>
                      ) : (
                        <div className="size-full flex flex-col items-center justify-center text-slate-400 gap-2">
                          <span className="material-symbols-outlined">badge</span>
                          <span className="text-[10px] font-black uppercase">Missing</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 4. Details Grid (Role Agnostic) */}
            <section className="space-y-4">
               <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pl-1">Demographics & Profile</h5>
               <div className="grid grid-cols-2 gap-4">
                  {/* NIN Text */}
                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                     <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">NIN Reference</p>
                     <p className="font-mono font-black text-sm text-slate-900 dark:text-white truncate">{user.nin || 'Unspecified'}</p>
                  </div>
                  {/* Age */}
                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                     <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Declared Age</p>
                     <p className="font-black text-sm text-slate-900 dark:text-white">{user.age || 'Not Disclosed'}</p>
                  </div>
                  {/* Member Since */}
                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                     <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Registration Date</p>
                     <p className="font-black text-sm text-slate-900 dark:text-white truncate">{formatJoinedDate(user.createdAt)}</p>
                  </div>
                  {/* Rating/Trip Volume */}
                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                     <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Operational Tier</p>
                     <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-yellow-500 text-sm filled">star</span>
                        <p className="font-black text-sm text-slate-900 dark:text-white">{user.rating || 'N/A'}</p>
                        <span className="text-[10px] text-slate-500 font-bold ml-1">({user.trips || 0} trips)</span>
                     </div>
                  </div>
               </div>
            </section>

            {/* 5. Vehicle Specifications (Owners Only) */}
            {user.role === UserRole.OWNER && (
              <section className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pl-1">Vehicle Fleet Detail</h5>
                <div className="bg-primary/5 p-6 rounded-[2.5rem] border border-primary/10 text-primary">
                   <div className="flex items-center gap-4 mb-6">
                     <div className="size-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
                       <span className="material-symbols-outlined text-3xl">directions_car</span>
                     </div>
                     <div>
                        <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                          {user.carYear} {user.carModel}
                        </p>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{user.carType}</span>
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fleet Status</p>
                        <p className="font-black text-slate-900 dark:text-white text-xs">Operational</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Commission</p>
                        <p className="font-black text-slate-900 dark:text-white text-xs">Standard Tier</p>
                      </div>
                   </div>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-8 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-slate-800 shrink-0">
           <div className="flex flex-col gap-3">
              {user.role === UserRole.DRIVER && user.approvalStatus === 'PENDING' && !user.isBlocked && (
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      onUpdateStatus(user.id, 'APPROVED');
                      onClose();
                    }}
                    disabled={!user.subAccountActive}
                    className={`w-full font-black py-5 rounded-[1.5rem] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      !user.subAccountActive 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                        : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">verified_user</span>
                    APPROVE REGISTRATION
                  </button>
                  {!user.subAccountActive && (
                    <div className="flex items-center justify-center gap-1.5 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                      <span className="material-symbols-outlined text-orange-500 text-sm">info</span>
                      <p className="text-[10px] text-orange-600 dark:text-orange-400 font-black uppercase tracking-widest">
                        Configure Sub-Account Before Approval
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    onBlockUser(user.id, !user.isBlocked);
                    onClose();
                  }}
                  className={`flex-1 font-black py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border-2 ${
                    user.isBlocked 
                      ? 'border-green-500 text-green-600 hover:bg-green-500/5' 
                      : 'border-red-500/20 text-red-500 hover:bg-red-500/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{user.isBlocked ? 'lock_open' : 'block'}</span>
                  {user.isBlocked ? 'RESTORE ACCESS' : 'SUSPEND USER'}
                </button>
                <button 
                  onClick={onClose}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  CLOSE DOSSIER
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default UserDossierModal;
