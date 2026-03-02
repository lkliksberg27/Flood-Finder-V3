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
  const popupRef = useRef(null);
  const geolocateRef = useRef(null);
  const userDotRef = useRef(null);
  const [cityName, setCityName] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [liveRadiusUpdates, setLiveRadiusUpdates] = useState({});
  const userCoordsRef = useRef(null);

  const handleLocateMe = () => {
    if (!map.current || !mapReady || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      if (!map.current) return;
      const { longitude, latitude } = pos.coords;
      map.current.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000 });
    }, (err) => {
      // silently fail
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

    const abortController = new AbortController();

    navigator.geolocation.getCurrentPosition((pos) => {
      if (!map.current || abortController.signal.aborted) return;
      const { longitude, latitude } = pos.coords;
      userCoordsRef.current = { lat: latitude, lng: longitude };

      map.current.flyTo({ center: [longitude, latitude], zoom: 14, duration: 1200 });

      // Reverse geocode for city name (cancellable)
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`, { signal: abortController.signal })
        .then(r => r.json())
        .then(data => {
          const place = data.features?.find(f => f.place_type.includes('place'));
          setCityName(place?.text || '');
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
        });

      // User dot — remove old one first then recreate
      userDotRef.current?.remove();
      const el = document.createElement('div');
      el.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 10px rgba(59,130,246,0.6);';
      userDotRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    }, (err) => {
      // silently fail
    }, { timeout: 6000 });

    return () => { abortController.abort(); };
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

  // Single effect that draws EVERYTHING using native Mapbox layers (no DOM marker jiggle)
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const drawAll = () => {
      const m = map.current;
      if (!m) return;

      const SENSOR_RADIUS_MIN = 25;
      const SENSOR_RADIUS_MAX = 50;

      // ── Build GeoJSON for watched location radius circles ──
      const wlRadiusFeatures = watchedLocations.map((loc) => {
        const radius = liveRadiusUpdates[loc.id] ?? loc.alertRadiusMeters ?? 500;
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [makeCircleCoords(loc.lat, loc.lng, radius)] },
          properties: { radius },
        };
      });

      // ── Build GeoJSON for watched location pins ──
      const wlPinFeatures = watchedLocations.map((loc) => {
        const radius = liveRadiusUpdates[loc.id] ?? loc.alertRadiusMeters ?? 500;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
          properties: { name: loc.name, radius },
        };
      });

      // ── Build GeoJSON for sensor radius circles ──
      const scRadiusFeatures = sensors.map((sensor) => {
        const color = getWaterBlue(sensor.waterLevelCm);
        const depth = Math.min(1, Math.max(0, (sensor.waterLevelCm || 0) / 100));
        const radiusM = SENSOR_RADIUS_MIN + depth * (SENSOR_RADIUS_MAX - SENSOR_RADIUS_MIN);
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [makeCircleCoords(sensor.lat, sensor.lng, radiusM)] },
          properties: { color },
        };
      });

      // ── Build GeoJSON for sensor dots ──
      const scDotFeatures = sensors.map((sensor) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [sensor.lng, sensor.lat] },
        properties: { waterLevelCm: sensor.waterLevelCm ?? 0, color: getWaterBlue(sensor.waterLevelCm) },
      }));

      const wlRadiiFC = { type: 'FeatureCollection', features: wlRadiusFeatures };
      const wlPinsFC = { type: 'FeatureCollection', features: wlPinFeatures };
      const scRadiiFC = { type: 'FeatureCollection', features: scRadiusFeatures };
      const scDotsFC = { type: 'FeatureCollection', features: scDotFeatures };

      if (m.getSource('wl-radii')) {
        m.getSource('wl-radii').setData(wlRadiiFC);
        m.getSource('wl-pins').setData(wlPinsFC);
        m.getSource('sc-radii').setData(scRadiiFC);
        m.getSource('sc-dots').setData(scDotsFC);
      } else {
        // Watched location radius circles (dashed)
        m.addSource('wl-radii', { type: 'geojson', data: wlRadiiFC });
        m.addLayer({ id: 'wl-radii-fill', type: 'fill', source: 'wl-radii', paint: { 'fill-color': '#4285f4', 'fill-opacity': 0.08 } });
        m.addLayer({ id: 'wl-radii-stroke', type: 'line', source: 'wl-radii', paint: { 'line-color': '#4285f4', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [4, 3] } });

        // Watched location pins (native circle layer)
        m.addSource('wl-pins', { type: 'geojson', data: wlPinsFC });
        m.addLayer({
          id: 'wl-pins-layer', type: 'circle', source: 'wl-pins',
          paint: { 'circle-radius': 12, 'circle-color': '#4285f4', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' },
        });

        // Sensor radius circles
        m.addSource('sc-radii', { type: 'geojson', data: scRadiiFC });
        m.addLayer({ id: 'sc-radii-fill', type: 'fill', source: 'sc-radii', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 } });
        m.addLayer({ id: 'sc-radii-stroke', type: 'line', source: 'sc-radii', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.5 } });

        // Sensor dots (native circle layer)
        m.addSource('sc-dots', { type: 'geojson', data: scDotsFC });
        m.addLayer({
          id: 'sc-dots-layer', type: 'circle', source: 'sc-dots',
          paint: { 'circle-radius': 7, 'circle-color': '#1e3a8a', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
        });

        // Click handlers (set up once)
        m.on('click', 'sc-dots-layer', (e) => {
          if (!e.features?.length) return;
          const f = e.features[0];
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 10, className: 'sensor-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="background:#151a2e;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-family:Inter,system-ui,sans-serif;text-align:center;padding:6px 10px;white-space:nowrap;"><span style="font-weight:700;font-size:14px;color:${f.properties.color};">${f.properties.waterLevelCm}</span><span style="font-size:10px;color:#6b7280;margin-left:2px;">cm</span></div>`)
            .addTo(m);
        });
        m.on('click', 'wl-pins-layer', (e) => {
          if (!e.features?.length) return;
          const f = e.features[0];
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 16, className: 'sensor-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="background:#151a2e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;color:white;font-family:Inter,sans-serif;"><div style="font-weight:600;font-size:11px;">${f.properties.name}</div><div style="color:#6b7280;font-size:10px;">${f.properties.radius}m</div></div>`)
            .addTo(m);
        });
        m.on('mouseenter', 'sc-dots-layer', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'sc-dots-layer', () => { m.getCanvas().style.cursor = ''; });
        m.on('mouseenter', 'wl-pins-layer', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'wl-pins-layer', () => { m.getCanvas().style.cursor = ''; });
      }
    };

    if (map.current && map.current.isStyleLoaded()) drawAll();
    else if (map.current) map.current.once('style.load', drawAll);

  }, [mapReady, sensors, watchedLocations, liveRadiusUpdates]);

  return (
    <div className="relative w-full overflow-hidden bg-[#0c1021]" style={{ height: '100dvh' }}>
      <style>{`
        .mapboxgl-popup-content { background:transparent!important;padding:0!important;box-shadow:none!important; }
        .mapboxgl-popup-close-button { color:#6b7280!important;font-size:14px!important;right:4px!important;top:2px!important;padding:0!important;line-height:1!important; }
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
            aria-label="Go to my location"
          >
            <Navigation className="w-4 h-4 text-blue-600" />
          </button>
        )}
        <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          <button
            onClick={() => map.current?.zoomIn()}
            className="flex items-center justify-center w-9 h-9 hover:bg-gray-50 active:scale-95 transition-all border-b border-gray-200"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            className="flex items-center justify-center w-9 h-9 hover:bg-gray-50 active:scale-95 transition-all"
            title="Zoom out"
            aria-label="Zoom out"
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