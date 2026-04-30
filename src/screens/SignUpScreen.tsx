import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSignUpForm } from '@/hooks/useSignUpForm';
import { UserRole } from '@/types';

// Components
import Step1PersonalProfile from '@/components/SignUp/Step1PersonalProfile';
import Step2IdentityDocs from '@/components/SignUp/Step2IdentityDocs';
import Step3BankDetails from '@/components/SignUp/Step3BankDetails';
import Step4Security from '@/components/SignUp/Step4Security';

const SignUpScreen: React.FC = () => {
  const location = useLocation();
  const initialRole = (location.state as any)?.role || UserRole.OWNER;
  
  const {
    step,
    totalSteps,
    formData,
    errors,
    isLoading,
    updateField,
    handleNext,
    handleBack,
    submit,
    isDriver,
  } = useSignUpForm(initialRole);

  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1PersonalProfile formData={formData} errors={errors} updateField={updateField} onNext={handleNext} />;
      case 2:
        return <Step2IdentityDocs formData={formData} errors={errors} updateField={updateField} onNext={handleNext} isDriver={isDriver} />;
      case 3:
        return isDriver 
          ? <Step3BankDetails formData={formData} errors={errors} updateField={updateField} onNext={handleNext} />
          : <Step4Security formData={formData} errors={errors} updateField={updateField} onSubmit={submit} isLoading={isLoading} isDriver={false} />;
      case 4:
        return <Step4Security formData={formData} errors={errors} updateField={updateField} onSubmit={submit} isLoading={isLoading} isDriver={true} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-100 dark:border-white/5">
        <button 
          onClick={handleBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <div className="flex flex-col items-center">
            <h1 className="text-sm font-bold leading-tight">Registration</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Step {step} of {totalSteps}</p>
        </div>
        <div className="size-10 flex items-center justify-center">
             <span className="text-xs font-bold text-primary">{Math.round((step/totalSteps)*100)}%</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-6 pb-8 w-full overflow-y-auto no-scrollbar">
          {/* Progress bar */}
          <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full mb-8 overflow-hidden">
             <div 
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${(step/totalSteps)*100}%` }}
             />
          </div>

          {renderStep()}
      </main>
    </div>
  );
};

export default SignUpScreen;
