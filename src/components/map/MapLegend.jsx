import React from 'react';

const items = [
  { color: '#34d399', label: 'Clear' },
  { color: '#fbbf24', label: 'Warning' },
  { color: '#f87171', label: 'Flooding' },
];

export default function MapLegend() {
  return (
    <div className="absolute left-3 z-[500]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 82px)' }}>
      <div className="backdrop-blur-md bg-[#0c1021]/70 border border-white/8 rounded-lg px-2.5 py-1.5 flex items-center gap-2.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/60"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-gray-400 font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
