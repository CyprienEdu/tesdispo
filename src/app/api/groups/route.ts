import { NextResponse } from 'next/server';

import { createSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';

function splitNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((name) => String(name).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  return [];
}

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ data: [] });
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
    }

    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const ownerName = String(body.owner_name ?? '').trim();
    const memberNames = Array.from(new Set([ownerName, ...splitNames(body.members)]));

    if (!name || !ownerName) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    const groupInsert = await supabase.from('groups').insert({ name, owner_name: ownerName }).select('*').single();

    if (groupInsert.error || !groupInsert.data) {
      return NextResponse.json({ error: groupInsert.error?.message ?? 'group_create_failed' }, { status: 500 });
    }

    if (memberNames.length > 0) {
      const membersPayload = memberNames.map((memberName) => ({ group_id: groupInsert.data.id, member_name: memberName }));
      const memberInsert = await supabase.from('group_members').upsert(membersPayload, {
        onConflict: 'group_id,member_name'
      });

      if (memberInsert.error) {
        return NextResponse.json({ error: memberInsert.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ data: groupInsert.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}
