
import React, { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { UserProfile, UserRole } from '@/types';
import { IMAGES } from '@/constants';
import { CapacitorService } from '@/services/CapacitorService';

interface ProfileScreenProps {
  user: UserProfile;
  initialRole: UserRole;
  onBack: () => void;
  onLogout: () => void;
  onUpdateAvatar: (newAvatar: string) => Promise<void>;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, initialRole, onBack, onLogout, onUpdateAvatar }) => {
  const { toast } = useToast();
  
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // The role is locked based on the initial selection for both Owners and Drivers.
  const [activeRole, setActiveRole] = useState<UserRole>(initialRole);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  const handleFeatureAlert = (feature: string) => {
    CapacitorService.triggerHaptic();
    toast.info(`Great news! ${feature} is coming very soon to your BICA experience.`);
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

  // Requirement: Once a user selects a role (Owner or Driver), they are locked to that mode.
  // Switcher is only visible if the role is UNSET (which should not happen in normal flow).
  const isRoleSwitcherVisible = initialRole === UserRole.UNSET;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white min-h-screen pb-10">
      <div className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center p-4 justify-between max-w-md mx-auto">
          <button 
            onClick={onBack}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-slate-900 dark:text-white" style={{ fontSize: '24px' }}>arrow_back</span>
          </button>
          <h2 className="text-lg font-bold leading-tight flex-1 text-center">Profile</h2>
          <button 
            onClick={() => handleFeatureAlert("Profile Editing")}
            className="flex w-10 items-center justify-end active:scale-95"
          >
            <span className="text-primary text-base font-bold">Edit</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 pb-8">
        <div className="flex flex-col items-center pt-6 px-4">
          <div className="relative">
            <div 
              className="bg-center bg-no-repeat bg-cover rounded-full h-28 w-28 ring-4 ring-surface-light dark:ring-surface-dark shadow-lg overflow-hidden" 
            >
              <img src={user.avatar} className="w-full h-full object-cover" alt="Profile" />
            </div>
            <button 
              onClick={handleCameraUpdate}
              disabled={isUpdatingAvatar}
              className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-2 shadow-md flex items-center justify-center ring-2 ring-background-light dark:ring-background-dark active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {isUpdatingAvatar ? 'progress_activity' : 'photo_camera'}
              </span>
            </button>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <h1 className="text-2xl font-bold leading-tight">{user.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                {activeRole === UserRole.DRIVER ? 'Professional Driver' : 'Car Owner'}
              </span>
              <span className="text-text-secondary text-sm font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-yellow-500 filled" style={{ fontSize: '16px' }}>star</span>
                {user.rating} ({user.trips})
              </span>
            </div>
          </div>
        </div>

        {isRoleSwitcherVisible && (
          <div className="px-4">
            <div className="bg-slate-200 dark:bg-surface-dark p-1 rounded-xl flex">
              <button 
                onClick={() => { CapacitorService.triggerHaptic(); setActiveRole(UserRole.DRIVER); }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-center transition-all ${
                  activeRole === UserRole.DRIVER ? 'bg-surface-light dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-text-secondary'
                }`}
              >
                Driver Mode
              </button>
              <button 
                onClick={() => { CapacitorService.triggerHaptic(); setActiveRole(UserRole.OWNER); }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-center transition-all ${
                  activeRole === UserRole.OWNER ? 'bg-surface-light dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-text-secondary'
                }`}
              >
                Owner Mode
              </button>
            </div>
          </div>
        )}

        {!isRoleSwitcherVisible && (
          <div className="px-4">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">
                {activeRole === UserRole.DRIVER ? 'verified_user' : 'verified'}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeRole === UserRole.DRIVER ? 'Verified Professional Driver' : 'Verified Car Owner'}
                </p>
                <p className="text-xs text-text-secondary">Premium account status active</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="px-4">
            <h3 className="text-lg font-bold">Personal Information</h3>
          </div>
          <div className="px-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Full Name</label>
              <div className="flex items-center px-4 h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800">
                <input className="w-full bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 p-0 text-base" readOnly value={user.name}/>
                <span className="material-symbols-outlined text-green-500" style={{ fontSize: '20px' }}>check_circle</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Email Address</label>
              <div className="flex items-center px-4 h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800">
                <input className="w-full bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 p-0 text-base" readOnly value={user.email}/>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Phone Number</label>
              <div className="flex items-center px-4 h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800">
                <input className="w-full bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 p-0 text-base" readOnly value={user.phone}/>
                <span className="bg-green-500/10 text-green-500 text-xs font-bold px-2 py-1 rounded">Verified</span>
              </div>
            </div>
          </div>
        </div>

        {activeRole === UserRole.OWNER && (
          <div className="flex flex-col gap-4">
            <div className="px-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Vehicle Details</h3>
              <button onClick={() => handleFeatureAlert("Adding a Vehicle")} className="text-primary text-sm font-semibold active:scale-95">Add New</button>
            </div>
            <div className="px-4">
              <div onClick={() => handleFeatureAlert("Vehicle Management")} className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-4 cursor-pointer active:scale-[0.99] transition-transform">
                <div className="w-20 h-20 shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                  <img className="w-full h-full object-cover" src={IMAGES.CAR_IMAGE} alt="Vehicle" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-base truncate">Toyota Prius</h4>
                      <p className="text-text-secondary text-sm">Dark Grey • Sedan</p>
                    </div>
                    <span className="bg-green-500/10 text-green-500 text-xs font-bold px-2 py-1 rounded-full">Active</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 bg-background-light dark:bg-background-dark rounded-lg px-2 py-1.5 w-fit">
                    <span className="material-symbols-outlined text-text-secondary" style={{ fontSize: '16px' }}>directions_car</span>
                    <span className="text-sm font-mono font-medium">ABC 1234</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeRole === UserRole.DRIVER && (
          <div className="flex flex-col gap-4">
            <div className="px-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Driver Credentials</h3>
            </div>
            <div className="px-4 flex flex-col gap-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary">badge</span>
                  <span className="text-sm font-medium">Driving License</span>
                </div>
                <span className="text-green-500 text-xs font-bold uppercase">Verified</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary">description</span>
                  <span className="text-sm font-medium">Background Check</span>
                </div>
                <span className="text-green-500 text-xs font-bold uppercase">Passed</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 pt-4 flex flex-col gap-3">
          <button onClick={() => handleFeatureAlert("System Settings")} className="flex items-center justify-between w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors">settings</span>
              <span className="font-medium">Settings</span>
            </div>
            <span className="material-symbols-outlined text-text-secondary" style={{ fontSize: '20px' }}>chevron_right</span>
          </button>

          <div className="mt-4 px-2">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 px-2">Legal</h3>
            <div className="flex flex-col gap-1">
              <a 
                href="https://sammy001-ship.github.io/Bica-Driver-Web/terms.html" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors">gavel</span>
                  <span className="font-medium text-sm">Terms and Conditions</span>
                </div>
                <span className="material-symbols-outlined text-text-secondary" style={{ fontSize: '18px' }}>open_in_new</span>
              </a>
              <a 
                href="https://sammy001-ship.github.io/Bica-Driver-Web/privacy.html" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors">shield</span>
                  <span className="font-medium text-sm">Privacy Policy</span>
                </div>
                <span className="material-symbols-outlined text-text-secondary" style={{ fontSize: '18px' }}>open_in_new</span>
              </a>
            </div>
          </div>

          <div className="mt-4 px-2">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 px-2">Support & Feedback</h3>
            <div className="flex flex-col gap-1">
              <a 
                href="mailto:support@bicadriver.com"
                className="flex items-center justify-between w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors">mail</span>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-left">Email Support</span>
                    <span className="text-[10px] text-text-secondary text-left">support@bicadriver.com</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-text-secondary" style={{ fontSize: '18px' }}>chevron_right</span>
              </a>
              <a 
                href="tel:+2349038987333"
                className="flex items-center justify-between w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors">call</span>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-left">Call Center</span>
                    <span className="text-[10px] text-text-secondary text-left">+234 903 898 7333</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-text-secondary" style={{ fontSize: '18px' }}>chevron_right</span>
              </a>
            </div>
          </div>
          <button onClick={onLogout} className="mt-4 w-full py-4 rounded-xl bg-red-500/10 text-red-500 font-bold text-base hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
