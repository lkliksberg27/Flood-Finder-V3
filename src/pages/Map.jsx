import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { entities } from '@/api/firestoreService';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Navigation, Plus, Minus } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapHeader from '@/components/map/MapHeader';
import MapLegend from '@/components/map/MapLegend';
import BottomNav from '@/components/ui/BottomNav';
import { getWaterBlue } from '@/utils';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function MapPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const locationMarkersRef = useRef([]);
  const geolocateRef = useRef(null);
  const userDotRef = useRef(null);
  const [cityName, setCityName] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const popupRef = useRef(null);
  const [liveRadiusUpdates, setLiveRadiusUpdates] = useState({});
  const userCoordsRef = useRef(null);

  const handleLocateMe = () => {
    if (!map.current || !mapReady || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      if (!map.current) return;
      const { longitude, latitude } = pos.coords;
      map.current.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000 });
    }, (err) => {
      console.warn('Locate me failed:', err?.message);
    }, { timeout: 6000 });
  };

  const { data: sensors = [], isLoading, isError } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => entities.Sensor.list(),
    refetchInterval: 30000,
  });

  const { data: watchedLocations = [], refetch: refetchLocations } = useQuery({
    queryKey: ['watchedLocations'],
    queryFn: () => entities.WatchedLocation.list(),
    refetchInterval: 60000,
  });

  // Live-sync watched location radius changes in real-time
  useEffect(() => {
    const unsub = entities.WatchedLocation.subscribe((event) => {
      if (event.type === 'update') {
        // Immediately update liveRadiusUpdates so circle redraws without waiting for refetch
        if (event.data?.alertRadiusMeters) {
          setLiveRadiusUpdates(prev => ({ ...prev, [event.id]: event.data.alertRadiusMeters }));
        }
      }
      refetchLocations();
    });
    return () => unsub();
  }, [refetchLocations]);

  const { data: settingsList = [], isSuccess: settingsLoaded } = useQuery({
    queryKey: ['settings'],
    queryFn: () => entities.Settings.list(),
    refetchInterval: 10000,
  });
  const locationEnabled = settingsList[0]?.locationEnabled ?? true;
  const detectionRadius = settingsList[0]?.alertRadiusMeters ?? 300;

  // Initialize map immediately
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-80.1223, 25.9651],
        zoom: 13,
        projection: 'mercator',
        attributionControl: false,
        logoPosition: 'bottom-left',
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        failIfMajorPerformanceCaveat: false,
        maxTileCacheSize: 50,
      });
      map.current.touchZoomRotate.disableRotation();

      map.current.on('load', () => {
        setMapReady(true);
        requestAnimationFrame(() => map.current?.resize());
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError(e.error?.message || 'Map failed to load');
      });
    } catch (e) {
      console.error('Map init failed:', e);
      setMapError(e.message);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Center on user + show city name + user dot — only when locationEnabled
  useEffect(() => {
    if (!mapReady) return;

    // Remove dot if location was disabled
    if (!locationEnabled) {
      userDotRef.current?.remove();
      userDotRef.current = null;
      setCityName('');
      return;
    }

    // Hard gate: never call geolocation unless setting is on
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((pos) => {
      if (!map.current) return;
      const { longitude, latitude } = pos.coords;
      userCoordsRef.current = { lat: latitude, lng: longitude };

      map.current.flyTo({ center: [longitude, latitude], zoom: 14, duration: 1200 });

      // Reverse geocode for city name
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`)
        .then(r => r.json())
        .then(data => {
          const place = data.features?.find(f => f.place_type.includes('place'));
          setCityName(place?.text || '');
        })
        .catch((err) => {
          console.error('Reverse geocode failed:', err);
        });

      // User dot — remove old one first then recreate
      userDotRef.current?.remove();
      const el = document.createElement('div');
      el.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 10px rgba(59,130,246,0.6);';
      userDotRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    }, (err) => {
      console.warn('Geolocation denied or failed:', err?.message);
    }, { timeout: 6000 });
  }, [locationEnabled, mapReady]);

  const makeCircleCoords = (lat, lng, radiusM) => {
    const points = 32;
    const earthR = 6371000;
    const d = radiusM / earthR;
    const latR = lat * Math.PI / 180;
    const lngR = lng * Math.PI / 180;
    const coords = [];
    for (let i = 0; i <= points; i++) {
      const bearing = (i / points) * 2 * Math.PI;
      const pLat = Math.asin(Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(bearing));
      const pLng = lngR + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(latR), Math.cos(d) - Math.sin(latR) * Math.sin(pLat));
      coords.push([pLng * 180 / Math.PI, pLat * 180 / Math.PI]);
    }
    return coords;
  };

  // Single effect that draws EVERYTHING once map is ready, and redraws on data changes
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const drawAll = () => {
      const m = map.current;
      if (!m) return;

      // ── Remove old location markers ──
      locationMarkersRef.current.forEach(mk => mk.remove());
      locationMarkersRef.current = [];

      // ── Remove old location circle layers (only up to actual count) ──
      const prevWlCount = locationMarkersRef.current.length || watchedLocations.length;
      for (let i = 0; i < prevWlCount + 5; i++) {
        try {
          if (m.getLayer(`wl-stroke-${i}`)) m.removeLayer(`wl-stroke-${i}`);
          if (m.getLayer(`wl-fill-${i}`)) m.removeLayer(`wl-fill-${i}`);
          if (m.getSource(`wl-src-${i}`)) m.removeSource(`wl-src-${i}`);
        } catch {}
      }

      // ── Remove old sensor dot markers ──
      markersRef.current.forEach(mk => mk.remove());
      markersRef.current = [];

      // ── Draw watched location circles ──
      watchedLocations.forEach((loc, i) => {
        const srcId = `wl-src-${i}`;
        const fillId = `wl-fill-${i}`;
        const strokeId = `wl-stroke-${i}`;
        const radius = liveRadiusUpdates[loc.id] ?? loc.alertRadiusMeters ?? 500;
        const circleData = {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [makeCircleCoords(loc.lat, loc.lng, radius)] },
        };
        m.addSource(srcId, { type: 'geojson', data: circleData });
        m.addLayer({ id: fillId, type: 'fill', source: srcId, paint: { 'fill-color': '#4285f4', 'fill-opacity': 0.08 } });
        m.addLayer({ id: strokeId, type: 'line', source: srcId, paint: { 'line-color': '#4285f4', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [4, 3] } });

        const el = document.createElement('div');
        el.style.cssText = `width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#4285f4;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer;`;
        const inner = document.createElement('div');
        inner.style.cssText = `width:8px;height:8px;border-radius:50%;background:white;margin:8px auto 0;`;
        el.appendChild(inner);
        const mk = new mapboxgl.Marker({ element: el, anchor: 'bottom-left' })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(new mapboxgl.Popup({ offset: 20, className: 'sensor-popup' }).setHTML(`
            <div style="background:#151a2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;min-width:180px;color:white;font-family:Inter,sans-serif;">
              <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${loc.name}</div>
              <div style="color:#6b7280;font-size:12px;margin-bottom:8px;">${loc.address}</div>
              <div style="font-size:12px;color:#4285f4;">📍 ${radius}m radius</div>
            </div>
          `))
          .addTo(m);
        locationMarkersRef.current.push(mk);
      });

      // ── Draw sensor dot markers with gradient glow ──
      sensors.forEach((sensor, i) => {
        const color = getWaterBlue(sensor.waterLevelCm);

        // Outer glow + inner dot
        const el = document.createElement('div');
        el.style.cssText = `width:36px;height:36px;position:relative;cursor:pointer;`;
        // Gradient glow
        const glow = document.createElement('div');
        glow.style.cssText = `position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,${color}55 0%,${color}00 70%);`;
        el.appendChild(glow);
        // Solid center dot
        const dot = document.createElement('div');
        dot.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);`;
        el.appendChild(dot);

        const mk = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([sensor.lng, sensor.lat])
          .addTo(m);

        el.addEventListener('click', () => {
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ closeButton: true, offset: 14, className: 'sensor-popup' })
            .setLngLat([sensor.lng, sensor.lat])
            .setHTML(`
              <div style="background:#151a2e;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden;min-width:160px;color:white;font-family:Inter,system-ui,sans-serif;text-align:center;padding:16px 20px;">
                <div style="font-weight:600;font-size:13px;color:#9ca3af;margin-bottom:8px;">${sensor.name}</div>
                <div style="font-size:40px;font-weight:800;color:${color};line-height:1;">${sensor.waterLevelCm}</div>
                <div style="font-size:13px;color:#6b7280;margin-top:2px;">cm</div>
              </div>
            `)
            .addTo(m);
        });

        markersRef.current.push(mk);
      });
    };

    if (map.current && map.current.isStyleLoaded()) drawAll();
    else if (map.current) map.current.once('style.load', drawAll);

  }, [mapReady, sensors, watchedLocations, liveRadiusUpdates]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0c1021]">
      <style>{`
        .mapboxgl-popup-content { background:transparent!important;padding:0!important;box-shadow:none!important; }
        .mapboxgl-popup-tip { display:none!important; }
        .mapboxgl-ctrl-logo { display:none!important; }
        .mapboxgl-ctrl-attrib { display:none!important; }
      `}</style>

      {isLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
          <div className="flex items-center gap-2 bg-[#0c1021]/90 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-gray-400 text-xs">Loading sensors…</span>
          </div>
        </div>
      )}

      {isError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
          <div className="flex items-center gap-2 bg-red-500/10 backdrop-blur-sm px-4 py-2 rounded-full border border-red-500/20">
            <span className="text-red-400 text-xs">Could not load sensors</span>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute top-20 left-4 right-4 z-[9999] bg-red-900/90 border border-red-500 rounded-2xl p-4">
          <p className="text-red-300 text-xs font-bold mb-1">Map Error:</p>
          <p className="text-yellow-300 text-xs font-mono break-all">{mapError}</p>
        </div>
      )}

      <MapHeader sensors={sensors} cityName={cityName} />
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Map controls column */}
      <div
        className="absolute right-3 z-[1000] flex flex-col gap-2"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
      >
        {locationEnabled && (
          <button
            onClick={handleLocateMe}
            className="bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all w-9 h-9"
            title="Go to my location"
          >
            <Navigation className="w-4 h-4 text-blue-600" />
          </button>
        )}
        <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          <button
            onClick={() => map.current?.zoomIn()}
            className="flex items-center justify-center w-9 h-9 hover:bg-gray-50 active:scale-95 transition-all border-b border-gray-200"
            title="Zoom in"
          >
            <Plus className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            className="flex items-center justify-center w-9 h-9 hover:bg-gray-50 active:scale-95 transition-all"
            title="Zoom out"
          >
            <Minus className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>

      <MapLegend />
      <BottomNav />
    </div>
  );
}