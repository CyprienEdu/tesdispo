'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, MapPinned } from 'lucide-react';
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
};

export default function UpcomingPage() {
  const { apiFetch, email } = useAuth();
  const [items, setItems] = useState<EventItem[]>([]);

  useEffect(() => {
    if (!email) return;

    void apiFetch('/api/events?status=upcoming', { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]));
  }, [apiFetch, email]);

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      const leftDate = left.resolved_at ? new Date(left.resolved_at).getTime() : 0;
      const rightDate = right.resolved_at ? new Date(right.resolved_at).getTime() : 0;
      return leftDate - rightDate;
    });
  }, [items]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                <CalendarClock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">À venir</p>
                <h1 className="mt-1 text-3xl font-semibold text-white">Tes prochains plans validés</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Cette page ne garde que les évènements dont une date a été fixée et qui ne sont pas encore passés.
            </p>
          </div>

          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Voir tous les évènements
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-slate-300">
          <MapPinned className="h-4 w-4" />
          <span className="text-xs uppercase tracking-[0.3em]">Flux</span>
          <span className="text-sm">{sortedItems.length} évènements à venir</span>
        </div>

        <div className="mt-5 grid max-h-[calc(100vh-24rem)] gap-3 overflow-y-auto pr-1">
          {sortedItems.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
              Aucun évènement à venir pour le moment. Va dans la page Évènements pour en valider un.
            </p>
          ) : (
            sortedItems.map((item) => (
              <Link
                key={item.id}
                href={`/events/${item.id}`}
                className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.group_name || 'Sans groupe'}</p>
                    <p className="mt-2 text-sm text-emerald-100">
                      {item.resolved_at ? format(new Date(item.resolved_at), 'dd MMM yyyy HH:mm') : 'Date inconnue'}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
