import React from 'react';
import { DISCOVERY_CATEGORIES } from '../../constants';
import {
  getLocationPrimaryText,
  getLocationSecondaryText,
} from '../../services/LocationService';

interface LocationSearchModalProps {
  type: 'pickup' | 'dest';
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onClose: () => void;
  onUseMyLocation?: () => void;
  isLocating?: boolean;
  onCategoryTap: (type: string) => void;
  isSearching: boolean;
  searchResults: any[];
  onSelectLocation: (loc: any, type: 'pickup' | 'dest') => void;
  searchError: string | null;
}

const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  type,
  searchQuery,
  setSearchQuery,
  onClose,
  onUseMyLocation,
  isLocating,
  onCategoryTap,
  isSearching,
  searchResults,
  onSelectLocation,
  searchError,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark flex flex-col animate-slide-up">
      <div className="px-4 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <div className="flex-1 bg-slate-100 dark:bg-surface-dark rounded-xl flex items-center px-4 h-12">
          <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
          <input
            autoFocus
            className="bg-transparent border-none w-full text-base font-medium focus:ring-0 p-0 text-slate-900 dark:text-white"
            placeholder={type === 'pickup' ? "Where are you?" : "Where to?"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {type === 'pickup' && searchQuery === '' && onUseMyLocation && (
          <div className="mb-6">
            <button
              onClick={onUseMyLocation}
              disabled={isLocating}
              className="w-full flex items-center gap-4 p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors text-left mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                {isLocating ? (
                  <span className="material-symbols-outlined text-primary animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-primary">my_location</span>
                )}
              </div>
              <div>
                <p className="font-bold text-primary text-sm">Use My Live Location</p>
                <p className="text-xs text-slate-500">Tap to set pickup to your current position</p>
              </div>
            </button>
            <p className="text-[10px] text-slate-400 px-2 text-center">
              Location is only used for this ride request.
            </p>
          </div>
        )}

        {searchQuery === '' && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Categories</h3>
            <div className="grid grid-cols-4 gap-4">
              {DISCOVERY_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => onCategoryTap(cat.type)}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">{cat.icon}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Locations</h3>
        <div className="space-y-2">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-primary">refresh</span>
            </div>
          )}
          {!isSearching && searchResults.map(loc => (
            <button
              key={loc.id}
              onClick={() => onSelectLocation(loc, type)}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-surface-dark transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-slate-500 text-lg">location_on</span>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{getLocationPrimaryText(loc)}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded text-slate-500 font-bold uppercase">{loc.category}</span>
                  <p className="text-xs text-slate-500">{getLocationSecondaryText(loc)}</p>
                </div>
              </div>
            </button>
          ))}
          {!isSearching && searchResults.length === 0 && (searchQuery.trim().length >= 2 || Boolean(searchError)) && (
            <div className="py-8 text-center">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {searchError || 'No matching locations found.'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Try a nearby landmark, street, or area name.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationSearchModal;
