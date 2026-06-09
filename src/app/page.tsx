'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, CircleCheckBig, CloudSun, Users } from 'lucide-react';

import { useAuth } from '@/components/auth-context';

const highlights = [
  {
    icon: Users,
    title: 'Groupes flexibles',
    description: 'Créer des cercles pour les potes, les voyages ou les plans de dernière minute.'
  },
  {
    icon: CalendarDays,
    title: 'Calendrier lisible',
    description: 'Vue mensuelle par défaut, avec navigation semaine et année pour aller vite.'
  },
  {
    icon: CloudSun,
    title: 'Temps libre visible',
    description: 'On repere rapidement les jours, semaines et mois disponibles pour tout le monde.'
  }
];

export default function LandingPage() {
  const { session } = useAuth();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-100">
            Sorties entre amis, en mieux
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Trouve en un coup d&apos;oeil quand ton groupe est vraiment dispo.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            TesDispo transforme les indisponibilités de chacun en un calendrier clair pour
            organiser un resto, un week-end ou de vraies vacances ensemble.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={session ? '/upcoming' : '/account'}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              {session ? 'Ouvrir mon espace' : 'Créer mon compte'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Se connecter
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Jour</p>
              <p className="mt-2 text-3xl font-semibold text-white">Instant</p>
              <p className="mt-1 text-sm text-slate-300">Une indispo saute aux yeux.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Semaine</p>
              <p className="mt-2 text-3xl font-semibold text-white">Clair</p>
              <p className="mt-1 text-sm text-slate-300">On voit vite si le plan tient.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mois</p>
              <p className="mt-2 text-3xl font-semibold text-white">Large</p>
              <p className="mt-1 text-sm text-slate-300">Parfait pour organiser les vacances.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Preview</p>
            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-slate-400">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }, (_, index) => {
                const blocked = [4, 5, 11, 12, 18, 19, 20, 27].includes(index);
                return (
                  <div
                    key={index}
                    className={`aspect-square rounded-2xl border text-xs ${
                      blocked
                        ? 'border-rose-300/40 bg-rose-400/20 text-rose-50'
                        : 'border-white/10 bg-white/5 text-slate-300'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-white">{item.title}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-sm font-medium text-emerald-50">Raccourci de base</p>
            <p className="mt-1 text-sm text-emerald-50/80">
              Une fois connecté, tu arrives directement sur <span className="font-semibold">À venir</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">1. Groupes</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Organise tes cercles</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Crée des groupes petits ou grands, invite des gens et garde tout au même endroit.
          </p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">2. Events</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Bats le calendrier</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Chaque évènement a sa propre page, ses membres et son calendrier d&apos;indisponibilités.
          </p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">3. À venir</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Suis les plans validés</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Les sorties datées remontent ici, et les anciens plans disparaissent automatiquement de la vue.
          </p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Pourquoi maintenant</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Une version simple à vendre, puis évolutive</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              On commence par la coordination entre amis, puis on pourra ajouter le chat, la sync
              calendrier et une vraie couche collaborative plus tard.
            </p>
          </div>
          <Link
            href={session ? '/upcoming' : '/account'}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100"
          >
            {session ? 'Voir mon planning' : 'Commencer maintenant'}
            <CircleCheckBig className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
