import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { entities } from '@/api/firestoreService';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Navigation } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapHeader from '@/components/map/MapHeader';
import MapLegend from '@/components/map/MapLegend';
import BottomNav from '@/components/ui/BottomNav';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';
mapboxgl.accessToken = MAPBOX_TOKEN;

const getStatusColor = (status) => {
  switch (status) {
    case 'OK':    return '#34d399';
    case 'WARN':  return '#fbbf24';
    case 'ALERT': return '#f87171';
    default:      return '#9ca3af';
  }
};

export default function MapPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const locationMarkersRef = useRef([]);
  const geolocateRef = useRef(null);
  const userDotRef = useRef(null);
  const [cityName, setCityName] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const popupRef = useRef(null);
  const [liveRadiusUpdates, setLiveRadiusUpdates] = useState({});
  const userCoordsRef = useRef(null);

  const handleLocateMe = () => {
    if (!map.current || !mapReady || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      if (!map.current) return;
      const { longitude, latitude } = pos.coords;
      map.current.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000 });
    }, () => {}, { timeout: 6000 });
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
    });
    map.current.touchZoomRotate.disableRotation();
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.current.on('load', () => {
      setMapReady(true);
    });

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

      map.current.flyTo({ center: [longitude, latitude], zoom: 14, duration: 1200 });

      // Reverse geocode for city name
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`)
        .then(r => r.json())
        .then(data => {
          const place = data.features?.find(f => f.place_type.includes('place'));
          setCityName(place?.text || '');
        })
        .catch(() => {});

      // User dot — remove old one first then recreate
      userDotRef.current?.remove();
      const el = document.createElement('div');
      el.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 10px rgba(59,130,246,0.6);';
      userDotRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    }, () => {}, { timeout: 6000 });
  }, [locationEnabled, mapReady]);

  const makeCircleCoords = (lat, lng, radiusM) => {
    const points = 64;
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

      // ── Remove old location circle layers ──
      for (let i = 0; i < 100; i++) {
        const fillId = `wl-fill-${i}`;
        const strokeId = `wl-stroke-${i}`;
        const srcId = `wl-src-${i}`;
        if (m.getLayer(strokeId)) m.removeLayer(strokeId);
        if (m.getLayer(fillId)) m.removeLayer(fillId);
        if (m.getSource(srcId)) m.removeSource(srcId);
      }

      // ── Remove old sensor layers ──
      for (let i = 0; i < 100; i++) {
        const fillId = `sc-fill-${i}`;
        const strokeId = `sc-stroke-${i}`;
        const srcId = `sc-src-${i}`;
        if (m.getLayer(strokeId)) m.removeLayer(strokeId);
        if (m.getLayer(fillId)) m.removeLayer(fillId);
        if (m.getSource(srcId)) m.removeSource(srcId);
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

      // ── Draw sensor circles + dot markers ──
      const SENSOR_RADIUS_M = 50;
      sensors.forEach((sensor, i) => {
        const color = getStatusColor(sensor.status);
        const depthAlpha = Math.min(0.15 + (sensor.waterLevelCm / 100) * 0.45, 0.6);
        const srcId = `sc-src-${i}`;
        const fillId = `sc-fill-${i}`;
        const strokeId = `sc-stroke-${i}`;

        const fillColor = sensor.status === 'ALERT' ? '#ef4444' : sensor.status === 'WARN' ? '#f59e0b' : '#3b82f6';
        const strokeColor = sensor.status === 'ALERT' ? '#dc2626' : sensor.status === 'WARN' ? '#d97706' : '#2563eb';
        m.addSource(srcId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [makeCircleCoords(sensor.lat, sensor.lng, SENSOR_RADIUS_M)] } },
        });
        m.addLayer({ id: fillId, type: 'fill', source: srcId, paint: { 'fill-color': fillColor, 'fill-opacity': depthAlpha } });
        m.addLayer({ id: strokeId, type: 'line', source: srcId, paint: { 'line-color': strokeColor, 'line-width': 2, 'line-opacity': 1, 'line-dasharray': sensor.status === 'OK' ? [1] : [2, 1.5] } });

        const size = sensor.status === 'ALERT' ? 24 : 20;
        const el = document.createElement('div');
        el.style.cssText = `position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px ${color}80, 0 0 20px ${color}40;cursor:pointer;transition:transform 0.2s;`;
        // White inner dot
        const inner = document.createElement('div');
        inner.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;border-radius:50%;background:white;';
        el.appendChild(inner);
        // Pulsing ring for ALERT/WARN sensors
        if (sensor.status !== 'OK') {
          const pulse = document.createElement('div');
          pulse.style.cssText = `position:absolute;inset:-8px;border-radius:50%;border:2px solid ${color};animation:sensorPulse ${sensor.status === 'ALERT' ? '1.2s' : '2s'} ease-out infinite;pointer-events:none;`;
          el.appendChild(pulse);
        }
        const mk = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([sensor.lng, sensor.lat])
          .addTo(m);

        el.addEventListener('click', () => {
          popupRef.current?.remove();
          const lastSeen = sensor.lastSeen ? new Date(sensor.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
          const battPct = sensor.batteryV ? Math.min(100, Math.max(0, Math.round(((sensor.batteryV - 3.0) / (4.2 - 3.0)) * 100))) : null;
          const battColor = battPct !== null ? (battPct <= 20 ? '#f87171' : battPct <= 40 ? '#fbbf24' : '#34d399') : '#6b7280';
          const waterPct = Math.min(100, Math.round((sensor.waterLevelCm / 100) * 100));
          const statusLabel = sensor.status === 'OK' ? '✓ Clear' : sensor.status === 'WARN' ? '⚠ Warning' : '🚨 Flooding';
          const statusBg = sensor.status === 'ALERT' ? 'rgba(239,68,68,0.15)' : sensor.status === 'WARN' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';
          popupRef.current = new mapboxgl.Popup({ closeButton: true, offset: 14, className: 'sensor-popup' })
            .setLngLat([sensor.lng, sensor.lat])
            .setHTML(`
              <div style="background:linear-gradient(180deg,#1a1f35,#151a2e);border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;min-width:240px;color:white;font-family:Inter,system-ui,sans-serif;">
                <div style="height:4px;background:${color};"></div>
                <div style="padding:14px 16px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                    <span style="font-weight:700;font-size:16px;">${sensor.name}</span>
                    <span style="font-size:11px;font-weight:700;color:${color};padding:4px 10px;border-radius:10px;background:${statusBg};">${statusLabel}</span>
                  </div>
                  <div style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                      <span style="color:#9ca3af;font-size:12px;">Water level</span>
                      <span style="font-size:13px;font-weight:700;">${sensor.waterLevelCm} cm</span>
                    </div>
                    <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
                      <div style="height:100%;width:${waterPct}%;background:${color};border-radius:3px;transition:width 0.3s;"></div>
                    </div>
                  </div>
                  <div style="display:flex;gap:12px;">
                    ${battPct !== null ? `<div style="flex:1;">
                      <span style="color:#9ca3af;font-size:11px;display:block;">Battery</span>
                      <span style="font-size:13px;font-weight:600;color:${battColor};">${battPct}%</span>
                    </div>` : ''}
                    <div style="flex:1;">
                      <span style="color:#9ca3af;font-size:11px;display:block;">Last seen</span>
                      <span style="font-size:13px;color:#9ca3af;">${lastSeen}</span>
                    </div>
                  </div>
                </div>
              </div>
            `)
            .addTo(m);
        });

        markersRef.current.push(mk);
      });
    };

    if (map.current.isStyleLoaded()) drawAll();
    else map.current.once('style.load', drawAll);

  }, [mapReady, sensors, watchedLocations, liveRadiusUpdates]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0c1021]">
      <style>{`
        .mapboxgl-popup-content { background:transparent!important;padding:0!important;box-shadow:none!important; }
        .mapboxgl-popup-tip { display:none!important; }
        .mapboxgl-ctrl-bottom-right { bottom:calc(env(safe-area-inset-bottom, 0px) + 160px)!important; right:12px!important; }
        .mapboxgl-ctrl-group { background:white!important;border:none!important;box-shadow:0 2px 8px rgba(0,0,0,0.15)!important; }
        .mapboxgl-ctrl-logo { display:none!important; }
        .mapboxgl-ctrl-attrib { display:none!important; }
        @keyframes sensorPulse { 0%{transform:scale(0.8);opacity:0.6;} 100%{transform:scale(1.8);opacity:0;} }
      `}</style>

      {isLoading && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
          <div className="flex items-center gap-2 bg-[#0c1021]/90 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-gray-400 text-xs">Loading sensors…</span>
          </div>
        </div>
      )}

      {isError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
          <div className="flex items-center gap-2 bg-red-500/10 backdrop-blur-sm px-4 py-2 rounded-full border border-red-500/20">
            <span className="text-red-400 text-xs">Could not load sensors</span>
          </div>
        </div>
      )}

      <MapHeader sensors={sensors} cityName={cityName} />
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Locate Me button — sits above the zoom controls */}
      {locationEnabled && (
        <button
          onClick={handleLocateMe}
          className="absolute z-[1000] bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all w-9 h-9 right-3"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 220px)' }}
          title="Go to my location"
        >
          <Navigation className="w-4 h-4 text-blue-600" />
        </button>
      )}

      <MapLegend />
      {/* Bottom gradient overlay anchoring controls */}
      <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-[#0c1021]/70 to-transparent pointer-events-none z-[99]" />
      <BottomNav />
    </div>
  );
}