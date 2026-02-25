import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, AlertCircle, Droplets, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const MAX_LEVEL = 100; // cm considered max for bar

export default function AlertCard({ sensor, index }) {
  const isAlert = sensor.status === 'ALERT';
  const iconColor = isAlert ? 'text-red-400' : 'text-amber-400';
  const bgColor = isAlert ? 'bg-red-500/8' : 'bg-amber-500/8';
  const borderColor = isAlert ? 'border-red-500/25' : 'border-amber-500/25';
  const accentColor = isAlert ? 'bg-red-500' : 'bg-amber-400';
  const barFrom = isAlert ? 'from-red-500' : 'from-amber-500';
  const barTo = isAlert ? 'to-red-400' : 'to-amber-300';
  const Icon = isAlert ? AlertTriangle : AlertCircle;
  const fillPct = Math.min(100, Math.round((sensor.waterLevelCm / MAX_LEVEL) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`${bgColor} border ${borderColor} rounded-2xl overflow-hidden flex`}
    >
      {/* Colored accent bar */}
      <div className={`w-1 ${accentColor} flex-shrink-0`} />

      <div className="flex-1 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${isAlert ? 'bg-red-500/20' : 'bg-amber-500/20'} flex-shrink-0`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div>
              <h3 className="text-white font-semibold leading-tight">{sensor.name}</h3>
              <p className={`text-xs font-medium ${iconColor} mt-0.5`}>
                {isAlert ? 'Severe Flooding' : 'Moderate Flooding'}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-baseline gap-1 justify-end">
              <Droplets className={`w-3.5 h-3.5 ${iconColor}`} />
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
              className={`h-full bg-gradient-to-r ${barFrom} ${barTo} rounded-full`}
            />
          </div>
        </div>

        {/* View on map button */}
        <Link
          to={createPageUrl('Map')}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg min-h-[44px] transition-colors ${
            isAlert
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
              : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          View on map
        </Link>
      </div>
    </motion.div>
  );
}
