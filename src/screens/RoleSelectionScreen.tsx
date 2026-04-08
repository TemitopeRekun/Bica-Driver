import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@/types';
import { CapacitorService } from '@/services/CapacitorService';

const RoleSelectionScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleSelect = (role: UserRole) => {
    CapacitorService.triggerHaptic();
    // We could use search params or state, but for this app's simple flow, 
    // let's just go to register and handle role selection there if needed, 
    // or pass state via navigate
    navigate('/register', { state: { role } });
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 bg-background-light dark:bg-background-dark">
        <button 
          onClick={() => navigate('/')}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight tracking-tight text-center">Choose Your Role</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 flex flex-col px-8 pt-6 pb-12 w-full">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold mb-3">How do you want to use Bica?</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Select an option below to continue your journey.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <button 
            onClick={() => handleSelect(UserRole.OWNER)}
            className="group relative flex flex-col items-start p-6 bg-white dark:bg-white/5 border-2 border-slate-100 dark:border-white/5 hover:border-primary rounded-3xl transition-all h-44 shadow-sm hover:shadow-xl active:scale-[0.98]"
          >
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
              <span className="material-symbols-outlined text-primary group-hover:text-white filled">person</span>
            </div>
            <h3 className="text-xl font-bold mb-1">I am a Passenger</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-left">
              Book rides, manage trips, and enjoy safe premium mobility.
            </p>
            <span className="material-symbols-outlined absolute top-6 right-6 text-slate-300 group-hover:text-primary transition-colors">arrow_forward</span>
          </button>

          <button 
            onClick={() => handleSelect(UserRole.DRIVER)}
            className="group relative flex flex-col items-start p-6 bg-white dark:bg-white/5 border-2 border-slate-100 dark:border-white/5 hover:border-accent rounded-3xl transition-all h-44 shadow-sm hover:shadow-xl active:scale-[0.98]"
          >
            <div className="size-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent transition-colors">
              <span className="material-symbols-outlined text-accent group-hover:text-white filled">local_taxi</span>
            </div>
            <h3 className="text-xl font-bold mb-1">I am a Driver</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-left">
              Apply to join our fleet, accept ride requests, and earn money.
            </p>
            <span className="material-symbols-outlined absolute top-6 right-6 text-slate-300 group-hover:text-accent transition-colors">arrow_forward</span>
          </button>
        </div>

        <footer className="mt-auto pt-8 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Already have an account? 
            <span 
              onClick={() => navigate('/login')}
              className="text-primary font-bold hover:underline ml-1 cursor-pointer"
            >
              Log In
            </span>
          </p>
        </footer>
      </main>
    </div>
  );
};

export default RoleSelectionScreen;
