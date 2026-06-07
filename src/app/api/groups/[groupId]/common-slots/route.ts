'use server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { generateSlots, filterCommonSlots } from '@/lib/slots';

export async function GET(request: Request, { params }: { params: { groupId: string } }) {
  try {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days') ?? '7');
    const slot = Number(url.searchParams.get('slot') ?? '30');

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        cookies: {
          getAll() {
            return cookies().getAll();
          },
          setAll() {
            /* no-op */
          }
        }
      }
    );

    // Récupère les membres du groupe
    const membersRes = await supabase.from('group_members').select('user_id').eq('group_id', params.groupId);
    if (membersRes.error) return NextResponse.json({ error: membersRes.error.message }, { status: 500 });

    const userIds: string[] = (membersRes.data ?? []).map((r: any) => r.user_id);

    // récupère les indispos pour ces users dans la fenêtre
    const startWindow = new Date();
    startWindow.setHours(0, 0, 0, 0);
    const endWindow = new Date(startWindow);
    endWindow.setDate(endWindow.getDate() + days);

    const avRes = await supabase
      .from('availabilities')
      .select('user_id,start_ts,end_ts')
      .in('user_id', userIds)
      .gte('end_ts', startWindow.toISOString())
      .lte('start_ts', endWindow.toISOString());

    if (avRes.error) return NextResponse.json({ error: avRes.error.message }, { status: 500 });

    const perUser = userIds.map((uid) => ({ user_id: uid, ranges: [] as { start: string; end: string }[] }));
    for (const r of avRes.data ?? []) {
      const idx = perUser.findIndex((p) => p.user_id === r.user_id);
      if (idx >= 0) perUser[idx].ranges.push({ start: r.start_ts, end: r.end_ts });
    }

    const slots = generateSlots(startWindow, days, slot);
    const commons = filterCommonSlots(slots, perUser);

    return NextResponse.json({ slots: commons });
  } catch (err) {
    return NextResponse.json({ error: 'server_error', details: String(err) }, { status: 500 });
  }
}
