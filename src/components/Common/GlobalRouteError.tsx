import React from 'react';
import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';
import { telemetry } from '@/services/TelemetryService';

const GlobalRouteError: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  // Log the error to telemetry
  React.useEffect(() => {
    telemetry.error('Route level crash', error);
    console.error('Route Error:', error);
  }, [error]);

  let errorMessage = 'An unexpected navigation error occurred.';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || error.data?.message || errorMessage;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  const handleRestart = () => {
    window.location.href = window.location.origin + '/#/';
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6 text-center z-[9999]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#3b82f615,transparent_50%)]" />
      
      <div className="relative z-10 w-full max-w-sm">
        <div className="size-20 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-8 shadow-2xl shadow-primary/10">
          <span className="material-symbols-outlined text-4xl filled">navigation</span>
        </div>

        <h1 className="text-3xl font-black text-white tracking-tighter mb-4 italic">BICA<span className="text-primary NOT-italic"> SAFE MODE</span></h1>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8 text-left">
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Error Status {errorStatus}</p>
           <p className="text-sm font-medium text-slate-300 leading-relaxed italic">
             "{errorMessage}"
           </p>
        </div>

        <p className="text-slate-400 text-xs leading-relaxed mb-10 px-4">
          The navigation requested could not be completed securely. Please return to the dashboard or restart the application.
        </p>

        <div className="space-y-4">
          <button 
            onClick={handleGoHome}
            className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
          >
            Return to Dashboard
          </button>
          
          <button 
            onClick={handleRestart}
            className="w-full h-12 bg-slate-900 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/5 hover:text-white transition-colors"
          >
            Hard Restart Application
          </button>
        </div>

        <div className="mt-12 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">
           Recovery Protocol Active
        </div>
      </div>
    </div>
  );
};

export default GlobalRouteError;
