import React, { useState, useRef, useEffect, useCallback } from 'react';
import { entities } from '@/api/firestoreService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bell, MapPin } from 'lucide-react';
import { getDistanceMeters } from '@/utils';
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

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLocId, setSelectedLocId] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

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

  // Draw location markers on map
  useEffect(() => {
    if (!mapRef.current) return;
    const m = mapRef.current;
    const draw = () => {
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
          .setPopup(new mapboxgl.Popup({ offset: 20, className: 'sensor-popup' }).setHTML(
            `<div style="background:#151a2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;min-width:140px;color:white;font-family:Inter,sans-serif;">
              <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${loc.name}</div>
              <div style="color:#6b7280;font-size:11px;">${loc.address || ''}</div>
            </div>`
          ))
          .addTo(m);
        markersRef.current.push(mk);
      });
      // Fit bounds if locations exist and nothing selected
      if (locations.length > 0 && !selectedLocId) {
        const bounds = new mapboxgl.LngLatBounds();
        locations.forEach(loc => bounds.extend([loc.lng, loc.lat]));
        m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 500 });
      }
    };
    if (m.isStyleLoaded()) draw();
    else m.once('style.load', draw);
  }, [locations, selectedLocId]);

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
      <div className="relative w-full h-[28vh] min-h-[160px] border-b border-white/5">
        <div ref={mapContainerRef} className="absolute inset-0" />
        <style>{`
          .mapboxgl-popup-content { background:transparent!important;padding:0!important;box-shadow:none!important; }
          .mapboxgl-popup-tip { display:none!important; }
          .mapboxgl-ctrl-logo { display:none!important; }
          .mapboxgl-ctrl-attrib { display:none!important; }
        `}</style>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
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