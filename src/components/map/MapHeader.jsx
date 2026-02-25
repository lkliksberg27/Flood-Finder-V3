import React from 'react';
import { Droplets, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function MapHeader({ sensors = [], cityName }) {
  const warnCount = sensors.filter(s => s.status === 'WARN').length;
  const alertCount = sensors.filter(s => s.status === 'ALERT').length;
  const allClear = warnCount === 0 && alertCount === 0;

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000]">
      {/* Gradient fade into map instead of hard border */}
      <div className="bg-gradient-to-b from-[#0c1021] via-[#0c1021]/60 to-transparent pb-6">
        <div className="px-4 pt-12 pb-1 safe-area-top">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Droplets className="w-4.5 h-4.5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-white">Flood Finder</h1>
              </div>
              {cityName ? (
                <p className="text-[11px] text-gray-500 ml-[42px] -mt-0.5">{cityName}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {/* Status pill with glow */}
              {allClear ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold"
                  style={{ boxShadow: '0 0 12px rgba(52,211,153,0.15)' }}>
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  All Clear
                </span>
              ) : (
                <Link
                  to={createPageUrl('Alerts')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold"
                  style={{ boxShadow: '0 0 12px rgba(248,113,113,0.2)' }}
                >
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                  {alertCount > 0 ? `${alertCount} Flooding` : `${warnCount} Warning`}
                </Link>
              )}
              {/* Settings gear */}
              <Link
                to="/Settings"
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 transition-all backdrop-blur-sm"
              >
                <Settings className="w-4 h-4 text-gray-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Alert banner with gradient */}
      {alertCount > 0 && (
        <div className="bg-gradient-to-r from-red-600/90 to-red-500/70 backdrop-blur-sm px-4 py-2.5 -mt-4">
          <p className="text-white text-sm font-semibold text-center">
            🚨 {alertCount} sensor{alertCount > 1 ? 's' : ''} reporting severe flooding nearby
          </p>
        </div>
      )}
    </div>
  );
}
