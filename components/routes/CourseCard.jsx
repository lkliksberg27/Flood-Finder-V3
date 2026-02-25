import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Navigation, Pencil, Check, X, Clock, Trash2, Loader2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

import FloodDetailPanel from './FloodDetailPanel';
import CourseSchedule from './CourseSchedule';
import { checkRouteFlooding } from './courseUtils';

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function fetchRoutes(start, end, direction) {
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?alternatives=true&geometries=geojson&overview=full`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes) return [];
  return data.routes.slice(0, 3).map((r, i) => ({
    id: `${direction}-${i}-${Date.now()}`,
    label: i === 0 ? 'Fastest route' : `Alternative ${i}`,
    direction,
    distanceMiles: r.distance / 1609.34,
    durationMinutes: Math.round(r.duration / 60),
    coordinates: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  }));
}

export default function CourseCard({
  course,
  sensors,
  isExpanded,
  onToggle,
  onSelectRoute,
  onDrive,
  selectedRoute,
  onUpdateCourse,
  onDeleteCourse,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(course.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [generatingRoutes, setGeneratingRoutes] = useState(false);
  const [localRoutes, setLocalRoutes] = useState(course.routes || []);
  const [routeError, setRouteError] = useState('');

  const routes = localRoutes.filter(r => r.direction === 'forward');
  
  // Automatically pick best route: prefer flood-free, then fastest
  const activeRoute = (() => {
    if (!routes.length) return null;
    const floodFreeRoutes = routes.filter(r => checkRouteFlooding(r, sensors).length === 0);
    return floodFreeRoutes.length > 0 ? floodFreeRoutes[0] : routes[0];
  })();
  
  const floodingSensors = activeRoute ? checkRouteFlooding(activeRoute, sensors) : [];
  const hasFloodingWarning = floodingSensors.length > 0;
  const allRoutesFlooded = routes.length > 0 && !routes.some(r => checkRouteFlooding(r, sensors).length === 0);

  const saveName = () => {
    onUpdateCourse(course.id, { name: editName });
    setIsEditing(false);
  };

  const handleGenerateRoutes = async () => {
    setGeneratingRoutes(true);
    setRouteError('');
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const startCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const endCoords = { lat: course.endLat, lng: course.endLng };

        const sensors_list = sensors || [];
        const [fwd, rev] = await Promise.all([
          fetchRoutes(startCoords, endCoords, 'forward'),
          fetchRoutes(endCoords, startCoords, 'reverse'),
        ]);

        const all = [...fwd, ...rev];

        setLocalRoutes(all);
        onUpdateCourse(course.id, { routes: all, startLat: startCoords.lat, startLng: startCoords.lng });
        setGeneratingRoutes(false);
      }, () => {
        setRouteError('Location access needed to generate routes.');
        setGeneratingRoutes(false);
      }, { enableHighAccuracy: true, timeout: 8000 });
    } catch {
      setRouteError('Failed to generate routes.');
      setGeneratingRoutes(false);
    }
  };

  const handleSelectRoute = (route) => {
    onSelectRoute(route);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#151a2e] hover:bg-[#1a1f35] rounded-xl border border-white/5 hover:border-white/10 overflow-hidden transition-colors cursor-pointer"
      onClick={() => !isEditing && onToggle(course.id)}
    >
      {/* Header */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 flex-shrink-0 mt-0.5">
            <MapPin className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="bg-[#0c1021] text-white px-2 py-1 rounded-lg text-sm flex-1 border border-white/10 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
                <button onClick={saveName} className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"><Check className="w-4 h-4" /></button>
                <button onClick={() => setIsEditing(false)} className="p-1 text-gray-400 hover:bg-gray-500/20 rounded"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold text-sm truncate">{course.name}</h3>
                <button onClick={e => { e.stopPropagation(); setIsEditing(true); }} className="p-1 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded flex-shrink-0">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 truncate mt-0.5">{course.endAddress}</p>
          </div>
          <div className="flex-shrink-0">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-3">
              {/* Generate routes button */}
              {routes.length === 0 ? (
                <div className="space-y-2">
                  {routeError && <p className="text-red-400 text-xs bg-red-500/10 px-2 py-1.5 rounded-lg">{routeError}</p>}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateRoutes(); }}
                    disabled={generatingRoutes}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {generatingRoutes ? <><Loader2 className="w-4 h-4 animate-spin" />Loading...</> : <><Navigation className="w-4 h-4" />Get Routes</>}
                  </button>
                </div>
              ) : (
                <>
                  {/* Route summary */}
                  {activeRoute && (
                    <div className="bg-[#0c1021]/50 border border-white/5 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Route Selected</span>
                        <span className="text-xs font-semibold text-blue-400">{activeRoute.durationMinutes} min • {activeRoute.distanceMiles.toFixed(1)} mi</span>
                      </div>
                      {hasFloodingWarning && (
                        <div className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1.5 rounded-lg border border-amber-500/20">
                          ⚠️ Route has flooded areas nearby—use caution
                        </div>
                      )}
                      {allRoutesFlooded && (
                        <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1.5 rounded-lg border border-red-500/20">
                          ⚠️ All available routes have flooded areas
                        </div>
                      )}
                      {!hasFloodingWarning && !allRoutesFlooded && (
                        <div className="text-xs text-green-400">✓ Route is clear of flooding</div>
                      )}
                    </div>
                  )}
                  
                  {floodingSensors.length > 0 && <FloodDetailPanel sensors={floodingSensors} />}
                  
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGenerateRoutes(); }}
                      disabled={generatingRoutes}
                      className="flex-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      {generatingRoutes ? 'Refreshing...' : 'Refresh'}
                    </button>
                    {activeRoute && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDrive(activeRoute); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        Drive
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Schedule */}
              <CourseSchedule course={course} onUpdate={(data) => onUpdateCourse(course.id, data)} />

              {/* Delete */}
              <div className="pt-1 border-t border-white/5">
                {showDeleteConfirm ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400">Delete?</span>
                    <div className="flex gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }} className="px-2 py-1 text-xs text-gray-400 hover:bg-white/5 rounded">Cancel</button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteCourse(course.id); setShowDeleteConfirm(false); }} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded">Delete</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="flex items-center gap-1.5 text-xs text-red-400 hover:bg-red-500/10 px-2 py-1.5 rounded transition-colors">
                    <Trash2 className="w-3 h-3" />Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}