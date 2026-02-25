import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Battery, Clock, X } from 'lucide-react';

const getStatusColor = (status) => {
  switch (status) {
    case 'OK': return '#34d399';
    case 'WARN': return '#fbbf24';
    case 'ALERT': return '#f87171';
    default: return '#9ca3af';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'OK': return 'NORMAL';
    case 'WARN': return 'WARNING';
    case 'ALERT': return 'SEVERE';
    default: return status;
  }
};

const getBatteryPercent = (voltage) => {
  const minV = 3.0;
  const maxV = 4.2;
  const percent = Math.round(((voltage - minV) / (maxV - minV)) * 100);
  return Math.max(0, Math.min(100, percent));
};

const getBatteryColor = (percent) => {
  if (percent > 50) return '#34d399';
  if (percent > 20) return '#fbbf24';
  return '#f87171';
};

export default function SensorPopup({ sensor, onClose }) {
  const batteryPercent = getBatteryPercent(sensor.batteryV);
  const batteryColor = getBatteryColor(batteryPercent);
  const statusColor = getStatusColor(sensor.status);
  
  return (
    <div className="bg-[#151a2e] rounded-2xl p-4 min-w-[220px] border border-white/10 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm truncate pr-2">{sensor.name}</h3>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      
      <span 
        className="inline-block px-2 py-1 rounded-full text-xs font-bold uppercase mb-3"
        style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
      >
        {getStatusLabel(sensor.status)}
      </span>
      
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-4xl font-bold text-white">{sensor.waterLevelCm}</span>
        <span className="text-gray-400 text-sm">cm</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-gray-400" />
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${batteryPercent}%`, backgroundColor: batteryColor }}
            />
          </div>
          <span className="text-xs text-gray-400">{batteryPercent}%</span>
        </div>
        
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-4 h-4" />
          <span className="text-xs">
            {formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}