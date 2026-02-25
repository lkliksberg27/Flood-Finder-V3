import React from 'react';
import { entities } from '@/api/firestoreService';
import { useQuery } from '@tanstack/react-query';
import { Bell, Loader2 } from 'lucide-react';
import BottomNav from '@/components/ui/BottomNav';
import AlertCard from '@/components/alerts/AlertCard';
import AlertSummary from '@/components/alerts/AlertSummary';
import EmptyAlerts from '@/components/alerts/EmptyAlerts';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { motion } from 'framer-motion';

export default function AlertsPage() {
  const { data: sensors = [], isLoading, refetch } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => entities.Sensor.list(),
    refetchInterval: 30000,
  });

  // Filter and sort: ALERT first, then WARN
  const alertSensors = sensors
    .filter(s => s.status === 'ALERT' || s.status === 'WARN')
    .sort((a, b) => {
      if (a.status === 'ALERT' && b.status !== 'ALERT') return -1;
      if (a.status !== 'ALERT' && b.status === 'ALERT') return 1;
      return new Date(b.lastSeen) - new Date(a.lastSeen);
    });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c1021] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1021] pb-24 flex flex-col">
      {/* Header */}
      <div className="backdrop-blur-xl bg-[#0c1021]/80 border-b border-white/10 sticky top-0 z-10">
        <div className="px-4 pt-12 pb-4 safe-area-top">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-xl">
              <Bell className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Flood Alerts</h1>
              <p className="text-sm text-gray-400">Active flooding warnings</p>
            </div>
          </div>
        </div>
      </div>

      <PullToRefresh onRefresh={refetch}>
        <div className="px-4 py-6">
          {alertSensors.length > 0 ? (
            <>
              <AlertSummary sensors={sensors} />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {alertSensors.map((sensor, index) => (
                  <AlertCard key={sensor.id} sensor={sensor} index={index} />
                ))}
              </motion.div>
            </>
          ) : (
            <EmptyAlerts />
          )}
        </div>
      </PullToRefresh>

      <BottomNav />
    </div>
  );
}