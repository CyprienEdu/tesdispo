'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, FolderOpen, Plus, Users } from 'lucide-react';

import { useAuth } from '@/components/auth-context';

type Group = { id: string; name: string; owner_name: string; created_at: string };

const scopes = [
  { value: 'all', label: 'Tous' },
  { value: 'owned', label: 'Mes groupes' },
  { value: 'invited', label: 'Invités' }
] as const;

type Scope = (typeof scopes)[number]['value'];

function displayFor(name: string, displayNames: Record<string, string>) {
  return displayNames[name.toLowerCase()] || name;
}

export default function GroupsPage() {
  const { apiFetch, email } = useAuth();
  const [scope, setScope] = useState<Scope>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [groupName, setGroupName] = useState('');
  const [inviteMembers, setInviteMembers] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!email) {
      setGroups([]);
      return;
    }

    const searchParams = new URLSearchParams({ scope });
    searchParams.set('member_name', email);
    searchParams.set('owner_name', email);

    const response = await apiFetch(`/api/groups?${searchParams.toString()}`, { cache: 'no-store' });
    const json = await response.json().catch(() => ({ data: [] }));
    setGroups(json.data ?? []);
    setDisplayNames(json.display_names ?? {});
  }, [apiFetch, email, scope]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function createGroup() {
    if (!email) return;

    const response = await apiFetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: groupName,
        owner_name: email,
        members: [email, ...inviteMembers.split(',').map((value) => value.trim()).filter(Boolean)]
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? 'Impossible de créer le groupe.');
      return;
    }

    setMessage('Groupe créé.');
    setGroupName('');
    setInviteMembers('');
    await refresh();
  }

  const counts = useMemo(() => {
    return {
      all: groups.length,
      owned: groups.filter((group) => group.owner_name === email).length,
      invited: groups.filter((group) => group.owner_name !== email).length
    };
  }, [groups, email]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
              <FolderOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Groupes</p>
              <h1 className="mt-1 text-3xl font-semibold text-white">Organise tes cercles</h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Un groupe rassemble des gens qui partagent des évènements ponctuels. Clique sur un groupe pour voir ses évènements et ouvrir un event.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {scopes.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setScope(item.value)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  scope === item.value
                    ? 'border-emerald-300/40 bg-emerald-300/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400">{counts[item.value]} groupes</p>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Nouveau groupe</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Créer un espace</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
              placeholder="Nom du groupe"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
              placeholder="Inviter (emails séparés par des virgules)"
              value={inviteMembers}
              onChange={(event) => setInviteMembers(event.target.value)}
            />
            <button
              type="button"
              onClick={createGroup}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Créer le groupe
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
        </article>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Liste</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Tes groupes</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <Users className="h-4 w-4" />
            {groups.length} groupes
          </div>
        </div>

        <div className="mt-5 grid max-h-[calc(100vh-24rem)] gap-3 overflow-y-auto pr-1">
          {groups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
              Aucun groupe pour le moment.
            </p>
          ) : (
            groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{group.name}</p>
                    <p className="mt-1 text-xs text-slate-400">Owner: {displayFor(group.owner_name, displayNames)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
