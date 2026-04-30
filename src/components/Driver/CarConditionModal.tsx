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
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Condition Check</h3>
          <p className="text-slate-400 text-sm">Snap all 4 sides in circular motion to unlock trip</p>
        </div>

        {/* Progress Stepper */}
        <div className="flex gap-2 w-full max-w-xs">
          {sides.map(s => (
            <div 
              key={s} 
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${conditionStep === s ? 'bg-primary' : carPhotos[s] ? 'bg-primary/40' : 'bg-white/10'}`} 
            />
          ))}
        </div>

        {/* Camera Preview / Placeholder */}
        <button 
          onClick={() => onSnap(conditionStep)}
          disabled={isCapturing}
          className="relative w-full aspect-[4/5] rounded-[3rem] bg-white/5 border-2 border-dashed border-white/10 overflow-hidden flex items-center justify-center group active:scale-95 transition-transform"
          aria-label={`Snap ${conditionStep} of car`}
        >
          {carPhotos[conditionStep] ? (
            <>
              <img src={carPhotos[conditionStep]} className="w-full h-full object-cover" alt={`${conditionStep} view`} />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-white text-4xl">photo_camera</span>
                <span className="text-white font-bold ml-2">Retake</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className={`size-20 rounded-full bg-primary/20 flex items-center justify-center ${isCapturing ? 'animate-spin' : 'animate-pulse'}`}>
                <span className="material-symbols-outlined text-4xl text-primary">{isCapturing ? 'refresh' : 'photo_camera'}</span>
              </div>
              <span className="text-white font-black uppercase tracking-widest text-sm">
                {isCapturing ? 'Uploading...' : `Snap ${conditionStep}`}
              </span>
            </div>
          )}
        </button>

        {/* Navigation */}
        <div className="w-full flex gap-4">
          {conditionStep === 'FRONT' ? (
            <button onClick={onCancel} className="flex-1 py-5 rounded-2xl bg-white/5 text-slate-400 font-bold">Cancel</button>
          ) : (
            <button 
              onClick={() => {
                const prevIndex = sides.indexOf(conditionStep) - 1;
                setConditionStep(sides[prevIndex]);
              }} 
              className="flex-1 py-5 rounded-2xl bg-white/5 text-white font-bold"
            >Back</button>
          )}

          {carPhotos[conditionStep] ? (
            conditionStep === 'LEFT' ? (
              <button 
                onClick={onConfirm} 
                className="flex-[2] py-5 rounded-2xl bg-primary text-white font-black text-lg flex items-center justify-center gap-2"
              >
                Confirm All Photos
              </button>
            ) : (
              <button 
                onClick={() => {
                  const nextIndex = sides.indexOf(conditionStep) + 1;
                  setConditionStep(sides[nextIndex]);
                }} 
                className="flex-[2] py-5 rounded-2xl bg-primary text-white font-black text-lg"
              >Next Side</button>
            )
          ) : (
            <div className="flex-[2]" />
          )}
        </div>
      </div>
    </div>
  );
};

export default CarConditionModal;
