import { NextResponse } from 'next/server';

import { isBetaAllowed } from '@/lib/beta-access';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  let body: { email?: string; password?: string; username?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const username = String(body.username ?? '').trim();

  if (!email || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 });
  }

  if (!isBetaAllowed(email)) {
    return NextResponse.json({ error: 'beta_denied' }, { status: 403 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: username ? { username } : undefined
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'signup_failed' },
      { status: 500 }
    );
  }
}
