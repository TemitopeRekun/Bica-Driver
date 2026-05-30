import React, { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { UserProfile, UserRole } from '@/types';
import { IMAGES } from '@/constants';
import { CapacitorService } from '@/services/CapacitorService';
import { Skeleton } from '@/components/Common/Skeleton';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/services/api.service';
import { useAuthStore } from '@/stores/authStore';

interface ProfileScreenProps {
  user: UserProfile;
  initialRole: UserRole;
  onBack: () => void;
  onLogout: () => void;
  onUpdateAvatar: (newAvatar: string) => Promise<void>;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, initialRole, onBack, onLogout, onUpdateAvatar }) => {
  const { toast } = useToast();
  
  const [activeRole, setActiveRole] = useState<UserRole>(initialRole);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const { mapTheme, toggleMapTheme } = useUIStore();

  // Delete Account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!user) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <Skeleton circle width={40} height={40} />
          <Skeleton width={120} height={20} />
        </div>
        <div className="flex flex-col items-center pt-10 gap-6">
          <Skeleton circle width={112} height={112} />
          <div className="space-y-2 flex flex-col items-center">
            <Skeleton width={200} height={24} />
            <Skeleton width={150} height={16} />
          </div>
          <div className="w-full px-4 space-y-6 mt-6">
            <Skeleton height={80} />
            <Skeleton height={50} />
            <Skeleton height={50} />
            <Skeleton height={50} />
          </div>
        </div>
      </div>
    );
  }

  const handleFeatureAlert = (feature: string) => {
    CapacitorService.triggerHaptic();
    toast.info(`Great news! ${feature} is coming very soon to your BicaDriver experience.`);
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteError('');
      
      // Validate inputs
      if (!deletePassword.trim()) {
        setDeleteError('Password is required');
        return;
      }
      
      if (deleteConfirmation !== 'DELETE') {
        setDeleteError('Type DELETE to confirm');
        return;
      }
      
      CapacitorService.triggerHaptic();
      setIsDeletingAccount(true);
      
      // Call deletion API
      await api.deleteAccount(deletePassword);
      
      // On success: logout and redirect
      toast.success('Your account has been permanently deleted.');
      const authStore = useAuthStore.getState();
      authStore.logout();
      
      // Redirect to login/welcome
      setTimeout(() => {
        window.location.href = '/auth/welcome'; // Adjust path as needed
      }, 1500);
      
    } catch (error: any) {
      CapacitorService.triggerHaptic();
      const message = error.message || 'Failed to delete account. Please try again.';
      setDeleteError(message);
      toast.error(message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleCameraUpdate = async () => {
    CapacitorService.triggerHaptic();
    const photo = await CapacitorService.takePhoto();
    if (photo) {
      setIsUpdatingAvatar(true);
      try {
        await onUpdateAvatar(photo);
        toast.success("Looking good! Your profile photo has been updated.");
      } catch (error: any) {
        toast.error(error.message || "We couldn't update your photo right now. Please check your connection and try again.");
      } finally {
        setIsUpdatingAvatar(false);
      }
    }
  };

  const isRoleSwitcherVisible = initialRole === UserRole.UNSET;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white min-h-screen pb-10 font-display">
      <div className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center p-4 justify-between max-w-md mx-auto">
          <button 
            onClick={onBack}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-slate-900 dark:text-white" style={{ fontSize: '24px' }}>arrow_back</span>
          </button>
          <h2 className="text-lg font-black leading-tight flex-1 text-center">Profile</h2>
          <button 
            onClick={() => handleFeatureAlert("Profile Editing")}
            className="flex w-10 items-center justify-end active:scale-95"
          >
            <span className="text-primary text-xs font-black uppercase tracking-widest">Edit</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 pb-8">
        <div className="flex flex-col items-center pt-6 px-4">
          <div className="relative">
            <div 
              className="bg-center bg-no-repeat bg-cover rounded-full h-28 w-28 ring-4 ring-surface-light dark:ring-surface-dark shadow-xl overflow-hidden" 
            >
              <img src={user.avatar} className="w-full h-full object-cover" alt="Profile" />
              {isUpdatingAvatar && (
                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="size-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                 </div>
              )}
            </div>
            <button 
              onClick={handleCameraUpdate}
              disabled={isUpdatingAvatar}
              className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-2 shadow-md flex items-center justify-center ring-2 ring-background-light dark:ring-background-dark active:scale-90 transition-transform disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                photo_camera
              </span>
            </button>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">{user.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                {activeRole === UserRole.DRIVER ? 'Professional Driver' : 'Car Owner'}
              </span>
              {activeRole === UserRole.DRIVER && (
                <span className="text-slate-500 text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-yellow-500 filled" style={{ fontSize: '14px' }}>star</span>
                  {user.rating != null ? (user.rating > 5 ? (user.rating / 100).toFixed(1) : user.rating.toFixed(1)) : '5.0'} ({user.trips})
                </span>
              )}
            </div>
          </div>
        </div>

        {isRoleSwitcherVisible && (
          <div className="px-4">
            <div className="bg-slate-200 dark:bg-surface-dark p-1 rounded-2xl flex shadow-inner">
              <button 
                onClick={() => { CapacitorService.triggerHaptic(); setActiveRole(UserRole.DRIVER); }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeRole === UserRole.DRIVER ? 'bg-surface-light dark:bg-slate-700 shadow-md text-slate-900 dark:text-white' : 'text-slate-400'
                }`}
              >
                Driver
              </button>
              <button 
                onClick={() => { CapacitorService.triggerHaptic(); setActiveRole(UserRole.OWNER); }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeRole === UserRole.OWNER ? 'bg-surface-light dark:bg-slate-700 shadow-md text-slate-900 dark:text-white' : 'text-slate-400'
                }`}
              >
                Owner
              </button>
            </div>
          </div>
        )}

        <div className="px-4 flex flex-col gap-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1">Identity</h3>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center px-4 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 transition-all focus-within:border-primary/50">
                <span className="material-symbols-outlined text-slate-400 mr-3 text-lg">person</span>
                <input className="flex-1 bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 p-0 text-sm font-bold" readOnly value={user.name}/>
                <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center px-4 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 transition-all focus-within:border-primary/50">
                <span className="material-symbols-outlined text-slate-400 mr-3 text-lg">mail</span>
                <input className="flex-1 bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 p-0 text-sm font-bold" readOnly value={user.email}/>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center px-4 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 transition-all focus-within:border-primary/50">
                <span className="material-symbols-outlined text-slate-400 mr-3 text-lg">call</span>
                <input className="flex-1 bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 p-0 text-sm font-bold" readOnly value={user.phone}/>
                <span className="bg-green-500/10 text-green-500 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Verified</span>
              </div>
            </div>
          </div>
        </div>

        {activeRole === UserRole.OWNER && (
          <div className="flex flex-col gap-4">
            <div className="px-4 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1">Vehicles</h3>
              <button onClick={() => handleFeatureAlert("Adding a Vehicle")} className="text-primary text-[10px] font-black uppercase tracking-widest active:scale-95">Add New</button>
            </div>
            <div className="px-4">
              <div onClick={() => handleFeatureAlert("Vehicle Management")} className="bg-surface-light dark:bg-surface-dark rounded-[2rem] p-4 border border-slate-200 dark:border-slate-800 shadow-lg shadow-black/5 flex items-start gap-4 cursor-pointer active:scale-[0.99] transition-all hover:border-primary/30">
                <div className="size-20 shrink-0 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden">
                  <img className="w-full h-full object-cover" src={IMAGES.CAR_IMAGE} alt="Vehicle" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-base truncate">
                        {user.carType ? `${user.carType} ${user.carModel || ''}`.trim() : 'Toyota Prius'}
                      </h4>
                      <p className="text-slate-500 text-xs font-bold">
                        {user.carYear ? `${user.carYear} • ` : ''}{user.transmission || 'Automatic'}
                      </p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase px-2 py-1 rounded-full">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="px-4 flex flex-col gap-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1">Preferences</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-5 rounded-2xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800">
               <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">{mapTheme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-widest">Map Theme</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{mapTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
                  </div>
               </div>
               <button 
                 onClick={() => { CapacitorService.triggerHaptic(); toggleMapTheme(); }}
                 className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${mapTheme === 'dark' ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
               >
                 <span
                   className={`${
                     mapTheme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                   } inline-block h-5 w-5 transform rounded-full bg-white transition-transform`}
                 />
               </button>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 flex flex-col gap-3">
          <button onClick={() => handleFeatureAlert("System Settings")} className="flex items-center justify-between w-full p-5 rounded-2xl bg-surface-light dark:bg-surface-dark hover:bg-slate-100 dark:hover:bg-white/5 transition-all group active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">settings</span>
              </div>
              <span className="font-black text-sm uppercase tracking-widest">Settings</span>
            </div>
            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '20px' }}>chevron_right</span>
          </button>

          <button 
            onClick={() => {
              CapacitorService.triggerHaptic();
              setShowDeleteModal(true);
            }} 
            className="w-full h-16 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase tracking-[0.2em] text-xs hover:bg-red-500/20 transition-colors flex items-center justify-center gap-3 active:scale-[0.98] border border-red-500/20"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            Delete Account Permanently
          </button>

          <button 
            onClick={onLogout} 
            className="mt-3 w-full h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Sign Out Securely
          </button>

          {/* Delete Account Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black/40 flex items-end z-50">
              <div className="w-full bg-background-light dark:bg-background-dark rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black uppercase tracking-tight">Delete Account?</h2>
                  <button 
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletePassword('');
                      setDeleteConfirmation('');
                      setDeleteError('');
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-2">
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">
                    ⚠️ This action cannot be undone.
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Your account and all personal data will be permanently deleted. Your trip history will be retained for legal and safety reasons.
                  </p>
                </div>

                {deleteError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3">
                    <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">Password Confirmation</label>
                    <input
                      type="password"
                      placeholder="Enter your password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      disabled={isDeletingAccount}
                      className="w-full px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-bold placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">Type "DELETE" to confirm</label>
                    <input
                      type="text"
                      placeholder="Type DELETE"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value.toUpperCase())}
                      disabled={isDeletingAccount}
                      className="w-full px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-bold placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || !deletePassword || deleteConfirmation !== 'DELETE'}
                  className="w-full h-14 rounded-2xl bg-red-500 text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-red-600 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingAccount ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">delete</span>
                      Permanently Delete
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                    setDeleteConfirmation('');
                    setDeleteError('');
                  }}
                  disabled={isDeletingAccount}
                  className="w-full h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors active:scale-[0.98] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
