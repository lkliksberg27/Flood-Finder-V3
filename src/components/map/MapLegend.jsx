import React from 'react';

const items = [
  { color: '#34d399', label: 'Clear' },
  { color: '#fbbf24', label: 'Warning' },
  { color: '#f87171', label: 'Flooding' },
];

export default function MapLegend() {
  return (
    <div className="absolute bottom-24 left-3 z-[500]">
      <div className="backdrop-blur-md bg-[#0c1021]/80 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-3">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}