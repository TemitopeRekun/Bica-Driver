import React, { useEffect } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000); // 3 seconds loading time

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white dark:bg-[#032e02] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent opacity-50 animate-pulse"></div>
      
      <div className="relative z-10 flex flex-col items-center animate-pop-in">
        {/* Logo Container */}
        <div className="flex items-end mb-2 relative">
          {/* The Big B */}
          <span className="font-serif text-[120px] leading-[0.8] text-[#045828] dark:text-[#0a7a3b] -mr-2">
            B
          </span>
          
          {/* The rest of the text */}
          <div className="flex flex-col mb-3">
             {/* Steering Wheel Icon - Positioned above 'i' */}
             <div className="absolute left-[72px] -top-6 animate-spin-slow">
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20Z" fill="#f17606"/>
                 <path d="M12 6C12.55 6 13 6.45 13 7V10.27C14.93 10.65 16.5 12.02 17.09 13.91L18.87 12.13C19.26 11.74 19.89 11.74 20.28 12.13C20.67 12.52 20.67 13.15 20.28 13.54L17.86 15.96C17.67 16.15 17.42 16.25 17.16 16.25C16.9 16.25 16.65 16.15 16.46 15.96L14.68 14.18C14.2 14.66 13.55 14.95 12.85 14.99L13.5 18H10.5L11.15 14.99C10.45 14.95 9.8 14.66 9.32 14.18L7.54 15.96C7.35 16.15 7.1 16.25 6.84 16.25C6.58 16.25 6.33 16.15 6.14 15.96L3.72 13.54C3.33 13.15 3.33 12.52 3.72 12.13C4.11 11.74 4.74 11.74 5.13 12.13L6.91 13.91C7.5 12.02 9.07 10.65 11 10.27V7C11 6.45 11.45 6 12 6Z" fill="white"/>
                 <circle cx="12" cy="12" r="2" fill="#f17606"/>
               </svg>
             </div>
             
             {/* Text */}
             <span className="font-display font-bold text-4xl text-[#045828] dark:text-[#0a7a3b] tracking-wide ml-1">
               ICADRIVER
             </span>
          </div>
        </div>
        
        {/* Loading Indicator */}
        <div className="mt-12 flex space-x-2">
           <div className="w-3 h-3 bg-[#f17606] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
           <div className="w-3 h-3 bg-[#f17606] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
           <div className="w-3 h-3 bg-[#f17606] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
