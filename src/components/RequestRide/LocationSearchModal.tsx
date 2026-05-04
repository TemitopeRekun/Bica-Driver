import React from 'react';
import { DISCOVERY_CATEGORIES } from '../../constants';
import {
  getLocationPrimaryText,
  getLocationSecondaryText,
} from '../../services/LocationService';
import { Skeleton } from '../Common/Skeleton';
import { InlineError } from '../Common/InlineError';

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
              className="w-full flex items-center gap-4 p-3 rounded-2xl bg-primary/10 hover:bg-primary/20 transition-colors text-left mb-2"
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
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Categories</h3>
            <div className="grid grid-cols-4 gap-4">
              {DISCOVERY_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => onCategoryTap(cat.type)}
                  className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                >
                  <div className="size-14 rounded-[1.25rem] bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">{cat.icon}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Locations</h3>
        <div className="space-y-2">
          {isSearching && (
            <div className="space-y-4">
               {[1, 2, 3, 4, 5].map(i => (
                 <div key={i} className="flex items-center gap-4 p-3">
                   <Skeleton circle width={40} height={40} />
                   <div className="flex-1 space-y-2">
                     <Skeleton width="70%" height={14} />
                     <Skeleton width="40%" height={10} />
                   </div>
                 </div>
               ))}
            </div>
          )}

          {!isSearching && searchError && (
             <InlineError 
               message={searchError} 
               onRetry={() => setSearchQuery(searchQuery)}
               className="my-4"
             />
          )}

          {!isSearching && !searchError && searchResults.map(loc => (
            <button
              key={loc.id}
              onClick={() => onSelectLocation(loc, type)}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">location_on</span>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{getLocationPrimaryText(loc)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] bg-slate-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">{loc.category}</span>
                  <p className="text-xs text-slate-500 truncate">{getLocationSecondaryText(loc)}</p>
                </div>
              </div>
            </button>
          ))}
          
          {!isSearching && !searchError && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
            <div className="py-12 text-center text-slate-500 space-y-2">
               <span className="material-symbols-outlined text-4xl block opacity-20">sentiment_dissatisfied</span>
               <p className="text-sm font-bold">No locations found</p>
               <p className="text-xs px-12">Try a nearby landmark, street, or area name.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationSearchModal;
