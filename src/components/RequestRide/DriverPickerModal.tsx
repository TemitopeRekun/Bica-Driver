import React from 'react';
import { IMAGES } from '../../constants';

interface DriverPickerModalProps {
  onClose: () => void;
  isLoading: boolean;
  availableDrivers: any[];
  onSelectDriver: (driver: any) => void;
}

const DriverPickerModal: React.FC<DriverPickerModalProps> = ({
  onClose,
  isLoading,
  availableDrivers,
  onSelectDriver,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-h-[70vh] bg-surface-light dark:bg-surface-dark rounded-[2rem] p-6 shadow-2xl animate-slide-up overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Choose a Driver</h3>
            <p className="text-sm text-slate-500">Select your preferred driver to start the ride</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold animate-pulse">Finding nearby drivers...</p>
            </div>
          ) : availableDrivers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <span className="material-symbols-outlined text-4xl">person_off</span>
              </div>
              <p className="text-slate-900 dark:text-white font-bold">No drivers available</p>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your location or check back soon</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableDrivers.map(driver => (
                <button
                  key={driver.id}
                  onClick={() => onSelectDriver(driver)}
                  className="w-full flex items-center gap-4 p-4 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary transition-all active:scale-[0.98] text-left"
                >
                  <div className="relative shrink-0">
                    <img
                      src={driver.avatarUrl || IMAGES.DRIVER_CARD}
                      className="w-14 h-14 rounded-xl object-cover"
                      alt={driver.name}
                    />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-surface-dark"></div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate">
                      {driver.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="material-symbols-outlined text-yellow-500 text-sm filled">star</span>
                      <span className="text-sm font-bold">{driver.rating?.toFixed(1)}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-400">{driver.totalTrips} trips</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-500 uppercase">
                        {driver.transmission || 'Any'}
                      </span>
                      {driver.distanceKm && (
                        <span className="text-[10px] text-slate-400">
                          {driver.distanceKm}km away
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {driver.estimatedArrivalMins && (
                      <span className="text-xs font-bold text-primary">
                        ~{driver.estimatedArrivalMins} mins
                      </span>
                    )}
                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverPickerModal;
