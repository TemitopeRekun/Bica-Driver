
import React from 'react';
import { IMAGES } from '../constants';

interface WelcomeScreenProps {
  onCreateAccount: () => void;
  onLogin: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onCreateAccount, onLogin }) => {
  return (
    <div className="relative h-screen flex flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] rounded-full bg-primary/20 blur-[120px] pointer-events-none animate-fade-in"></div>
      
      <div className="h-12 w-full"></div>
      
      <div className="flex items-center justify-center px-6 py-2 z-10 animate-slide-up">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-white shadow-lg shadow-primary/30">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4V20M7 4H12C15.3137 4 18 6.68629 18 10C18 11.6569 17.3284 13.1569 16.2426 14.2426C15.1569 15.3284 13.6569 16 12 16H7M7 20H12C15.3137 20 18 17.3137 18 14C18 12.3431 17.3284 10.8431 16.2426 9.75736" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Bicadriver</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto no-scrollbar pb-10">
        <div className="w-full relative aspect-[4/3] mb-10 mt-4 animate-scale-in">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background-light dark:to-background-dark z-10"></div>
          <div 
            className="w-full h-full bg-center bg-cover rounded-[2.5rem] shadow-2xl ring-1 ring-white/10 overflow-hidden"
          >
            <div 
               className="w-full h-full bg-cover bg-center animate-soft-pulse"
               style={{ backgroundImage: `url('${IMAGES.WELCOME_HERO}')` }}
            />
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-white/10 dark:bg-[#044422]/90 backdrop-blur-xl px-5 py-4 rounded-3xl shadow-2xl border border-white/20 w-[90%] animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-accent/20 text-accent">
              <span className="material-symbols-outlined filled">verified_user</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-1">System Status</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Chauffeurs Online</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center text-center mt-6 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <h1 className="text-[34px] font-black text-gray-900 dark:text-white leading-[1.1] mb-5 tracking-tight">
            Your Premium Car, <br/>
            <span className="text-accent">Our Verified Driver.</span>
          </h1>
          <p className="text-base text-gray-600 dark:text-slate-400 max-w-[300px] leading-relaxed font-medium">
            The elite connection for luxury car owners and professional chauffeurs in Nigeria.
          </p>
        </div>
      </div>

      <div className="w-full p-6 pb-12 flex flex-col gap-4 z-20 animate-slide-up stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
        <button 
          onClick={onCreateAccount}
          className="flex w-full items-center justify-center rounded-[1.25rem] h-16 px-5 bg-primary hover:bg-[#056d32] transition-all text-white text-[17px] font-black shadow-xl shadow-primary/30 active:scale-[0.97]"
        >
          Get Started
        </button>
        <button 
          onClick={onLogin}
          className="flex w-full items-center justify-center rounded-[1.25rem] h-16 px-5 bg-white/5 border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-gray-900 dark:text-white text-[17px] font-bold active:scale-[0.97]"
        >
          Sign In
        </button>
        <div className="flex items-center justify-center gap-4 mt-2">
          <p className="text-[11px] text-gray-500 dark:text-slate-500 font-medium tracking-tight">
            Safety first. Read our <span className="text-accent font-bold cursor-pointer hover:underline">Guidelines</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
