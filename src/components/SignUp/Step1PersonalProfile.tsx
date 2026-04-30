import React from 'react';

interface StepProps {
  formData: any;
  errors: Record<string, string>;
  updateField: (field: string, value: any) => void;
  onNext: () => void;
}

const Step1PersonalProfile: React.FC<StepProps> = ({ formData, errors, updateField, onNext }) => {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-2xl font-bold mb-1">Personal Profile</h2>
        <p className="text-sm text-slate-500 font-medium">This information helps us verify your identity.</p>
      </div>
      
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Full Name</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.name ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">person</span>
          <input 
            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
            placeholder="John Doe"
            value={formData.name || ''}
            onChange={e => updateField('name', e.target.value)}
          />
        </div>
        {errors.name && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Email Address</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.email ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">mail</span>
          <input 
            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
            placeholder="john@example.com"
            type="email"
            value={formData.email || ''}
            onChange={e => updateField('email', e.target.value)}
          />
        </div>
        {errors.email && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Phone Number</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.phone ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">phone_iphone</span>
          <input 
            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
            placeholder="08012345678"
            type="tel"
            value={formData.phone || ''}
            onChange={e => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
          />
        </div>
        {errors.phone && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.phone}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Age</label>
          <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.age ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
            <input 
              className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0 text-center"
              placeholder="18+"
              type="number"
              value={formData.age || ''}
              onChange={e => updateField('age', e.target.value)}
            />
          </div>
          {errors.age && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.age}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Gender</label>
          <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.gender ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
            <select 
              className="bg-transparent border-none text-slate-900 dark:text-white text-sm font-bold w-full focus:ring-0 p-0"
              value={formData.gender || ''}
              onChange={e => updateField('gender', e.target.value)}
            >
              <option value="" disabled className="text-slate-400 bg-white dark:bg-surface-dark">Select</option>
              <option value="Male" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Male</option>
              <option value="Female" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Female</option>
              <option value="Other" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Other</option>
            </select>
          </div>
          {errors.gender && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.gender}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Home Address</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.address ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">home</span>
          <input 
            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
            placeholder="Residential Address"
            value={formData.address || ''}
            onChange={e => updateField('address', e.target.value)}
          />
        </div>
        {errors.address && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.address}</p>}
      </div>

      <button 
        onClick={onNext}
        className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-4"
      >
        Continue
      </button>
    </div>
  );
};

export default Step1PersonalProfile;
