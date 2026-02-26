import React from 'react';
import { Droplets, Activity } from 'lucide-react';

export default function AlertSummary({ sensors }) {
  const highCount = sensors.filter(s => s.waterLevelCm > 65).length;
  const midCount = sensors.filter(s => s.waterLevelCm > 15 && s.waterLevelCm <= 65).length;
  const totalActive = sensors.filter(s => s.status === 'WARN' || s.status === 'ALERT').length;

  return (
    <div className="grid grid-cols-3 gap-2 mb-6">
      <div className="bg-blue-600/10 border border-blue-600/20 rounded-2xl p-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 rounded-full blur-xl scale-150" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Droplets className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] text-blue-400 uppercase font-medium">Deep</span>
          </div>
          <p className="text-3xl font-bold text-white">{highCount}</p>
        </div>
      </div>

      <div className="bg-blue-400/10 border border-blue-400/20 rounded-2xl p-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-400/10 rounded-full blur-xl scale-150" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Droplets className="w-4 h-4 text-blue-300" />
            <span className="text-[10px] text-blue-300 uppercase font-medium">Moderate</span>
          </div>
          <p className="text-3xl font-bold text-white">{midCount}</p>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl scale-150" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] text-blue-400 uppercase font-medium">Active</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalActive}</p>
        </div>
      </div>
    </div>
  );
}
