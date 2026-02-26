import React from 'react';
import { Droplet } from 'lucide-react';
import { motion } from 'framer-motion';
import { getWaterBlueTw } from '@/utils';

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
          const tw = getWaterBlueTw(sensor.waterLevelCm);

          return (
            <div key={sensor.id} className={`bg-blue-500/10 rounded-lg p-2 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Droplet className={`w-4 h-4 ${tw.text}`} />
                <span className="text-sm text-white">{sensor.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Droplet className={`w-3 h-3 ${tw.text}`} />
                <span className={`text-sm font-medium ${tw.text}`}>{sensor.waterLevelCm} cm</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
