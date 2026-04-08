import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '@/constants';
import { CapacitorService } from '@/services/CapacitorService';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    CapacitorService.triggerHaptic();
    navigate('/role-selection');
  };

  const handleLogin = () => {
    CapacitorService.triggerHaptic();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background-light dark:bg-background-dark overflow-hidden">
      <div className="relative h-[55%] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-background-light dark:to-background-dark z-10" />
        <img 
          src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop" 
          alt="Bica Ride" 
          className="h-full w-full object-cover scale-110 animate-fade-in"
        />
        
        <div className="absolute top-12 left-0 right-0 z-20 flex justify-center">
          <div className="bg-white/90 dark:bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-primary/20 flex items-center gap-2 shadow-xl animate-bounce">
            <span className="material-symbols-outlined text-primary text-sm filled">check_circle</span>
            <span className="text-[10px] font-bold tracking-wider text-slate-900 dark:text-white uppercase italic">Safety Verified in Nigeria</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-8 pb-12 pt-4 relative z-20">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex items-center gap-3 animate-scale-in">
             <div className="size-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
                <span className="text-white text-3xl font-black italic">B</span>
             </div>
             <div>
                <h1 className="text-3xl font-black tracking-tight leading-none text-slate-900 dark:text-white italic">BICA<span className="text-primary NOT-italic ml-1">DRIVE</span></h1>
                <p className="text-[10px] font-bold tracking-[.3em] uppercase text-primary text-left opacity-80">Premium Mobility</p>
             </div>
          </div>
          
          <h2 className="text-[32px] font-extrabold leading-[1.1] mb-4 text-slate-900 dark:text-white animate-slide-up stagger-1">
            The Smartest Way <br />
            <span className="text-primary italic">To Move.</span>
          </h2>
          
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs animate-slide-up stagger-2">
            Professional drivers, seamless payments, and 100% safety. Experience the next level of transport.
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-4 animate-slide-up stagger-3">
          <button 
            onClick={handleStart}
            className="w-full bg-primary hover:bg-opacity-90 active:bg-opacity-100 text-white font-bold text-lg h-16 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-[0.98]"
          >
            Get Started
          </button>
          
          <button 
            onClick={handleLogin}
            className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-900 dark:text-white font-bold text-lg h-16 rounded-2xl transition-all transform active:scale-[0.98]"
          >
            Login to Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
