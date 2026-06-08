'use client';

import { useState } from 'react';
import { endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

import { useAuth } from '@/components/auth-context';
import type { PeriodView } from '@/lib/freetime';

const presets: Array<{ value: PeriodView; label: string }> = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' }
];

function toLocalInputValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function buildPresetRange(view: PeriodView) {
  const now = new Date();

  if (view === 'day') {
    const start = startOfDay(now);
    return { start, end: endOfDay(start) };
  }

  if (view === 'month') {
    const start = startOfMonth(now);
    return { start, end: endOfMonth(start) };
  }

  const start = startOfWeek(now, { weekStartsOn: 1 });
  return { start, end: endOfWeek(start, { weekStartsOn: 1 }) };
}

export function UnavailForm({ groupId }: { groupId: string }) {
  const { apiFetch } = useAuth();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await apiFetch('/api/availabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope_type: 'group',
          scope_id: groupId,
          start_ts: new Date(start).toISOString(),
          end_ts: new Date(end).toISOString(),
          note
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur');
      setMessage('Indisponibilite enregistree');
      setStart('');
      setEnd('');
      setNote('');
    } catch (err: any) {
      setMessage(err?.message ?? 'Erreur');
    }
  }

  function applyPreset(view: PeriodView) {
    const range = buildPresetRange(view);
    setStart(toLocalInputValue(range.start));
    setEnd(toLocalInputValue(range.end));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Raccourcis</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => applyPreset(preset.value)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-200">Debut</label>
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          type="datetime-local"
          className="mt-1 block w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/60"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-200">Fin</label>
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          type="datetime-local"
          className="mt-1 block w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/60"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-200">Note (optionnel)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 block w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/60"
        />
      </div>
      <button
        className="inline-flex items-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
        type="submit"
      >
        Enregistrer
      </button>
      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
    </form>
  );
}
