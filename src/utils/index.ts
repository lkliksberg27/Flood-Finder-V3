export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

// Returns a hex blue color where lighter = shallow water, darker = deep water
export function getWaterBlue(waterLevelCm: number): string {
  const t = Math.min(1, Math.max(0, (waterLevelCm || 0) / 100));
  // blue-300 rgb(147,197,253) → blue-900 rgb(30,58,138)
  const r = Math.round(147 - 117 * t);
  const g = Math.round(197 - 139 * t);
  const b = Math.round(253 - 115 * t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Returns Tailwind class sets based on water depth
export function getWaterBlueTw(waterLevelCm: number) {
  const cm = waterLevelCm || 0;
  if (cm <= 15) return { text: 'text-blue-300', bg: 'bg-blue-400/10', border: 'border-blue-400/20', dot: 'bg-blue-300', label: 'Low' };
  if (cm <= 40) return { text: 'text-blue-400', bg: 'bg-blue-500/12', border: 'border-blue-500/25', dot: 'bg-blue-400', label: 'Moderate' };
  if (cm <= 65) return { text: 'text-blue-500', bg: 'bg-blue-500/18', border: 'border-blue-500/30', dot: 'bg-blue-500', label: 'High' };
  return { text: 'text-blue-600', bg: 'bg-blue-600/20', border: 'border-blue-600/30', dot: 'bg-blue-600 animate-pulse', label: 'Severe' };
}

export function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}