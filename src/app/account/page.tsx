'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LogOut, UserRound } from 'lucide-react';

import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth-context';
import { isBetaAllowed } from '@/lib/beta-access';

export default function AccountPage() {
  const router = useRouter();
  const { configured, loading, session, email, displayName, refreshSession, signOut } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const profileUsername = username || displayName || '';

  function getAuthMessage(error: string) {
    if (error === 'email_domain_not_configured') {
      return 'Email impossible: domaine Resend non configure. Ajoute un domaine valide dans Resend.';
    }

    return error || 'Création du compte impossible.';
  }

  function getSafeNextPath() {
    const nextPath = new URLSearchParams(window.location.search).get('next') ?? '';
    return nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '';
  }

  useEffect(() => {
    if (!session) return;
    const safeNextPath = getSafeNextPath();
    if (safeNextPath) {
      router.replace(safeNextPath);
    }
  }, [router, session]);

  async function handleSignup() {
    if (!configured) return;
    if (!isBetaAllowed(authEmail)) {
      setMessage('Email non autorisé pour cette bêta.');
      return;
    }

    const signup = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password, username, next: getSafeNextPath() })
    });

    if (!signup.ok) {
      const data = await signup.json().catch(() => ({ error: 'signup_failed' }));
      setMessage(getAuthMessage(data.error));
      return;
    }

    setMessage('Compte créé. Vérifie ta boîte mail pour confirmer ton compte.');
  }

  async function handleLogin() {
    if (!configured) return;
    if (!isBetaAllowed(authEmail)) {
      setMessage('Email non autorisé pour cette bêta.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password
    });
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Connecté.');
    const safeNextPath = getSafeNextPath();
    router.push(safeNextPath || '/upcoming');
  }

  async function saveProfile() {
    if (!configured) return;
    if (!isBetaAllowed(email)) {
      setMessage('Email non autorisé pour cette bêta.');
      await signOut();
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      data: { username: profileUsername.trim() }
    });
    setMessage(error ? error.message : 'Pseudo mis à jour.');
    await refreshSession();
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center px-4 py-10 text-slate-200">
        Chargement...
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      {!session ? (
        <section className="grid gap-6 rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Compte</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Accède à ton espace</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Crée ton compte ou connecte-toi pour retrouver tes groupes, tes évènements et ta page À venir.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  authMode === 'login' ? 'bg-emerald-400 text-slate-950' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  authMode === 'signup' ? 'bg-emerald-400 text-slate-950' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                Créer un compte
              </button>
            </div>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
              placeholder="Email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
              placeholder="Mot de passe"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {authMode === 'signup' ? (
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
                placeholder="Pseudo"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {authMode === 'signup' ? (
                <button
                  type="button"
                  onClick={handleSignup}
                  className="rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  Créer un compte
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  className="rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  Se connecter
                </button>
              )}
            </div>

            {message ? <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          </div>
        </section>
      ) : (
        <section className="grid gap-6 rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mon compte</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Gère ton profil</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Tu es connecté avec <span className="font-semibold text-white">{email}</span>. Tu peux
              mettre un pseudo, puis naviguer vers tes groupes et évènements.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Email</p>
                <p className="mt-2 text-sm font-medium text-white">{email}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Pseudo</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
                  value={profileUsername}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveProfile}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  <Check className="h-4 w-4" />
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </button>
              </div>
              {message ? <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Profil actif</p>
                <p className="mt-1 text-lg font-semibold text-white">{displayName || email}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <p>Tu arriveras directement sur la page À venir après connexion.</p>
              <p>Ton compte sert de base pour rejoindre des groupes et marquer tes indispos.</p>
              <p>Plus tard, on pourra brancher la synchronisation calendrier externe ici.</p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
