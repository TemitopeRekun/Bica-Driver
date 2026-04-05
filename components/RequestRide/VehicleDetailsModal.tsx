import React from 'react';

interface VehicleDetailsModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  vehicleData: {
    make: string;
    model: string;
    year: string;
    transmission: string;
  };
  setVehicleData: (data: any) => void;
}

const VehicleDetailsModal: React.FC<VehicleDetailsModalProps> = ({
  onClose,
  onSubmit,
  vehicleData,
  setVehicleData,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-h-[85vh] overflow-y-auto no-scrollbar bg-surface-light dark:bg-surface-dark rounded-[2rem] p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Vehicle Details</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Make</label>
              <input
                required
                placeholder="e.g. Toyota"
                className="w-full h-12 bg-slate-50 dark:bg-input-dark rounded-xl px-4 font-bold text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-primary placeholder-slate-400"
                value={vehicleData.make}
                onChange={e => setVehicleData({ ...vehicleData, make: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Model</label>
              <input
                required
                placeholder="e.g. Camry"
                className="w-full h-12 bg-slate-50 dark:bg-input-dark rounded-xl px-4 font-bold text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-primary placeholder-slate-400"
                value={vehicleData.model}
                onChange={e => setVehicleData({ ...vehicleData, model: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Year</label>
              <input
                required
                placeholder="e.g. 2020"
                className="w-full h-12 bg-slate-50 dark:bg-input-dark rounded-xl px-4 font-bold text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-primary placeholder-slate-400"
                value={vehicleData.year}
                onChange={e => setVehicleData({ ...vehicleData, year: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Transmission</label>
              <select
                className="w-full h-12 bg-slate-50 dark:bg-input-dark rounded-xl px-4 font-bold text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-primary"
                value={vehicleData.transmission}
                onChange={e => setVehicleData({ ...vehicleData, transmission: e.target.value })}
              >
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-14 bg-primary text-white font-bold rounded-xl mt-4 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
          >
            Confirm & Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default VehicleDetailsModal;
