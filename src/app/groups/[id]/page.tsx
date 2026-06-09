'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarRange, Copy, UserPlus, Users } from 'lucide-react';
import { format } from 'date-fns';

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

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { apiFetch, email } = useAuth();
  const [payload, setPayload] = useState<GroupPayload | null>(null);
  const [memberName, setMemberName] = useState('');
  const [eventName, setEventName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const invitePath = `/join/group/${resolvedParams.id}`;

  async function load() {
    if (!email) return;

    const response = await apiFetch(`/api/groups/${resolvedParams.id}`, { cache: 'no-store' });
    const json = await response.json().catch(() => ({ data: null, error: 'group_fetch_failed' }));
    if (!response.ok || !json?.data?.group) {
      setError(json.error ?? 'Groupe introuvable.');
      setPayload(null);
      return;
    }

    setError('');
    setPayload(json.data);
  }

  useEffect(() => {
    void load();
  }, [resolvedParams.id, email]);

  const eventsSorted = useMemo(() => {
    if (!payload) return [];
    return [...payload.events].sort((left, right) => {
      const leftTime = left.resolved_at ? new Date(left.resolved_at).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.resolved_at ? new Date(right.resolved_at).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  }, [payload]);

  async function addMember() {
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
    setMessage('Membre ajouté.');
    await load();
  }

  async function createEvent() {
    if (!payload) return;

    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: resolvedParams.id,
        name: eventName,
        owner_name: email,
        members: payload.members.map((member) => member.member_name)
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? "Impossible de créer l'évènement.");
      return;
    }

    setEventName('');
    setMessage('Évènement créé.');
    await load();
  }

  async function copyInviteLink() {
    const link = `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(link);
    setMessage('Lien copié.');
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
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Groupe</p>
              <h1 className="mt-1 text-3xl font-semibold text-white">{payload.group.name}</h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Un groupe regroupe les personnes avec qui tu partages des évènements ponctuels. Plus tard,
            on pourra ajouter le chat ici.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Membres</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {payload.members.map((member) => (
                <span key={member.id} className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-sm text-slate-100">
                  {member.member_name}
                </span>
              ))}
            </div>
          </div>

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
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/15"
            >
              <Copy className="h-4 w-4" />
              Copier le lien
            </button>
            {message ? <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Évènements</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Évènements du groupe</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              {eventsSorted.length} évènement(s)
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
              placeholder="Nom du nouvel évènement"
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
            />
            <button
              type="button"
              onClick={createEvent}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              <CalendarRange className="h-4 w-4" />
              Créer un évènement
            </button>
          </div>

          <div className="mt-5 grid max-h-[calc(100vh-28rem)] gap-3 overflow-y-auto pr-1">
            {eventsSorted.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                Aucun évènement pour le moment.
              </p>
            ) : (
              eventsSorted.map((event) => {
                const isUpcoming = event.resolved_at ? new Date(event.resolved_at) > new Date() : false;
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-white">{event.name}</p>
                          <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
                            {isUpcoming ? 'À venir' : event.resolved_at ? 'Passé' : 'À planifier'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-300">Owner: {event.owner_name}</p>
                        {event.resolved_at ? (
                          <p className="mt-2 text-sm text-emerald-100">
                            {format(new Date(event.resolved_at), 'dd MMM yyyy HH:mm')}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-400">Date non fixée.</p>
                        )}
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
