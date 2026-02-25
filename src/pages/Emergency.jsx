import React, { useState } from 'react';
import { entities } from '@/api/firestoreService';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Navigation } from 'lucide-react';
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
    queryFn: () => entities.Sensor.list(),
    refetchInterval: 30000,
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => entities.Settings.list(),
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
        <div className="h-[38vh] min-h-[200px] lg:h-screen lg:flex-1 lg:sticky lg:top-0">
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
            settingsLink
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-primary text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20"
              >
                <Navigation className="w-4 h-4" />
                Start Driving
              </button>
            )}
          </div>
        </div>

        <BottomNav />
      </div>
    </>
  );
}