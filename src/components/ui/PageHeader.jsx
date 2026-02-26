import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Settings } from 'lucide-react';

export default function PageHeader({ title, subtitle, action, showBack = false, settingsLink = false }) {
  const navigate = useNavigate();
  return (
    <div className="backdrop-blur-xl bg-[#0c1021]/95 border-b border-white/8 sticky top-0 z-10">
      <div className="px-4 pt-11 pb-3 safe-area-top flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex-shrink-0 -ml-1"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white leading-tight">{title}</h1>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {action && <div>{action}</div>}
          {settingsLink && (
            <Link
              to="/Settings"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Open settings"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
