import React from 'react';

export type PaymentContextStatus = 'unpaid' | 'initiated' | 'verifying' | 'confirmed' | 'failed' | 'partial' | 'cancelled';

interface PaymentStatusBannerProps {
  status: PaymentContextStatus;
  message?: string;
  onRetry?: () => void;
  showIcon?: boolean;
}

export const PaymentStatusBanner: React.FC<PaymentStatusBannerProps> = ({
  status,
  message,
  onRetry,
  showIcon = true,
}) => {
  const configs = {
    unpaid: {
      bg: 'bg-slate-100 dark:bg-white/5',
      border: 'border-slate-200 dark:border-white/10',
      text: 'text-slate-600 dark:text-slate-400',
      icon: 'payments',
      label: 'Payment Required',
    },
    initiated: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/20',
      text: 'text-blue-600 dark:text-blue-400',
      icon: 'hourglass_top',
      label: 'Checkout Completed',
    },
    verifying: {
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      icon: 'sync',
      label: 'Verifying with Monnify',
    },
    confirmed: {
      bg: 'bg-emerald-500/5',
      border: 'border-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      icon: 'verified',
      label: 'Payment Confirmed',
    },
    failed: {
      bg: 'bg-red-500/5',
      border: 'border-red-500/20',
      text: 'text-red-600 dark:text-red-400',
      icon: 'error',
      label: 'Payment Failed',
    },
    partial: {
      bg: 'bg-orange-500/5',
      border: 'border-orange-500/20',
      text: 'text-orange-600 dark:text-orange-400',
      icon: 'warning',
      label: 'Partially Paid',
    },
    cancelled: {
      bg: 'bg-slate-100 dark:bg-white/5',
      border: 'border-slate-200 dark:border-white/10',
      text: 'text-slate-500',
      icon: 'cancel',
      label: 'Payment Cancelled',
    },
  };

  const config = configs[status];

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-2xl border ${config.bg} ${config.border} animate-fade-in`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showIcon && (
            <span className={`material-symbols-outlined text-lg ${status === 'verifying' ? 'animate-spin' : ''}`}>
              {config.icon}
            </span>
          )}
          <span className="text-[10px] font-black uppercase tracking-widest">{config.label}</span>
        </div>
        {onRetry && (status === 'failed' || status === 'unpaid') && (
          <button
            onClick={onRetry}
            className="text-[10px] font-black uppercase tracking-widest text-primary underline underline-offset-4"
          >
            Try Again
          </button>
        )}
      </div>
      {message && (
        <p className={`text-xs font-medium leading-relaxed ${config.text}`}>
          {message}
        </p>
      )}
    </div>
  );
};
