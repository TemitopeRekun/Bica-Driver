
import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/services/GoogleMapsLoader';

interface InteractiveMapProps {
  center?: [number, number]; // [lat, lng]
  zoom?: number;
  markers?: Array<{
    id: string;
    position: [number, number]; // [lat, lng]
    title: string;
    icon?: 'user' | 'taxi' | 'destination' | 'pickup' | 'smart' | 'nearby';
    draggable?: boolean;
    accuracy?: number;
  }>;
  onMarkerDragEnd?: (id: string, newPos: [number, number]) => void;
  onMapLoad?: (map: any) => void;
  className?: string;
}

type InteractiveMarker = NonNullable<InteractiveMapProps['markers']>[number];

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  center = [6.5244, 3.3792],
  zoom = 13,
  markers = [],
  onMarkerDragEnd,
  onMapLoad,
  className = '',
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const circlesRef = useRef<Record<string, any>>({});
  const markerEventsRef = useRef<Record<string, any>>({});
  const onMarkerDragEndRef = useRef(onMarkerDragEnd);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const toLatLngLiteral = ([lat, lng]: [number, number]) => ({ lat, lng });

  const clearMarker = (id: string) => {
    markersRef.current[id]?.setMap(null);
    delete markersRef.current[id];

    circlesRef.current[id]?.setMap(null);
    delete circlesRef.current[id];

    markerEventsRef.current[id]?.remove?.();
    delete markerEventsRef.current[id];
  };

  const clearAllMapObjects = () => {
    Object.keys(markersRef.current).forEach((id) => clearMarker(id));
  };

  const createSvgDataUrl = (svg: string) =>
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

  const getMarkerIcon = (icon?: InteractiveMarker['icon']) => {
    if (!window.google?.maps) return undefined;

    switch (icon) {
      case 'pickup':
        return {
          url: createSvgDataUrl(
            '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><path fill="#f17606" d="M21 2C13.82 2 8 7.82 8 15c0 10.5 13 25 13 25s13-14.5 13-25C34 7.82 28.18 2 21 2Z"/><circle cx="21" cy="15" r="5.5" fill="#fff"/></svg>',
          ),
          scaledSize: new window.google.maps.Size(42, 42),
          anchor: new window.google.maps.Point(21, 40),
        };
      case 'destination':
        return {
          url: createSvgDataUrl(
            '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><path fill="#045828" d="M21 2C13.82 2 8 7.82 8 15c0 10.5 13 25 13 25s13-14.5 13-25C34 7.82 28.18 2 21 2Z"/><path fill="#fff" d="M18 10h8l-2 4h5v2h-5l2 4h-8z"/></svg>',
          ),
          scaledSize: new window.google.maps.Size(42, 42),
          anchor: new window.google.maps.Point(21, 40),
        };
      case 'nearby':
        return {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: '#ffffff',
          fillOpacity: 0.95,
          strokeColor: '#94a3b8',
          strokeOpacity: 1,
          strokeWeight: 1,
        };
      case 'user':
        return {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#f17606',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeOpacity: 1,
          strokeWeight: 2,
        };
      case 'taxi':
      default:
        return {
          url: createSvgDataUrl(
            '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#0f172a" stroke-width="2"/><path fill="#0f172a" d="M12 23.5V18a2 2 0 0 1 2-2h1.2l1.2-3.1A2 2 0 0 1 18.27 11h3.46a2 2 0 0 1 1.87 1.29L24.8 16H26a2 2 0 0 1 2 2v5.5h-1.5a2.5 2.5 0 0 1-5 0h-3a2.5 2.5 0 0 1-5 0Zm4.35-8.5h7.3l-.95-2.47a.5.5 0 0 0-.47-.33h-4.46a.5.5 0 0 0-.47.33Zm-.85 4.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm9 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"/></svg>',
          ),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20),
        };
    }
  };

  const getMarkerZIndex = (icon?: InteractiveMarker['icon']) => {
    if (icon === 'pickup' || icon === 'destination') {
      return 20;
    }

    if (icon === 'taxi') {
      return 15;
    }

    return 10;
  };

  useEffect(() => {
    onMarkerDragEndRef.current = onMarkerDragEnd;
  }, [onMarkerDragEnd]);

  useEffect(() => {
    let isCancelled = false;

    const initializeMap = async () => {
      if (!mapContainer.current || map.current) return;

      setIsLoading(true);
      setLoadError(null);

      try {
        const googleMaps = await loadGoogleMaps();
        const [coreLibrary, mapsLibrary] = await Promise.all([
          googleMaps.importLibrary('core'),
          googleMaps.importLibrary('maps'),
        ]);

        if (isCancelled || !mapContainer.current) return;

        map.current = new mapsLibrary.Map(mapContainer.current, {
          center: toLatLngLiteral(center as [number, number]),
          zoom,
          mapTypeId: 'roadmap',
          colorScheme: coreLibrary.ColorScheme.DARK,
          disableDefaultUI: true,
          clickableIcons: false,
          keyboardShortcuts: false,
          gestureHandling: 'greedy',
          tilt: 0,
          backgroundColor: '#101622',
        });

        setMapReady(true);
        onMapLoad?.(map.current);
      } catch (error: any) {
        if (!isCancelled) {
          setLoadError(error?.message || 'Google Maps could not be loaded.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    initializeMap();

    return () => {
      isCancelled = true;
      clearAllMapObjects();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !map.current) return;

    map.current.panTo(toLatLngLiteral(center as [number, number]));

    if (typeof zoom === 'number' && map.current.getZoom() !== zoom) {
      map.current.setZoom(zoom);
    }
  }, [center[0], center[1], zoom, mapReady]);

  useEffect(() => {
    if (!mapReady || !map.current || !window.google?.maps) return;

    const nextMarkerIds = new Set(markers.map((marker) => marker.id));

    Object.keys(markersRef.current).forEach((id) => {
      if (!nextMarkerIds.has(id)) {
        clearMarker(id);
      }
    });

    markers.forEach((marker) => {
      const { id, position, title, icon, draggable, accuracy } = marker;
      const latLng = toLatLngLiteral(position);
      const existingMarker = markersRef.current[id];

      if (existingMarker) {
        existingMarker.setPosition(latLng);
        existingMarker.setTitle(title);
        existingMarker.setDraggable(Boolean(draggable));
        existingMarker.setIcon(getMarkerIcon(icon));
        existingMarker.setZIndex(getMarkerZIndex(icon));

        if (draggable && !markerEventsRef.current[id]) {
          markerEventsRef.current[id] = existingMarker.addListener('dragend', (event: any) => {
            const latitude = event.latLng?.lat?.();
            const longitude = event.latLng?.lng?.();
            if (
              typeof latitude === 'number' &&
              typeof longitude === 'number' &&
              onMarkerDragEndRef.current
            ) {
              onMarkerDragEndRef.current(id, [latitude, longitude]);
            }
          });
        } else if (!draggable && markerEventsRef.current[id]) {
          markerEventsRef.current[id].remove?.();
          delete markerEventsRef.current[id];
        }
      } else {
        const nextMarker = new window.google.maps.Marker({
          map: map.current,
          position: latLng,
          title,
          draggable: Boolean(draggable),
          icon: getMarkerIcon(icon),
          zIndex: getMarkerZIndex(icon),
          optimized: true,
        });

        if (draggable) {
          markerEventsRef.current[id] = nextMarker.addListener('dragend', (event: any) => {
            const latitude = event.latLng?.lat?.();
            const longitude = event.latLng?.lng?.();
            if (
              typeof latitude === 'number' &&
              typeof longitude === 'number' &&
              onMarkerDragEndRef.current
            ) {
              onMarkerDragEndRef.current(id, [latitude, longitude]);
            }
          });
        }

        markersRef.current[id] = nextMarker;
      }

      if (accuracy && accuracy > 0) {
        const existingCircle = circlesRef.current[id];
        if (existingCircle) {
          existingCircle.setCenter(latLng);
          existingCircle.setRadius(accuracy);
        } else {
          circlesRef.current[id] = new window.google.maps.Circle({
            map: map.current,
            center: latLng,
            radius: accuracy,
            strokeColor: '#f17606',
            strokeOpacity: 0.7,
            strokeWeight: 1,
            fillColor: '#f17606',
            fillOpacity: 0.15,
          });
        }
      } else if (circlesRef.current[id]) {
        circlesRef.current[id].setMap(null);
        delete circlesRef.current[id];
      }
    });
  }, [markers, mapReady]);

  return (
    <div className={`w-full h-full relative overflow-hidden bg-[#101622] ${className}`}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full z-0" />
      {(isLoading || loadError) && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50 px-6 text-center">
          {loadError ? (
            <div className="max-w-xs">
              <p className="font-bold">Google Maps unavailable</p>
              <p className="text-sm text-slate-300 mt-2">{loadError}</p>
            </div>
          ) : (
            <>
              <span className="material-symbols-outlined animate-spin mr-2">refresh</span>
              Loading Map...
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
