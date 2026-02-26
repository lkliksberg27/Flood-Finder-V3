import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { checkRouteFlooding, fetchAvoidanceRoute } from './courseUtils';
import { AlertTriangle, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getWaterBlue } from '@/utils';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function RoutesMap({ selectedRoute, sensors, course, locationEnabled = true }) {
   const mapContainer = useRef(null);
   const map = useRef(null);
   const sensorMarkerRefs = useRef([]);
   const routeMarkerRefs = useRef([]);
   const userMarkerRef = useRef(null);
   const [userLocation, setUserLocation] = useState(null);
   const [avoidanceRoute, setAvoidanceRoute] = useState(null);
   const [loadingAvoidance, setLoadingAvoidance] = useState(false);

  const floodingSensors = selectedRoute
    ? checkRouteFlooding(selectedRoute, sensors)
    : [];

  const displayRoute = avoidanceRoute || selectedRoute;
  const avoidanceFlood = avoidanceRoute ? checkRouteFlooding(avoidanceRoute, sensors) : null;
  const hasAlert = floodingSensors.some(s => s.status === 'ALERT');
  const isClear = floodingSensors.length === 0;
  const routeColor = avoidanceRoute ? '#34d399' : (isClear ? '#3b82f6' : '#f87171');
  const glowColor = avoidanceRoute ? '#065f46' : (isClear ? '#1d4ed8' : '#991b1b');

  // Reset avoidance when route changes
  useEffect(() => { setAvoidanceRoute(null); }, [selectedRoute]);

  const handleFindAvoidance = async () => {
    if (!course || !floodingSensors.length) return;
    setLoadingAvoidance(true);
    const alt = await fetchAvoidanceRoute(
      course.startLat, course.startLng,
      course.endLat, course.endLng,
      floodingSensors
    );
    setAvoidanceRoute(alt);
    setLoadingAvoidance(false);
  };

  const startPoint = course ? { lat: course.startLat, lng: course.startLng } : null;
  const endPoint = course ? { lat: course.endLat, lng: course.endLng } : null;

  const initMap = (center) => {
    if (map.current || !mapContainer.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom: 13,
      projection: 'mercator',
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
    });
    map.current.touchZoomRotate.disableRotation();
  };

  // Init map once and get user location
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    if (locationEnabled && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          initMap([longitude, latitude]);
          // Add user marker after map is ready
          const addUserMarker = () => {
            if (!map.current) return;
            const userEl = document.createElement('div');
            userEl.style.cssText = 'width:24px;height:24px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5);';
            userMarkerRef.current = new mapboxgl.Marker({ element: userEl })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          };
          if (map.current?.isStyleLoaded()) addUserMarker();
          else map.current?.once('load', addUserMarker);
        },
        (err) => {
          console.warn('RoutesMap geolocation failed:', err?.message);
          initMap([-80.1392, 25.9565]);
        },
        { timeout: 6000, maximumAge: 0 }
      );
    } else {
      initMap([-80.1392, 25.9565]);
    }

    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Draw/update route
  useEffect(() => {
    if (!map.current) return;

    const draw = () => {
      // Remove old route layers/sources
      ['route-outline', 'route-line'].forEach(id => {
        if (map.current.getLayer(id)) map.current.removeLayer(id);
      });
      ['route-outline-src', 'route-line-src'].forEach(id => {
        if (map.current.getSource(id)) map.current.removeSource(id);
      });
      routeMarkerRefs.current.forEach(m => m.remove());
      routeMarkerRefs.current = [];

      if (!displayRoute?.coordinates?.length) return;

      const coords = displayRoute.coordinates.map(c => [c.lng, c.lat]);
      const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };

      map.current.addSource('route-outline-src', { type: 'geojson', data: geojson });
      map.current.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route-outline-src',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': glowColor, 'line-width': 14, 'line-opacity': 0.3 },
      });

      map.current.addSource('route-line-src', { type: 'geojson', data: geojson });
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line-src',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': routeColor, 'line-width': 6, 'line-opacity': 1 },
      });

      // End marker (destination)
      const endEl = document.createElement('div');
      endEl.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#f87171;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);';
      routeMarkerRefs.current.push(
        new mapboxgl.Marker({ element: endEl }).setLngLat(coords[coords.length - 1]).addTo(map.current)
      );

      const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1000 });
    };

    if (map.current?.isStyleLoaded()) draw();
    else map.current?.once('load', draw);
  }, [displayRoute, routeColor, glowColor]);

  // Draw sensor markers (matching main Map page style)
  useEffect(() => {
    if (!map.current) return;
    const DARK_BLUE = '#1e3a8a';
    const RADIUS_MIN = 25;
    const RADIUS_MAX = 50;

    const makeCircleCoords = (lat, lng, radiusM) => {
      const points = 32, earthR = 6371000, d = radiusM / earthR;
      const latR = lat * Math.PI / 180, lngR = lng * Math.PI / 180;
      const coords = [];
      for (let i = 0; i <= points; i++) {
        const bearing = (i / points) * 2 * Math.PI;
        const pLat = Math.asin(Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(bearing));
        const pLng = lngR + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(latR), Math.cos(d) - Math.sin(latR) * Math.sin(pLat));
        coords.push([pLng * 180 / Math.PI, pLat * 180 / Math.PI]);
      }
      return coords;
    };

    const addSensors = () => {
      sensorMarkerRefs.current.forEach(m => m.remove());
      sensorMarkerRefs.current = [];
      // Remove old circle layers
      for (let i = 0; i < (sensors.length + 5); i++) {
        try {
          if (map.current.getLayer(`sc-fill-${i}`)) map.current.removeLayer(`sc-fill-${i}`);
          if (map.current.getLayer(`sc-stroke-${i}`)) map.current.removeLayer(`sc-stroke-${i}`);
          if (map.current.getSource(`sc-src-${i}`)) map.current.removeSource(`sc-src-${i}`);
        } catch {}
      }

      sensors.forEach((sensor, i) => {
        const color = getWaterBlue(sensor.waterLevelCm);
        const depth = Math.min(1, Math.max(0, (sensor.waterLevelCm || 0) / 100));
        const radiusM = RADIUS_MIN + depth * (RADIUS_MAX - RADIUS_MIN);

        // Radius circle
        const srcId = `sc-src-${i}`;
        map.current.addSource(srcId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [makeCircleCoords(sensor.lat, sensor.lng, radiusM)] } },
        });
        map.current.addLayer({ id: `sc-fill-${i}`, type: 'fill', source: srcId, paint: { 'fill-color': color, 'fill-opacity': 0.2 } });
        map.current.addLayer({ id: `sc-stroke-${i}`, type: 'line', source: srcId, paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.5 } });

        // Dark blue dot + tap popup
        const el = document.createElement('div');
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${DARK_BLUE};border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.4);cursor:pointer;`;
        const popup = new mapboxgl.Popup({ closeButton: false, offset: 8, className: 'sensor-popup' })
          .setHTML(`<div style="background:#151a2e;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-family:Inter,system-ui,sans-serif;text-align:center;padding:6px 10px;white-space:nowrap;"><span style="font-weight:700;font-size:14px;color:${color};">${sensor.waterLevelCm ?? 0}</span><span style="font-size:10px;color:#6b7280;margin-left:2px;">cm</span></div>`);
        sensorMarkerRefs.current.push(
          new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([sensor.lng, sensor.lat]).setPopup(popup).addTo(map.current)
        );
      });
    };

    if (map.current?.isStyleLoaded()) addSensors();
    else map.current?.once('load', addSensors);
  }, [sensors]);

  return (
    <div className="relative h-full w-full">
      <style>{`
        .mapboxgl-popup-content{background:transparent!important;padding:0!important;box-shadow:none!important;}
        .mapboxgl-popup-tip{display:none!important;}
        .mapboxgl-ctrl-logo{display:none!important}
        .mapboxgl-ctrl-attrib{display:none!important}
      `}</style>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Route status banner */}
      {selectedRoute && (
        <div className="absolute top-4 left-4 right-4 z-[1000] space-y-2">
          {avoidanceRoute ? (
            <div className="backdrop-blur-xl bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-emerald-400 font-medium">Flood-safe route found</span>
                <p className="text-emerald-400/70 text-xs">{avoidanceRoute.durationMinutes} min · {avoidanceRoute.distanceMiles} mi</p>
              </div>
              <button onClick={() => setAvoidanceRoute(null)} className="text-xs text-emerald-400/60 hover:text-emerald-400 underline">Original</button>
            </div>
          ) : isClear ? (
            <div className="backdrop-blur-xl bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Route clear</span>
            </div>
          ) : hasAlert ? (
            <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-400 font-medium flex-1">⚠ Flooding — {floodingSensors.length} sensor{floodingSensors.length > 1 ? 's' : ''} on route</span>
              <button
                onClick={handleFindAvoidance}
                disabled={loadingAvoidance}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingAvoidance ? 'animate-spin' : ''}`} />
                {loadingAvoidance ? 'Finding…' : 'Reroute'}
              </button>
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <span className="text-amber-400 font-medium flex-1">⚡ Risk — {floodingSensors.length} sensor{floodingSensors.length > 1 ? 's' : ''} nearby</span>
              <button
                onClick={handleFindAvoidance}
                disabled={loadingAvoidance}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingAvoidance ? 'animate-spin' : ''}`} />
                {loadingAvoidance ? 'Finding…' : 'Reroute'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}