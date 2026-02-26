import React from 'react';

const items = [
  { color: '#93c5fd', label: 'Low' },
  { color: '#3b82f6', label: 'Mid' },
  { color: '#1e3a8a', label: 'Deep' },
];

export default function MapLegend() {
  const stopDrag = (e) => e.stopPropagation();
  return (
    <div
      className="absolute left-3 z-[500]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      onTouchStart={stopDrag}
      onTouchMove={stopDrag}
      onMouseDown={stopDrag}
    >
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
