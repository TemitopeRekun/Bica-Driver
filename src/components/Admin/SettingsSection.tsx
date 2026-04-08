import React from 'react';
import { SystemSettings } from '@/types';

interface SettingsSectionProps {
  localSettings: SystemSettings;
  setLocalSettings: (settings: SystemSettings) => void;
  handleSaveSettings: () => void;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  localSettings,
  setLocalSettings,
  handleSaveSettings
}) => {
  return (
    <div className="space-y-8 animate-slide-up pb-20">
       {/* Pricing Engine */}
       <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-primary">payments</span>
            <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Pricing Engine</h3>
          </div>
          
          <div className="bg-white dark:bg-surface-dark p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Base Fare (₦)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₦</span>
                    <input 
                      type="number" 
                      value={localSettings.baseFare}
                      onChange={(e) => setLocalSettings({...localSettings, baseFare: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/30 rounded-2xl pl-10 pr-4 py-4 font-black text-lg text-slate-900 dark:text-white transition-all outline-none"
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Distance Rate (₦ / km)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₦</span>
                    <input 
                      type="number" 
                      value={localSettings.pricePerKm}
                      onChange={(e) => setLocalSettings({...localSettings, pricePerKm: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/30 rounded-2xl pl-10 pr-4 py-4 font-black text-lg text-slate-900 dark:text-white transition-all outline-none"
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Platform Commission (%)</label>
                 <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                    <input 
                      type="number" 
                      value={localSettings.commission}
                      onChange={(e) => setLocalSettings({...localSettings, commission: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/30 rounded-2xl px-4 py-4 font-black text-lg text-slate-900 dark:text-white transition-all outline-none"
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Time Rate (₦ / min)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₦</span>
                    <input 
                      type="number" 
                      value={localSettings.timeRate}
                      onChange={(e) => setLocalSettings({...localSettings, timeRate: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/30 rounded-2xl pl-10 pr-4 py-4 font-black text-lg text-slate-900 dark:text-white transition-all outline-none"
                    />
                 </div>
              </div>
            </div>
          </div>
       </section>

       {/* Safety & Automation */}
       <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-primary">security</span>
            <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Safety & Automation</h3>
          </div>

          <div className={`p-6 rounded-[2.5rem] border-2 transition-all flex items-center justify-between shadow-sm ${
            localSettings.autoApprove 
              ? 'bg-red-500/[0.02] border-red-500/20' 
              : 'bg-white dark:bg-surface-dark border-slate-100 dark:border-slate-800'
          }`}>
             <div className="flex gap-4 items-center">
                <div className={`size-12 rounded-2xl flex items-center justify-center ${localSettings.autoApprove ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                   <span className="material-symbols-outlined">{localSettings.autoApprove ? 'warning' : 'verified_user'}</span>
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">Auto-Approve Drivers</h4>
                  <p className="text-xs text-slate-500 font-medium">Instantly approve new registrations</p>
                </div>
             </div>
             <button 
               onClick={() => setLocalSettings({...localSettings, autoApprove: !localSettings.autoApprove})}
               className={`w-14 h-8 rounded-full transition-all relative p-1 ${localSettings.autoApprove ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'}`}
             >
               <div className={`size-6 bg-white rounded-full transition-all shadow-sm ${localSettings.autoApprove ? 'ml-6' : 'ml-0'}`}></div>
             </button>
          </div>
          
          {localSettings.autoApprove && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex gap-3 items-start animate-pulse">
               <span className="material-symbols-outlined text-red-500 text-sm">error</span>
               <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest leading-relaxed">
                 Critical: Auto-approval bypasses identity verification. This increases platform liability.
               </p>
            </div>
          )}
       </section>

       <div className="pt-4">
          <button 
            onClick={handleSaveSettings}
            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
             <span className="material-symbols-outlined">save</span>
             COMMIT SYSTEM CHANGES
          </button>
       </div>
    </div>
  );
};

export default SettingsSection;
