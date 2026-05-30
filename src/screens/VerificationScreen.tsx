import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/services/api.service';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { mapUser } from '@/mappers/appMappers';
import { UserRole } from '@/types';

const VerificationScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const { login } = useAuthStore();
  
  const email = location.state?.email;
  const role = location.state?.role;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // Inline error — shown below OTP boxes, not as a toast
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false); // drives the red border state

  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const ref4 = useRef<HTMLInputElement>(null);
  const ref5 = useRef<HTMLInputElement>(null);
  const inputRefs = [ref0, ref1, ref2, ref3, ref4, ref5];

  const startResendTimer = () => {
    setResendTimer(60);
    setCanResend(false);
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return timer;
  };

  useEffect(() => {
    if (!email) {
      navigate('/login');
      return;
    }
    const timer = startResendTimer();
    return () => clearInterval(timer);
  }, [email, navigate]);

  const clearError = () => {
    setInlineError(null);
    setHasError(false);
  };

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    clearError();
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setInlineError('Please enter the full 6-digit code.');
      setHasError(true);
      return;
    }

    setIsLoading(true);
    clearError();
    try {
      const response = await api.post<any>('/auth/verify-email', { email, otp: code }, false);
      
      if (response.token) {
        const mapped = mapUser(response.user);
        await login(mapped, response.token, response.refreshToken);
        addToast('Email verified successfully!', 'success');
        navigate(mapped.role === UserRole.DRIVER ? '/driver' : '/owner');
      } else {
        addToast('Verification successful! Please log in.', 'success');
        navigate('/login');
      }
    } catch (error: any) {
      const message = error?.message || 'Invalid verification code. Please try again.';
      setInlineError(message);
      setHasError(true);
      // Clear the boxes so user can try again cleanly
      setOtp(['', '', '', '', '', '']);
      ref0.current?.focus();

      // If locked out (too many attempts), immediately allow resend
      if (message.toLowerCase().includes('too many') || message.toLowerCase().includes('request a new')) {
        setCanResend(true);
        setResendTimer(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setIsResending(true);
    clearError();
    try {
      await api.post('/auth/resend-otp', { email }, false);
      addToast('A new code has been sent to your email.', 'success');
      setOtp(['', '', '', '', '', '']);
      ref0.current?.focus();
      startResendTimer();
    } catch (error: any) {
      addToast(error?.message || 'Could not resend code. Please try again.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 bg-background-light dark:bg-background-dark">
        <button 
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight tracking-tight">Verify Email</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-10 pb-8 w-full overflow-y-auto no-scrollbar">
        <div className="flex flex-col mb-10">
          <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
            <span className="material-symbols-outlined text-4xl filled">mark_email_unread</span>
          </div>
          <h2 className="text-[28px] font-bold leading-tight mb-3">Check your inbox</h2>
          <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
            We've sent a 6-digit code to <span className="font-bold text-slate-900 dark:text-white">{email}</span>.
          </p>
        </div>

        {/* OTP Boxes */}
        <div className="flex justify-between gap-2 mb-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`w-full h-16 text-center text-2xl font-black bg-white dark:bg-surface-dark border-2 rounded-2xl transition-all text-slate-900 dark:text-white
                ${hasError 
                  ? 'border-red-400 bg-red-500/5 dark:bg-red-500/10' 
                  : 'border-slate-100 dark:border-white/5 focus:border-primary focus:ring-4 focus:ring-primary/10'
                }`}
            />
          ))}
        </div>

        {/* Inline Error */}
        {inlineError && (
          <div className="flex items-start gap-2 mb-6 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
            <span className="material-symbols-outlined text-red-500 text-sm mt-0.5 shrink-0">error</span>
            <p className="text-red-600 dark:text-red-400 text-sm font-semibold leading-relaxed">{inlineError}</p>
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={isLoading || otp.join('').length < 6}
          className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale mb-8"
        >
          {isLoading ? 'Verifying...' : 'Verify & Continue'}
        </button>

        {/* Resend Section */}
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-3">
            Didn't receive the code?
          </p>
          {canResend ? (
            <button 
              onClick={handleResend}
              disabled={isResending}
              className="text-primary font-black hover:underline underline-offset-4 disabled:opacity-50"
            >
              {isResending ? 'Sending...' : 'Resend New Code'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-slate-400 font-bold">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span>Resend available in {resendTimer}s</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default VerificationScreen;
