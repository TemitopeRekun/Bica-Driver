import React, { useState } from 'react';

interface StepProps {
  formData: any;
  errors: Record<string, string>;
  updateField: (field: string, value: any) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isDriver: boolean;
}

const Step4Security: React.FC<StepProps> = ({ formData, errors, updateField, onSubmit, isLoading, isDriver }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-2xl font-bold mb-1">Secure Account</h2>
        <p className="text-sm text-slate-500 font-medium">Protect your earnings and data.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Create Password</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.password ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">lock</span>
          <input 
            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold w-full focus:ring-0 p-0"
            placeholder="Min. 6 characters"
            type={showPassword ? "text" : "password"}
            value={formData.password || ''}
            onChange={e => updateField('password', e.target.value)}
          />
          <button onClick={() => setShowPassword(!showPassword)} type="button">
            <span className="material-symbols-outlined text-slate-400">{showPassword ? 'visibility_off' : 'visibility'}</span>
          </button>
        </div>
        {errors.password && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.password}</p>}
      </div>
      
      <div className="p-5 bg-primary/5 rounded-[1.5rem] border border-primary/10 flex gap-4">
        <input 
          type="checkbox" 
          id="terms_consent"
          className="size-5 mt-1 rounded bg-transparent border-primary/40 text-primary"
          checked={formData.backgroundCheckAccepted || false}
          onChange={e => updateField('backgroundCheckAccepted', e.target.checked)}
        />
        <label htmlFor="terms_consent" className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
          {isDriver ? (
            <>I verify that all information provided is accurate and truthful. I agree to <b>BICA's Background Check Policy</b> for professional chauffeurs.</>
          ) : (
            <>I agree to <b>BICA's Terms of Service</b> and verify that I am the legal owner of the vehicle registered.</>
          )}
        </label>
      </div>
      {errors.backgroundCheckAccepted && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.backgroundCheckAccepted}</p>}

      <button 
        onClick={onSubmit}
        disabled={isLoading}
        className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating Account...
          </>
        ) : 'Complete Registration'}
      </button>
    </div>
  );
};

export default Step4Security;
