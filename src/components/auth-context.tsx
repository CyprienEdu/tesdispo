'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { createSupabaseBrowserClient, hasSupabaseConfig } from '@/lib/supabase';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  email: string;
  displayName: string;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = hasSupabaseConfig();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  async function refreshSession() {
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    setSession(data.session ?? null);
    setLoading(false);
  }

  async function signOut() {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSession(null);
  }

  const apiFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!configured) {
      return fetch(input, init);
    }

    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);

    if (data.session?.access_token) {
      headers.set('Authorization', `Bearer ${data.session.access_token}`);
    }

    return fetch(input, { ...init, headers });
  }, [configured]);

  useEffect(() => {
    void refreshSession();
  }, [configured]);

  useEffect(() => {
    if (!configured) return;

    const supabase = createSupabaseBrowserClient();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [configured]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const email = user?.email ?? '';
    const displayName = String(user?.user_metadata?.username ?? '').trim() || email;

    return {
      configured,
      loading,
      session,
      user,
      email,
      displayName,
      refreshSession,
      signOut,
      apiFetch
    };
  }, [apiFetch, configured, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
