import { NextResponse } from 'next/server';

import { createSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';

function cleanName(value: unknown) {
  return String(value ?? '').trim();
}

export async function GET(_: Request, { params }: { params: { groupId: string } }) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ data: [] });
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from('group_members').select('*').eq('group_id', params.groupId).order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { groupId: string } }) {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
    }

    const body = await request.json();
    const memberName = cleanName(body.member_name);

    if (!memberName) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('group_members')
      .upsert({ group_id: params.groupId, member_name: memberName }, { onConflict: 'group_id,member_name' })
      .select('*')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'member_create_failed' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}
