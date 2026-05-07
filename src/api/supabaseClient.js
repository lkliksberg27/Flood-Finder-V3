import { createClient } from '@supabase/supabase-js';

// Same Supabase project as the city dashboard / firmware.
// URL is public (visible in any frontend). The anon key must be supplied via
// `VITE_SUPABASE_ANON_KEY` env var (set in Vercel project settings).
// NEVER bundle the service_role key into the browser — it bypasses RLS.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://zywpdxnwkvotsyjisjwg.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  // Fail loud at startup instead of getting cryptic 401s later.
  console.error(
    '[Supabase] VITE_SUPABASE_ANON_KEY is not set. Add it in your Vercel ' +
      'project (and .env.local for dev). Sensor data will not load.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || '', {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});
