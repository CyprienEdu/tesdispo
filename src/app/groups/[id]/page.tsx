import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UnavailForm } from './unavail-form';
import { format } from 'date-fns';

export default async function GroupPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const groupRes = await supabase.from('groups').select('*').eq('id', params.id).limit(1).single();
  if (groupRes.error || !groupRes.data) {
    return <div className="p-8">Groupe introuvable</div>;
  }

  // récupère quelques créneaux communs par défaut
  const csRes = await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : ''}/api/groups/${params.id}/common-slots?days=7&slot=30`, {
    cache: 'no-store'
  });
  const csJson = await csRes.json().catch(() => ({ slots: [] }));

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold">Groupe: {groupRes.data.name}</h1>
          <p className="text-sm text-muted-foreground">ID: {params.id}</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-lg font-medium">Marquer une indisponibilité</h2>
            <UnavailForm groupId={params.id} />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-medium">Créneaux communs (prochaines 7 jours)</h2>
            <div className="space-y-2">
              {(csJson.slots ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun créneau trouvé ou données manquantes.</p>
              ) : (
                (csJson.slots as any[]).slice(0, 40).map((s) => (
                  <div key={s.start} className="rounded-md border p-2">
                    <div className="text-sm font-medium">{format(new Date(s.start), "eee dd/MM HH:mm")} — {format(new Date(s.end), "HH:mm")}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
