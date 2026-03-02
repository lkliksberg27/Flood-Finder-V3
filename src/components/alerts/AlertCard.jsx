import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Droplets, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl, getWaterBlueTw } from '@/utils';

const MAX_LEVEL = 100; // cm considered max for bar

export default function AlertCard({ sensor, index }) {
  const tw = getWaterBlueTw(sensor.waterLevelCm);
  const fillPct = Math.min(100, Math.round((sensor.waterLevelCm / MAX_LEVEL) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`${tw.bg} border ${tw.border} rounded-2xl overflow-hidden flex`}
    >
      {/* Colored accent bar */}
      <div className={`w-1 ${tw.dot} flex-shrink-0`} />

      <div className="flex-1 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${tw.bg} flex-shrink-0`}>
              <Droplets className={`w-6 h-6 ${tw.text}`} />
            </div>
            <div>
              <h3 className="text-white font-semibold leading-tight">{sensor.name}</h3>
              <p className={`text-xs font-medium ${tw.text} mt-0.5`}>
                {tw.label} water level
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-baseline gap-1 justify-end">
              <Droplets className={`w-3.5 h-3.5 ${tw.text}`} />
              <span className="text-xl font-bold text-white tabular-nums">{sensor.waterLevelCm}</span>
              <span className="text-gray-400 text-xs">cm</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {sensor.lastSeen ? formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true }) : 'Unknown'}
            </p>
          </div>
        </div>

        {/* Water level bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>Water level</span>
            <span className="font-semibold">{fillPct}%</span>
          </div>
          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${fillPct}%` }}
              transition={{ delay: index * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
            />
          </div>
        </div>

        {/* View on map button */}
        <Link
          to={createPageUrl('Map')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
        >
          <MapPin className="w-3 h-3" />
          View on map
        </Link>
      </div>
    </motion.div>
  );
}
