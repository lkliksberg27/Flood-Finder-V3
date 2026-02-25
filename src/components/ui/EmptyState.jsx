import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="relative mb-4">
          {/* Radial glow behind icon */}
          <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl scale-150" />
          <div className="relative bg-blue-500/15 p-5 rounded-2xl border border-blue-500/10">
            <Icon className="w-9 h-9 text-blue-400" />
          </div>
        </div>
      )}
      <h2 className="text-base font-bold text-white mb-2">{title}</h2>
      {description && <p className="text-gray-400 text-sm mb-6 max-w-xs leading-relaxed">{description}</p>}
      {action}
    </div>
  );
}
