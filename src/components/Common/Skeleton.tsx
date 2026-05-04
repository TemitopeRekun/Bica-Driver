import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width, 
  height, 
  circle = false 
}) => {
  return (
    <div 
      className={`bg-slate-200 dark:bg-slate-800 animate-pulse ${circle ? 'rounded-full' : 'rounded-lg'} ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || '20px' 
      }}
    />
  );
};

export const CardSkeleton: React.FC = () => (
  <div className="p-4 bg-white/5 border border-white/10 rounded-3xl space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton circle width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} />
      </div>
    </div>
    <Skeleton height={40} />
  </div>
);
