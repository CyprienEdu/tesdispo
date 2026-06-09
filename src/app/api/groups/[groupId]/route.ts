import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/api-auth';
import { getDisplayNames } from '@/lib/display-names';
import { deleteGroup, getGroupSummary, isSchemaCacheError, updateGroup } from '@/lib/local-store';

type RouteContext = { params: Promise<{ groupId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  const { groupId } = await params;
  const { supabase } = auth;
  const [groupRes, membersRes, eventsRes] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('*').eq('group_id', groupId).order('created_at', { ascending: true }),
    supabase.from('events').select('*').eq('group_id', groupId).order('created_at', { ascending: false })
  ]);

  if (groupRes.error || !groupRes.data) {
    if (groupRes.error && isSchemaCacheError(groupRes.error)) {
      const localSummary = await getGroupSummary(groupId);
      if (!localSummary) {
        return NextResponse.json({ error: 'group_not_found' }, { status: 404 });
      }

      const displayNames = await getDisplayNames([
        localSummary.owner_name,
        ...(localSummary.members ?? []).map((member) => member.member_name),
        ...(localSummary.events ?? []).map((event) => event.owner_name)
      ]);

      return NextResponse.json({ data: localSummary, display_names: displayNames });
    }

    return NextResponse.json({ error: groupRes.error?.message ?? 'group_not_found' }, { status: 404 });
  }

  const members = membersRes.error && isSchemaCacheError(membersRes.error) ? [] : membersRes.data ?? [];
  const events = eventsRes.error && isSchemaCacheError(eventsRes.error) ? [] : eventsRes.data ?? [];
  const displayNames = await getDisplayNames([
    groupRes.data.owner_name,
    ...members.map((member) => member.member_name),
    ...events.map((event) => event.owner_name)
  ]);

  return NextResponse.json({
    data: {
      group: groupRes.data,
      members,
      events
    },
    display_names: displayNames
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { groupId } = await params;
    const body = await request.json();
    const name = String(body.name ?? '').trim();

    if (!name) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const { supabase } = auth;
    const groupLookup = await supabase.from('groups').select('owner_name').eq('id', groupId).single();

    if (groupLookup.error || !groupLookup.data) {
      if (groupLookup.error && isSchemaCacheError(groupLookup.error)) {
        const localSummary = await getGroupSummary(groupId);
        if (!localSummary) return NextResponse.json({ error: 'group_not_found' }, { status: 404 });
        if (localSummary.owner_name.toLowerCase() !== auth.email.toLowerCase()) {
          return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: groupLookup.error?.message ?? 'group_not_found' }, { status: 404 });
      }
    } else if (groupLookup.data.owner_name.toLowerCase() !== auth.email.toLowerCase()) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase.from('groups').update({ name }).eq('id', groupId).select('*').single();

    if (error || !data) {
      if (error && isSchemaCacheError(error)) {
        const localGroup = await updateGroup(groupId, name);
        if (!localGroup) {
          return NextResponse.json({ error: 'group_not_found' }, { status: 404 });
        }

        return NextResponse.json({ data: localGroup });
      }

      return NextResponse.json({ error: error?.message ?? 'group_update_failed' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  const { groupId } = await params;
  const { supabase } = auth;
  const groupLookup = await supabase.from('groups').select('owner_name').eq('id', groupId).single();

  if (groupLookup.error || !groupLookup.data) {
    if (groupLookup.error && isSchemaCacheError(groupLookup.error)) {
      const localSummary = await getGroupSummary(groupId);
      if (!localSummary) return NextResponse.json({ error: 'group_not_found' }, { status: 404 });
      if (localSummary.owner_name.toLowerCase() !== auth.email.toLowerCase()) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: groupLookup.error?.message ?? 'group_not_found' }, { status: 404 });
    }
  } else if (groupLookup.data.owner_name.toLowerCase() !== auth.email.toLowerCase()) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('groups').delete().eq('id', groupId);

  if (error) {
    if (isSchemaCacheError(error)) {
      await deleteGroup(groupId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
