'use client';

import { useEffect, useState } from 'react';
import { Check, LogOut, UserRound } from 'lucide-react';

import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth-context';
import { isBetaAllowed } from '@/lib/beta-access';

export default function AccountPage() {
  const { configured, loading, session, email, displayName, refreshSession, signOut } = useAuth();
  const [authEmail, setAuthEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setUsername(displayName || '');
  }, [displayName]);

  async function handleSignup() {
    if (!configured) return;
    if (!isBetaAllowed(authEmail)) {
      setMessage('Email non autorise pour cette beta.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/account`
      }
    });
    setMessage(error ? error.message : 'Compte cree. Verifie ta boite mail si la confirmation est activee.');
  }

  async function handleLogin() {
    if (!configured) return;
    if (!isBetaAllowed(authEmail)) {
      setMessage('Email non autorise pour cette beta.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password
    });
    setMessage(error ? error.message : 'Connecte.');
  }

  async function saveProfile() {
    if (!configured) return;
    if (!isBetaAllowed(email)) {
      setMessage('Email non autorise pour cette beta.');
      await signOut();
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      data: { username: username.trim() }
    });
    setMessage(error ? error.message : 'Pseudo mis a jour.');
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
            <h1 className="mt-2 text-3xl font-semibold text-white">Accede a ton espace</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Cree ton compte ou connecte-toi pour retrouver tes groupes, tes evenements et ta page A venir.
            </p>
          </div>

          <div className="space-y-4">
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
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
              placeholder="Pseudo"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSignup}
                className="rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Creer un compte
              </button>
              <button
                type="button"
                onClick={handleLogin}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Se connecter
              </button>
            </div>

            {message ? <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          </div>
        </section>
      ) : (
        <section className="grid gap-6 rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mon compte</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Gere ton profil</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Tu es connecte avec <span className="font-semibold text-white">{email}</span>. Tu peux
              mettre un pseudo, puis naviguer vers tes groupes et evenements.
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
                  value={username}
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
                  Se deconnecter
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
              <p>Tu arriveras directement sur la page A venir apres connexion.</p>
              <p>Ton compte sert de base pour rejoindre des groupes et marquer tes indispos.</p>
              <p>Plus tard, on pourra brancher la synchronisation calendrier externe ici.</p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
