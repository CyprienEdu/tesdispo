# TesDispo

TesDispo est une app pour organiser des sorties, des week-ends et des vacances entre amis.

La logique produit est simple:
- une landing page quand on n est pas connecte,
- une page compte pour creer un compte ou se connecter,
- une page A venir pour suivre les evenements deja dates,
- une page Groupes pour organiser les cercles d amis,
- une page Evenements pour piloter les evenements ponctuels,
- une page evenement avec un calendrier de disponibilites.

## Ce que fait l app

- Creer des groupes petits ou larges.
- Inviter des membres dans un groupe.
- Creer des evenements ponctuels depuis un groupe.
- Marquer des indisponibilites dans un calendrier mensuel par defaut.
- Naviguer en vue mois, semaine ou annee.
- Cliquer ou glisser sur le calendrier pour bloquer un jour ou une plage.
- Valider une date d evenement quand le groupe trouve un bon créneau.
- Faire remonter les evenements a venir dans une vue dediee.

## Parcours utilisateur

1. On arrive sur la landing page.
2. On clique sur le bouton compte dans la navbar.
3. On se connecte ou on cree un compte.
4. Une fois connecte, on atterrit sur la page A venir.
5. Depuis la navbar, on navigue vers Groupes, Evenements ou A venir.
6. Dans un groupe, on voit les evenements et on peut en creer un nouveau.
7. Dans un evenement, on ouvre le calendrier, on ajoute les indispos et on fixe une date.

## Principes de calendrier

- La vue mensuelle est la vue par defaut.
- Les jours passes sont grises et non selectionnables.
- On peut cliquer un jour pour le bloquer.
- On peut aussi cliquer-glisser pour bloquer une plage.
- La vue semaine et la vue annee restent disponibles pour le tri et la navigation.
- Les evenements dates et non passes remontent automatiquement dans A venir.

## Setup local

1. Installer les dependances:

```bash
npm install --legacy-peer-deps
```

2. Creer `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL="TesDispo <contact@ton-domaine.fr>"
```

Remplacer `re_xxxxxxxxx` par la vraie cle API Resend. `RESEND_FROM_EMAIL` doit utiliser un domaine verifie dans Resend pour envoyer a d autres adresses.

3. Initialiser la base avec `db/init.sql` dans Supabase SQL Editor.

4. Lancer l app:

```bash
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Notes techniques

- Les groupes et les evenements sont stockes dans Supabase.
- `resolved_at` sert de date validee pour un evenement.
- `archived_at` permet de sortir un evenement du flux visible si besoin.
- Le calendrier s appuie sur les indisponibilites sauvegardees en base.
- `POST /api/email/hello` envoie l email de test via Resend.
