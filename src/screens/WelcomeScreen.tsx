import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '@/constants';
import { CapacitorService } from '@/services/CapacitorService';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateAccount = () => {
    CapacitorService.triggerHaptic();
    navigate('/role-selection');
  };

  const handleLogin = () => {
    CapacitorService.triggerHaptic();
    navigate('/login');
  };

  return (
    <div className="relative h-screen w-full flex flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] rounded-full bg-primary/20 blur-[120px] pointer-events-none animate-fade-in"></div>
      
      {/* Top Header / Logo */}
      <div className="flex items-center justify-center pt-8 pb-4 z-10 animate-slide-up">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-white shadow-lg shadow-primary/30">
            <span style={{ fontFamily: "'TAN MIGNON', 'Playfair Display', Georgia, serif", fontSize: '1.25rem', lineHeight: 1, paddingBottom: '2px' }} className="font-normal">B</span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight italic">BICA<span className="text-primary NOT-italic">DRIVE</span></span>
        </div>
      </div>

      {/* Main Content Area - Responsive flex column */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6 overflow-hidden">
        {/* HERO SECTION - Constrained aspect ratio */}
        <div className="w-full relative aspect-[1.4] max-h-[35vh] mb-8 animate-scale-in">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background-light dark:to-background-dark z-10"></div>
          <div 
            className="w-full h-full bg-center bg-cover rounded-[2.5rem] shadow-2xl ring-1 ring-white/10 overflow-hidden"
          >
            <div 
               className="w-full h-full bg-cover bg-center animate-soft-pulse"
               style={{ backgroundImage: `url('${IMAGES.WELCOME_HERO}')` }}
            />
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-white/10 dark:bg-[#044422]/90 backdrop-blur-xl px-5 py-4 rounded-3xl shadow-2xl border border-white/20 w-[90%] animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-accent/20 text-accent">
              <span className="material-symbols-outlined filled">verified_user</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-1">System Status</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Chauffeurs Online</span>
            </div>
          </div>
        </div>

        {/* TEXT SECTION */}
        <div className="flex flex-col items-center text-center mt-4 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <h1 className="text-[30px] sm:text-[34px] font-black text-gray-900 dark:text-white leading-[1.1] mb-4 tracking-tight italic">
            Your Premium Car, <br/>
            <span className="text-accent">Our Verified Driver.</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 max-w-[280px] leading-relaxed font-medium">
            The elite connection for luxury car owners and professional chauffeurs in Nigeria.
          </p>
        </div>
      </div>

      {/* ACTION SECTION - Fixed bottom */}
      <div className="w-full p-6 pb-10 flex flex-col gap-4 z-20 animate-slide-up stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
        <button 
          onClick={handleCreateAccount}
          className="flex w-full items-center justify-center rounded-[1.25rem] h-16 px-5 bg-primary hover:bg-[#056d32] transition-all text-white text-[17px] font-black shadow-xl shadow-primary/30 active:scale-[0.97]"
        >
          Get Started
        </button>
        <button 
          onClick={handleLogin}
          className="flex w-full items-center justify-center rounded-[1.25rem] h-16 px-5 bg-white/5 border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-gray-900 dark:text-white text-[17px] font-bold active:scale-[0.97]"
        >
          Sign In
        </button>
        <div className="flex items-center justify-center gap-4 mt-1">
          <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium tracking-tight">
            Safety first. Read our <span className="text-accent font-bold cursor-pointer hover:underline">Guidelines</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
