import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bell, MapPin } from 'lucide-react';

import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/ui/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import LoadingScreen from '@/components/ui/LoadingScreen';
import EmptyState from '@/components/ui/EmptyState';
import LocationCard from '@/components/locations/LocationCard';
import AddLocationForm from '@/components/locations/AddLocationForm';

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: settingsList = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
  });
  const useMetric = settingsList[0]?.useMetric ?? true;

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['watchedLocations'],
    queryFn: () => base44.entities.WatchedLocation.list('-created_date'),
  });

  const { data: sensors = [] } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => base44.entities.Sensor.list(),
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WatchedLocation.create(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['watchedLocations'] });
      const prev = queryClient.getQueryData(['watchedLocations']);
      queryClient.setQueryData(['watchedLocations'], old => [{ ...data, id: '__optimistic__' }, ...(old || [])]);
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['watchedLocations'], ctx.prev),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchedLocations'] }); setShowAdd(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WatchedLocation.delete(id),
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
    mutationFn: ({ id, data }) => base44.entities.WatchedLocation.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['watchedLocations'] });
      const prev = queryClient.getQueryData(['watchedLocations']);
      queryClient.setQueryData(['watchedLocations'], old => (old || []).map(l => l.id === id ? { ...l, ...data } : l));
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['watchedLocations'], ctx.prev),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchedLocations'] }),
  });

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
        action={
          <button
            onClick={() => setShowAdd(v => !v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              showAdd ? 'bg-white/10 text-gray-300' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        }
      />

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
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
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
            onDelete={(id) => deleteMutation.mutate(id)}
            onUpdate={(id, data) => updateMutation.mutate({ id, data })}
          />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}