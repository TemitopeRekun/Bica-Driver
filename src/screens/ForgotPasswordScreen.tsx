import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api.service';
import { useUIStore } from '@/stores/uiStore';

const ForgotPasswordScreen: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email }, false);
      addToast('If an account exists, a reset code has been sent.', 'info');
      // Redirect to reset screen
      navigate('/reset-password', { state: { email } });
    } catch (error) {
      // Handled
    } finally {
      setIsLoading(false);
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
        <h1 className="text-lg font-bold">Reset Password</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-10 pb-8 w-full">
        <div className="flex flex-col mb-10">
          <h2 className="text-[28px] font-bold leading-tight mb-2">Forgot Password?</h2>
          <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
            Enter your registered email address to receive a 6-digit reset code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
            <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary transition-all">
              <span className="material-symbols-outlined text-slate-400 mr-3">mail</span>
              <input 
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0" 
                placeholder="email@example.com" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading || !email}
            className="w-full bg-primary text-white font-bold text-lg h-14 rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'Sending Code...' : 'Send Reset Code'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default ForgotPasswordScreen;
