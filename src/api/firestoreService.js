// Sensor data is now sourced from Supabase (shared with the city dashboard).
// Filename kept for compatibility — every page imports `entities` from here.
import { supabase } from './supabaseClient';
import { createLocalEntity } from './localStorageService';

// Supabase device row + latest sensor_reading -> the shape V3 pages expect:
//   { id, name, deviceId, lat, lng, waterLevelCm, batteryV, status, lastSeen }
function mapDeviceToSensor(device, latestReading) {
  const waterLevelCm = latestReading?.flood_depth_cm ?? 0;
  const batteryV =
    latestReading?.battery_v && latestReading.battery_v > 0
      ? latestReading.battery_v
      : (device.battery_v ?? 0);

  // Map Supabase status -> V3 status (OK / WARN / ALERT)
  let status = 'OK';
  if (device.status === 'alert' || waterLevelCm >= 30) status = 'ALERT';
  else if (waterLevelCm >= 10) status = 'WARN';

  return {
    id: device.device_id,
    deviceId: device.device_id,
    name: device.name || device.device_id,
    lat: Number(device.lat) || 0,
    lng: Number(device.lng) || 0,
    waterLevelCm,
    batteryV,
    status,
    lastSeen: latestReading?.recorded_at || device.last_seen || null,
    neighborhood: device.neighborhood || null,
  };
}

// Fetch all devices and merge each with its most-recent sensor_reading.
async function fetchAllSensors() {
  const { data: devices, error: devErr } = await supabase
    .from('devices')
    .select('*');
  if (devErr) throw devErr;
  if (!devices?.length) return [];

  // Pull a chunk of recent readings — enough that every active device has
  // its latest entry, without paging the whole history table.
  const { data: readings, error: readErr } = await supabase
    .from('sensor_readings')
    .select('device_id,flood_depth_cm,battery_v,recorded_at,water_detected,distance_cm')
    .order('recorded_at', { ascending: false })
    .limit(2000);
  if (readErr) throw readErr;

  // Group: keep the newest reading per device_id
  const latestByDevice = {};
  for (const r of readings || []) {
    if (!latestByDevice[r.device_id]) latestByDevice[r.device_id] = r;
  }

  return devices.map((d) => mapDeviceToSensor(d, latestByDevice[d.device_id]));
}

// Sensor entity — read-only from V3's perspective. create/update/delete are
// no-ops because real data flows from physical hardware via the bridge.
function createSensorEntity() {
  return {
    async list(sortParam) {
      const sensors = await fetchAllSensors();
      if (!sortParam) return sensors;

      const desc = sortParam.startsWith('-');
      const field = desc ? sortParam.slice(1) : sortParam;
      const sorted = [...sensors].sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return desc ? 1 : -1;
        if (av > bv) return desc ? -1 : 1;
        return 0;
      });
      return sorted;
    },

    async create() {
      console.warn('[Sensor.create] ignored — sensor data flows from hardware');
      return null;
    },
    async update(id) {
      console.warn('[Sensor.update] ignored — sensor data flows from hardware');
      return { id };
    },
    async delete(id) {
      console.warn('[Sensor.delete] ignored — sensor data flows from hardware');
      return { id };
    },

    // Realtime: subscribe to inserts on sensor_readings + updates on devices,
    // and emit refresh-style events. The app refetches on each change.
    subscribe(callback) {
      const refetchAndEmit = async () => {
        try {
          const sensors = await fetchAllSensors();
          for (const s of sensors) {
            callback({ type: 'update', id: s.id, data: s });
          }
        } catch (e) {
          console.warn('[Sensor.subscribe] refetch failed', e);
        }
      };

      const channel = supabase
        .channel('sensors-feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
          refetchAndEmit
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'devices' },
          refetchAndEmit
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

export const entities = {
  Sensor: createSensorEntity(),
  WatchedLocation: createLocalEntity('watchedLocations'),
  Course: createLocalEntity('courses'),
  Settings: createLocalEntity('settings'),
};
