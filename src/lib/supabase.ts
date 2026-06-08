import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseConfig());
}

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error('Supabase env vars are missing');
  }

  if (!browserClient) {
    browserClient = createClient(config.url, config.anonKey);
  }

  return browserClient;
}

export function createSupabaseClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error('Supabase env vars are missing');
  }

  return createClient(config.url, config.anonKey);
}

export function createSupabaseRequestClient(accessToken: string) {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error('Supabase env vars are missing');
  }

  return createClient(config.url, config.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}
