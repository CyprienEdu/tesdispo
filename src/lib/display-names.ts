import { createSupabaseAdminClient } from './supabase';

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

export function displayForName(name: string, displayNames: Record<string, string> = {}) {
  const key = cleanEmail(name);
  return displayNames[key] || name;
}

export async function getDisplayNames(names: string[]) {
  const wanted = Array.from(new Set(names.map(cleanEmail).filter((name) => name.includes('@'))));
  const result: Record<string, string> = {};

  if (wanted.length === 0) return result;

  try {
    const supabase = createSupabaseAdminClient();
    let page = 1;
    const perPage = 1000;

    while (page <= 10) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;

      for (const user of data.users) {
        const email = cleanEmail(user.email ?? '');
        if (!wanted.includes(email)) continue;
        const username = String(user.user_metadata?.username ?? '').trim();
        if (username) result[email] = username;
      }

      if (Object.keys(result).length === wanted.length || data.users.length < perPage) break;
      page += 1;
    }
  } catch {
    return result;
  }

  return result;
}
