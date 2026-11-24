import { createClient } from '@supabase/supabase-js';

const environment = import.meta.env ?? {};
const url = environment.VITE_SUPABASE_URL?.trim();
const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigured = Boolean(url && publishableKey);
export const supabaseClient = supabaseConfigured
  ? createClient(url, publishableKey, {
    realtime: { params: { eventsPerSecond: 10 } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  : null;
