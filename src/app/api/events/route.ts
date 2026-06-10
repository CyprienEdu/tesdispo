import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/api-auth';
import { getDisplayNames } from '@/lib/display-names';
import { createEvent as createLocalEvent, getGroupSummary, isSchemaCacheError, listEventsWithGroupNames } from '@/lib/local-store';

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
  const status = String(url.searchParams.get('status') ?? 'all');
  const groupId = String(url.searchParams.get('group_id') ?? '').trim();

  const { supabase } = auth;
  let query = supabase.from('events').select('*');

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  if (status === 'upcoming') {
    query = query.not('resolved_at', 'is', null).gt('resolved_at', new Date().toISOString()).is('archived_at', null);
  }

  if (status === 'past') {
    query = query.not('resolved_at', 'is', null).lte('resolved_at', new Date().toISOString());
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    if (isSchemaCacheError(error)) {
      const events = await listEventsWithGroupNames();
      const filtered = events.filter((event) => {
        if (groupId && event.group_id !== groupId) return false;
        if (status === 'upcoming') {
          return event.resolved_at !== null && new Date(event.resolved_at) > new Date() && !event.archived_at;
        }
        if (status === 'past') {
          return event.resolved_at !== null && new Date(event.resolved_at) <= new Date();
        }
        return true;
      });

      return NextResponse.json({
        data: filtered,
        display_names: await getDisplayNames(filtered.map((event) => event.owner_name))
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = data ?? [];
  const groupIds = Array.from(new Set(events.map((event) => event.group_id).filter(Boolean)));
  const groupsRes = groupIds.length > 0 ? await supabase.from('groups').select('id,name').in('id', groupIds) : { data: [], error: null };

  if (groupsRes.error) {
    if (isSchemaCacheError(groupsRes.error)) {
      const fallbackEvents = events.map((event) => ({
          ...event,
          group_name: ''
        }));
      return NextResponse.json({
        data: fallbackEvents,
        display_names: await getDisplayNames(fallbackEvents.map((event) => event.owner_name))
      });
    }

    return NextResponse.json({ error: groupsRes.error.message }, { status: 500 });
  }

  const groupNameById = new Map((groupsRes.data ?? []).map((group) => [group.id, group.name]));

  const mappedEvents = events.map((event) => ({
      ...event,
      group_name: groupNameById.get(event.group_id) ?? ''
    }));

  return NextResponse.json({
    data: mappedEvents,
    display_names: await getDisplayNames(mappedEvents.map((event) => event.owner_name))
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const groupId = String(body.group_id ?? '').trim();
    const name = String(body.name ?? '').trim();
    const ownerName = auth.email;
    const memberNames = Array.from(new Set([ownerName, ...splitNames(body.members)]));
    const resolvedAt = String(body.resolved_at ?? '').trim() || null;
    const availabilityStartTs = String(body.availability_start_ts ?? '').trim() || null;
    const availabilityEndTs = String(body.availability_end_ts ?? '').trim() || null;

    if (!name || !ownerName) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    if (availabilityStartTs && availabilityEndTs && new Date(availabilityEndTs) <= new Date(availabilityStartTs)) {
      return NextResponse.json({ error: 'invalid_availability_window' }, { status: 400 });
    }

    const { supabase } = auth;
    if (groupId) {
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
    }

    const eventInsert = await supabase
      .from('events')
      .insert({
        group_id: groupId || null,
        name,
        owner_name: ownerName,
        resolved_at: resolvedAt,
        availability_start_ts: availabilityStartTs,
        availability_end_ts: availabilityEndTs
      })
      .select('*')
      .single();

    if (eventInsert.error || !eventInsert.data) {
      if (eventInsert.error && isSchemaCacheError(eventInsert.error)) {
        const localEvent = await createLocalEvent(groupId || null, name, ownerName, resolvedAt, memberNames, availabilityStartTs, availabilityEndTs);
        return NextResponse.json({ data: localEvent }, { status: 201 });
      }

      return NextResponse.json({ error: eventInsert.error?.message ?? 'event_create_failed' }, { status: 500 });
    }

    if (memberNames.length > 0) {
      const membersPayload = memberNames.map((memberName) => ({ event_id: eventInsert.data.id, member_name: memberName }));
      const memberInsert = await supabase.from('event_members').upsert(membersPayload, {
        onConflict: 'event_id,member_name'
      });

      if (memberInsert.error) {
        return NextResponse.json({ error: memberInsert.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ data: eventInsert.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}
