import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireAuth } from '@/lib/api-auth';
import { deleteEvent as deleteLocalEvent, getEventSummary, isSchemaCacheError, updateEvent as updateLocalEvent } from '@/lib/local-store';

type RouteContext = { params: Promise<{ eventId: string }> };

async function canManageEvent(supabase: SupabaseClient, eventId: string, email: string) {
  const eventRes = await supabase.from('events').select('owner_name,group_id').eq('id', eventId).single();

  if (eventRes.error || !eventRes.data) {
    if (eventRes.error && isSchemaCacheError(eventRes.error)) {
      const localSummary = await getEventSummary(eventId);
      if (!localSummary) return { ok: false, missing: true };
      return {
        ok:
          localSummary.owner_name.toLowerCase() === email.toLowerCase() ||
          String(localSummary.group_owner_name ?? '').toLowerCase() === email.toLowerCase(),
        missing: false
      };
    }

    return { ok: false, missing: true, error: eventRes.error?.message };
  }

  const groupRes = await supabase.from('groups').select('owner_name').eq('id', eventRes.data.group_id).single();
  const groupOwner = groupRes.data?.owner_name ?? '';

  return {
    ok:
      eventRes.data.owner_name.toLowerCase() === email.toLowerCase() ||
      String(groupOwner).toLowerCase() === email.toLowerCase(),
    missing: false
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  const { eventId } = await params;
  const { supabase } = auth;
  const [eventRes, membersRes] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('event_members').select('*').eq('event_id', eventId).order('created_at', { ascending: true })
  ]);

  if (eventRes.error || !eventRes.data) {
    if (eventRes.error && isSchemaCacheError(eventRes.error)) {
      const localSummary = await getEventSummary(eventId);
      if (!localSummary) {
        return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
      }

      return NextResponse.json({
        data: {
          event: localSummary,
          group: { id: localSummary.group_id, name: localSummary.group_name ?? '', owner_name: localSummary.owner_name },
          members: localSummary.members ?? []
        }
      });
    }

    return NextResponse.json({ error: eventRes.error?.message ?? 'event_not_found' }, { status: 404 });
  }

  const groupRes = await supabase.from('groups').select('id,name,owner_name').eq('id', eventRes.data.group_id).single();

  return NextResponse.json({
    data: {
      event: eventRes.data,
      group: groupRes.error && isSchemaCacheError(groupRes.error) ? null : groupRes.data ?? null,
      members: membersRes.error && isSchemaCacheError(membersRes.error) ? [] : membersRes.data ?? []
    }
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { eventId } = await params;
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const resolvedAt = body.resolved_at === null ? null : String(body.resolved_at ?? '').trim() || null;
    const archivedAt = body.archived_at === null ? null : String(body.archived_at ?? '').trim() || null;

    if (!name && resolvedAt === null && archivedAt === null) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const { supabase } = auth;
    const management = await canManageEvent(supabase, eventId, auth.email);
    if (management.missing) {
      return NextResponse.json({ error: management.error ?? 'event_not_found' }, { status: 404 });
    }
    if (!management.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const payload: Record<string, string | null> = {};

    if (name) payload.name = name;
    if (body.resolved_at !== undefined) payload.resolved_at = resolvedAt;
    if (body.archived_at !== undefined) payload.archived_at = archivedAt;

    const { data, error } = await supabase.from('events').update(payload).eq('id', eventId).select('*').single();

    if (error || !data) {
      if (error && isSchemaCacheError(error)) {
        const localEvent = await updateLocalEvent(eventId, payload);
        if (!localEvent) {
          return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
        }

        return NextResponse.json({ data: localEvent });
      }

      return NextResponse.json({ error: error?.message ?? 'event_update_failed' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  const { eventId } = await params;
  const { supabase } = auth;
  const management = await canManageEvent(supabase, eventId, auth.email);
  if (management.missing) {
    return NextResponse.json({ error: management.error ?? 'event_not_found' }, { status: 404 });
  }
  if (!management.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('events').delete().eq('id', eventId);

  if (error) {
    if (isSchemaCacheError(error)) {
      await deleteLocalEvent(eventId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
