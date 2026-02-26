import React from 'react';
import { Droplets, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function MapHeader({ sensors = [], cityName }) {
  const warnCount = sensors.filter(s => s.status === 'WARN').length;
  const alertCount = sensors.filter(s => s.status === 'ALERT').length;
  const allClear = warnCount === 0 && alertCount === 0;

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
      <div className="bg-gradient-to-b from-[#0c1021]/90 to-transparent pb-2">
        <div className="px-3 pt-12 pb-0 safe-area-top pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <Droplets className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-none">Flood Finder</h1>
                {cityName ? <p className="text-[10px] text-gray-400 leading-none mt-0.5">{cityName}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {allClear ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-emerald-300 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full" />
                  Clear
                </span>
              ) : (
                <Link
                  to={createPageUrl('Alerts')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/12 border border-red-500/20 text-red-300 text-[11px] font-semibold"
                >
                  <span className="w-1.5 h-1.5 bg-red-300 rounded-full animate-pulse" />
                  {alertCount > 0 ? `${alertCount} Alert` : `${warnCount} Warn`}
                </Link>
              )}
              <Link
                to="/Settings"
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 active:scale-95 transition-all"
              >
                <Settings className="w-3.5 h-3.5 text-gray-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
