import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Shared page header — consistent across all non-map pages.
 * Props: title, subtitle, action (optional React node), showBack (bool)
 */
export default function PageHeader({ title, subtitle, action, showBack = false }) {
  const navigate = useNavigate();
  return (
    <div className="backdrop-blur-xl bg-[#0c1021]/95 border-b border-white/8 sticky top-0 z-10">
      <div className="px-4 pt-12 pb-4 safe-area-top flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex-shrink-0 -ml-1"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}