import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Flame, Hospital, Shield, Loader2, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';

const CATEGORIES = [
  {
    label: 'Hospital',
    icon: Hospital,
    color: 'text-red-400',
    bg: 'bg-red-500/15 border-red-500/25',
    value: 'hospital',
  },
  {
    label: 'Police',
    icon: Shield,
    color: 'text-blue-400',
    bg: 'bg-blue-500/15 border-blue-500/25',
    value: 'police',
  },
  {
    label: 'Fire Department',
    icon: Flame,
    color: 'text-orange-400',
    bg: 'bg-orange-500/15 border-orange-500/25',
    value: 'fire',
  },
];

async function searchPlaces(query, cat) {
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';
  
  const queries = {
    hospital: 'hospital',
    police: 'police station',
    fire: 'fire station',
  };
  const baseQuery = queries[cat.value];
  const fullQuery = query ? `${query} ${baseQuery}` : baseQuery;

  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullQuery)}.json?access_token=${MAPBOX_TOKEN}&types=poi&limit=5`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (!data.features?.length) return [];

    return data.features.map(f => ({
      name: f.text || f.place_name.split(',')[0],
      address: f.place_name,
      lat: f.center[1],
      lng: f.center[0],
    }));
  } catch {
    return [];
  }
}

async function findNearestPlace(lat, lng, cat) {
  const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibGtsaWNreTI3IiwiYSI6ImNtbHF5ZnF6ZjA2Y3czZXB3d2h1cXlxa3MifQ.CdPYVfniU1Y3_23xrzCk5w';

  // Mapbox category IDs for POI category search
  const categoryMap = {
    hospital: 'hospital',
    police:   'police',
    fire:     'fire_station',
  };

  const category = categoryMap[cat.value];

  try {
    // Use Mapbox Search Box API with category — most reliable for emergency services
    const res = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/category/${category}?proximity=${lng},${lat}&limit=5&access_token=${TOKEN}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    const features = data.features || [];

    if (features.length > 0) {
      const sorted = features
        .map(f => ({
          f,
          dist: getDistanceMeters(lat, lng, f.geometry.coordinates[1], f.geometry.coordinates[0]),
        }))
        .sort((a, b) => a.dist - b.dist);

      const nearest = sorted[0].f;
      return {
        name: nearest.properties?.name || nearest.properties?.full_address?.split(',')[0] || cat.label,
        address: nearest.properties?.full_address || nearest.properties?.place_formatted || '',
        lat: nearest.geometry.coordinates[1],
        lng: nearest.geometry.coordinates[0],
      };
    }
  } catch (e) {}

  return null;
}

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function fetchRoute(startLat, startLng, endLat, endLng, sensors, alertRadius) {
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full`
  );
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.[0]) return null;
  const r = data.routes[0];
  const coordinates = r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  
  // Check for flooding sensors along the route
  const floodedSensorsNearby = (sensors || []).filter(s =>
    (s.status === 'WARN' || s.status === 'ALERT') &&
    coordinates.some(c => getDistanceMeters(c.lat, c.lng, s.lat, s.lng) <= alertRadius)
  );

  return {
    id: `emergency-${Date.now()}`,
    label: 'Emergency Route',
    direction: 'forward',
    distanceMiles: r.distance / 1609.34,
    durationMinutes: Math.round(r.duration / 60),
    coordinates,
    startLat,
    startLng,
    endLat,
    endLng,
    isEmergency: true,
    floodedSensorsNearby,
  };
}

export default function EmergencyRoutes({ onRouteReady, sensors = [], alertRadius = 300, compact = false, locationEnabled = true }) {
  const [loading, setLoading] = useState(false);
  const [loadingCat, setLoadingCat] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [fastestRoute, setFastestRoute] = useState(null);
  const [activeResult, setActiveResult] = useState(null);

  const getLocation = () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  const handleLocationRoute = async (cat) => {
    if (!locationEnabled) {
      setLocationError('Enable "My Location" in Settings to use this feature.');
      return;
    }
    setLoadingCat(cat.label);
    setLocationError('');
    try {
      let coords = userCoords;
      if (!coords) {
        coords = await getLocation();
        setUserCoords(coords);
      }

      const place = await findNearestPlace(coords.lat, coords.lng, cat);
      if (!place) {
        setLocationError(`No ${cat.label.toLowerCase()} found in your area. Try "Get Fastest Route" instead.`);
        setLoadingCat(null);
        return;
      }

      const route = await fetchRoute(coords.lat, coords.lng, place.lat, place.lng, sensors, alertRadius);
      if (!route) {
        setLocationError('Could not calculate a route. Check your connection and try again.');
        setLoadingCat(null);
        return;
      }

      setActiveResult({ route, place, category: cat });
      if (onRouteReady) {
        onRouteReady(route, place);
      }
    } catch (e) {
      console.error('Route error:', e);
      setLocationError('Enable location access.');
    }
    setLoadingCat(null);
  };

  const handleFastestRoute = async () => {
    if (!locationEnabled) {
      setLocationError('Enable "My Location" in Settings to use this feature.');
      return;
    }
    setLoading(true);
    setLocationError('');
    try {
      let coords = userCoords;
      if (!coords) {
        coords = await getLocation();
        if (!coords) {
          setLocationError('Enable location access.');
          setLoading(false);
          return;
        }
        setUserCoords(coords);
      }

      // Find routes to all three locations and check for flooding
      const results = await Promise.all(
        CATEGORIES.map(async (cat) => {
          const place = await findNearestPlace(coords.lat, coords.lng, cat);
          if (!place) return null;
          const route = await fetchRoute(coords.lat, coords.lng, place.lat, place.lng, sensors, alertRadius);
          if (!route) return null;
          return { route, place, category: cat, hasFlood: route.floodedSensorsNearby?.length > 0 };
        })
      );

      const validRoutes = results.filter(Boolean);
      if (validRoutes.length === 0) {
        setLocationError('No emergency services found nearby.');
        setLoading(false);
        return;
      }

      // Prefer flood-free routes, then select fastest
      const floodFreeRoutes = validRoutes.filter(r => !r.hasFlood);
      const fastest = (floodFreeRoutes.length > 0 ? floodFreeRoutes : validRoutes).reduce((best, current) =>
        current.route.durationMinutes < best.route.durationMinutes ? current : best
      );

      setFastestRoute(fastest);
      setActiveResult(fastest);
      if (onRouteReady) {
        onRouteReady(fastest.route, fastest.place);
      }
    } catch (e) {
      console.error('Emergency route error:', e);
      setLocationError('Error finding fastest route.');
    }
    setLoading(false);
  };



  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Individual location buttons */}
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isLoading = loadingCat === cat.label;

        return (
          <button
            key={cat.label}
            onClick={() => handleLocationRoute(cat)}
            disabled={isLoading || loading}
            className={`w-full rounded-xl border p-4 ${cat.bg} hover:opacity-80 disabled:opacity-50 transition-opacity`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${cat.color} flex-shrink-0`} />
              <span className={`text-sm font-semibold ${cat.color} flex-1`}>{cat.label}</span>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </button>
        );
      })}

      {/* Status */}
      {locationError && (
        <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{locationError}</p>
      )}

      {/* Fastest route button */}
      <button
        onClick={handleFastestRoute}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white text-sm font-semibold transition-colors"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Finding fastest route...</>
        ) : (
          <><Navigation className="w-4 h-4" />Get Fastest Route</>
        )}
      </button>

      {activeResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Route to</span>
            <span className="text-xs text-white font-semibold">{activeResult.place?.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">ETA</span>
            <span className="text-xs text-blue-400 font-semibold">{activeResult.route?.durationMinutes} min • {activeResult.route?.distanceMiles?.toFixed(1)} mi</span>
          </div>
          {activeResult.route?.floodedSensorsNearby?.length > 0 && (
            <div className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 mt-1">
              ⚠️ Flooding detected along this route—drive with caution
            </div>
          )}
          {!activeResult.route?.floodedSensorsNearby?.length && (
            <div className="text-xs text-emerald-400 mt-1">✓ Route is clear of flooding</div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}