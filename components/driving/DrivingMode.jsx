import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, AlertTriangle, CheckCircle2, 
  ExternalLink, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { checkRouteFlooding } from '@/components/routes/courseUtils';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';
mapboxgl.accessToken = MAPBOX_TOKEN;

const OFF_ROUTE_THRESHOLD_METERS = 80;

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getMinDistanceToRoute(userLat, userLng, coords) {
  let min = Infinity;
  for (const c of coords) {
    const d = getDistanceMeters(userLat, userLng, c.lat, c.lng);
    if (d < min) min = d;
  }
  return min;
}



function formatDuration(mins) {
  if (!mins) return '—';
  if (mins >= 60) return `${Math.floor(mins/60)}h ${mins%60}m`;
  return `${Math.round(mins)} min`;
}

function formatDist(miles) {
  if (!miles) return '—';
  return `${miles.toFixed(1)} mi`;
}

export default function DrivingMode({ route, course, sensors, onClose, locationEnabled = true }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRef = useRef(null);
  const routeMarkerRefs = useRef([]);

  const [userPos, setUserPos] = useState(null);
  const [speedMph, setSpeedMph] = useState(0);
  const [offRoute, setOffRoute] = useState(false);
  const [offRouteAnnounced, setOffRouteAnnounced] = useState(false);
  const [toast, setToast] = useState(null);

  const watchIdRef = useRef(null);
  const prevPosRef = useRef(null);
  const prevTimeRef = useRef(null);

  const floodingSensors = route ? checkRouteFlooding(route, sensors) : [];
  const isClear = floodingSensors.length === 0;
  const hasAlert = floodingSensors.some(s => s.status === 'ALERT');

  const showToast = useCallback((msg, color = 'blue') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 4000);
  }, []);



  // Open in native maps
  const openInMaps = () => {
    if (!route?.coordinates?.length) return;
    const start = route.coordinates[0];
    const end = route.coordinates[route.coordinates.length - 1];
    const url = `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // GPS tracking
  useEffect(() => {
    if (!navigator.geolocation || !locationEnabled) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed } = pos.coords;
        const now = Date.now();

        // Speed calc (m/s → mph), fallback to GPS speed
        let mph = speed != null ? speed * 2.237 : 0;
        if (prevPosRef.current && prevTimeRef.current) {
          const dist = getDistanceMeters(lat, lng, prevPosRef.current[0], prevPosRef.current[1]);
          const dt = (now - prevTimeRef.current) / 1000;
          if (dt > 0) mph = Math.max(mph, (dist / dt) * 2.237);
        }
        prevPosRef.current = [lat, lng];
        prevTimeRef.current = now;
        setSpeedMph(Math.round(mph));
        setUserPos({ lat, lng });

        // Off-route detection
        if (route?.coordinates?.length) {
          const dist = getMinDistanceToRoute(lat, lng, route.coordinates);
          const isOff = dist > OFF_ROUTE_THRESHOLD_METERS;
          setOffRoute(isOff);
          if (isOff && !offRouteAnnounced) {
            setOffRouteAnnounced(true);
          } else if (!isOff && offRouteAnnounced) {
            setOffRouteAnnounced(false);
          }
        }

        // Move map marker
        if (map.current && markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
          map.current.panTo([lng, lat], { duration: 800 });
        }
      },
      null,
      { enableHighAccuracy: true, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchIdRef.current);
  }, [route, offRouteAnnounced]);

  // Init map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const center = route?.coordinates?.[0]
      ? [route.coordinates[0].lng, route.coordinates[0].lat]
      : [-80.1392, 25.9565];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom: 15,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.current.touchZoomRotate.disableRotation();

    map.current.once('load', () => {
      if (!route?.coordinates?.length) return;
      const coords = route.coordinates.map(c => [c.lng, c.lat]);
      const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
      const color = isClear ? '#3b82f6' : '#f87171';
      const glow = isClear ? '#1d4ed8' : '#991b1b';

      map.current.addSource('dm-glow', { type: 'geojson', data: geojson });
      map.current.addLayer({ id: 'dm-glow', type: 'line', source: 'dm-glow',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': glow, 'line-width': 14, 'line-opacity': 0.3 }
      });
      map.current.addSource('dm-route', { type: 'geojson', data: geojson });
      map.current.addLayer({ id: 'dm-route', type: 'line', source: 'dm-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': color, 'line-width': 6, 'line-opacity': 1 }
      });

      // Start/end pins
      const mkEl = (bg) => {
        const el = document.createElement('div');
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${bg};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);`;
        return el;
      };
      routeMarkerRefs.current.push(new mapboxgl.Marker({ element: mkEl('#34d399') }).setLngLat(coords[0]).addTo(map.current));
      routeMarkerRefs.current.push(new mapboxgl.Marker({ element: mkEl('#f87171') }).setLngLat(coords[coords.length-1]).addTo(map.current));

      // User location marker
      const userEl = document.createElement('div');
      userEl.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.7);';
      markerRef.current = new mapboxgl.Marker({ element: userEl }).setLngLat(center).addTo(map.current);

      const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
      map.current.fitBounds(bounds, { padding: 120, maxZoom: 15, duration: 1000 });
    });

    return () => { 
      routeMarkerRefs.current.forEach(m => m.remove());
      map.current?.remove(); 
      map.current = null; 
    };
  }, []);





  const totalMins = (route?.durationMinutes || 0) + (route?.trafficPenaltyMinutes || 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#050810] flex flex-col"
    >
      <style>{`
        .dm-map .mapboxgl-ctrl-bottom-right { display: none; }
        .dm-map .mapboxgl-ctrl-bottom-left { display: none; }
        .mapboxgl-ctrl-logo { display: none !important; }
        .mapboxgl-ctrl-attrib { display: none !important; }
      `}</style>

      {/* MAP — full screen background */}
      <div className="dm-map absolute inset-0" ref={mapContainer} />

      {/* ── TOP HUD ── */}
      <div className="relative z-10 flex items-start justify-between px-4 pt-12 pb-2 pointer-events-none">
        {/* Speed */}
        <div className="bg-black/70 backdrop-blur-xl rounded-2xl px-4 py-3 text-center min-w-[72px] pointer-events-auto">
          <div className="text-3xl font-bold text-white leading-none">{speedMph}</div>
          <div className="text-xs text-gray-400 mt-0.5">mph</div>
        </div>

        {/* Flood status badge */}
        <div className={cn(
          "backdrop-blur-xl rounded-2xl px-4 py-3 flex items-center gap-2 pointer-events-auto",
          isClear ? "bg-emerald-500/25 border border-emerald-500/40" 
                  : hasAlert ? "bg-red-500/25 border border-red-500/40" 
                  : "bg-amber-500/25 border border-amber-500/40"
        )}>
          {isClear 
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <AlertTriangle className={cn("w-5 h-5", hasAlert ? "text-red-400" : "text-amber-400")} />
          }
          <span className={cn("font-semibold text-sm", isClear ? "text-emerald-400" : hasAlert ? "text-red-400" : "text-amber-400")}>
            {isClear ? 'Route Clear' : hasAlert ? `⚠ ${floodingSensors.length} Alert${floodingSensors.length>1?'s':''}` : `${floodingSensors.length} Warning${floodingSensors.length>1?'s':''}`}
          </span>
        </div>

        {/* Close */}
        <button 
          onClick={onClose}
          className="bg-black/70 backdrop-blur-xl rounded-2xl p-3 pointer-events-auto"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Off-route banner */}
      <AnimatePresence>
        {offRoute && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative z-10 mx-4 mt-2"
          >
            <div className="bg-amber-500/30 border border-amber-500/50 backdrop-blur-xl rounded-2xl px-4 py-3 flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '2s' }} />
              <div>
                <p className="text-amber-300 font-semibold text-sm">Off Route</p>
                <p className="text-amber-400/70 text-xs">Recalculating…</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.msg}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative z-10 mx-4 mt-2"
          >
            <div className="bg-black/70 backdrop-blur-xl rounded-2xl px-4 py-3 text-center">
              <p className="text-white text-sm">{toast.msg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── BOTTOM PANEL ── */}
      <div className="relative z-10 px-4 pb-8 space-y-3">
        {/* Route info bar */}
        <div className="bg-black/75 backdrop-blur-xl rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Destination</p>
            <p className="text-white font-semibold text-sm mt-0.5 truncate max-w-[180px]">
              {course?.endAddress?.split(',')[0] || 'End Point'}
            </p>
          </div>
          <div className="flex items-center gap-5 text-right">
            <div>
              <p className="text-xs text-gray-500">Distance</p>
              <p className="text-white font-semibold text-sm">{formatDist(route?.distanceMiles)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ETA</p>
              <p className="text-white font-semibold text-sm">{formatDuration(totalMins)}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <button
          onClick={openInMaps}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-blue-500/30 bg-blue-500/15 active:scale-95"
        >
          <ExternalLink className="w-5 h-5 text-blue-400" />
          <span className="text-sm text-blue-400 font-semibold">Open in Google Maps</span>
        </button>
      </div>
    </motion.div>
  );
}