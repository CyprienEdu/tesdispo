import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/api-auth';
import { buildAvailabilityPeriods, buildPeriodWindows, filterCommonSlots, generateTimeSlots, type PeriodView, type Unavailability } from '@/lib/freetime';
import { isSchemaCacheError, listAvailabilities, listEventMembers } from '@/lib/local-store';

function isPeriodView(value: string): value is PeriodView {
  return value === 'day' || value === 'week' || value === 'month';
}

type RouteContext = { params: Promise<{ eventId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { eventId } = await params;
    const url = new URL(request.url);
    const viewParam = String(url.searchParams.get('view') ?? 'week');
    const view: PeriodView = isPeriodView(viewParam) ? viewParam : 'week';
    const count = Number(url.searchParams.get('count') ?? (view === 'day' ? '14' : view === 'week' ? '8' : '6')) || (view === 'day' ? 14 : view === 'week' ? 8 : 6);

    const { supabase } = auth;
    const membersRes = await supabase.from('event_members').select('member_name').eq('event_id', eventId);
    if (membersRes.error) {
      if (isSchemaCacheError(membersRes.error)) {
        const members = (await listEventMembers(eventId)).map((row) => row.member_name).filter(Boolean);
        if (members.length === 0) {
          return NextResponse.json({ slots: [], periods: [], summary: { fully_free_periods: 0, total_periods: 0 } });
        }

        const startWindow = new Date();
        startWindow.setHours(0, 0, 0, 0);
        const periodWindows = buildPeriodWindows(startWindow, view, count);
        const endWindow = new Date(periodWindows[periodWindows.length - 1]?.end ?? startWindow.toISOString());
        const avRows = (await listAvailabilities('event', eventId)).filter((row) => members.includes(row.member_name) && row.start_ts < endWindow.toISOString() && row.end_ts > startWindow.toISOString());
        const perMember: Unavailability[] = members.map((memberName) => ({ member_name: memberName, ranges: [] }));

        for (const row of avRows) {
          const index = perMember.findIndex((member) => member.member_name === row.member_name);
          if (index >= 0) {
            perMember[index].ranges.push({ start: row.start_ts, end: row.end_ts });
          }
        }

        const periods = buildAvailabilityPeriods(members, perMember, view, count, startWindow);
        const slots = generateTimeSlots(startWindow, 7, 30);
        const commons = filterCommonSlots(slots, perMember);

        return NextResponse.json({
          slots: commons,
          periods,
          summary: { fully_free_periods: periods.filter((period) => period.fullyFree).length, total_periods: periods.length }
        });
      }

      return NextResponse.json({ error: membersRes.error.message }, { status: 500 });
    }

    const members = (membersRes.data ?? []).map((row) => row.member_name).filter(Boolean);
    if (members.length === 0) {
      return NextResponse.json({ slots: [], periods: [], summary: { fully_free_periods: 0, total_periods: 0 } });
    }

    const startWindow = new Date();
    startWindow.setHours(0, 0, 0, 0);
    const periodWindows = buildPeriodWindows(startWindow, view, count);
    const endWindow = new Date(periodWindows[periodWindows.length - 1]?.end ?? startWindow.toISOString());

    const avRes = await supabase
      .from('availabilities')
      .select('member_name,start_ts,end_ts')
      .eq('scope_type', 'event')
      .eq('scope_id', eventId)
      .in('member_name', members)
      .lt('start_ts', endWindow.toISOString())
      .gt('end_ts', startWindow.toISOString());

    if (avRes.error) {
      if (isSchemaCacheError(avRes.error)) {
        const avRows = (await listAvailabilities('event', eventId)).filter((row) => members.includes(row.member_name) && row.start_ts < endWindow.toISOString() && row.end_ts > startWindow.toISOString());
        const perMember: Unavailability[] = members.map((memberName) => ({ member_name: memberName, ranges: [] }));

        for (const row of avRows) {
          const index = perMember.findIndex((member) => member.member_name === row.member_name);
          if (index >= 0) {
            perMember[index].ranges.push({ start: row.start_ts, end: row.end_ts });
          }
        }

        const periods = buildAvailabilityPeriods(members, perMember, view, count, startWindow);
        const slots = generateTimeSlots(startWindow, 7, 30);
        const commons = filterCommonSlots(slots, perMember);

        return NextResponse.json({
          slots: commons,
          periods,
          summary: { fully_free_periods: periods.filter((period) => period.fullyFree).length, total_periods: periods.length }
        });
      }

      return NextResponse.json({ error: avRes.error.message }, { status: 500 });
    }

    const perMember: Unavailability[] = members.map((memberName) => ({ member_name: memberName, ranges: [] }));
    for (const row of avRes.data ?? []) {
      const index = perMember.findIndex((member) => member.member_name === row.member_name);
      if (index >= 0) {
        perMember[index].ranges.push({ start: row.start_ts, end: row.end_ts });
      }
    }

    const periods = buildAvailabilityPeriods(members, perMember, view, count, startWindow);
    const slots = generateTimeSlots(startWindow, 7, 30);
    const commons = filterCommonSlots(slots, perMember);

    return NextResponse.json({
      slots: commons,
      periods,
      summary: {
        fully_free_periods: periods.filter((period) => period.fullyFree).length,
        total_periods: periods.length
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'server_error', details: String(error) }, { status: 500 });
  }
}
