import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  createAvailability as createLocalAvailability,
  deleteAvailabilities as deleteLocalAvailabilities,
  getEvent,
  isSchemaCacheError,
  listAvailabilities
} from '@/lib/local-store';

type ScopeType = 'group' | 'event';

function isScopeType(value: string): value is ScopeType {
  return value === 'group' || value === 'event';
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const scopeType = String(url.searchParams.get('scope_type') ?? '');
  const scopeId = String(url.searchParams.get('scope_id') ?? '');
  const memberName = String(url.searchParams.get('member_name') ?? '').trim();

  if (!isScopeType(scopeType) || !scopeId) {
    return NextResponse.json({ error: 'missing_scope' }, { status: 400 });
  }

  const { supabase } = auth;
  let query = supabase
    .from('availabilities')
    .select('*')
    .eq('scope_type', scopeType)
    .eq('scope_id', scopeId)
    .order('start_ts', { ascending: true });

  if (memberName) {
    query = query.eq('member_name', memberName);
  }

  const { data, error } = await query;
  if (error) {
    if (isSchemaCacheError(error)) {
      const localData = await listAvailabilities(scopeType, scopeId, memberName || undefined);
      return NextResponse.json({ data: localData });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const scopeType = String(body.scope_type ?? '');
    const scopeId = String(body.scope_id ?? '');
    const memberName = auth.email;
    const startTs = String(body.start_ts ?? '');
    const endTs = String(body.end_ts ?? '');
    const note = String(body.note ?? '').trim() || null;

    if (!isScopeType(scopeType) || !scopeId || !memberName || !startTs || !endTs) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    if (new Date(endTs) <= new Date(startTs)) {
      return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(startTs) < today) {
      return NextResponse.json({ error: 'past_range' }, { status: 400 });
    }

    const { supabase } = auth;

    if (scopeType === 'event') {
      const eventRes = await supabase
        .from('events')
        .select('availability_start_ts,availability_end_ts')
        .eq('id', scopeId)
        .single();

      if (eventRes.error) {
        if (isSchemaCacheError(eventRes.error)) {
          const localEvent = await getEvent(scopeId);
          const windowStart = localEvent?.availability_start_ts ? new Date(localEvent.availability_start_ts) : null;
          const windowEnd = localEvent?.availability_end_ts ? new Date(localEvent.availability_end_ts) : null;
          if ((windowStart && new Date(startTs) < windowStart) || (windowEnd && new Date(endTs) > windowEnd)) {
            return NextResponse.json({ error: 'outside_event_window' }, { status: 400 });
          }
        } else {
          return NextResponse.json({ error: eventRes.error.message }, { status: 500 });
        }
      } else {
        const windowStart = eventRes.data?.availability_start_ts ? new Date(eventRes.data.availability_start_ts) : null;
        const windowEnd = eventRes.data?.availability_end_ts ? new Date(eventRes.data.availability_end_ts) : null;
        if ((windowStart && new Date(startTs) < windowStart) || (windowEnd && new Date(endTs) > windowEnd)) {
          return NextResponse.json({ error: 'outside_event_window' }, { status: 400 });
        }
      }
    }

    const { data, error } = await supabase
      .from('availabilities')
      .insert({
        scope_type: scopeType,
        scope_id: scopeId,
        member_name: memberName,
        start_ts: startTs,
        end_ts: endTs,
        note
      })
      .select('*')
      .single();

    if (error || !data) {
      if (error && isSchemaCacheError(error)) {
        const localAvailability = await createLocalAvailability({
          scope_type: scopeType,
          scope_id: scopeId,
          member_name: memberName,
          start_ts: startTs,
          end_ts: endTs,
          note
        });
        return NextResponse.json({ data: localAvailability }, { status: 201 });
      }

      return NextResponse.json({ error: error?.message ?? 'availability_create_failed' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => String(id)).filter(Boolean) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'missing_ids' }, { status: 400 });
    }

    const { supabase } = auth;
    const { data, error } = await supabase.from('availabilities').delete().eq('member_name', auth.email).in('id', ids).select('*');

    if (error) {
      if (isSchemaCacheError(error)) {
        const deleted = await deleteLocalAvailabilities(ids, auth.email);
        return NextResponse.json({ data: deleted });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}
