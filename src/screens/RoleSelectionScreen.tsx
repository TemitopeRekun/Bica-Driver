import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@/types';
import { CapacitorService } from '@/services/CapacitorService';
import { IMAGES } from '@/constants';

const RoleSelectionScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleSelectRole = (role: UserRole) => {
    CapacitorService.triggerHaptic();
    navigate('/register', { state: { role } });
  };

  const handleBack = () => {
    CapacitorService.triggerHaptic();
    navigate('/');
  };

  const handleGoToLogin = () => {
    CapacitorService.triggerHaptic();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md">
        <button 
          onClick={handleBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight tracking-tight text-center">Bicadriver</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-4 pb-8 w-full overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center mb-8 animate-slide-up">
          <h2 className="text-[28px] font-bold leading-tight text-center mb-3">How will you use the app?</h2>
          <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal text-center max-w-xs">
            Choose your role to get started with the right experience.
          </p>
        </div>

        <div className="flex flex-col gap-5 w-full">
          {/* Card 1: Car Owner */}
          <div 
            className="group cursor-pointer transition-all duration-300 animate-slide-up stagger-1 opacity-0"
            style={{ animationFillMode: 'forwards' }}
            onClick={() => handleSelectRole(UserRole.OWNER)}
          >
            <div className="flex flex-col overflow-hidden rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark group-hover:border-primary group-hover:shadow-xl group-hover:shadow-primary/10 transition-all">
              <div className="w-full h-40 bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-90 transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url('${IMAGES.OWNER_CARD}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-4 left-5 text-white">
                  <span className="material-symbols-outlined mb-1 block text-primary" style={{ fontSize: '32px' }}>directions_car</span>
                </div>
              </div>
              <div className="flex flex-col p-6 gap-3">
                <div className="text-left">
                  <h3 className="text-xl font-bold leading-tight mb-1">Car Owner</h3>
                  <p className="text-slate-500 dark:text-[#9da6b9] text-base font-medium">I have a car and need a driver.</p>
                </div>
                <div className="flex items-center justify-end mt-2">
                  <button className="w-full flex items-center justify-center rounded-2xl h-12 px-6 bg-primary hover:bg-blue-600 text-white text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
                    Select Owner Role
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Driver */}
          <div 
            className="group cursor-pointer transition-all duration-300 animate-slide-up stagger-2 opacity-0"
            style={{ animationFillMode: 'forwards' }}
            onClick={() => handleSelectRole(UserRole.DRIVER)}
          >
            <div className="flex flex-col overflow-hidden rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark group-hover:border-primary group-hover:shadow-xl group-hover:shadow-primary/10 transition-all">
              <div className="w-full h-40 bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-90 transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url('${IMAGES.DRIVER_CARD}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-4 left-5 text-white">
                  <span className="material-symbols-outlined mb-1 block text-primary" style={{ fontSize: '32px' }}>sports_motorsports</span>
                </div>
              </div>
              <div className="flex flex-col p-6 gap-3">
                <div className="text-left">
                  <h3 className="text-xl font-bold leading-tight mb-1">Professional Driver</h3>
                  <p className="text-slate-500 dark:text-[#9da6b9] text-base font-medium">I am a driver looking for work.</p>
                </div>
                <div className="flex items-center justify-end mt-2">
                  <button className="w-full flex items-center justify-center rounded-2xl h-12 px-6 bg-primary hover:bg-blue-600 text-white text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
                    Select Driver Role
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center mt-auto animate-fade-in stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          Already have an account? 
          <span 
            onClick={handleGoToLogin}
            className="text-primary font-bold hover:underline ml-1 cursor-pointer transition-colors"
          >
            Log In
          </span>
        </p>
      </footer>
    </div>
  );
};

export default RoleSelectionScreen;
