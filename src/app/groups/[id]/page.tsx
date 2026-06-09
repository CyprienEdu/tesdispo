'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarRange, Copy, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { format } from 'date-fns';

import type { AvailabilityRange } from '@/components/availability-calendar';
import { useAuth } from '@/components/auth-context';

type GroupPayload = {
  group: { id: string; name: string; owner_name: string; created_at: string };
  members: { id: string; member_name: string }[];
  events: {
    id: string;
    name: string;
    owner_name: string;
    resolved_at: string | null;
    archived_at: string | null;
    created_at: string;
  }[];
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

function includesName(list: string[], name: string) {
  return list.some((item) => item.toLowerCase() === name.toLowerCase());
}

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { apiFetch, email } = useAuth();
  const [payload, setPayload] = useState<GroupPayload | null>(null);
  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedMember, setSelectedMember] = useState('all');
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('busy');
  const [memberName, setMemberName] = useState('');
  const [eventName, setEventName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const invitePath = `/join/group/${resolvedParams.id}`;

  async function load() {
    if (!email) return;

    const [groupRes, rangesRes, periodsRes] = await Promise.all([
      apiFetch(`/api/groups/${resolvedParams.id}`, { cache: 'no-store' }),
      apiFetch(`/api/availabilities?scope_type=group&scope_id=${resolvedParams.id}`, { cache: 'no-store' }),
      apiFetch(`/api/groups/${resolvedParams.id}/common-slots?view=week&count=8`, { cache: 'no-store' })
    ]);

    const groupJson = await groupRes.json().catch(() => ({ data: null, error: 'group_fetch_failed' }));
    const rangesJson = await rangesRes.json().catch(() => ({ data: [] }));
    const periodsJson = await periodsRes.json().catch(() => ({ periods: [] }));

    if (!groupRes.ok || !groupJson?.data?.group) {
      setError(groupJson.error ?? 'Groupe introuvable.');
      setPayload(null);
      return;
    }

    setError('');
    setPayload(groupJson.data);
    setRanges(rangesJson.data ?? []);
    setPeriods(periodsJson.periods ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id, email]);

  const canManageGroup = payload ? payload.group.owner_name.toLowerCase() === email.toLowerCase() : false;

  const eventsSorted = useMemo(() => {
    if (!payload) return [];
    return [...payload.events].sort((left, right) => {
      const leftTime = left.resolved_at ? new Date(left.resolved_at).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.resolved_at ? new Date(right.resolved_at).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  }, [payload]);

  const selectedRanges = useMemo(() => {
    if (selectedMember === 'all') return ranges;
    return ranges.filter((range) => range.member_name.toLowerCase() === selectedMember.toLowerCase());
  }, [ranges, selectedMember]);

  const selectedPeriods = useMemo(() => {
    return periods.filter((period) => {
      if (availabilityMode === 'free') {
        return selectedMember === 'all' ? period.fullyFree : includesName(period.availableMembers, selectedMember);
      }

      return selectedMember === 'all' ? period.blockedCount > 0 : includesName(period.blockedMembers, selectedMember);
    });
  }, [availabilityMode, periods, selectedMember]);

  async function addMember() {
    if (!canManageGroup) return;

    const response = await apiFetch(`/api/groups/${resolvedParams.id}/members`, {
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
    setMessage('Membre ajoute.');
    await load();
  }

  async function removeMember(member: string) {
    if (!canManageGroup) return;

    const response = await apiFetch(`/api/groups/${resolvedParams.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_name: member })
    });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? 'Membre supprime.' : json.error ?? 'Suppression impossible.');
    await load();
  }

  async function createEvent() {
    if (!payload || !canManageGroup) return;

    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: resolvedParams.id,
        name: eventName,
        members: payload.members.map((member) => member.member_name)
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? "Impossible de creer l'evenement.");
      return;
    }

    setEventName('');
    setMessage('Evenement cree.');
    await load();
  }

  async function deleteEvent(eventId: string) {
    if (!canManageGroup) return;

    const response = await apiFetch(`/api/events/${eventId}`, { method: 'DELETE' });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? 'Evenement supprime.' : json.error ?? 'Suppression impossible.');
    await load();
  }

  async function deleteGroup() {
    if (!canManageGroup) return;

    const response = await apiFetch(`/api/groups/${resolvedParams.id}`, { method: 'DELETE' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? 'Suppression impossible.');
      return;
    }

    router.push('/groups');
  }

  async function copyInviteLink() {
    if (!canManageGroup) return;

    const link = `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(link);
    setMessage('Lien copie.');
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
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Groupe</p>
                <h1 className="mt-1 text-3xl font-semibold text-white">{payload.group.name}</h1>
              </div>
            </div>
            {canManageGroup ? (
              <button
                type="button"
                onClick={deleteGroup}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-400/15"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            ) : null}
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Owner: {payload.group.owner_name}
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Membres</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {payload.members.map((member) => (
                <span key={member.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-sm text-slate-100">
                  {member.member_name}
                  {canManageGroup && member.member_name.toLowerCase() !== payload.group.owner_name.toLowerCase() ? (
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
          </div>

          {canManageGroup ? (
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Inviter un membre</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
                  placeholder="Email ou pseudo"
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={addMember}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <UserPlus className="h-4 w-4" />
                Ajouter au groupe
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

          {canManageGroup ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dispos</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Vue chef</h2>
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

              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {availabilityMode === 'busy'
                  ? selectedRanges.map((range) => (
                      <div key={range.id} className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-50">
                        <p className="font-semibold">{range.member_name}</p>
                        <p>{format(new Date(range.start_ts), 'dd MMM HH:mm')} - {format(new Date(range.end_ts), 'dd MMM HH:mm')}</p>
                      </div>
                    ))
                  : selectedPeriods.map((period) => (
                      <div key={period.key} className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-50">
                        <p className="font-semibold">{period.label}</p>
                        <p>{format(new Date(period.start), 'dd MMM HH:mm')} - {format(new Date(period.end), 'dd MMM HH:mm')}</p>
                      </div>
                    ))}
                {(availabilityMode === 'busy' ? selectedRanges : selectedPeriods).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">Aucune donnee.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Evenements</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Evenements du groupe</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              {eventsSorted.length} evenement(s)
            </div>
          </div>

          {canManageGroup ? (
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
                placeholder="Nom du nouvel evenement"
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
              />
              <button
                type="button"
                onClick={createEvent}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                <CalendarRange className="h-4 w-4" />
                Creer un evenement
              </button>
            </div>
          ) : null}

          <div className="mt-5 grid max-h-[calc(100vh-28rem)] gap-3 overflow-y-auto pr-1">
            {eventsSorted.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                Aucun evenement pour le moment.
              </p>
            ) : (
              eventsSorted.map((event) => {
                const isUpcoming = event.resolved_at ? new Date(event.resolved_at) > new Date() : false;
                return (
                  <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                    <div className="flex items-start justify-between gap-4">
                      <Link href={`/events/${event.id}`} className="group min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-white">{event.name}</p>
                          <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
                            {isUpcoming ? 'A venir' : event.resolved_at ? 'Passe' : 'A planifier'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-300">Owner: {event.owner_name}</p>
                        {event.resolved_at ? (
                          <p className="mt-2 text-sm text-emerald-100">
                            {format(new Date(event.resolved_at), 'dd MMM yyyy HH:mm')}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-400">Date non fixee.</p>
                        )}
                      </Link>
                      <div className="flex items-center gap-2">
                        {canManageGroup ? (
                          <button
                            type="button"
                            onClick={() => void deleteEvent(event.id)}
                            className="rounded-full border border-rose-300/30 bg-rose-400/10 p-2 text-rose-50 transition hover:bg-rose-400/15"
                            aria-label={`Supprimer ${event.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
