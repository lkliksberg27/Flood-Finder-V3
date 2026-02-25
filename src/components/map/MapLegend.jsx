import React from 'react';

const items = [
  { color: '#34d399', label: 'Clear' },
  { color: '#fbbf24', label: 'Warning' },
  { color: '#f87171', label: 'Flooding' },
];

export default function MapLegend() {
  return (
    <div className="absolute left-3 z-[500]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}>
      <div className="backdrop-blur-md bg-[#0c1021]/80 border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center gap-3.5 shadow-lg shadow-black/20">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white/80"
              style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}60` }}
            />
            <span className="text-xs text-gray-300 font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
