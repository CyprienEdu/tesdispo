import { NextResponse } from 'next/server';

import { createSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';

export async function GET(_: Request, { params }: { params: { groupId: string } }) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }

  const supabase = createSupabaseClient();
  const [groupRes, membersRes, eventsRes] = await Promise.all([
    supabase.from('groups').select('*').eq('id', params.groupId).single(),
    supabase.from('group_members').select('*').eq('group_id', params.groupId).order('created_at', { ascending: true }),
    supabase.from('events').select('*').eq('group_id', params.groupId).order('created_at', { ascending: false })
  ]);

  if (groupRes.error || !groupRes.data) {
    return NextResponse.json({ error: groupRes.error?.message ?? 'group_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      group: groupRes.data,
      members: membersRes.data ?? [],
      events: eventsRes.data ?? []
    }
  });
}

export async function PATCH(request: Request, { params }: { params: { groupId: string } }) {
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
    const { data, error } = await supabase.from('groups').update({ name }).eq('id', params.groupId).select('*').single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'group_update_failed' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { groupId: string } }) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from('groups').delete().eq('id', params.groupId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
