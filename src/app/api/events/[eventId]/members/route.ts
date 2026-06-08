import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/api-auth';
import { addEventMember, isSchemaCacheError, listEventMembers } from '@/lib/local-store';

type RouteContext = { params: Promise<{ eventId: string }> };

function cleanName(value: unknown) {
  return String(value ?? '').trim();
}

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  const { eventId } = await params;
  const { supabase } = auth;
  const { data, error } = await supabase.from('event_members').select('*').eq('event_id', eventId).order('created_at', { ascending: true });

  if (error) {
    if (isSchemaCacheError(error)) {
      return NextResponse.json({ data: await listEventMembers(eventId) });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { eventId } = await params;
    const body = await request.json();
    const memberName = cleanName(body.member_name);

    if (!memberName) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const { supabase } = auth;
    const { data, error } = await supabase
      .from('event_members')
      .upsert({ event_id: eventId, member_name: memberName }, { onConflict: 'event_id,member_name' })
      .select('*')
      .single();

    if (error || !data) {
      if (error && isSchemaCacheError(error)) {
        const localMember = await addEventMember(eventId, memberName);
        return NextResponse.json({ data: localMember }, { status: 201 });
      }

      return NextResponse.json({ error: error?.message ?? 'member_create_failed' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}
