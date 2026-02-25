import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useFloodNotifications } from './components/notifications/useFloodNotifications';

function NotificationManager() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    base44.entities.Settings.list().then(list => {
      if (list[0]) setSettings(list[0]);
    });
    const unsub = base44.entities.Settings.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create') {
        setSettings(event.data);
      }
    });
    return () => unsub();
  }, []);

  useFloodNotifications(settings);
  return null;
}

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#0c1021]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        .safe-area-top {
          padding-top: env(safe-area-inset-top, 0);
        }
        
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: #0c1021;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #2a3150;
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #3a4160;
        }
        
        /* Touch feedback */
        button:active {
          transform: scale(0.98);
        }
        
        /* Smooth transitions */
        * {
          -webkit-tap-highlight-color: transparent;
        }
        
        /* Slider styling for dark theme */
        [data-radix-slider-track] {
          background: #1e2340 !important;
        }
        
        [data-radix-slider-range] {
          background: #4285f4 !important;
        }
        
        [data-radix-slider-thumb] {
          background: white !important;
          border: none !important;
        }
        
        /* Switch styling for dark theme */
        [data-state="checked"] {
          background-color: #4285f4 !important;
        }
        
        [data-state="unchecked"] {
          background-color: #2a3150 !important;
        }
      `}</style>
      <NotificationManager />
      {children}
    </div>
  );
}