import React, { useState, useEffect } from 'react';

const CountUpTimer: React.FC = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = mins > 0
    ? `${mins}m ${secs.toString().padStart(2, '0')}s`
    : `${secs}s`;

  return (
    <div className="mt-5 flex flex-col items-center gap-1">
      <div className="px-5 py-2 rounded-2xl bg-primary/10 border border-primary/20">
        <span className="text-2xl font-black text-primary tracking-tight">{display}</span>
      </div>
      <span className="text-xs text-slate-400">waiting for driver to accept</span>
    </div>
  );
};

export default CountUpTimer;
