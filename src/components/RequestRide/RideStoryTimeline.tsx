// Owner ride story timeline with robust milestone handling and date formatting
import React from 'react';

interface RideStoryTimelineProps {
  milestone?: string;
  lastUpdate?: string;
}

const RideStoryTimeline: React.FC<RideStoryTimelineProps> = ({ 
  milestone = 'requested', 
  lastUpdate 
}) => {
  const steps = [
    { id: 'requested', label: 'Requested', icon: 'hail', microcopy: 'Waiting for a driver to confirm' },
    { id: 'assigned', label: 'Driver Assigned', icon: 'person_pin_circle', microcopy: 'Driver is heading to your pickup' },
    { id: 'arrived', label: 'Driver Arrived', icon: 'local_taxi', microcopy: 'Your driver has arrived – head to your car' },
    { id: 'in_progress', label: 'In Progress', icon: 'distance', microcopy: 'Enjoy your ride' },
    { id: 'completed', label: 'Completed', icon: 'check_circle', microcopy: 'Trip completed – proceed to payment' },
  ];

  const normalizedMilestone = (milestone === 'inprogress' || milestone === 'trip') ? 'in_progress' : milestone;
  const currentStepIndex = Math.max(0, steps.findIndex(s => s.id === normalizedMilestone));
  const progressPercent = (currentStepIndex / (steps.length - 1)) * 100;

  const formatLastUpdate = (update?: string) => {
    if (!update) return 'Just now';
    try {
      const date = new Date(update);
      if (isNaN(date.getTime())) return 'Just now';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Just now';
    }
  };

  return (
    <div className="mb-6 px-2">
      <div className="flex justify-between relative mb-8">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 z-0 mx-6"></div>
        <div 
          className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-700 z-0 mx-6" 
          style={{ width: progressPercent + "%" }}
        ></div>
        
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          
          return (
            <div key={step.id} className="flex flex-col items-center z-10 w-1/5">
              <div className={"w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 " + (
                isCurrent ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30' : 
                isCompleted ? 'bg-primary/20 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              )}>
                <span className="material-symbols-outlined text-lg">
                  {isCompleted ? 'check' : step.icon}
                </span>
              </div>
              <span className={"text-[10px] mt-2 font-bold text-center " + (
                isCurrent ? 'text-primary' : 'text-slate-400'
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      
      <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-4 border border-primary/10 flex items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary shadow-sm">
          <span className="material-symbols-outlined filled animate-pulse">
            {steps[currentStepIndex]?.icon || 'info'}
          </span>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            {steps[currentStepIndex]?.microcopy}
          </h4>
          <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-bold tracking-wider">
            Updated: {formatLastUpdate(lastUpdate)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RideStoryTimeline;
