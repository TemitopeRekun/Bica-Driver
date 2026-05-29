import React, { useState } from 'react';
import { EmergencyHelpContext } from '@/types';

interface EmergencyHelpSheetProps {
  context: EmergencyHelpContext;
  onClose: () => void;
}

const EmergencyHelpSheet: React.FC<EmergencyHelpSheetProps> = ({ context, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLocation = () => {
    if (context.locationLat && context.locationLng) {
      const url = `https://maps.google.com/?q=${context.locationLat},${context.locationLng}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const locationUrl = (context.locationLat !== undefined && context.locationLng !== undefined)
    ? `https://maps.google.com/?q=${context.locationLat},${context.locationLng}`
    : 'Location unavailable';

  const whatsappMsg = encodeURIComponent(
    `🚨 EMERGENCY HELP REQUEST 🚨\n\n` +
    `👤 OWNER: ${context.ownerName} (${context.ownerPhone})\n` +
    `🚕 DRIVER: ${context.driverName} (${context.driverPhone})\n` +
    `🆔 TRIP ID: ${context.tripId ?? 'N/A'}\n` +
    `📍 LOCATION: ${locationUrl}\n` +
    `🚦 STATUS: ${context.tripStatus ?? 'N/A'}`
  );

  return (
    <div className="fixed inset-0 z-50 bg-red-950/95 backdrop-blur-md flex flex-col animate-slide-up overflow-y-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Close</span>
        </button>
        <h2 className="text-amber-500 font-black uppercase tracking-tight italic flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">warning</span>
          Emergency Help
        </h2>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-md mx-auto w-full">
        {/* Location Card */}
        {context.locationLat !== undefined && context.locationLng !== undefined && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white">
                <span className="material-symbols-outlined text-primary">location_on</span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Your Current Location</span>
              </div>
              <button 
                onClick={handleCopyLocation}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <div className="space-y-3">
              <p className="font-mono text-sm text-white/60 tracking-wider">
                [{context.locationLat.toFixed(6)}, {context.locationLng.toFixed(6)}]
              </p>
              <a 
                href={`https://maps.google.com/?q=${context.locationLat},${context.locationLng}`}
                target="_blank"
                rel="noreferrer"
                className="block w-full py-3 rounded-xl bg-white/10 text-center text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/15 transition-all"
              >
                Open in Maps
              </a>
            </div>
          </div>
        )}

        {/* Trip Details Card */}
        {context.tripId && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
            <div className="flex items-center gap-2 text-white mb-4">
              <span className="material-symbols-outlined text-amber-500">local_taxi</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Active Trip</span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Trip ID</p>
                <p className="text-sm font-black text-white italic">#{context.tripId.slice(0, 8)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">From</p>
                  <p className="text-[11px] font-bold text-white truncate">{context.pickupAddress || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">To</p>
                  <p className="text-[11px] font-bold text-white truncate">{context.destAddress || 'N/A'}</p>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Owner</p>
                <p className="text-sm font-black text-white italic">{context.ownerName || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <a 
            href="tel:+2349038987333" 
            className="w-full py-5 rounded-2xl bg-red-600 text-white flex items-center justify-center gap-3 shadow-lg shadow-red-900/40 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">call</span>
            <span className="font-black uppercase tracking-widest italic">Call BicaDriver Support</span>
          </a>

          {(context.locationLat !== undefined && context.locationLng !== undefined) ? (
            <a 
              href={`https://wa.me/2349038987333?text=${whatsappMsg}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-5 rounded-2xl bg-green-700 text-white flex items-center justify-center gap-3 shadow-lg shadow-green-900/40 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">chat</span>
              <span className="font-black uppercase tracking-widest italic">WhatsApp BicaDriver</span>
            </a>
          ) : (
            <button 
              disabled
              className="w-full py-5 rounded-2xl bg-green-700/50 text-white/50 flex items-center justify-center gap-3 border border-white/10 cursor-not-allowed"
            >
              <span className="material-symbols-outlined">chat</span>
              <span className="font-black uppercase tracking-widest italic">WhatsApp (Location Unavailable)</span>
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer Footer */}
      <div className="px-6 pb-8 text-center space-y-4">
        <p className="text-[10px] text-red-200/60 font-medium leading-relaxed max-w-[280px] mx-auto">
          BicaDriver does not have a live dispatch service. If you are in immediate physical danger, always contact the national emergency number (112) or the nearest police station.
        </p>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-[9px] font-black text-red-200/40 uppercase tracking-widest mb-1">Police</p>
            <p className="text-lg font-black text-white italic">112</p>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="text-center">
            <p className="text-[9px] font-black text-red-200/40 uppercase tracking-widest mb-1">Ambulance</p>
            <p className="text-lg font-black text-white italic">199</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyHelpSheet;
