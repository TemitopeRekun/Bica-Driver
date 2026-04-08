import React, { Component, ErrorInfo, ReactNode } from 'react';
import { telemetry } from '@/services/TelemetryService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    telemetry.error('Uncaught UI Exception', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRestart = () => {
    window.location.href = window.location.origin + '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-display">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#3b82f615,transparent_50%)]" />
           
           <div className="relative z-10 w-full max-w-sm">
             <div className="size-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center text-red-500 mx-auto mb-8 shadow-2xl shadow-red-500/10">
               <span className="material-symbols-outlined text-4xl filled">error</span>
             </div>

             <h1 className="text-3xl font-black text-white tracking-tighter mb-4">Something went wrong</h1>
             <p className="text-slate-400 text-sm leading-relaxed mb-10 px-4">
               The application encountered an unexpected runtime error. Our engineers have been notified.
             </p>

             <div className="space-y-4">
               <button 
                 onClick={this.handleRestart}
                 className="w-full h-14 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-white/5 active:scale-95 transition-all"
               >
                 Restart Application
               </button>
               
               <button 
                 onClick={() => this.setState({ hasError: false })}
                 className="w-full h-12 bg-slate-900 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/5 hover:text-white transition-colors"
               >
                 Try to Resume
               </button>
             </div>

             {process.env.NODE_ENV === 'development' && this.state.error && (
               <div className="mt-12 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-[10px] font-mono text-red-400/80 overflow-auto text-left max-h-40 no-scrollbar">
                 <p className="font-bold mb-2">DEBUG INFO:</p>
                 {this.state.error.toString()}
                 <br />
                 {this.state.errorInfo?.componentStack}
               </div>
             )}
           </div>

           <div className="mt-20 relative z-10">
             <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Bica Safe Mode</p>
           </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
