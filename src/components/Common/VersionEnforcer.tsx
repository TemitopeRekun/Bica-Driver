import React from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { APP_VERSION } from '@/services/Config';

const VersionEnforcer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, isLoading } = useSettingsStore();

  if (isLoading || !settings.minAppVersion) {
    return <>{children}</>;
  }

  const parseVersion = (v: string) => v.split('.').map(Number);
  const compareVersions = (v1: string, v2: string) => {
    const p1 = parseVersion(v1);
    const p2 = parseVersion(v2);
    for (let i = 0; i < 3; i++) {
      if ((p1[i] || 0) > (p2[i] || 0)) return 1;
      if ((p1[i] || 0) < (p2[i] || 0)) return -1;
    }
    return 0;
  };

  const isBelowMin = compareVersions(APP_VERSION, settings.minAppVersion) < 0;
  const isBelowLatest = settings.latestAppVersion && compareVersions(APP_VERSION, settings.latestAppVersion) < 0;

  if (isBelowMin) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/20 to-transparent" />
        
        <div className="size-24 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center justify-center mb-8 relative">
           <span className="material-symbols-outlined text-4xl text-white">system_update_alt</span>
           <div className="absolute -top-1 -right-1 size-5 bg-primary rounded-full animate-ping" />
        </div>

        <h2 className="text-3xl font-black text-white tracking-tighter mb-4">Update Required</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-12">
          Your current version ({APP_VERSION}) is no longer supported. To enjoy the latest features and security updates, please upgrade to the latest version.
        </p>

        <button 
          onClick={() => window.location.href = 'https://bica.ng/update'}
          className="w-full max-w-xs h-16 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
        >
          Update Now
        </button>

        <p className="absolute bottom-10 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Essential Security Patch</p>
      </div>
    );
  }

  return (
    <>
      {isBelowLatest && (
        <div className="fixed top-2 left-2 right-2 z-[9999] p-3 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-between shadow-2xl animate-slide-up">
           <div className="flex items-center gap-3">
             <div className="size-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
               <span className="material-symbols-outlined text-sm">rocket_launch</span>
             </div>
             <div>
               <p className="text-[10px] font-black text-white uppercase tracking-tighter">New Version Available</p>
               <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">V{settings.latestAppVersion} is ready for you</p>
             </div>
           </div>
           <button 
             onClick={() => window.location.href = 'https://bica.ng/update'}
             className="px-4 py-2 bg-white text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-tighter active:scale-95 transition-all"
           >
             Update
           </button>
        </div>
      )}
      {children}
    </>
  );
};

export default VersionEnforcer;
