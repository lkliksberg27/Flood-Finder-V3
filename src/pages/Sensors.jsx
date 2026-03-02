import React, { useState } from 'react';
import { entities } from '@/api/firestoreService';
import { useQuery } from '@tanstack/react-query';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { Battery, BatteryLow, BatteryWarning, Droplets, Clock, Search } from 'lucide-react';
import BottomNav from '@/components/ui/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import LoadingScreen from '@/components/ui/LoadingScreen';
import EmptyState from '@/components/ui/EmptyState';
import { motion } from 'framer-motion';
import { getWaterBlue, getWaterBlueTw } from '@/utils';

function BatteryIcon({ voltage }) {
  const pct = Math.min(100, Math.max(0, ((voltage - 3.0) / (4.2 - 3.0)) * 100));
  if (pct <= 20) return <BatteryLow className="w-4 h-4 text-red-400" />;
  if (pct <= 40) return <BatteryWarning className="w-4 h-4 text-amber-400" />;
  return <Battery className="w-4 h-4 text-emerald-400" />;
}

function batteryPct(voltage) {
  return Math.min(100, Math.max(0, Math.round(((voltage - 3.0) / (4.2 - 3.0)) * 100)));
}

function batteryColor(voltage) {
  const pct = batteryPct(voltage);
  if (pct <= 20) return 'text-red-400';
  if (pct <= 40) return 'text-amber-400';
  return 'text-emerald-400';
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SensorsPage() {
  const [filter, setFilter] = useState('ALL');

  const { data: sensors = [], isLoading, refetch } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => entities.Sensor.list(),
    refetchInterval: 30000,
  });

  const filtered = filter === 'ALL' ? sensors : sensors.filter(s => s.status === filter);
  const counts = {
    ALL: sensors.length,
    OK: sensors.filter(s => s.status === 'OK').length,
    WARN: sensors.filter(s => s.status === 'WARN').length,
    ALERT: sensors.filter(s => s.status === 'ALERT').length,
  };
  const lowBattery = sensors.filter(s => batteryPct(s.batteryV) <= 20).length;

  if (isLoading) return <LoadingScreen message="Loading sensors…" />;

  return (
    <div className="min-h-screen bg-[#0c1021] pb-24 flex flex-col">
      <PageHeader
        title="Sensors"
        subtitle={`${sensors.length} devices${lowBattery > 0 ? ` · ${lowBattery} low battery` : ''}`}
        settingsLink
      />

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-white/5">
        {['ALL', 'OK', 'WARN', 'ALERT'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === f ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400 border border-white/10'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'OK' ? 'Clear' : f === 'WARN' ? 'Warning' : 'Flooding'} ({counts[f]})
          </button>
        ))}
      </div>

      <PullToRefresh onRefresh={refetch}>
      <div className="px-4 py-4 space-y-3">
        {filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="No sensors found"
            description={filter === 'ALL' ? 'No sensors are connected yet.' : `No sensors with ${filter === 'WARN' ? 'warning' : filter === 'ALERT' ? 'flooding' : 'clear'} status right now.`}
          />
        )}
        {filtered.map((sensor, i) => {
          const tw = getWaterBlueTw(sensor.waterLevelCm);
          const blueHex = getWaterBlue(sensor.waterLevelCm);
          const pct = batteryPct(sensor.batteryV);
          return (
            <motion.div
              key={sensor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden flex"
            >
              {/* Water level bar on left edge */}
              <div className="w-1.5 bg-white/[0.06] flex-shrink-0 relative">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.min(100, Math.round((sensor.waterLevelCm / 100) * 100))}%` }}
                  transition={{ delay: i * 0.03 + 0.2, duration: 0.5, ease: 'easeOut' }}
                  className="absolute bottom-0 left-0 right-0 rounded-t-full"
                  style={{ background: blueHex }}
                />
              </div>

              <div className="flex-1 p-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tw.dot}`} />
                      <span className="text-white font-semibold text-sm truncate">{sensor.name}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5 ml-4">{sensor.deviceId}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${tw.bg} ${tw.border} ${tw.text}`}>
                    {tw.label}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-1.5">
                  {/* Water level */}
                  <div className="bg-white/[0.04] rounded-xl px-2 py-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Droplets className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="text-gray-500 text-[10px]">Water</span>
                    </div>
                    <p className={`text-sm font-bold ${tw.text}`}>{sensor.waterLevelCm} cm</p>
                  </div>

                  {/* Battery */}
                  <div className="bg-white/[0.04] rounded-xl px-2 py-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <BatteryIcon voltage={sensor.batteryV} />
                      <span className="text-gray-500 text-[10px]">Battery</span>
                    </div>
                    <p className={`text-sm font-bold ${batteryColor(sensor.batteryV)}`}>{pct}%</p>
                  </div>

                  {/* Last seen */}
                  <div className="bg-white/[0.04] rounded-xl px-2 py-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500 text-[10px] truncate">Seen</span>
                    </div>
                    <p className="text-sm font-bold text-gray-300">{timeAgo(sensor.lastSeen)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      </PullToRefresh>

      <BottomNav />
    </div>
  );
}