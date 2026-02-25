import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import BottomNav from '@/components/ui/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import EmergencyRoutes from '@/components/routes/EmergencyRoutes';
import DrivingMode from '@/components/driving/DrivingMode';
import RoutesMap from '@/components/routes/RoutesMap';
import { AnimatePresence } from 'framer-motion';

export default function EmergencyPage() {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [drivingMode, setDrivingMode] = useState(false);

  const { data: sensors = [] } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => base44.entities.Sensor.list(),
    refetchInterval: 30000,
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
  });

  const alertRadius = settingsList[0]?.alertRadiusMeters || 300;
  const locationEnabled = settingsList[0]?.locationEnabled ?? true;

  const handleRouteReady = (route, place) => {
    setSelectedRoute(route);
    setSelectedCourse({
      id: `emergency-${Date.now()}`,
      name: place.name,
      endAddress: place.address,
      startLat: route.coordinates[0]?.lat,
      startLng: route.coordinates[0]?.lng,
      endLat: place.lat,
      endLng: place.lng,
      routes: [route],
    });
  };

  return (
    <>
      <AnimatePresence>
        {drivingMode && selectedRoute && (
          <DrivingMode
            route={selectedRoute}
            course={selectedCourse}
            sensors={sensors}
            alertRadius={alertRadius}
            locationEnabled={locationEnabled}
            onClose={() => setDrivingMode(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#0c1021] pb-24 flex flex-col lg:flex-row">
        {/* Map */}
        <div className="h-[38vh] lg:h-screen lg:flex-1 lg:sticky lg:top-0">
          <RoutesMap
            selectedRoute={selectedRoute}
            sensors={sensors}
            alertRadius={alertRadius}
            course={selectedCourse}
            locationEnabled={locationEnabled}
          />
        </div>

        {/* Content */}
        <div className="flex-1 lg:w-[400px] lg:max-w-[400px] lg:overflow-y-auto flex flex-col">
          <PageHeader
            title="Emergency SOS"
            subtitle="Navigate to the nearest help"
          />
          <div className="flex-1 px-4 py-4 space-y-3">
            <EmergencyRoutes
              sensors={sensors}
              alertRadius={alertRadius}
              onRouteReady={handleRouteReady}
              locationEnabled={locationEnabled}
            />
            {selectedRoute && (
              <button
                onClick={() => setDrivingMode(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
              >
                🚗 Start Driving
              </button>
            )}
          </div>
        </div>

        <BottomNav />
      </div>
    </>
  );
}