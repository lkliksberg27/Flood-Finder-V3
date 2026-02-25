import React from 'react';
import { Droplets } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function MapHeader({ sensors, cityName }) {
  const warnCount = sensors.filter(s => s.status === 'WARN').length;
  const alertCount = sensors.filter(s => s.status === 'ALERT').length;
  const allClear = warnCount === 0 && alertCount === 0;

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000]">
      <div className="backdrop-blur-xl bg-[#0c1021]/85 border-b border-white/10">
        <div className="px-4 pt-12 pb-3 safe-area-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-400" />
              <h1 className="text-lg font-bold text-white">Flood Finder</h1>
              {cityName ? (
                <span className="text-xs text-gray-500 ml-1">· {cityName}</span>
              ) : null}
            </div>
            {/* Status pill */}
            {allClear ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                All Clear
              </span>
            ) : (
              <Link
                to={createPageUrl('Alerts')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold"
              >
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                {alertCount > 0 ? `${alertCount} Flooding` : `${warnCount} Warning`}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Alert banner */}
      {alertCount > 0 && (
        <div className="bg-red-600/90 backdrop-blur-sm px-4 py-2.5 border-b border-red-500/40">
          <p className="text-white text-sm font-semibold text-center">
            🚨 {alertCount} sensor{alertCount > 1 ? 's' : ''} reporting severe flooding nearby
          </p>
        </div>
      )}
    </div>
  );
}