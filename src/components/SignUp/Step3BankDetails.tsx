import React, { useState, useEffect } from 'react';
import { api } from '@/services/api.service';

interface StepProps {
  formData: any;
  errors: Record<string, string>;
  updateField: (field: string, value: any) => void;
  onNext: () => void;
}

const Step3BankDetails: React.FC<StepProps> = ({ formData, errors, updateField, onNext }) => {
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);

  useEffect(() => {
    api.get<{ name: string; code: string }[]>('/payments/banks', false)
      .then(setBanks)
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-2xl font-bold mb-1">Financial Setup</h2>
        <p className="text-sm text-slate-500 font-medium">Where should we send your earnings?</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Your Bank</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.bankCode ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <select 
            className="bg-transparent border-none text-slate-900 dark:text-white text-base font-bold w-full focus:ring-0 p-0"
            value={formData.bankCode || ''}
            onChange={e => {
              const bank = banks.find(b => b.code === e.target.value);
              updateField('bankCode', e.target.value);
              updateField('bankName', bank?.name || '');
            }}
          >
            <option value="" disabled className="text-slate-400 bg-white dark:bg-surface-dark">Select your bank</option>
            {banks.map(bank => (
              <option key={bank.code} value={bank.code} className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">{bank.name}</option>
            ))}
          </select>
        </div>
        {errors.bankCode && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.bankCode}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Account Number</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.accountNumber ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">account_balance</span>
          <input 
            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold w-full focus:ring-0 p-0"
            placeholder="10 Digits"
            inputMode="numeric"
            value={formData.accountNumber || ''}
            onChange={e => updateField('accountNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        </div>
        {errors.accountNumber && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.accountNumber}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Verified Account Name</label>
        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.accountName ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
          <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">person_check</span>
          <input 
            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
            placeholder="Enter Name as seen on Bank"
            value={formData.accountName || ''}
            onChange={e => updateField('accountName', e.target.value)}
          />
        </div>
        {errors.accountName && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.accountName}</p>}
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

export default Step3BankDetails;
