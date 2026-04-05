
import React, { useState } from 'react';
import { useToast } from '../hooks/useToast';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => void;
  onBack: () => void;
  onGoToSignUp: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onBack, onGoToSignUp }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(formData.email, formData.password);
  };

  const fillAdminCredentials = () => {
    setFormData({
      email: 'admin@bicadrive.app',
      password: 'admin'
    });
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 bg-background-light dark:bg-background-dark">
        <button 
          onClick={onBack}
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
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
              <button 
                type="button"
                className="text-primary text-xs font-bold hover:underline"
                onClick={() => toast.info("Forgot password functionality coming soon.")}
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
                onChange={(e) => setFormData({...formData, password: e.target.value})}
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

          <button 
            type="submit"
            className="w-full bg-primary hover:bg-blue-600 active:bg-blue-700 text-white font-bold text-lg h-14 rounded-xl shadow-lg shadow-primary/25 mt-4 transition-all transform active:scale-[0.98]"
          >
            Log In
          </button>
        </form>
      </main>

      <footer className="p-6 text-center flex flex-col items-center gap-6">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Don't have an account? 
          <span 
            onClick={onGoToSignUp}
            className="text-primary font-bold hover:underline ml-1 cursor-pointer"
          >
            Sign Up
          </span>
        </p>

        <button 
          onClick={fillAdminCredentials}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          [DEV] Autofill Admin
        </button>
      </footer>
    </div>
  );
};

export default LoginScreen;
