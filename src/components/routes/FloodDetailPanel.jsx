import React from 'react';
import { AlertTriangle, AlertCircle, Droplet } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FloodDetailPanel({ sensors }) {
  if (!sensors || sensors.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0c1021] rounded-xl p-3 border border-white/5"
    >
      <h4 className="text-xs uppercase text-gray-500 font-medium mb-2">Flooding Sensors</h4>
      <div className="space-y-2">
        {sensors.map(sensor => {
          const isAlert = sensor.status === 'ALERT';
          const Icon = isAlert ? AlertTriangle : AlertCircle;
          const color = isAlert ? 'text-red-400' : 'text-amber-400';
          const bgColor = isAlert ? 'bg-red-500/10' : 'bg-amber-500/10';
          
          return (
            <div key={sensor.id} className={`${bgColor} rounded-lg p-2 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-sm text-white">{sensor.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Droplet className={`w-3 h-3 ${color}`} />
                <span className={`text-sm font-medium ${color}`}>{sensor.waterLevelCm} cm</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}