import { NextResponse } from 'next/server';

import { isBetaAllowed } from '@/lib/beta-access';
import { sendSignupConfirmationEmail } from '@/lib/resend';
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
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: username ? { username } : undefined,
        redirectTo: `${new URL(request.url).origin}/account`
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    }

    const confirmationUrl = data.properties?.action_link;

    if (!confirmationUrl) {
      if (data.user?.id) {
        await supabase.auth.admin.deleteUser(data.user.id);
      }

      return NextResponse.json({ error: 'confirmation_link_missing' }, { status: 500 });
    }

    const emailResult = await sendSignupConfirmationEmail(email, confirmationUrl);

    if (emailResult.error) {
      if (data.user?.id) {
        await supabase.auth.admin.deleteUser(data.user.id);
      }

      return NextResponse.json({ error: emailResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'signup_failed' },
      { status: 500 }
    );
  }
}
