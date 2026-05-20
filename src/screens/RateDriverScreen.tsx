import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRatingGateStore } from '@/stores/ratingGateStore';
import { api } from '@/services/api.service';
import { useUIStore } from '@/stores/uiStore';
import { sounds } from '@/services/SoundService';

const RateDriverScreen: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { pendingRating, clearPendingRating } = useRatingGateStore();
  const { addToast } = useUIStore();

  const [score, setScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Safety: If somehow accessed without pending rating or mismatched ID, go back to owner dashboard
  useEffect(() => {
    if (!pendingRating || pendingRating.tripId !== tripId) {
      navigate('/owner', { replace: true });
    }
  }, [pendingRating, tripId, navigate]);

  if (!pendingRating) return null;

  const handleSubmit = async () => {
    if (!score || !tripId) return;
    
    setIsSubmitting(true);
    try {
      await api.rateTrip(tripId, score);
      sounds.playSuccess();
      addToast('Thank you for your feedback!', 'success');
      clearPendingRating();
      navigate('/owner', { replace: true });
    } catch (error: any) {
      addToast(error.message || 'Failed to submit rating. Please try again.', 'error');
      setIsSubmitting(false);
    }
  };

  const driver = pendingRating.driver;

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-950 px-6 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full z-10">
        
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white tracking-tight">
            How was your ride?
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Please rate your experience to continue.
          </p>
        </div>

        {/* Driver Info Card */}
        <div className="w-full bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl mb-10 flex flex-col items-center relative overflow-hidden">
          {/* Subtle accent line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

          {/* Avatar */}
          <div className="w-24 h-24 rounded-full p-1 bg-slate-800 mb-4 shadow-inner relative">
            <img 
              src={driver?.avatarUrl || 'https://ui-avatars.com/api/?background=random&color=fff&name=' + encodeURIComponent(driver?.name || 'Driver')} 
              alt={driver?.name}
              className="w-full h-full rounded-full object-cover"
            />
            {/* Verified badge */}
            <div className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 border-4 border-slate-900 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">{driver?.name}</h2>
          
          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            {driver?.rating && (
              <div className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded-full border border-slate-700/50">
                <span className="material-symbols-outlined text-[14px] text-amber-400 fill-current">star</span>
                <span>{driver.rating > 5 ? (driver.rating / 100).toFixed(1) : driver.rating.toFixed(1)}</span>
              </div>
            )}
            {driver?.totalTrips && (
              <div className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded-full border border-slate-700/50">
                <span className="material-symbols-outlined text-[14px]">local_taxi</span>
                <span>{driver.totalTrips} trips</span>
              </div>
            )}
          </div>
        </div>

        {/* 5-Star Selector */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {[1, 2, 3, 4, 5].map((star) => {
            const isActive = score && score >= star;
            return (
              <button
                key={star}
                onClick={() => setScore(star)}
                disabled={isSubmitting}
                className="group relative focus:outline-none"
              >
                {/* Glow behind active stars */}
                {isActive && (
                  <div className="absolute inset-0 bg-amber-400/30 rounded-full blur-md" />
                )}
                <span 
                  className={`
                    material-symbols-outlined text-5xl transition-all duration-300 relative z-10
                    ${isActive ? 'text-amber-400 fill-current scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-slate-700 hover:text-slate-500'}
                    ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}
                  `}
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  star
                </span>
              </button>
            );
          })}
        </div>

        {/* Submit Button */}
        <div className="w-full">
          <button
            onClick={handleSubmit}
            disabled={!score || isSubmitting}
            className={`
              w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all duration-300 flex items-center justify-center gap-2
              ${score && !isSubmitting 
                ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--color-primary),0.4)] hover:bg-primary/90 active:scale-95' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'}
            `}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                Submitting...
              </>
            ) : (
              'Submit Rating'
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default RateDriverScreen;
