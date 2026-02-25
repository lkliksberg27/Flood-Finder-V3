// Flood detection: sensor must be within 1–20m of the route line
const FLOOD_DETECTION_RADIUS_M = 20;

export function checkRouteFlooding(route, sensors) {
  if (!route?.coordinates || !sensors?.length) return [];
  return sensors.filter(s =>
    s.status !== 'OK' &&
    route.coordinates.some(c => getDistanceMeters(c.lat, c.lng, s.lat, s.lng) <= FLOOD_DETECTION_RADIUS_M)
  );
}

export function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Fetch an avoidance route from OSRM, passing flooded sensor coords as waypoints to route around
export async function fetchAvoidanceRoute(startLat, startLng, endLat, endLng, floodedSensors) {
  // Build waypoints that nudge the route away from flooded sensors
  // Strategy: request multiple alternatives and pick the one with fewest flooded sensors
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=3`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes?.length) return null;

  // Pick the route with the fewest flooded sensor hits
  let bestRoute = null;
  let bestHits = Infinity;

  for (const r of data.routes) {
    const coords = r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const hits = floodedSensors.filter(s =>
      coords.some(c => getDistanceMeters(c.lat, c.lng, s.lat, s.lng) <= FLOOD_DETECTION_RADIUS_M)
    ).length;
    if (hits < bestHits) {
      bestHits = hits;
      bestRoute = { coords, raw: r };
    }
  }

  if (!bestRoute) return null;

  return {
    id: 'avoidance',
    label: 'Flood-safe route',
    distanceMiles: +(bestRoute.raw.distance / 1609.34).toFixed(1),
    durationMinutes: Math.round(bestRoute.raw.duration / 60),
    coordinates: bestRoute.coords,
    direction: 'avoidance',
    floodHits: bestHits,
  };
}