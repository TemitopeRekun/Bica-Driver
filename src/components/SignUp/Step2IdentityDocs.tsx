import React, { useState } from 'react';
import { CameraSource, CameraDirection } from '@capacitor/camera';
import { snapAndUpload } from '@/utils/photoUtils';

interface StepProps {
  formData: any;
  errors: Record<string, string>;
  updateField: (field: string, value: any) => void;
  onNext: () => void;
  isDriver: boolean;
}

const Step2IdentityDocs: React.FC<StepProps> = ({ formData, errors, updateField, onNext, isDriver }) => {
  const [isCapturing, setIsCapturing] = useState<'license' | 'selfie' | 'nin' | null>(null);

  const handleCapture = async (type: 'license' | 'selfie' | 'nin', source: CameraSource, direction: CameraDirection) => {
    try {
      const url = await snapAndUpload(source, direction, 'registration', (status) => {
        if (status === 'CAPTURING' || status === 'UPLOADING') setIsCapturing(type);
        else setIsCapturing(null);
      });
      if (url) {
        updateField(`${type}Image`, url);
      }
    } catch (error) {
      console.error('Capture failed', error);
    }
  };

  if (isDriver) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="mb-2">
          <h2 className="text-2xl font-bold mb-1">Identity & Safety</h2>
          <p className="text-sm text-slate-500 font-medium">Verify your right to drive and identity.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">NIN Number</label>
          <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.nin ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
            <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">id_card</span>
            <input 
              className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
              placeholder="11-digit National Identity"
              inputMode="numeric"
              value={formData.nin || ''}
              onChange={e => updateField('nin', e.target.value.replace(/\D/g, '').slice(0, 11))}
            />
          </div>
          {errors.nin && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.nin}</p>}
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest mb-[-8px]">Required Document Photos</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'license', label: 'License', icon: 'badge', dir: CameraDirection.Rear },
              { id: 'selfie', label: 'Selfie', icon: 'face', dir: CameraDirection.Front },
              { id: 'nin', label: 'NIN Card', icon: 'id_card', dir: CameraDirection.Rear },
            ].map((doc) => (
              <button 
                key={doc.id}
                onClick={() => handleCapture(doc.id as any, CameraSource.Camera, doc.dir)}
                className={`flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl border-2 border-dashed transition-all overflow-hidden relative ${formData[`${doc.id}Image`] ? 'border-green-500 bg-green-500/5' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-input-dark'}`}
              >
                {formData[`${doc.id}Image`] ? (
                  <img src={formData[`${doc.id}Image`]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-slate-400">{doc.icon}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{doc.label}</span>
                  </>
                )}
                {isCapturing === doc.id && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {(errors.licenseImage || errors.selfieImage || errors.ninImage) && (
            <p className="text-[10px] text-red-500 font-bold ml-1">Please upload all required photos</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Transmission You Can Drive</label>
          <div className="grid grid-cols-3 gap-3">
            {(['Manual', 'Automatic', 'Both'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => updateField('transmission', type)}
                className={`py-4 rounded-2xl text-sm font-bold border transition-all ${
                  formData.transmission === type
                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-white dark:bg-surface-dark border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={onNext}
          className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-auto"
        >
          Continue
        </button>
      </div>
    );
  }

  // OWNER VEHICLE DETAILS
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-2xl font-bold mb-1">Vehicle Specs</h2>
        <p className="text-sm text-slate-500 font-medium">Tell us about the car being used.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Luxury Car Category</label>
        <div className="grid grid-cols-2 gap-3">
          {['Standard', 'Executive', 'Luxury', 'SUV'].map(type => (
            <button
              key={type}
              onClick={() => updateField('carType', type)}
              className={`py-4 rounded-2xl text-sm font-bold border transition-all ${formData.carType === type ? 'bg-primary border-primary text-white' : 'bg-white dark:bg-surface-dark border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Model</label>
          <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.carModel ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
            <input 
              className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
              placeholder="e.g. Camry"
              value={formData.carModel || ''}
              onChange={e => updateField('carModel', e.target.value)}
            />
          </div>
          {errors.carModel && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.carModel}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Year</label>
          <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.carYear ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
            <input 
              className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0 text-center"
              placeholder="20XX"
              inputMode="numeric"
              value={formData.carYear || ''}
              onChange={e => updateField('carYear', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
          {errors.carYear && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.carYear}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Transmission</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.transmission ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <select 
            className="bg-transparent border-none text-slate-900 dark:text-white text-base font-bold w-full focus:ring-0 p-0"
            value={formData.transmission || ''}
            onChange={e => updateField('transmission', e.target.value)}
          >
            <option value="Automatic" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Automatic (Most Common)</option>
            <option value="Manual" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Manual Transmission</option>
          </select>
        </div>
        {errors.transmission && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.transmission}</p>}
      </div>

      <button 
        onClick={onNext}
        className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-auto"
      >
        Continue
      </button>
    </div>
  );
};

export default Step2IdentityDocs;
