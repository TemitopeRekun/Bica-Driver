import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { api } from '../services/api.service';
import { mapUser } from '../mappers/appMappers';
import { AuthResponse, UserRole } from '../types';

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { addToast } = useUIStore();
  
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Inline error shown below the form fields — more appropriate than toasts for login failures
  const [inlineError, setInlineError] = useState<string | null>(null);

  const clearError = () => setInlineError(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setInlineError('Please enter both your email and password.');
      return;
    }

    setIsLoading(true);
    clearError();
    try {
      const response = await api.post<AuthResponse>(
        '/auth/login',
        { email: formData.email, password: formData.password },
        false,
      );

      if (!response.token) {
        setInlineError(response.message || 'Login failed. Please contact support.');
        return;
      }

      const mapped = mapUser(response.user);
      
      // Defense-in-depth: if backend somehow returns a token for an unapproved driver
      if (mapped.role === UserRole.DRIVER && mapped.approvalStatus !== 'APPROVED') {
        setInlineError('Your driver account is not yet approved. Please wait for admin review.');
        return;
      }

      await login(mapped, response.token, response.refreshToken);
      addToast(`Welcome back, ${mapped.name}!`, 'success');

      if (mapped.role === UserRole.ADMIN) navigate('/admin');
      else if (mapped.role === UserRole.DRIVER) navigate('/driver');
      else navigate('/owner');

    } catch (error: any) {
      const status = error?.status;
      const message = error?.message || '';

      if (status === 401) {
        // Wrong email or wrong password — stay intentionally vague for security
        setInlineError('Incorrect email or password. Please try again.');
      } else if (status === 403 && message.toLowerCase().includes('email not verified')) {
        // Edge case: registered but never verified (e.g. closed app after sign-up)
        setInlineError('Your email address hasn\'t been verified yet.');
        // Navigate them to complete verification
        setTimeout(() => navigate('/verify-email', { state: { email: formData.email } }), 1500);
      } else if (status === 403) {
        // Driver pending/rejected
        setInlineError(message || 'Access denied. Please contact support.');
      } else {
        setInlineError("We're having trouble connecting. Please check your internet and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 bg-background-light dark:bg-background-dark">
        <button 
          onClick={() => navigate('/')}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight tracking-tight text-center">Log In</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-10 pb-8 w-full overflow-y-auto no-scrollbar">
        <div className="flex flex-col mb-10">
          <h2 className="text-[28px] font-bold leading-tight mb-2">Welcome Back</h2>
          <p className="text-slate-500 dark:text-slate-400 text-base">
            Log in to your account to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
            <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <span className="material-symbols-outlined text-slate-400 mr-3">mail</span>
              <input 
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0" 
                placeholder="email@example.com" 
                type="email" 
                value={formData.email}
                onChange={(e) => { setFormData({...formData, email: e.target.value}); clearError(); }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
              <button 
                type="button"
                className="text-primary text-xs font-bold hover:underline"
                onClick={() => navigate('/forgot-password')}
              >
                Forgot Password?
              </button>
            </div>
            <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <span className="material-symbols-outlined text-slate-400 mr-3">lock</span>
              <input 
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0" 
                placeholder="Enter your password" 
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => { setFormData({...formData, password: e.target.value}); clearError(); }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center justify-center p-1 hover:text-primary transition-colors focus:outline-none"
              >
                <span className="material-symbols-outlined text-slate-400">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Inline error banner */}
          {inlineError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
              <span className="material-symbols-outlined text-red-500 text-sm mt-0.5 shrink-0">error</span>
              <p className="text-red-600 dark:text-red-400 text-sm font-semibold leading-relaxed">{inlineError}</p>
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-opacity-90 active:bg-opacity-100 text-white font-bold text-lg h-14 rounded-xl shadow-lg shadow-primary/25 mt-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </main>

      <footer className="p-6 text-center flex flex-col items-center gap-6">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Don't have an account? 
          <span 
            onClick={() => navigate('/role-selection')}
            className="text-primary font-bold hover:underline ml-1 cursor-pointer"
          >
            Sign Up
          </span>
        </p>
      </footer>
    </div>
  );
};

export default LoginScreen;
