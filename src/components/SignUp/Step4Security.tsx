import React, { useState } from 'react';

const TERMS_URL = 'https://sammy001-ship.github.io/Bica-Driver-Web/terms.html';
const PRIVACY_URL = 'https://sammy001-ship.github.io/Bica-Driver-Web/privacy.html';

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

  const termsAccepted = !!formData.backgroundCheckAccepted;

  const handleLinkOpen = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-2xl font-bold mb-1">Secure Account</h2>
        <p className="text-sm text-slate-500 font-medium">Protect your earnings and data.</p>
      </div>

      {/* Password field */}
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

      {/* Confirm Password field */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Confirm Password</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${
          (errors.confirmPassword || (formData.confirmPassword && formData.password !== formData.confirmPassword))
            ? 'border-red-500 bg-red-500/5'
            : 'border-slate-100 dark:border-white/5'
        }`}>
          <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">lock_reset</span>
          <input
            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold w-full focus:ring-0 p-0"
            placeholder="Repeat password"
            type={showPassword ? "text" : "password"}
            value={formData.confirmPassword || ''}
            onChange={e => updateField('confirmPassword', e.target.value)}
          />
        </div>
        {errors.confirmPassword
          ? <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.confirmPassword}</p>
          : formData.confirmPassword && formData.password !== formData.confirmPassword
          ? <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">Passwords do not match.</p>
          : null
        }
      </div>

      {/* Terms & Conditions Consent */}
      <div
        onClick={() => updateField('backgroundCheckAccepted', !termsAccepted)}
        className={`cursor-pointer p-5 rounded-[1.5rem] border-2 transition-all flex gap-4 items-start ${
          termsAccepted
            ? 'bg-primary/5 border-primary/30'
            : errors.backgroundCheckAccepted
            ? 'bg-red-500/5 border-red-400'
            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'
        }`}
      >
        {/* Custom checkbox */}
        <div className={`mt-0.5 size-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
          termsAccepted
            ? 'bg-primary border-primary'
            : 'border-slate-300 dark:border-white/20 bg-white dark:bg-transparent'
        }`}>
          {termsAccepted && (
            <span className="material-symbols-outlined text-white text-sm" style={{ fontSize: '14px' }}>check</span>
          )}
        </div>

        {/* Consent text — stop propagation on links so click doesn't toggle checkbox */}
        <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium" onClick={e => e.stopPropagation()}>
          {isDriver ? (
            <>
              I have read and agree to BICA's{' '}
              <button
                type="button"
                onClick={() => handleLinkOpen(TERMS_URL)}
                className="font-black text-primary underline underline-offset-2"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => handleLinkOpen(PRIVACY_URL)}
                className="font-black text-primary underline underline-offset-2"
              >
                Privacy Policy
              </button>
              . I verify that all information provided is accurate and truthful, and I consent to BICA's <span className="font-black text-slate-700 dark:text-slate-200">Background Check Policy</span> for professional chauffeurs.
            </>
          ) : (
            <>
              I have read and agree to BICA's{' '}
              <button
                type="button"
                onClick={() => handleLinkOpen(TERMS_URL)}
                className="font-black text-primary underline underline-offset-2"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => handleLinkOpen(PRIVACY_URL)}
                className="font-black text-primary underline underline-offset-2"
              >
                Privacy Policy
              </button>
              . I verify that I am the legal owner of the vehicle registered on this account.
            </>
          )}
        </div>
      </div>
      {errors.backgroundCheckAccepted && (
        <p className="text-[10px] text-red-500 font-bold ml-1 -mt-3 animate-fade-in">
          You must read and agree to the Terms & Conditions to continue.
        </p>
      )}

      <button
        onClick={onSubmit}
        disabled={isLoading || !termsAccepted || (!!formData.confirmPassword && formData.password !== formData.confirmPassword)}
        className={`w-full py-5 rounded-2xl text-white font-black text-lg shadow-xl active:scale-[0.98] transition-all mt-4 flex items-center justify-center gap-2 ${
          termsAccepted && !isLoading
            ? 'bg-primary shadow-primary/20 cursor-pointer'
            : 'bg-slate-300 dark:bg-slate-700 shadow-none cursor-not-allowed opacity-60'
        }`}
      >
        {isLoading ? (
          <>
            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating Account...
          </>
        ) : !termsAccepted ? (
          <>
            <span className="material-symbols-outlined text-lg">lock</span>
            Agree to Terms to Continue
          </>
        ) : (
          'Complete Registration'
        )}
      </button>
    </div>
  );
};

export default Step4Security;
