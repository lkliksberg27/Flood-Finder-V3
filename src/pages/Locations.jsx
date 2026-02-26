import React, { useState, useRef, useEffect, useCallback } from 'react';
import { entities } from '@/api/firestoreService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bell, MapPin } from 'lucide-react';
import { getDistanceMeters, getWaterBlue } from '@/utils';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/ui/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import LoadingScreen from '@/components/ui/LoadingScreen';
import EmptyState from '@/components/ui/EmptyState';
import LocationCard from '@/components/locations/LocationCard';
import AddLocationForm from '@/components/locations/AddLocationForm';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';
const DARK_BLUE = '#1e3a8a';
const SENSOR_RADIUS_MIN = 25;
const SENSOR_RADIUS_MAX = 50;

function makeCircleCoords(lat, lng, radiusM) {
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
}

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLocId, setSelectedLocId] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const sensorMarkersRef = useRef([]);
  const prevSensorCount = useRef(0);

  const { data: settingsList = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => entities.Settings.list(),
  });
  const useMetric = settingsList[0]?.useMetric ?? true;

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['watchedLocations'],
    queryFn: () => entities.WatchedLocation.list('-created_date'),
  });

  const { data: sensors = [] } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => entities.Sensor.list(),
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => entities.WatchedLocation.create(data),
    onMutate: async (data) => {
      const tempId = `temp-${Date.now()}`;
      await queryClient.cancelQueries({ queryKey: ['watchedLocations'] });
      const prev = queryClient.getQueryData(['watchedLocations']);
      queryClient.setQueryData(['watchedLocations'], old => [{ ...data, id: tempId }, ...(old || [])]);
      return { prev, tempId };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['watchedLocations'], ctx.prev),
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['watchedLocations'] }); setShowAdd(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => entities.WatchedLocation.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['watchedLocations'] });
      const prev = queryClient.getQueryData(['watchedLocations']);
      queryClient.setQueryData(['watchedLocations'], old => (old || []).filter(l => l.id !== id));
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['watchedLocations'], ctx.prev),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchedLocations'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => entities.WatchedLocation.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['watchedLocations'] });
      const prev = queryClient.getQueryData(['watchedLocations']);
      queryClient.setQueryData(['watchedLocations'], old => (old || []).map(l => l.id === id ? { ...l, ...data } : l));
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['watchedLocations'], ctx.prev),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchedLocations'] }),
  });

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-80.1223, 25.9651],
      zoom: 11,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Draw everything on map: sensors + location markers
  useEffect(() => {
    if (!mapRef.current) return;
    const m = mapRef.current;
    const draw = () => {
      // ── Clean up old sensor layers ──
      sensorMarkersRef.current.forEach(mk => mk.remove());
      sensorMarkersRef.current = [];
      for (let i = 0; i < prevSensorCount.current + 5; i++) {
        try {
          if (m.getLayer(`sc-fill-${i}`)) m.removeLayer(`sc-fill-${i}`);
          if (m.getLayer(`sc-stroke-${i}`)) m.removeLayer(`sc-stroke-${i}`);
          if (m.getSource(`sc-src-${i}`)) m.removeSource(`sc-src-${i}`);
        } catch {}
      }
      prevSensorCount.current = sensors.length;

      // ── Draw sensor radius circles + dot markers ──
      sensors.forEach((sensor, i) => {
        const color = getWaterBlue(sensor.waterLevelCm);
        const depth = Math.min(1, Math.max(0, (sensor.waterLevelCm || 0) / 100));
        const radiusM = SENSOR_RADIUS_MIN + depth * (SENSOR_RADIUS_MAX - SENSOR_RADIUS_MIN);

        const srcId = `sc-src-${i}`;
        m.addSource(srcId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [makeCircleCoords(sensor.lat, sensor.lng, radiusM)] } },
        });
        m.addLayer({ id: `sc-fill-${i}`, type: 'fill', source: srcId, paint: { 'fill-color': color, 'fill-opacity': 0.2 } });
        m.addLayer({ id: `sc-stroke-${i}`, type: 'line', source: srcId, paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.5 } });

        const el = document.createElement('div');
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${DARK_BLUE};border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.4);cursor:pointer;`;
        const popup = new mapboxgl.Popup({ closeButton: true, offset: 10, className: 'sensor-popup' })
          .setHTML(`
            <div style="background:#151a2e;border:1px solid rgba(255,255,255,0.15);border-radius:10px;overflow:hidden;color:white;font-family:Inter,system-ui,sans-serif;text-align:center;padding:8px 14px;">
              <div style="font-weight:600;font-size:10px;color:#9ca3af;margin-bottom:3px;">${sensor.name}</div>
              <div style="font-size:22px;font-weight:800;color:${color};line-height:1;">${sensor.waterLevelCm ?? 0}<span style="font-size:11px;font-weight:600;color:#6b7280;margin-left:2px;">cm</span></div>
            </div>
          `);
        const mk = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([sensor.lng, sensor.lat])
          .setPopup(popup)
          .addTo(m);
        sensorMarkersRef.current.push(mk);
      });

      // ── Draw location pin markers ──
      markersRef.current.forEach(mk => mk.remove());
      markersRef.current = [];
      locations.forEach(loc => {
        const isSelected = loc.id === selectedLocId;
        const el = document.createElement('div');
        el.style.cssText = `width:${isSelected ? 32 : 26}px;height:${isSelected ? 32 : 26}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${isSelected ? '#3b82f6' : '#4285f4'};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,${isSelected ? '0.6' : '0.4'});cursor:pointer;transition:all 0.2s;`;
        const inner = document.createElement('div');
        inner.style.cssText = `width:${isSelected ? 10 : 7}px;height:${isSelected ? 10 : 7}px;border-radius:50%;background:white;margin:${isSelected ? '9px' : '7.5px'} auto 0;`;
        el.appendChild(inner);
        const mk = new mapboxgl.Marker({ element: el, anchor: 'bottom-left' })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(new mapboxgl.Popup({ offset: 16, className: 'sensor-popup' }).setHTML(
            `<div style="background:#151a2e;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:8px 12px;color:white;font-family:Inter,sans-serif;">
              <div style="font-weight:600;font-size:11px;">${loc.name}</div>
              <div style="color:#6b7280;font-size:10px;margin-top:1px;">${loc.address || ''}</div>
            </div>`
          ))
          .addTo(m);
        markersRef.current.push(mk);
      });

      // Fit bounds to show everything on first load
      if ((locations.length > 0 || sensors.length > 0) && !selectedLocId) {
        const bounds = new mapboxgl.LngLatBounds();
        locations.forEach(loc => bounds.extend([loc.lng, loc.lat]));
        sensors.forEach(s => bounds.extend([s.lng, s.lat]));
        m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 500 });
      }
    };
    if (m.isStyleLoaded()) draw();
    else m.once('style.load', draw);
  }, [locations, sensors, selectedLocId]);

  const handleLocationTap = useCallback((locId) => {
    const loc = locations.find(l => l.id === locId);
    if (!loc || !mapRef.current) return;
    setSelectedLocId(locId);
    mapRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 15, duration: 1000 });
  }, [locations]);

  const levelOrder = { OK: 0, WARN: 1, ALERT: 2 };
  const alertCount = locations.filter(loc => {
    const minLevel = loc.alertLevel === 'ANY' ? 0 : (levelOrder[loc.alertLevel] ?? 1);
    return sensors.some(s =>
      getDistanceMeters(loc.lat, loc.lng, s.lat, s.lng) <= (loc.alertRadiusMeters || 500) &&
      levelOrder[s.status] >= minLevel &&
      s.status !== 'OK'
    );
  }).length;

  const subtitle = locations.length === 0
    ? 'Monitor specific places for nearby flooding'
    : alertCount > 0
    ? `⚠️ ${alertCount} place${alertCount > 1 ? 's' : ''} with flooding nearby`
    : `${locations.length} place${locations.length > 1 ? 's' : ''} monitored — all clear`;

  if (isLoading) return <LoadingScreen message="Loading your places…" />;

  return (
    <div className="min-h-screen bg-[#0c1021] pb-24 flex flex-col">
      <PageHeader
        title="Watched Places"
        subtitle={subtitle}
        settingsLink
        action={
          <button
            onClick={() => setShowAdd(v => !v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              showAdd ? 'bg-white/10 text-gray-300' : 'btn-primary text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        }
      />

      {/* Map */}
      <div className="relative w-full h-[45vh] min-h-[220px] border-b border-white/5">
        <div ref={mapContainerRef} className="absolute inset-0" />
        <style>{`
          .mapboxgl-popup-content { background:transparent!important;padding:0!important;box-shadow:none!important; }
          .mapboxgl-popup-tip { display:none!important; }
          .mapboxgl-ctrl-logo { display:none!important; }
          .mapboxgl-ctrl-attrib { display:none!important; }
        `}</style>
      </div>

      <div className="flex-1 px-3 py-3 space-y-2 overflow-y-auto">
        <AnimatePresence>
          {showAdd && (
            <AddLocationForm
              onClose={() => setShowAdd(false)}
              onSave={async (data) => { await createMutation.mutateAsync(data); }}
            />
          )}
        </AnimatePresence>

        {locations.length === 0 && !showAdd && (
          <EmptyState
            icon={Bell}
            title="Monitor places you care about"
            description="Add your home, office, or school to get alerted when flooding is detected nearby."
            action={
              <button
                onClick={() => setShowAdd(true)}
                className="btn-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add First Place
              </button>
            }
          />
        )}

        {locations.map(loc => (
          <LocationCard
            key={loc.id}
            location={loc}
            sensors={sensors}
            useMetric={useMetric}
            isSelected={loc.id === selectedLocId}
            onTap={() => handleLocationTap(loc.id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onUpdate={(id, data) => updateMutation.mutate({ id, data })}
          />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}