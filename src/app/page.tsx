import Link from 'next/link';
import { CalendarDays, Users, Clock3 } from 'lucide-react';

import { createSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';

async function loadDashboard() {
  if (!hasSupabaseConfig()) {
    return { groups: [], events: [] };
  }

  const supabase = createSupabaseClient();

  const [groupsRes, eventsRes] = await Promise.all([
    supabase.from('groups').select('id,name,owner_name,created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('events').select('id,name,group_id,owner_name,created_at,resolved_at,archived_at').order('created_at', { ascending: false }).limit(8)
  ]);

  return {
    groups: groupsRes.data ?? [],
    events: eventsRes.data ?? []
  };
}

export default async function Home() {
  const { groups, events } = await loadDashboard();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_24%),linear-gradient(180deg,_#fbfdfc_0%,_#f4f7f5_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-800">
              <CalendarDays className="h-4 w-4" />
              TesDispo v1
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Groupes permanents, événements ponctuels, et créneaux communs en un seul endroit.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Crée un groupe pour tes amis, ajoute des membres, puis ouvre un événement temporaire pour un rendez-vous précis. Chaque périmètre a ses propres disponibilités.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Users className="h-5 w-5" />} label="Groupes actifs" value={groups.length} />
              <StatCard icon={<Clock3 className="h-5 w-5" />} label="Événements ouverts" value={events.filter((event: any) => !event.resolved_at && !event.archived_at).length} />
              <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Vues rapides" value="Groupes + événements" />
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-900/10 bg-slate-950 p-8 text-white shadow-[0_24px_70px_-38px_rgba(2,6,23,0.65)]">
            <h2 className="text-2xl font-semibold">Ce que tu peux faire maintenant</h2>
            <ul className="mt-5 space-y-4 text-slate-200">
              <li>Créer un groupe permanent et y inviter plusieurs membres.</li>
              <li>Créer un événement lié à un groupe pour un besoin ponctuel.</li>
              <li>Ajouter les indisponibilités de chaque membre.</li>
              <li>Calculer le premier créneau commun, puis supprimer l’événement ponctuel.</li>
            </ul>
            {!hasSupabaseConfig() ? (
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                Ajoute `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans `.env.local` pour connecter la base.
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Groupes permanents</h2>
                <p className="mt-1 text-sm text-slate-500">Gestion des amis, membres et événements rattachés.</p>
              </div>
              <Link href="#groups" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                Voir les groupes
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {groups.length === 0 ? (
                <EmptyState text="Aucun groupe pour l’instant. Crée le premier ci-dessous." />
              ) : (
                groups.map((group: any) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-emerald-300 hover:bg-emerald-50/60"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{group.name}</p>
                      <p className="text-sm text-slate-500">Créé par {group.owner_name}</p>
                    </div>
                    <span className="text-sm font-medium text-emerald-700">Ouvrir</span>
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Événements ponctuels</h2>
                <p className="mt-1 text-sm text-slate-500">Un événement = un mini-groupe temporaire lié à un groupe parent.</p>
              </div>
              <Link href="#events" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                Voir les événements
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {events.length === 0 ? (
                <EmptyState text="Aucun événement pour l’instant. Crée-en un depuis une fiche groupe." />
              ) : (
                events.map((event: any) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-emerald-300 hover:bg-emerald-50/60"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{event.name}</p>
                      <p className="text-sm text-slate-500">Créé par {event.owner_name}</p>
                    </div>
                    <span className="text-sm font-medium text-emerald-700">Ouvrir</span>
                  </Link>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">{icon}</div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">{text}</div>;
}
