'use client';

import { useState } from 'react';

export function UnavailForm({ groupId }: { groupId: string }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await fetch('/api/availabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, start_ts: start, end_ts: end, note })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur');
      setMessage('Indisponibilité enregistrée');
      setStart('');
      setEnd('');
      setNote('');
    } catch (err: any) {
      setMessage(err?.message ?? 'Erreur');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium">Début</label>
        <input value={start} onChange={(e) => setStart(e.target.value)} type="datetime-local" className="mt-1 block w-full rounded-md border px-3 py-2" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Fin</label>
        <input value={end} onChange={(e) => setEnd(e.target.value)} type="datetime-local" className="mt-1 block w-full rounded-md border px-3 py-2" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Note (optionnel)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2" />
      </div>
      <button className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-white" type="submit">Enregistrer</button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
