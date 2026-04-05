
import React from 'react';

export type DriverMilestone = 'pickup' | 'arrived' | 'trip' | 'completed';

interface TripProgressTimelineProps {
  milestone: DriverMilestone;
}

const TripProgressTimeline: React.FC<TripProgressTimelineProps> = ({ milestone }) => {
  const steps = [
    { id: 'pickup', label: 'Pickup' },
    { id: 'arrived', label: 'Arrived' },
    { id: 'trip', label: 'Trip Live' },
    { id: 'completed', label: 'Complete' },
  ];

  const getMilestoneIndex = (m: DriverMilestone) => {
    switch (m) {
      case 'pickup': return 0;
      case 'arrived': return 1;
      case 'trip': return 2;
      case 'completed': return 3;
      default: return 0;
    }
  };

  const currentIndex = getMilestoneIndex(milestone);

  return (
    <div className="w-full px-2 py-4 mb-2">
      <div className="relative flex justify-between items-center">
        {/* Background line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0"></div>
        
        {/* Progress line */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500 ease-in-out"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              {/* Dot */}
              <div 
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-primary border-primary' 
                    : isCurrent 
                      ? 'bg-background-dark border-primary scale-125' 
                      : 'bg-background-dark border-slate-300 dark:border-slate-700'
                }`}
              >
                {isCompleted && (
                  <span className="material-symbols-outlined text-[10px] text-white font-bold">check</span>
                )}
                {isCurrent && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                )}
              </div>
              
              {/* Label */}
              <span 
                className={`text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  isCurrent 
                    ? 'text-primary' 
                    : isCompleted 
                      ? 'text-slate-400 dark:text-slate-500' 
                      : 'text-slate-300 dark:text-slate-700'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TripProgressTimeline;
