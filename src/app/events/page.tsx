'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarRange, CheckCircle2, Clock3, SquareStack } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth-context';

type EventItem = {
  id: string;
  group_id: string;
  group_name: string;
  name: string;
  owner_name: string;
  resolved_at: string | null;
  archived_at: string | null;
  created_at: string;
};

type Filter = 'all' | 'planned' | 'upcoming' | 'past';

const filters = [
  { value: 'all', label: 'Tous' },
  { value: 'planned', label: 'À planifier' },
  { value: 'upcoming', label: 'À venir' },
  { value: 'past', label: 'Passés' }
] as const;

function getEventFilter(item: EventItem): Filter {
  const now = new Date();
  if (!item.resolved_at) return 'planned';
  if (item.archived_at) return 'past';
  return new Date(item.resolved_at) > now ? 'upcoming' : 'past';
}

export default function EventsPage() {
  const { apiFetch, email } = useAuth();
  const [items, setItems] = useState<EventItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!email) return;

    void apiFetch('/api/events?status=all', { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]));
  }, [apiFetch, email]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => filter === 'all' || getEventFilter(item) === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      planned: items.filter((item) => getEventFilter(item) === 'planned').length,
      upcoming: items.filter((item) => getEventFilter(item) === 'upcoming').length,
      past: items.filter((item) => getEventFilter(item) === 'past').length
    };
  }, [items]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                <SquareStack className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Évènements</p>
                <h1 className="mt-1 text-3xl font-semibold text-white">Tous les plans du groupe</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Ici tu retrouves les évènements ponctuels, qu&apos;ils soient encore à planifier ou déjà datés.
              Une fois la date passée, ils sortent naturellement de la page À venir.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { icon: SquareStack, key: 'all' as const, label: 'Total' },
              { icon: Clock3, key: 'planned' as const, label: 'À planifier' },
              { icon: CalendarRange, key: 'upcoming' as const, label: 'À venir' },
              { icon: CheckCircle2, key: 'past' as const, label: 'Passés' }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-[0.25em]">{item.label}</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">{counts[item.key]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === item.value
                  ? 'bg-emerald-400 text-slate-950'
                  : 'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid max-h-[calc(100vh-26rem)] gap-3 overflow-y-auto pr-1">
          {visibleItems.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
              Aucun évènement pour ce filtre.
            </p>
          ) : (
            visibleItems.map((item) => {
              const state = getEventFilter(item);
              return (
                <Link
                  key={item.id}
                  href={`/events/${item.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-white">{item.name}</p>
                        <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
                          {state}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{item.group_name || 'Sans groupe'}</p>
                      <p className="mt-1 text-xs text-slate-400">Owner: {item.owner_name}</p>
                      {item.resolved_at ? (
                        <p className="mt-2 text-sm text-emerald-100">
                          Date: {format(new Date(item.resolved_at), 'dd MMM yyyy HH:mm')}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-slate-400">Aucune date fixée pour le moment.</p>
                      )}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
