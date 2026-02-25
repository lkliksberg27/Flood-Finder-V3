import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Map, Navigation, AlertTriangle, MapPin, Settings, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const tabs = [
  { name: 'Map',      page: 'Map',       icon: Map,           label: 'Map',      bg: 'bg-sky-500'     },
  { name: 'Routes',   page: 'Routes',    icon: Navigation,    label: 'Routes',   bg: 'bg-violet-500'  },
  { name: 'SOS',      page: 'Emergency', icon: AlertTriangle, label: 'SOS',      bg: 'bg-red-500'     },
  { name: 'Places',   page: 'Locations', icon: MapPin,        label: 'Places',   bg: 'bg-emerald-500' },
  { name: 'Sensors',  page: 'Sensors',   icon: Cpu,           label: 'Sensors',  bg: 'bg-blue-500'    },
  { name: 'Settings', page: 'Settings',  icon: Settings,      label: 'Settings', bg: 'bg-amber-500'   },
];

export default function BottomNav() {
  const location = useLocation();
  const currentPage = location.pathname.split('/').pop() || 'Map';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="backdrop-blur-2xl bg-[#0b0f1e]/95 border-t border-white/[0.06]">
        <div className="flex justify-around items-end h-[72px] pb-2 max-w-lg mx-auto px-1">
          {tabs.map((tab) => {
            const isActive = currentPage.toLowerCase() === tab.page.toLowerCase();
            const Icon = tab.icon;

            return (
              <Link
                key={tab.name}
                to={createPageUrl(tab.page)}
                className="flex flex-col items-center justify-end gap-1 pb-1 px-2"
              >
                <motion.div
                  whileTap={{ scale: 0.82 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300',
                    isActive ? tab.bg : 'bg-transparent'
                  )}
                >
                  <Icon className={cn(
                    'w-5 h-5 transition-all duration-300',
                    isActive ? 'text-white' : 'text-gray-600'
                  )} />
                </motion.div>
                <span className={cn(
                  'text-[10px] font-medium transition-colors duration-200',
                  isActive ? 'text-white' : 'text-gray-600'
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}