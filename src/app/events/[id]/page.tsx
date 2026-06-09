'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck2, Copy, Link as LinkIcon, UserPlus, Users } from 'lucide-react';
import { format, startOfDay } from 'date-fns';

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

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { apiFetch, email } = useAuth();
  const [payload, setPayload] = useState<EventPayload | null>(null);
  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
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
      apiFetch(`/api/events/${resolvedParams.id}/common-slots?view=${nextView}&count=8`, { cache: 'no-store' })
    ]);

    const eventJson = await eventRes.json().catch(() => ({ data: null }));
    const rangesJson = await rangesRes.json().catch(() => ({ data: [] }));
    const periodsJson = await periodsRes.json().catch(() => ({ periods: [] }));

    if (!eventRes.ok || !eventJson?.data?.event) {
      setError(eventJson?.error ?? 'Évènement introuvable.');
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
    void loadData(view);
  }, [resolvedParams.id, view, email]);

  const fullyFreePeriods = useMemo(() => periods.filter((period) => period.fullyFree), [periods]);

  async function addMember() {
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
    setMessage("Membre ajouté à l'évènement.");
    await loadData(view);
  }

  async function copyInviteLink() {
    const link = `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(link);
    setMessage('Lien copié.');
  }

  async function saveEventDate(value: string) {
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

    setMessage('Date validée.');
    await loadData(view);
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
        setMessage(json.error ?? "Impossible de supprimer l'indisponibilité.");
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
          setMessage(createJson.error ?? 'Indisponibilité retirée partiellement.');
          await loadData(view);
          return;
        }
      }

      setMessage('Indisponibilité retirée.');
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
      setMessage(json.error ?? "Impossible d'enregistrer l'indisponibilité.");
      return;
    }

    setMessage('Indisponibilité ajoutée.');
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Évènement</p>
              <h1 className="mt-1 text-3xl font-semibold text-white">{payload.event.name}</h1>
              <p className="mt-2 text-sm text-slate-300">
                Groupe: {payload.group?.name ?? 'Sans groupe'} - Owner: {payload.event.owner_name}
              </p>
              {payload.event.resolved_at ? (
                <p className="mt-2 text-sm text-emerald-100">
                  Date fixée: {format(new Date(payload.event.resolved_at), 'dd MMM yyyy HH:mm')}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Date non fixée pour le moment.</p>
              )}
            </div>

            <Link
              href="/upcoming"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Voir À venir
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

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

          <div className="mt-6">
            <AvailabilityCalendar
              view={view}
              anchorDate={anchorDate}
              ranges={ranges}
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
                <span key={member.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100">
                  {member.member_name}
                </span>
              ))}
            </div>

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
                Inviter à l&apos;event
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/15"
              >
                <Copy className="h-4 w-4" />
                Copier le lien
              </button>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                <LinkIcon className="h-4 w-4 text-emerald-100" />
                <span className="truncate">{invitePath}</span>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Synthèse</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Périodes idéales</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Les plages ci-dessous sont les meilleures options pour valider une date commune.
            </p>

            <div className="mt-4 space-y-3">
              {fullyFreePeriods.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                  Pas encore de période totalement libre. Continue à ajouter les indisponibilités du groupe.
                </p>
              ) : (
                fullyFreePeriods.map((period) => (
                  <button
                    key={period.key}
                    type="button"
                    onClick={() => void saveEventDate(period.start)}
                    className="w-full rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-4 text-left transition hover:bg-emerald-300/15"
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
