'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LayoutGrid, LogOut, Mail, Sparkles, Users, CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth-context';

const appNav = [
  { href: '/upcoming', label: 'À venir', icon: Sparkles },
  { href: '/groups', label: 'Groupes', icon: Users },
  { href: '/events', label: 'Évènements', icon: CalendarDays }
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, session, displayName, email, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isInviteRoute = pathname.startsWith('/join/');
  const isPublicRoute = pathname === '/' || pathname === '/account' || isInviteRoute;
  const isLanding = pathname === '/';
  const isAccount = pathname === '/account';
  const isProtected = !isPublicRoute;

  useEffect(() => {
    if (loading) return;

    if (isLanding && session) {
      router.replace('/upcoming');
      return;
    }

    if (isProtected && !session) {
      router.replace(`/account?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLanding, isProtected, loading, router, session]);

  const accountLabel = displayName || email || 'Compte';
  const accountInitials = useMemo(() => initials(accountLabel), [accountLabel]);

  if (loading && isProtected) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(124,247,194,0.15),transparent_34%),linear-gradient(180deg,#06110f_0%,#081512_100%)] text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(124,247,194,0.15),transparent_34%),radial-gradient(circle_at_right,rgba(38,99,77,0.2),transparent_28%),linear-gradient(180deg,#06110f_0%,#081512_100%)] text-slate-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href={session ? '/upcoming' : '/'} className="group flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 shadow-lg shadow-emerald-950/20">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">TesDispo</p>
              <p className="text-xs text-slate-400">Sorties, events et calendrier de groupe</p>
            </div>
          </Link>

          {session && pathname !== '/' ? (
            <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
              {appNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      active ? 'bg-emerald-400 text-slate-950' : 'text-slate-200 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <div />
          )}

          <div className="relative">
            {!session ? (
              <Link
                href="/account"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Mon compte
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-300 text-sm font-semibold text-slate-950">
                  {accountInitials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-xs uppercase tracking-[0.25em] text-slate-400">Compte</span>
                  <span className="block text-sm font-medium text-white">{accountLabel}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-300" />
              </button>
            )}

            {session ? (
              <div
                className={`absolute right-0 top-[calc(100%+0.5rem)] w-72 rounded-[1.5rem] border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl transition ${
                  menuOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
                }`}
              >
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Connecté</p>
                  <p className="mt-2 text-sm font-medium text-white">{accountLabel}</p>
                  <p className="mt-1 text-xs text-slate-400">{email}</p>
                </div>
                <div className="mt-3 space-y-1">
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-100 transition hover:bg-white/8"
                  >
                    <Mail className="h-4 w-4" />
                    Gérer mon compte
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                      router.push('/');
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Se déconnecter
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {!session && isLanding ? (
          <div className="border-t border-white/10 bg-white/5">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 text-sm text-slate-300 sm:px-6 lg:px-8">
              <p>Vue calendrier type Google Calendar, pensée pour les sorties entre amis.</p>
              <Link href="/account" className="font-semibold text-emerald-100 hover:text-white">
                Créer un compte
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <div onClick={() => setMenuOpen(false)}>{children}</div>
    </div>
  );
}
