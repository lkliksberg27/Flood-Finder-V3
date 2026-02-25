import React from 'react';
import { AlertTriangle, AlertCircle, Activity } from 'lucide-react';

export default function AlertSummary({ sensors }) {
  const alertCount = sensors.filter(s => s.status === 'ALERT').length;
  const warnCount = sensors.filter(s => s.status === 'WARN').length;
  const totalActive = alertCount + warnCount;

  return (
    <div className="grid grid-cols-3 gap-2 mb-6">
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 relative overflow-hidden">
        <div className="absolute -top-3 -right-3 w-16 h-16 bg-red-500/10 rounded-full blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-[10px] text-red-400 uppercase font-medium">Severe</span>
          </div>
          <p className="text-3xl font-bold text-white">{alertCount}</p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 relative overflow-hidden">
        <div className="absolute -top-3 -right-3 w-16 h-16 bg-amber-500/10 rounded-full blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] text-amber-400 uppercase font-medium">Moderate</span>
          </div>
          <p className="text-3xl font-bold text-white">{warnCount}</p>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 relative overflow-hidden">
        <div className="absolute -top-3 -right-3 w-16 h-16 bg-blue-500/10 rounded-full blur-xl" />
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
