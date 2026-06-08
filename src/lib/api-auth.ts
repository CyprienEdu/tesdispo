import { NextResponse } from 'next/server';

import { isBetaAllowed } from './beta-access';
import { createSupabaseRequestClient, hasSupabaseConfig } from './supabase';

export function missingSupabaseResponse() {
  return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
}

export async function requireAuth(request: Request) {
  if (!hasSupabaseConfig()) {
    return { error: missingSupabaseResponse() };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!token) {
    return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }

  const supabase = createSupabaseRequestClient(token);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.email) {
    return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }

  if (!isBetaAllowed(data.user.email)) {
    return { error: NextResponse.json({ error: 'beta_access_denied' }, { status: 403 }) };
  }

  return { supabase, user: data.user, email: data.user.email };
}
