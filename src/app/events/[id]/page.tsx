'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck2, Copy, Edit3, Save, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { addDays, addMonths, endOfMonth, format, startOfMonth } from 'date-fns';

import { AvailabilityCalendar, type AvailabilityRange, type CalendarView } from '@/components/availability-calendar';
import { useAuth } from '@/components/auth-context';

type EventPayload = {
  event: {
    id: string;
    group_id: string | null;
    name: string;
    owner_name: string;
    resolved_at: string | null;
    archived_at: string | null;
    availability_start_ts: string | null;
    availability_end_ts: string | null;
    created_at: string;
  };
  group: { id: string; name: string; owner_name: string } | null;
  members: { id: string; member_name: string }[];
};

type AvailabilityMode = 'busy' | 'free';

function toLocalInputValue(value: string | null) {
  return value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm") : '';
}

function rangeOverlaps(start: Date, end: Date, range: AvailabilityRange) {
  return new Date(range.start_ts) < end && new Date(range.end_ts) > start;
}

function addMillisecond(date: Date, value: number) {
  const result = new Date(date);
  result.setMilliseconds(result.getMilliseconds() + value);
  return result;
}

function includesName(list: string[], name: string) {
  return list.some((item) => item.toLowerCase() === name.toLowerCase());
}

function displayFor(name: string, displayNames: Record<string, string>) {
  return displayNames[name.toLowerCase()] || name;
}

function monthDays(anchorDate: Date) {
  const days: Date[] = [];
  const end = endOfMonth(anchorDate);
  let cursor = startOfMonth(anchorDate);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return days;
}

function normalizeDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function daysBetweenInclusive(start: Date | null, end: Date | null) {
  if (!start || !end) return 1;
  return Math.max(1, Math.ceil((normalizeDay(end).getTime() - normalizeDay(start).getTime()) / 86400000) + 1);
}

function sameDate(left: Date, right: Date) {
  return normalizeDay(left).getTime() === normalizeDay(right).getTime();
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { apiFetch, email } = useAuth();
  const [payload, setPayload] = useState<EventPayload | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [chefMonth, setChefMonth] = useState(() => new Date());
  const [synthesisMonth, setSynthesisMonth] = useState(() => new Date());
  const [selectedMember, setSelectedMember] = useState('all');
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('busy');
  const [consecutiveDays, setConsecutiveDays] = useState('1');
  const [memberName, setMemberName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [availabilityStart, setAvailabilityStart] = useState('');
  const [availabilityEnd, setAvailabilityEnd] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editResolvedAt, setEditResolvedAt] = useState('');
  const [editAvailabilityStart, setEditAvailabilityStart] = useState('');
  const [editAvailabilityEnd, setEditAvailabilityEnd] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const invitePath = `/join/event/${resolvedParams.id}`;

  async function loadData() {
    if (!email) return;

    const [eventRes, rangesRes] = await Promise.all([
      apiFetch(`/api/events/${resolvedParams.id}`, { cache: 'no-store' }),
      apiFetch(`/api/availabilities?scope_type=event&scope_id=${resolvedParams.id}`, { cache: 'no-store' })
    ]);

    const eventJson = await eventRes.json().catch(() => ({ data: null }));
    const rangesJson = await rangesRes.json().catch(() => ({ data: [] }));

    if (!eventRes.ok || !eventJson?.data?.event) {
      setError(eventJson?.error ?? 'Evenement introuvable.');
      setPayload(null);
      return;
    }

    setError('');
    setPayload({
      event: eventJson.data.event,
      group: eventJson.data.group ?? null,
      members: eventJson.data.members ?? []
    });
    setDisplayNames(eventJson.display_names ?? {});
    setRanges(rangesJson.data ?? []);
    setEventDate(toLocalInputValue(eventJson.data.event.resolved_at));
    setAvailabilityStart(toLocalInputValue(eventJson.data.event.availability_start_ts ?? null));
    setAvailabilityEnd(toLocalInputValue(eventJson.data.event.availability_end_ts ?? null));
    setEditName(eventJson.data.event.name);
    setEditResolvedAt(toLocalInputValue(eventJson.data.event.resolved_at));
    setEditAvailabilityStart(toLocalInputValue(eventJson.data.event.availability_start_ts ?? null));
    setEditAvailabilityEnd(toLocalInputValue(eventJson.data.event.availability_end_ts ?? null));
    setConsecutiveDays(String(daysBetweenInclusive(
      eventJson.data.event.availability_start_ts ? new Date(eventJson.data.event.availability_start_ts) : null,
      eventJson.data.event.availability_end_ts ? new Date(eventJson.data.event.availability_end_ts) : null
    )));
    setSynthesisMonth(eventJson.data.event.availability_start_ts ? new Date(eventJson.data.event.availability_start_ts) : new Date());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id, email]);

  const canManageEvent = payload
    ? email.toLowerCase() === payload.event.owner_name.toLowerCase() ||
      email.toLowerCase() === String(payload.group?.owner_name ?? '').toLowerCase()
    : false;
  const availabilityMinDate = useMemo(
    () => (payload?.event.availability_start_ts ? new Date(payload.event.availability_start_ts) : null),
    [payload]
  );
  const availabilityMaxDate = useMemo(
    () => (payload?.event.availability_end_ts ? new Date(payload.event.availability_end_ts) : null),
    [payload]
  );
  const today = useMemo(() => normalizeDay(new Date()), []);
  const effectiveMinDate = availabilityMinDate && availabilityMinDate > today ? availabilityMinDate : today;
  const requestedConsecutiveDays = Math.max(1, Number(consecutiveDays) || 1);

  const selectedRanges = useMemo(() => {
    const visibleRanges = ranges.filter((range) => {
      if (new Date(range.end_ts) < today) return false;
      if (availabilityMinDate && new Date(range.end_ts) < normalizeDay(availabilityMinDate)) return false;
      if (availabilityMaxDate && new Date(range.start_ts) > normalizeDay(availabilityMaxDate)) return false;
      return true;
    });
    if (!canManageEvent || selectedMember === 'all') return visibleRanges;
    return visibleRanges.filter((range) => range.member_name.toLowerCase() === selectedMember.toLowerCase());
  }, [availabilityMaxDate, availabilityMinDate, canManageEvent, ranges, selectedMember, today]);

  const monthlyAvailability = useMemo(() => {
    if (!payload) return [];

    return monthDays(chefMonth).filter((day) => {
      const normalized = normalizeDay(day);
      return normalized >= today && (!availabilityMinDate || normalized >= normalizeDay(availabilityMinDate)) && (!availabilityMaxDate || normalized <= normalizeDay(availabilityMaxDate));
    }).map((day) => {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const blockedMembers = payload.members
        .map((member) => member.member_name)
        .filter((memberName) => ranges.some((range) => range.member_name === memberName && rangeOverlaps(start, end, range)));
      const availableMembers = payload.members.map((member) => member.member_name).filter((memberName) => !includesName(blockedMembers, memberName));

      return { day, blockedMembers, availableMembers };
    });
  }, [availabilityMaxDate, availabilityMinDate, chefMonth, payload, ranges, today]);

  const selectedMonthlyAvailability = useMemo(() => {
    return monthlyAvailability.filter((day) => {
      if (selectedMember === 'all') return day.availableMembers.length > 0;
      return includesName(day.availableMembers, selectedMember);
    });
  }, [monthlyAvailability, selectedMember]);

  const chefAvailableWindows = useMemo(() => {
    const days = selectedMonthlyAvailability.sort((left, right) => left.day.getTime() - right.day.getTime());
    const windows: { key: string; start: Date; end: Date; availableMembers: string[] }[] = [];

    for (let index = 0; index <= days.length - requestedConsecutiveDays; index += 1) {
      const slice = days.slice(index, index + requestedConsecutiveDays);
      const consecutive = slice.every((item, sliceIndex) => sliceIndex === 0 || sameDate(item.day, addDays(slice[sliceIndex - 1].day, 1)));
      if (!consecutive) continue;

      const commonMembers = slice[0].availableMembers.filter((member) => slice.every((item) => includesName(item.availableMembers, member)));
      if (selectedMember !== 'all' && !includesName(commonMembers, selectedMember)) continue;
      if (commonMembers.length === 0) continue;

      windows.push({
        key: `${slice[0].day.toISOString()}-${slice[slice.length - 1].day.toISOString()}`,
        start: slice[0].day,
        end: slice[slice.length - 1].day,
        availableMembers: commonMembers
      });
    }

    return windows;
  }, [requestedConsecutiveDays, selectedMember, selectedMonthlyAvailability]);

  const synthesisDays = useMemo(() => {
    if (!payload) return [];

    return monthDays(synthesisMonth).filter((day) => {
      const normalized = normalizeDay(day);
      if (normalized < today) return false;
      if (availabilityMinDate && normalized < normalizeDay(availabilityMinDate)) return false;
      if (availabilityMaxDate && normalized > normalizeDay(availabilityMaxDate)) return false;

      const start = new Date(normalized);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return payload.members.every((member) => !ranges.some((range) => range.member_name === member.member_name && rangeOverlaps(start, end, range)));
    });
  }, [availabilityMaxDate, availabilityMinDate, payload, ranges, synthesisMonth, today]);

  const synthesisWindows = useMemo(() => {
    const size = daysBetweenInclusive(availabilityMinDate, availabilityMaxDate);
    const windows: { key: string; start: Date; end: Date }[] = [];

    for (let index = 0; index <= synthesisDays.length - size; index += 1) {
      const slice = synthesisDays.slice(index, index + size);
      const consecutive = slice.every((day, sliceIndex) => sliceIndex === 0 || sameDate(day, addDays(slice[sliceIndex - 1], 1)));
      if (!consecutive) continue;
      windows.push({ key: `${slice[0].toISOString()}-${slice[slice.length - 1].toISOString()}`, start: slice[0], end: slice[slice.length - 1] });
    }

    return windows;
  }, [availabilityMaxDate, availabilityMinDate, synthesisDays]);

  const canGoChefBack = startOfMonth(chefMonth).getTime() > startOfMonth(effectiveMinDate).getTime();
  const canGoChefForward = !availabilityMaxDate || startOfMonth(addMonths(chefMonth, 1)).getTime() <= startOfMonth(availabilityMaxDate).getTime();
  const canGoSynthesisBack = startOfMonth(synthesisMonth).getTime() > startOfMonth(effectiveMinDate).getTime();
  const canGoSynthesisForward = !availabilityMaxDate || startOfMonth(addMonths(synthesisMonth, 1)).getTime() <= startOfMonth(availabilityMaxDate).getTime();

  async function addMember() {
    if (!canManageEvent) return;

    const response = await apiFetch(`/api/events/${resolvedParams.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_name: memberName })
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(json.error ?? "Impossible d'ajouter le membre.");
      return;
    }

    setMemberName('');
    setMessage("Membre ajoute a l'evenement.");
    await loadData();
  }

  async function removeMember(member: string) {
    if (!canManageEvent) return;

    const response = await apiFetch(`/api/events/${resolvedParams.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_name: member })
    });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? 'Membre supprime.' : json.error ?? 'Suppression impossible.');
    await loadData();
  }

  async function copyInviteLink() {
    if (!canManageEvent) return;

    const link = `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(link);
    setMessage('Lien copie.');
  }

  async function saveEventDate(value: string) {
    if (!canManageEvent) return;

    const response = await apiFetch(`/api/events/${resolvedParams.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved_at: value ? new Date(value).toISOString() : null })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? 'Impossible de valider la date.');
      return;
    }

    setMessage('Date validee.');
    await loadData();
  }

  async function saveAvailabilityWindow() {
    if (!canManageEvent) return;

    const response = await apiFetch(`/api/events/${resolvedParams.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        availability_start_ts: availabilityStart ? new Date(availabilityStart).toISOString() : null,
        availability_end_ts: availabilityEnd ? new Date(availabilityEnd).toISOString() : null
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? 'Periode invalide.');
      return;
    }

    setMessage('Periode mise a jour.');
    await loadData();
  }

  async function saveEventDetails() {
    if (!canManageEvent) return;

    const response = await apiFetch(`/api/events/${resolvedParams.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName,
        resolved_at: editResolvedAt ? new Date(editResolvedAt).toISOString() : null,
        availability_start_ts: editAvailabilityStart ? new Date(editAvailabilityStart).toISOString() : null,
        availability_end_ts: editAvailabilityEnd ? new Date(editAvailabilityEnd).toISOString() : null
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? 'Modification impossible.');
      return;
    }

    setEditOpen(false);
    setMessage('Evenement modifie.');
    await loadData();
  }

  async function deleteEvent() {
    if (!canManageEvent || !payload) return;
    if (!window.confirm(`Supprimer "${payload.event.name}" ?`)) return;

    const response = await apiFetch(`/api/events/${resolvedParams.id}`, { method: 'DELETE' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? 'Suppression impossible.');
      return;
    }

    router.push(payload.event.group_id ? `/groups/${payload.event.group_id}` : '/events');
  }

  async function createAvailability(start: Date, end: Date) {
    if (!email) return;

    async function postAvailability(rangeStart: Date, rangeEnd: Date, note = 'Bloque depuis le calendrier') {
      return apiFetch('/api/availabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope_type: 'event',
          scope_id: resolvedParams.id,
          member_name: email,
          start_ts: rangeStart.toISOString(),
          end_ts: rangeEnd.toISOString(),
          note
        })
      });
    }

    const ownedRanges = ranges.filter((range) => range.member_name === email && rangeOverlaps(start, end, range));
    if (ownedRanges.length > 0) {
      const response = await apiFetch('/api/availabilities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ownedRanges.map((range) => range.id) })
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error ?? "Impossible de supprimer l'indisponibilite.");
        return;
      }

      const remainders = ownedRanges.flatMap((range) => {
        const rangeStart = new Date(range.start_ts);
        const rangeEnd = new Date(range.end_ts);
        const parts: { start: Date; end: Date; note?: string | null }[] = [];

        if (rangeStart < start) {
          parts.push({ start: rangeStart, end: addMillisecond(start, -1), note: range.note });
        }

        if (rangeEnd > end) {
          parts.push({ start: addMillisecond(end, 1), end: rangeEnd, note: range.note });
        }

        return parts.filter((part) => part.end > part.start);
      });

      for (const part of remainders) {
        const createResponse = await postAvailability(part.start, part.end, part.note ?? 'Bloque depuis le calendrier');
        if (!createResponse.ok) {
          const createJson = await createResponse.json().catch(() => ({}));
          setMessage(createJson.error ?? 'Indisponibilite retiree partiellement.');
          await loadData();
          return;
        }
      }

      setMessage('Indisponibilite retiree.');
      await loadData();
      return;
    }

    await apiFetch(`/api/events/${resolvedParams.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_name: email })
    });

    const response = await postAvailability(start, end);

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? "Impossible d'enregistrer l'indisponibilite.");
      return;
    }

    setMessage('Indisponibilite ajoutee.');
    await loadData();
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center px-4 py-10 text-slate-200">
        {error}
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center px-4 py-10 text-slate-200">
        Chargement...
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
        <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Evenement</p>
              <h1 className="mt-1 text-3xl font-semibold text-white">{payload.event.name}</h1>
              <p className="mt-2 text-sm text-slate-300">
                Groupe: {payload.group?.name ?? 'Sans groupe'} - Owner: {displayFor(payload.event.owner_name, displayNames)}
              </p>
              {payload.event.resolved_at ? (
                <p className="mt-2 text-sm text-emerald-100">
                  Date fixee: {format(new Date(payload.event.resolved_at), 'dd MMM yyyy HH:mm')}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Date non fixee pour le moment.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {canManageEvent ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <Edit3 className="h-4 w-4" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={deleteEvent}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-400/15"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                </>
              ) : null}
              <Link
                href="/upcoming"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Voir a venir
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {canManageEvent ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Choisir la date</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Valide un moment pour tout le groupe</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void saveEventDate(eventDate)}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  <CalendarCheck2 className="h-4 w-4" />
                  Valider
                </button>
              </div>
              <input
                className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
                type="datetime-local"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
              />
            </div>
          ) : null}

          {canManageEvent ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Periode des indispos</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Limiter le calendrier</h2>
                </div>
                <button
                  type="button"
                  onClick={saveAvailabilityWindow}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  Enregistrer
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/60"
                  type="datetime-local"
                  value={availabilityStart}
                  onChange={(event) => setAvailabilityStart(event.target.value)}
                />
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/60"
                  type="datetime-local"
                  value={availabilityEnd}
                  onChange={(event) => setAvailabilityEnd(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <AvailabilityCalendar
              view={view}
              anchorDate={anchorDate}
              ranges={selectedRanges}
              currentMemberName={email}
              onViewChange={setView}
              onAnchorDateChange={setAnchorDate}
              onCreateRange={createAvailability}
              minDate={availabilityMinDate}
              maxDate={availabilityMaxDate}
            />
          </div>
        </article>

        <aside className="space-y-6">
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Participants</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Membres de l&apos;event</h2>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {payload.members.map((member) => (
                <span key={member.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100">
                  {displayFor(member.member_name, displayNames)}
                  {canManageEvent && member.member_name.toLowerCase() !== payload.event.owner_name.toLowerCase() ? (
                    <button
                      type="button"
                      onClick={() => void removeMember(member.member_name)}
                      className="text-slate-400 transition hover:text-rose-100"
                      aria-label={`Supprimer ${member.member_name}`}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>

            {canManageEvent ? (
              <div className="mt-5 space-y-3">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
                  placeholder="Ajouter un membre"
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                />
                <button
                  type="button"
                  onClick={addMember}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <UserPlus className="h-4 w-4" />
                  Inviter a l&apos;event
                </button>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="ml-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/15"
                >
                  <Copy className="h-4 w-4" />
                  Copier le lien
                </button>
              </div>
            ) : null}
          </article>

          {canManageEvent ? (
            <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dispos</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Vue chef</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAvailabilityMode((mode) => (mode === 'busy' ? 'free' : 'busy'))}
                  className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  {availabilityMode === 'busy' ? 'Voir dispos' : 'Voir indispos'}
                </button>
              </div>

              <select
                value={selectedMember}
                onChange={(event) => setSelectedMember(event.target.value)}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/60"
              >
                <option value="all">Tous les membres</option>
                {payload.members.map((member) => (
                  <option key={member.id} value={member.member_name}>
                    {displayFor(member.member_name, displayNames)}
                  </option>
                ))}
              </select>

              <input
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Jours consecutifs"
                value={consecutiveDays}
                onChange={(event) => setConsecutiveDays(event.target.value.replace(/\D/g, '') || '1')}
              />

              {availabilityMode === 'free' ? (
                <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                  <button
                    type="button"
                    onClick={() => setChefMonth((date) => addMonths(date, -1))}
                    disabled={!canGoChefBack}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Precedent
                  </button>
                  <p className="text-sm font-semibold text-white">{format(chefMonth, 'MMMM yyyy')}</p>
                  <button
                    type="button"
                    onClick={() => setChefMonth((date) => addMonths(date, 1))}
                    disabled={!canGoChefForward}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </div>
              ) : null}

              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                {availabilityMode === 'busy'
                  ? selectedRanges.map((range) => (
                      <div key={range.id} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-50">
                        <p className="font-semibold">{displayFor(range.member_name, displayNames)}</p>
                        <p>{format(new Date(range.start_ts), 'dd MMM HH:mm')} - {format(new Date(range.end_ts), 'dd MMM HH:mm')}</p>
                      </div>
                    ))
                  : chefAvailableWindows.map((window) => (
                      <div key={window.key} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-50">
                        <p className="font-semibold">
                          {format(window.start, 'dd MMM yyyy')}{sameDate(window.start, window.end) ? '' : ` - ${format(window.end, 'dd MMM yyyy')}`}
                        </p>
                        <p>{window.availableMembers.length}/{payload.members.length} dispo</p>
                        <p className="mt-1 text-xs text-emerald-50/80">
                          {window.availableMembers.map((member) => displayFor(member, displayNames)).join(', ')}
                        </p>
                      </div>
                    ))}
                {(availabilityMode === 'busy' ? selectedRanges : chefAvailableWindows).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                    Aucune donnee.
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}

          <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Synthese</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Dispos</h2>

            <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
              <button
                type="button"
                onClick={() => setSynthesisMonth((date) => addMonths(date, -1))}
                disabled={!canGoSynthesisBack}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Precedent
              </button>
              <p className="text-sm font-semibold text-white">{format(synthesisMonth, 'MMMM yyyy')}</p>
              <button
                type="button"
                onClick={() => setSynthesisMonth((date) => addMonths(date, 1))}
                disabled={!canGoSynthesisForward}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Suivant
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {synthesisWindows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                  Pas encore de dispo totale.
                </p>
              ) : (
                synthesisWindows.map((period) => (
                  <button
                    key={period.key}
                    type="button"
                    onClick={() => void saveEventDate(period.start.toISOString())}
                    disabled={!canManageEvent}
                    className="w-full rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-4 text-left transition hover:bg-emerald-300/15 disabled:cursor-default disabled:opacity-70"
                  >
                    <p className="text-sm font-semibold text-white">
                      {format(period.start, 'dd MMM yyyy')}{sameDate(period.start, period.end) ? '' : ` - ${format(period.end, 'dd MMM yyyy')}`}
                    </p>
                  </button>
                ))
              )}
            </div>

            {message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          </article>
        </aside>
      </section>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Modifier l&apos;evenement</h2>
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-full border border-white/10 p-2 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60" placeholder="Nom" value={editName} onChange={(event) => setEditName(event.target.value)} />
              <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/60" type="datetime-local" value={editResolvedAt} onChange={(event) => setEditResolvedAt(event.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/60" type="datetime-local" value={editAvailabilityStart} onChange={(event) => setEditAvailabilityStart(event.target.value)} />
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/60" type="datetime-local" value={editAvailabilityEnd} onChange={(event) => setEditAvailabilityEnd(event.target.value)} />
              </div>
              <button type="button" onClick={saveEventDetails} className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950">
                <Save className="h-4 w-4" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
