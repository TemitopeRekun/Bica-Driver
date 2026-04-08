import React from 'react';
import { UserProfile, UserRole } from '@/types';

interface MonnifyStatusProps {
  driver: UserProfile;
  retryingSubAccountIds: Set<string>;
  onRetrySubAccount: (userId: string) => Promise<void>;
}

const MonnifyStatus: React.FC<MonnifyStatusProps> = ({ 
  driver, 
  retryingSubAccountIds, 
  onRetrySubAccount 
}) => {
  if (driver.role !== UserRole.DRIVER) return null;

  const isRetrying = retryingSubAccountIds.has(driver.id);
  const hasSubAccount = !!driver.subAccountActive;
  const canRetry = !!driver.canRetrySubAccountSetup;

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onRetrySubAccount(driver.id);
  };

  return (
    <div className={`mt-2 p-3 rounded-2xl border ${hasSubAccount ? 'bg-green-500/5 border-green-500/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${hasSubAccount ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></span>
          <span className="text-[10px] font-black uppercase tracking-wider">
            {hasSubAccount ? 'Sub Account Configured' : 'Sub Account Missing'}
          </span>
        </div>
        {canRetry && !hasSubAccount && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-2 py-1 bg-primary hover:bg-primary-dark disabled:bg-slate-400 text-white text-[9px] font-bold uppercase rounded-lg transition-colors flex items-center gap-1"
          >
            {isRetrying ? (
              <span className="material-symbols-outlined text-[10px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[10px]">refresh</span>
            )}
            {isRetrying ? 'Retrying...' : 'Retry Setup'}
          </button>
        )}
      </div>

      {hasSubAccount && driver.monnifySubAccountCode && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-slate-500 font-medium">Monnify Code:</span>
          <code className="text-[10px] font-mono bg-white dark:bg-black/20 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800" title={driver.monnifySubAccountCode}>
            {driver.monnifySubAccountCode}
          </code>
        </div>
      )}

      {(driver.bankName || driver.accountNumber) && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium italic">
          <span className="material-symbols-outlined text-[12px]">account_balance</span>
          {driver.bankName} • ****{driver.accountNumber?.slice(-4) || '****'}
        </div>
      )}
    </div>
  );
};

export default MonnifyStatus;
