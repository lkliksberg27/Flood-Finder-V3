import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="bg-blue-500/15 p-5 rounded-2xl mb-4">
          <Icon className="w-9 h-9 text-blue-400" />
        </div>
      )}
      <h2 className="text-base font-bold text-white mb-2">{title}</h2>
      {description && <p className="text-gray-400 text-sm mb-6 max-w-xs leading-relaxed">{description}</p>}
      {action}
    </div>
  );
}