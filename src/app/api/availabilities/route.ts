'use server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { group_id, start_ts, end_ts, note } = body;

    if (!group_id || !start_ts || !end_ts) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        cookies: {
          getAll() {
            return cookies().getAll();
          },
          setAll() {
            // no-op in this context
          }
        }
      }
    );

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const insert = await supabase.from('availabilities').insert({
      user_id: user.id,
      group_id,
      start_ts,
      end_ts,
      note
    });

    if (insert.error) {
      return NextResponse.json({ error: insert.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, record: insert.data?.[0] ?? null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'server_error', details: String(err) }, { status: 500 });
  }
}
