import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/api-auth';
import { getDisplayNames } from '@/lib/display-names';
import {
  createGroup as createLocalGroup,
  isSchemaCacheError,
  listGroups,
  listGroupsByMember,
  listGroupsByOwner
} from '@/lib/local-store';

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

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const scope = String(url.searchParams.get('scope') ?? 'all');
  const ownerName = auth.email;
  const memberName = auth.email;

  const { supabase } = auth;

  if (scope === 'owned' && ownerName) {
    const { data, error } = await supabase.from('groups').select('*').eq('owner_name', ownerName).order('created_at', { ascending: false });

    if (error) {
      if (isSchemaCacheError(error)) {
        const groups = await listGroupsByOwner(ownerName);
        return NextResponse.json({ data: groups, display_names: await getDisplayNames(groups.map((group) => group.owner_name)) });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, display_names: await getDisplayNames((data ?? []).map((group) => group.owner_name)) });
  }

  if (scope === 'invited' && memberName) {
    const membersRes = await supabase.from('group_members').select('group_id').eq('member_name', memberName);
    if (membersRes.error) {
      if (isSchemaCacheError(membersRes.error)) {
        const groups = await listGroupsByMember(memberName);
        return NextResponse.json({ data: groups, display_names: await getDisplayNames(groups.map((group) => group.owner_name)) });
      }

      return NextResponse.json({ error: membersRes.error.message }, { status: 500 });
    }

    const groupIds = Array.from(new Set((membersRes.data ?? []).map((row) => row.group_id).filter(Boolean)));
    if (groupIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .neq('owner_name', memberName)
      .order('created_at', { ascending: false });

    if (error) {
      if (isSchemaCacheError(error)) {
        const groups = await listGroupsByMember(memberName);
        return NextResponse.json({ data: groups, display_names: await getDisplayNames(groups.map((group) => group.owner_name)) });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, display_names: await getDisplayNames((data ?? []).map((group) => group.owner_name)) });
  }

  const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });

  if (error) {
    if (isSchemaCacheError(error)) {
      const groups = await listGroups();
      return NextResponse.json({ data: groups, display_names: await getDisplayNames(groups.map((group) => group.owner_name)) });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, display_names: await getDisplayNames((data ?? []).map((group) => group.owner_name)) });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const ownerName = auth.email;
    const memberNames = Array.from(new Set([ownerName, ...splitNames(body.members)]));

    if (!name || !ownerName) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const { supabase } = auth;
    const groupInsert = await supabase.from('groups').insert({ name, owner_name: ownerName }).select('*').single();

    if (groupInsert.error || !groupInsert.data) {
      if (groupInsert.error && isSchemaCacheError(groupInsert.error)) {
        const localGroup = await createLocalGroup(name, ownerName, memberNames);
        return NextResponse.json({ data: localGroup }, { status: 201 });
      }

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
