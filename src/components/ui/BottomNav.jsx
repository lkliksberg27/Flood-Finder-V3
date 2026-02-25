import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Map, Navigation, AlertTriangle, MapPin, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const tabs = [
  { name: 'Map',     page: 'Map',       icon: Map,           label: 'Map',     color: 'bg-sky-500',     activeText: 'text-sky-400'     },
  { name: 'Routes',  page: 'Routes',    icon: Navigation,    label: 'Routes',  color: 'bg-violet-500',  activeText: 'text-violet-400'  },
  { name: 'SOS',     page: 'Emergency', icon: AlertTriangle, label: 'SOS',     color: 'bg-red-500',     activeText: 'text-red-400'     },
  { name: 'Places',  page: 'Locations', icon: MapPin,        label: 'Places',  color: 'bg-emerald-500', activeText: 'text-emerald-400' },
  { name: 'Sensors', page: 'Sensors',   icon: Cpu,           label: 'Sensors', color: 'bg-blue-500',    activeText: 'text-blue-400'    },
];

export default function BottomNav() {
  const location = useLocation();
  const currentPage = location.pathname.split('/').pop() || 'Map';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="backdrop-blur-2xl bg-[#0b0f1e]/95 border-t border-white/[0.06]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-around items-end h-[76px] pb-2 max-w-lg mx-auto px-2">
          {tabs.map((tab) => {
            const isActive = currentPage.toLowerCase() === tab.page.toLowerCase();
            const isSOS = tab.name === 'SOS';
            const Icon = tab.icon;

            return (
              <Link
                key={tab.name}
                to={createPageUrl(tab.page)}
                className="relative flex flex-col items-center justify-end gap-1 pb-1 min-w-[52px] min-h-[44px]"
              >
                {/* Sliding indicator bar */}
                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className={cn('absolute -top-0.5 w-8 h-1 rounded-full', tab.color)}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                <motion.div
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300',
                    isActive ? tab.color : (isSOS ? 'bg-red-500/10' : 'bg-transparent')
                  )}
                >
                  <Icon className={cn(
                    'w-5 h-5 transition-all duration-300',
                    isActive ? 'text-white' : (isSOS ? 'text-red-400/60' : 'text-gray-500')
                  )} />
                </motion.div>
                <span className={cn(
                  'text-[10px] font-medium transition-colors duration-200',
                  isActive ? tab.activeText : (isSOS ? 'text-red-400/60' : 'text-gray-500')
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
