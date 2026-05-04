import React from 'react';

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({ 
  message, 
  onRetry, 
  className = '' 
}) => {
  return (
    <div className={`p-6 bg-red-500/5 border border-red-500/10 rounded-3xl flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in duration-300 ${className}`}>
      <div className="size-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
        <span className="material-symbols-outlined text-xl">error</span>
      </div>
      <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-wider px-2">
        {message}
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="mt-2 px-6 py-2 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
        >
          Try Again
        </button>
      )}
    </div>
  );
};
