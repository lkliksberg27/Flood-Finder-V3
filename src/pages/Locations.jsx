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
  const popupRef = useRef(null);
  const hasFittedRef = useRef(false);

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

  // Draw everything on map using native Mapbox layers (no DOM marker jiggle)
  useEffect(() => {
    if (!mapRef.current) return;
    const m = mapRef.current;
    const update = () => {
      // ── Build GeoJSON for sensor radius circles ──
      const radiusFeatures = sensors.map((sensor) => {
        const color = getWaterBlue(sensor.waterLevelCm);
        const depth = Math.min(1, Math.max(0, (sensor.waterLevelCm || 0) / 100));
        const radiusM = SENSOR_RADIUS_MIN + depth * (SENSOR_RADIUS_MAX - SENSOR_RADIUS_MIN);
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [makeCircleCoords(sensor.lat, sensor.lng, radiusM)] },
          properties: { color },
        };
      });

      // ── Build GeoJSON for sensor center dots ──
      const dotFeatures = sensors.map((sensor) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [sensor.lng, sensor.lat] },
        properties: { waterLevelCm: sensor.waterLevelCm ?? 0, color: getWaterBlue(sensor.waterLevelCm) },
      }));

      // ── Build GeoJSON for location pins ──
      const pinFeatures = locations.map((loc) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
        properties: { name: loc.name, id: loc.id, isSelected: loc.id === selectedLocId },
      }));

      const radiusFC = { type: 'FeatureCollection', features: radiusFeatures };
      const dotsFC = { type: 'FeatureCollection', features: dotFeatures };
      const pinsFC = { type: 'FeatureCollection', features: pinFeatures };

      if (m.getSource('sensor-radii')) {
        m.getSource('sensor-radii').setData(radiusFC);
        m.getSource('sensor-dots').setData(dotsFC);
        m.getSource('location-pins').setData(pinsFC);
      } else {
        // Sensor radius circles
        m.addSource('sensor-radii', { type: 'geojson', data: radiusFC });
        m.addLayer({ id: 'sensor-radii-fill', type: 'fill', source: 'sensor-radii', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 } });
        m.addLayer({ id: 'sensor-radii-stroke', type: 'line', source: 'sensor-radii', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.5 } });

        // Sensor center dots (native circle layer)
        m.addSource('sensor-dots', { type: 'geojson', data: dotsFC });
        m.addLayer({
          id: 'sensor-dots-layer', type: 'circle', source: 'sensor-dots',
          paint: { 'circle-radius': 7, 'circle-color': DARK_BLUE, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
        });

        // Location pins (native circle layer)
        m.addSource('location-pins', { type: 'geojson', data: pinsFC });
        m.addLayer({
          id: 'location-pins-layer', type: 'circle', source: 'location-pins',
          paint: {
            'circle-radius': ['case', ['==', ['get', 'isSelected'], true], 14, 11],
            'circle-color': ['case', ['==', ['get', 'isSelected'], true], '#3b82f6', '#4285f4'],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Click handlers (set up once)
        m.on('click', 'sensor-dots-layer', (e) => {
          if (!e.features?.length) return;
          const f = e.features[0];
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 10, className: 'sensor-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="background:#151a2e;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-family:Inter,system-ui,sans-serif;text-align:center;padding:6px 10px;white-space:nowrap;"><span style="font-weight:700;font-size:14px;color:${f.properties.color};">${f.properties.waterLevelCm}</span><span style="font-size:10px;color:#6b7280;margin-left:2px;">cm</span></div>`)
            .addTo(m);
        });
        m.on('click', 'location-pins-layer', (e) => {
          if (!e.features?.length) return;
          const f = e.features[0];
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 16, className: 'sensor-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="background:#151a2e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;color:white;font-family:Inter,sans-serif;"><div style="font-weight:600;font-size:11px;">${f.properties.name}</div></div>`)
            .addTo(m);
        });
        m.on('mouseenter', 'sensor-dots-layer', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'sensor-dots-layer', () => { m.getCanvas().style.cursor = ''; });
        m.on('mouseenter', 'location-pins-layer', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'location-pins-layer', () => { m.getCanvas().style.cursor = ''; });
      }

      // Fit bounds only on first load
      if (!hasFittedRef.current && (locations.length > 0 || sensors.length > 0)) {
        hasFittedRef.current = true;
        const bounds = new mapboxgl.LngLatBounds();
        locations.forEach(loc => bounds.extend([loc.lng, loc.lat]));
        sensors.forEach(s => bounds.extend([s.lng, s.lat]));
        m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 500 });
      }
    };
    if (m.isStyleLoaded()) update();
    else m.once('style.load', update);
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
          .mapboxgl-popup-close-button { color:#6b7280!important;font-size:14px!important;right:4px!important;top:2px!important;padding:0!important;line-height:1!important; }
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