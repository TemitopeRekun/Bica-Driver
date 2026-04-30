import React from 'react';
import { CarSide } from '@/hooks/useCarVerification';

interface CarConditionModalProps {
  conditionStep: CarSide;
  carPhotos: Record<string, string>;
  isCapturing: boolean;
  onSnap: (side: CarSide) => void;
  onBack: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  setConditionStep: (side: CarSide) => void;
  sides: CarSide[];
}

const CarConditionModal: React.FC<CarConditionModalProps> = ({
  conditionStep,
  carPhotos,
  isCapturing,
  onSnap,
  onBack,
  onConfirm,
  onCancel,
  setConditionStep,
  sides
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Vehicle Condition</h3>
          <p className="text-slate-400 text-sm">Verify all 4 sides of the vehicle to start the trip</p>
        </div>

        {/* Progress Stepper & Mini Previews */}
        <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
          {sides.map(s => (
            <div key={s} className="space-y-2">
              <button 
                onClick={() => setConditionStep(s)}
                className={`w-full aspect-square rounded-xl border-2 transition-all overflow-hidden ${conditionStep === s ? 'border-primary scale-105 shadow-lg shadow-primary/20' : carPhotos[s] ? 'border-primary/40' : 'border-white/10'}`}
              >
                {carPhotos[s] ? (
                  <img src={carPhotos[s]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <span className={`material-symbols-outlined text-xs ${conditionStep === s ? 'text-primary' : 'text-slate-600'}`}>
                      {s === 'FRONT' ? 'stat_3' : s === 'BACK' ? 'stat_minus_3' : 'stat_2'}
                    </span>
                  </div>
                )}
              </button>
              <p className={`text-[8px] font-black text-center uppercase tracking-widest ${conditionStep === s ? 'text-primary' : 'text-slate-500'}`}>{s}</p>
            </div>
          ))}
        </div>

        {/* Main Capture Area */}
        <div className="relative w-full max-w-md aspect-[4/3] group">
          <button 
            onClick={() => onSnap(conditionStep)}
            disabled={isCapturing}
            className="w-full h-full rounded-[2.5rem] bg-white/5 border-2 border-dashed border-white/10 overflow-hidden flex items-center justify-center active:scale-[0.98] transition-all"
            aria-label={`Snap ${conditionStep} of car`}
          >
            {carPhotos[conditionStep] ? (
              <>
                <img src={carPhotos[conditionStep]} className="w-full h-full object-cover" alt={`${conditionStep} view`} />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="size-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                  </div>
                  <span className="text-white font-black uppercase tracking-widest text-xs">Retake Photo</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className={`size-24 rounded-full bg-primary/20 flex items-center justify-center ${isCapturing ? 'animate-spin' : 'animate-pulse'}`}>
                  <span className="material-symbols-outlined text-5xl text-primary">{isCapturing ? 'refresh' : 'photo_camera'}</span>
                </div>
                <div className="text-center">
                   <p className="text-white font-black uppercase tracking-[0.2em] text-sm">Snap {conditionStep} Side</p>
                   <p className="text-slate-500 text-[10px] mt-1 italic">Position the car within frame</p>
                </div>
              </div>
            )}
          </button>
          
          {/* Status Overlay */}
          {carPhotos[conditionStep] && (
             <div className="absolute top-4 right-4 bg-primary text-white size-8 rounded-full flex items-center justify-center shadow-lg animate-pop-in">
                <span className="material-symbols-outlined text-sm font-black">check</span>
             </div>
          )}
        </div>

        {/* Navigation Actions */}
        <div className="w-full flex flex-col gap-4">
          <div className="flex gap-4">
            {conditionStep === 'FRONT' ? (
              <button onClick={onCancel} className="flex-1 py-5 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-colors uppercase tracking-widest text-xs">Cancel</button>
            ) : (
              <button 
                onClick={() => {
                  const prevIndex = sides.indexOf(conditionStep) - 1;
                  setConditionStep(sides[prevIndex]);
                }} 
                className="flex-1 py-5 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors uppercase tracking-widest text-xs"
              >Previous</button>
            )}

            {carPhotos[conditionStep] ? (
              conditionStep === 'LEFT' ? (
                <button 
                  onClick={onConfirm} 
                  className="flex-[2] py-5 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary/20 animate-pulse"
                >
                  Complete Verification
                  <span className="material-symbols-outlined text-sm">task_alt</span>
                </button>
              ) : (
                <button 
                  onClick={() => {
                    const nextIndex = sides.indexOf(conditionStep) + 1;
                    setConditionStep(sides[nextIndex]);
                  }} 
                  className="flex-[2] py-5 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                >
                   Next: {sides[sides.indexOf(conditionStep) + 1]}
                   <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )
            ) : (
              <button disabled className="flex-[2] py-5 rounded-2xl bg-slate-800 text-slate-500 font-bold uppercase tracking-widest text-xs cursor-not-allowed">
                Capture to Proceed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarConditionModal;
