import React, { useEffect, useState } from 'react';
import { ToastItem, ToastVariant } from '../../types/toast';

interface ToastItemProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

const getVariantStyles = (variant: ToastVariant) => {
  switch (variant) {
    case 'success':
      return {
        icon: 'check_circle',
        color: 'text-green-500',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
      };
    case 'error':
      return {
        icon: 'error',
        color: 'text-red-500',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
      };
    case 'warning':
      return {
        icon: 'warning',
        color: 'text-orange-500',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
      };
    default:
      return {
        icon: 'info',
        color: 'text-primary',
        bg: 'bg-primary/10',
        border: 'border-primary/20',
      };
  }
};

const ToastItemComponent: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const { icon, color, bg, border } = getVariantStyles(toast.variant);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(toast.id), 300); // Wait for transition
    }, toast.duration || (toast.variant === 'error' ? 6000 : 4000));

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'}
        w-full max-w-[calc(100vw-2rem)] md:max-w-sm
        ${bg} ${border} border backdrop-blur-md
        p-4 rounded-2xl shadow-xl flex items-start gap-3
        pointer-events-auto
      `}
    >
      <span className={`material-symbols-outlined ${color} shrink-0 text-xl`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white mb-1">
            {toast.title}
          </h4>
        )}
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
          {toast.message}
        </p>
        {toast.action && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.action?.onClick();
              setIsVisible(false);
            }}
            className="mt-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-dark transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="shrink-0 size-6 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 transition-colors"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
};

export default ToastItemComponent;
