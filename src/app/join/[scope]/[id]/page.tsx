'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';

import { useAuth } from '@/components/auth-context';

type JoinScope = 'group' | 'event';

function getJoinConfig(scope: string, id: string) {
  if (scope === 'group') {
    return {
      label: 'groupe',
      apiPath: `/api/groups/${id}/members`,
      targetPath: `/groups/${id}`
    };
  }

  if (scope === 'event') {
    return {
      label: 'event',
      apiPath: `/api/events/${id}/members`,
      targetPath: `/events/${id}`
    };
  }

  return null;
}

export default function JoinPage({ params }: { params: Promise<{ scope: JoinScope; id: string }> }) {
  const resolvedParams = use(params);
  const { loading, session, email, apiFetch } = useAuth();
  const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const config = useMemo(() => getJoinConfig(resolvedParams.scope, resolvedParams.id), [resolvedParams.scope, resolvedParams.id]);
  const nextPath = `/join/${resolvedParams.scope}/${resolvedParams.id}`;

  useEffect(() => {
    if (loading || !config || !session || !email || status !== 'idle') return;

    async function join() {
      if (!config) return;
      setStatus('joining');
      const response = await apiFetch(config.apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_name: email })
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus('error');
        setMessage(json.error ?? 'Invitation impossible.');
        return;
      }

      setStatus('joined');
      setMessage(`Ajouté au ${config.label}.`);
    }

    void join();
  }, [apiFetch, config, email, loading, session, status]);

  if (!config) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center px-4 py-10 text-slate-200">
        Invitation invalide.
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="w-full rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Invitation</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">Rejoindre le {config.label}</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-300">
          {session ? message || 'Ajout en cours...' : 'Connecte-toi ou crée un compte pour rejoindre automatiquement.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {!session ? (
            <Link
              href={`/account?next=${encodeURIComponent(nextPath)}`}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              <LogIn className="h-4 w-4" />
              Continuer
            </Link>
          ) : status === 'joined' ? (
            <Link
              href={config.targetPath}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Ouvrir
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
