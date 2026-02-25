import React, { useState, useRef } from 'react';
import { Trash2, Bell, BellOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const LEVELS = [
  { value: 'ANY',   label: 'Any',     emoji: '🔵', color: 'text-blue-400',  activeBg: 'bg-blue-500/20 border-blue-500/40' },
  { value: 'WARN',  label: 'Warning+',emoji: '⚠️', color: 'text-amber-400', activeBg: 'bg-amber-500/20 border-amber-500/40' },
  { value: 'ALERT', label: 'Severe',  emoji: '🚨', color: 'text-red-400',   activeBg: 'bg-red-500/20 border-red-500/40' },
];

const RADIUS_MIN = 50;
const RADIUS_MAX = 2000;

export default function LocationCard({ location, sensors, useMetric = true, onDelete, onUpdate }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const debounceRef = useRef(null);

  const handleUpdate = (changes) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(location.id, changes);
    }, 150);
  };

  const setRadius = (r) => handleUpdate({ alertRadiusMeters: r, alertLevel: location.alertLevel || 'WARN' });
  const setLevel = (l) => handleUpdate({ alertLevel: l, alertRadiusMeters: location.alertRadiusMeters || 500 });

  // Status logic
  const levelOrder = { OK: 0, WARN: 1, ALERT: 2 };
  const minLevel = location.alertLevel === 'ANY' ? 0 : (levelOrder[location.alertLevel] ?? 1);
  const radius = location.alertRadiusMeters || 500;

  const nearbySensors = (sensors || []).filter(s =>
    getDistanceMeters(location.lat, location.lng, s.lat, s.lng) <= radius
  );
  const triggeredSensors = nearbySensors.filter(s => levelOrder[s.status] >= minLevel && s.status !== 'OK');
  const isTriggered = triggeredSensors.length > 0;
  const worstStatus = triggeredSensors.reduce((worst, s) => levelOrder[s.status] > levelOrder[worst] ? s.status : worst, 'OK');

  const statusBorder = isTriggered
    ? (worstStatus === 'ALERT' ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/40 bg-amber-500/5')
    : 'border-white/5 bg-[#151a2e]';
  const dotColor = isTriggered
    ? (worstStatus === 'ALERT' ? 'bg-red-500' : 'bg-amber-400')
    : 'bg-emerald-500';

  const currentRadius = location.alertRadiusMeters || 500;
  const currentLevel = location.alertLevel || 'WARN';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border overflow-hidden ${statusBorder} transition-colors`}
    >
      {/* Header */}
      <div className="p-3 pb-2">
        <div className="flex items-start gap-2.5">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor} ${isTriggered ? 'animate-pulse' : ''}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white font-semibold text-sm truncate">{location.name}</span>
              {isTriggered
                ? <Bell className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                : <BellOff className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              }
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{location.address}</p>
          </div>
        </div>

        {/* Status badge */}
        {isTriggered ? (
          <div className={`mt-2 text-xs px-2.5 py-1.5 rounded-lg ${worstStatus === 'ALERT' ? 'bg-red-500/15 text-red-400 border border-red-500/25' : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'}`}>
            {triggeredSensors.length} sensor{triggeredSensors.length > 1 ? 's' : ''} {worstStatus === 'ALERT' ? 'flooding' : 'with warning'} within {useMetric ? `${currentRadius}m` : `${Math.round(currentRadius * 3.28084)} ft`}
          </div>
        ) : (
          <div className="mt-1.5 text-xs text-emerald-400">✓ No flooding nearby</div>
        )}
      </div>

      {/* Always-visible settings */}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.06] space-y-3">
        {/* Alert Radius */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Alert radius</span>
            <span className="text-[11px] text-blue-400 font-semibold">
              {useMetric ? (currentRadius >= 1000 ? `${(currentRadius/1000).toFixed(1)} km` : `${currentRadius}m`) : `${Math.round(currentRadius * 3.28084)} ft`}
            </span>
          </div>
          <Slider
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={50}
            value={[currentRadius]}
            onValueChange={([val]) => setRadius(val)}
            className="w-full"
          />
        </div>

        {/* Alert level */}
        <div>
          <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide block mb-1.5">Alert when</span>
          <div className="flex gap-1.5">
            {LEVELS.map(level => (
              <button
                key={level.value}
                onClick={() => setLevel(level.value)}
                className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  currentLevel === level.value
                    ? level.activeBg + ' ' + level.color
                    : 'bg-white/5 text-gray-500 border-white/5'
                }`}
              >
                {level.emoji} {level.label}
              </button>
            ))}
          </div>
        </div>

        {/* Delete */}
        <div className="flex justify-end">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Delete this place?</span>
              <button onClick={() => setShowDeleteConfirm(false)} className="px-2 py-1 text-xs text-gray-400 hover:bg-white/5 rounded">Cancel</button>
              <button onClick={() => onDelete(location.id)} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded">Delete</button>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1 text-xs text-red-400/50 hover:text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-colors">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}