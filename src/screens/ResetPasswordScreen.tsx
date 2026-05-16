import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/services/api.service';
import { useUIStore } from '@/stores/uiStore';

const ResetPasswordScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  
  const email = location.state?.email;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [hasOtpError, setHasOtpError] = useState(false);
  // When the OTP is locked, user must go back and request a new one via forgot-password
  const [isLocked, setIsLocked] = useState(false);

  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const ref4 = useRef<HTMLInputElement>(null);
  const ref5 = useRef<HTMLInputElement>(null);
  const inputRefs = [ref0, ref1, ref2, ref3, ref4, ref5];

  const clearError = () => {
    setInlineError(null);
    setHasOtpError(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    clearError();
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs[index + 1].current?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    clearError();

    if (code.length < 6) {
      setInlineError('Please enter the 6-digit reset code.');
      setHasOtpError(true);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setInlineError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setInlineError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        otp: code,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      }, false);
      
      addToast('Password updated successfully! Please log in.', 'success');
      navigate('/login');
    } catch (error: any) {
      const message = error?.message || 'Invalid or expired reset code.';
      setInlineError(message);
      setHasOtpError(true);
      setOtp(['', '', '', '', '', '']);
      ref0.current?.focus();

      // If locked (too many attempts), disable the OTP boxes and show CTA to get new code
      if (message.toLowerCase().includes('too many') || message.toLowerCase().includes('request a new')) {
        setIsLocked(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    navigate('/login');
    return null;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 bg-background-light dark:bg-background-dark">
        <button 
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight">New Password</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-10 pb-8 w-full overflow-y-auto no-scrollbar">
        <div className="flex flex-col mb-8">
          <h2 className="text-2xl font-bold mb-2">Create New Password</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter the 6-digit code sent to your email and your new secure password.
          </p>
        </div>

        <form onSubmit={handleReset} className="flex flex-col gap-5">
          {/* OTP Section */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Verification Code</label>
            <div className="flex justify-between gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={isLocked}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={`w-full h-12 text-center text-xl font-black bg-white dark:bg-surface-dark border rounded-xl transition-all text-slate-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed
                    ${hasOtpError
                      ? 'border-red-400 bg-red-500/5 dark:bg-red-500/10'
                      : 'border-slate-100 dark:border-white/5 focus:border-primary'
                    }`}
                />
              ))}
            </div>
          </div>

          {/* Inline Error */}
          {inlineError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
              <span className="material-symbols-outlined text-red-500 text-sm mt-0.5 shrink-0">error</span>
              <div className="flex-1">
                <p className="text-red-600 dark:text-red-400 text-sm font-semibold leading-relaxed">{inlineError}</p>
                {isLocked && (
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-primary text-sm font-black underline underline-offset-4 mt-1"
                  >
                    Request a new reset code →
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">New Password</label>
            <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-100 dark:border-white/5 focus-within:border-primary transition-all">
              <span className="material-symbols-outlined text-slate-400 mr-3">lock</span>
              <input 
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold w-full focus:ring-0 p-0" 
                placeholder="New password" 
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => { setFormData({...formData, password: e.target.value}); clearError(); }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                <span className="material-symbols-outlined text-slate-400">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Confirm New Password</label>
            <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${
              formData.confirmPassword && formData.password !== formData.confirmPassword
                ? 'border-red-400 bg-red-500/5 dark:bg-red-500/10'
                : 'border-slate-100 dark:border-white/5 focus-within:border-primary'
            }`}>
              <span className="material-symbols-outlined text-slate-400 mr-3">lock_reset</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold w-full focus:ring-0 p-0"
                placeholder="Repeat new password"
                type={showPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => { setFormData({...formData, confirmPassword: e.target.value}); clearError(); }}
              />
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-[11px] text-red-500 font-bold ml-1 animate-fade-in">Passwords do not match.</p>
            )}
          </div>

          <button 
            type="submit"
            disabled={isLoading || otp.join('').length < 6 || !formData.password || formData.password !== formData.confirmPassword || isLocked}
            className="w-full bg-primary text-white font-black text-lg h-14 rounded-2xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98] mt-2 disabled:opacity-50"
          >
            {isLoading ? 'Updating Password...' : 'Reset Password'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default ResetPasswordScreen;
