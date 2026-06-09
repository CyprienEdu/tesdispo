'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck2, Copy, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { format } from 'date-fns';

import { AvailabilityCalendar, type AvailabilityRange, type CalendarView } from '@/components/availability-calendar';
import { useAuth } from '@/components/auth-context';

type EventPayload = {
  event: {
    id: string;
    group_id: string;
    name: string;
    owner_name: string;
    resolved_at: string | null;
    archived_at: string | null;
    created_at: string;
  };
  group: { id: string; name: string; owner_name: string } | null;
  members: { id: string; member_name: string }[];
};

type Period = {
  key: string;
  label: string;
  start: string;
  end: string;
  blockedMembers: string[];
  availableMembers: string[];
  totalMembers: number;
  blockedCount: number;
  fullyFree: boolean;
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

function periodViewFor(view: CalendarView) {
  return view === 'year' ? 'month' : view === 'month' ? 'month' : 'week';
}

function includesName(list: string[], name: string) {
  return list.some((item) => item.toLowerCase() === name.toLowerCase());
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { apiFetch, email } = useAuth();
  const [payload, setPayload] = useState<EventPayload | null>(null);
  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedMember, setSelectedMember] = useState('all');
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('busy');
  const [memberName, setMemberName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const invitePath = `/join/event/${resolvedParams.id}`;

  async function loadData(nextView: CalendarView = view) {
    if (!email) return;

    const [eventRes, rangesRes, periodsRes] = await Promise.all([
      apiFetch(`/api/events/${resolvedParams.id}`, { cache: 'no-store' }),
      apiFetch(`/api/availabilities?scope_type=event&scope_id=${resolvedParams.id}`, { cache: 'no-store' }),
      apiFetch(`/api/events/${resolvedParams.id}/common-slots?view=${periodViewFor(nextView)}&count=8`, { cache: 'no-store' })
    ]);

    const eventJson = await eventRes.json().catch(() => ({ data: null }));
    const rangesJson = await rangesRes.json().catch(() => ({ data: [] }));
    const periodsJson = await periodsRes.json().catch(() => ({ periods: [] }));

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
    setRanges(rangesJson.data ?? []);
    setPeriods(periodsJson.periods ?? []);
    setEventDate(toLocalInputValue(eventJson.data.event.resolved_at));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id, view, email]);

  const canManageEvent = payload
    ? email.toLowerCase() === payload.event.owner_name.toLowerCase() ||
      email.toLowerCase() === String(payload.group?.owner_name ?? '').toLowerCase()
    : false;

  const selectedRanges = useMemo(() => {
    if (!canManageEvent || selectedMember === 'all') return ranges;
    return ranges.filter((range) => range.member_name.toLowerCase() === selectedMember.toLowerCase());
  }, [canManageEvent, ranges, selectedMember]);

  const selectedPeriods = useMemo(() => {
    return periods.filter((period) => {
      if (availabilityMode === 'free') {
        return selectedMember === 'all' ? period.fullyFree : includesName(period.availableMembers, selectedMember);
      }

      return selectedMember === 'all' ? period.blockedCount > 0 : includesName(period.blockedMembers, selectedMember);
    });
  }, [availabilityMode, periods, selectedMember]);

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
    await loadData(view);
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
    await loadData(view);
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
    await loadData(view);
  }

  async function deleteEvent() {
    if (!canManageEvent || !payload) return;

    const response = await apiFetch(`/api/events/${resolvedParams.id}`, { method: 'DELETE' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? 'Suppression impossible.');
      return;
    }

    router.push(`/groups/${payload.event.group_id}`);
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
          await loadData(view);
          return;
        }
      }

      setMessage('Indisponibilite retiree.');
      await loadData(view);
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
    await loadData(view);
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
                Groupe: {payload.group?.name ?? 'Sans groupe'} - Owner: {payload.event.owner_name}
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
                <button
                  type="button"
                  onClick={deleteEvent}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-400/15"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
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

          <div className="mt-6">
            <AvailabilityCalendar
              view={view}
              anchorDate={anchorDate}
              ranges={selectedRanges}
              currentMemberName={email}
              onViewChange={setView}
              onAnchorDateChange={setAnchorDate}
              onCreateRange={createAvailability}
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
                  {member.member_name}
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
                    {member.member_name}
                  </option>
                ))}
              </select>

              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                {availabilityMode === 'busy'
                  ? selectedRanges.map((range) => (
                      <div key={range.id} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-50">
                        <p className="font-semibold">{range.member_name}</p>
                        <p>{format(new Date(range.start_ts), 'dd MMM HH:mm')} - {format(new Date(range.end_ts), 'dd MMM HH:mm')}</p>
                      </div>
                    ))
                  : selectedPeriods.map((period) => (
                      <div key={period.key} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-50">
                        <p className="font-semibold">{period.label}</p>
                        <p>{format(new Date(period.start), 'dd MMM HH:mm')} - {format(new Date(period.end), 'dd MMM HH:mm')}</p>
                      </div>
                    ))}
                {(availabilityMode === 'busy' ? selectedRanges : selectedPeriods).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                    Aucune donnee.
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}

          <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Synthese</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Periodes ideales</h2>

            <div className="mt-4 space-y-3">
              {periods.filter((period) => period.fullyFree).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                  Pas encore de periode totalement libre.
                </p>
              ) : (
                periods
                  .filter((period) => period.fullyFree)
                  .map((period) => (
                    <button
                      key={period.key}
                      type="button"
                      onClick={() => void saveEventDate(period.start)}
                      disabled={!canManageEvent}
                      className="w-full rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-4 text-left transition hover:bg-emerald-300/15 disabled:cursor-default disabled:opacity-70"
                    >
                      <p className="text-xs uppercase tracking-[0.3em] text-emerald-100/70">{period.label}</p>
                      <p className="mt-2 text-sm text-white">
                        {format(new Date(period.start), 'dd MMM yyyy HH:mm')} - {format(new Date(period.end), 'dd MMM yyyy HH:mm')}
                      </p>
                    </button>
                  ))
              )}
            </div>

            {message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          </article>
        </aside>
      </section>
    </main>
  );
}
