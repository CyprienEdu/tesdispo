import { NextResponse } from 'next/server';

import { createSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';

export async function GET(_: Request, { params }: { params: { eventId: string } }) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }

  const supabase = createSupabaseClient();
  const [eventRes, membersRes] = await Promise.all([
    supabase.from('events').select('*').eq('id', params.eventId).single(),
    supabase.from('event_members').select('*').eq('event_id', params.eventId).order('created_at', { ascending: true })
  ]);

  if (eventRes.error || !eventRes.data) {
    return NextResponse.json({ error: eventRes.error?.message ?? 'event_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      event: eventRes.data,
      members: membersRes.data ?? []
    }
  });
}

export async function PATCH(request: Request, { params }: { params: { eventId: string } }) {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
    }

    const body = await request.json();
    const name = String(body.name ?? '').trim();

    if (!name) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from('events').update({ name }).eq('id', params.eventId).select('*').single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'event_update_failed' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { eventId: string } }) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from('events').delete().eq('id', params.eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
