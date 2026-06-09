import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/api-auth';
import { addGroupMember, isSchemaCacheError, listGroupMembers } from '@/lib/local-store';
import { createSupabaseAdminClient } from '@/lib/supabase';

function cleanName(value: unknown) {
  return String(value ?? '').trim();
}

type RouteContext = { params: Promise<{ groupId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  const { groupId } = await params;
  const { supabase } = auth;
  const { data, error } = await supabase.from('group_members').select('*').eq('group_id', groupId).order('created_at', { ascending: true });

  if (error) {
    if (isSchemaCacheError(error)) {
      return NextResponse.json({ data: await listGroupMembers(groupId) });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { groupId } = await params;
    const body = await request.json();
    const memberName = cleanName(body.member_name);

    if (!memberName) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const normalizedMemberName = memberName.toLowerCase() === auth.email.toLowerCase() ? auth.email : memberName;
    const isSelfJoin = normalizedMemberName.toLowerCase() === auth.email.toLowerCase();
    const group = await admin.from('groups').select('id,owner_name').eq('id', groupId).single();

    if (group.error || !group.data) {
      return NextResponse.json({ error: group.error?.message ?? 'group_not_found' }, { status: 404 });
    }

    if (!isSelfJoin && group.data.owner_name.toLowerCase() !== auth.email.toLowerCase()) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { data, error } = await admin
      .from('group_members')
      .insert({ group_id: groupId, member_name: normalizedMemberName })
      .select('*')
      .single();

    if (error || !data) {
      if (error?.code === '23505') {
        const existing = await admin
          .from('group_members')
          .select('*')
          .eq('group_id', groupId)
          .eq('member_name', normalizedMemberName)
          .single();

        if (!existing.error && existing.data) {
          return NextResponse.json({ data: existing.data }, { status: 200 });
        }
      }

      if (error && isSchemaCacheError(error)) {
        const localMember = await addGroupMember(groupId, normalizedMemberName);
        return NextResponse.json({ data: localMember }, { status: 201 });
      }

      return NextResponse.json({ error: error?.message ?? 'member_create_failed' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}
