# Prochaines étapes concrètes

État actuel : le code est écrit, testé et commité localement. Il reste à
brancher les services externes.

```
✅ Code écrit et testé (42 tests backend, 14 tests frontend)
✅ Dépôt Git local initialisé, premier commit fait
⬜ Dépôt GitHub
⬜ Projet Supabase + SQL appliqué
⬜ Backend déployé (Railway / Render)
⬜ Frontend déployé (Vercel)
```

---

## Étape A — Créer le projet Supabase

1. Allez sur https://supabase.com et connectez-vous (ou créez un compte gratuit).
2. Cliquez sur **New project**.
3. Renseignez :
   - **Name** : `resto-smart`
   - **Database Password** : mot de passe fort, **notez-le**, il ne sera plus affiché
   - **Region** : la plus proche de votre université (ex. `West EU (Paris)` ou `EU Central`)
   - **Plan** : Free suffit pour démarrer
4. Attendez environ 2 minutes que le projet soit provisionné.

### Récupérer vos identifiants

Dans le tableau de bord : **Project Settings → API**

Notez ces trois valeurs, vous en aurez besoin partout :

| Clé | Où elle sert |
|---|---|
| `Project URL` | `SUPABASE_URL` |
| `anon public` | `SUPABASE_ANON_KEY` (aussi côté navigateur) |
| `service_role` | `SUPABASE_SERVICE_ROLE_KEY` — **backend uniquement, jamais exposée** |

Dans **Project Settings → Database → Connection string**, prenez aussi
l'URL de connexion (mode **Session** ou **Transaction**, pour le backend).

---

## Étape B — Appliquer le schéma SQL

La façon la plus simple, sans rien à installer :

1. Dans le tableau de bord Supabase, ouvrez **SQL Editor**.
2. Cliquez sur **New query**.
3. Ouvrez le fichier `sql/00_extensions_enums.sql`, copiez **tout** son contenu, collez-le dans l'éditeur, cliquez sur **Run**.
4. Recommencez pour chaque fichier, **dans cet ordre** :

```
sql/00_extensions_enums.sql     extensions, enums, séquences
sql/01_tables.sql              8 tables + contraintes + index
sql/02_functions_triggers.sql  fonctions et triggers métier
sql/03_rls.sql                 Row Level Security
sql/04_views.sql               vues de reporting
sql/05_seed.sql                repas et paramètres
sql/06_storage.sql             bucket Storage + policies
```

### Vérifier que tout est en place

Exécutez cette requête de contrôle dans le SQL Editor :

```sql
-- Doit renvoyer 8 tables, toutes avec rls activé
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by tablename;
```

Résultat attendu :

```
tablename          | rowsecurity
-------------------+------------
app_settings       | t
audit_logs         | t
meal_prices        | t
meal_types         | t
profiles           | t
reservation_items  | t
reservations       | t
tickets            | t
```

Puis :

```sql
-- Doit renvoyer les 3 repas
select code, name, display_order from meal_types order by display_order;
```

```
code      | name             | display_order
----------+------------------+---------------
BREAKFAST | Petit-déjeuner   | 1
LUNCH     | Déjeuner         | 2
DINNER    | Dîner            | 3
```

Si `rowsecurity` vaut `f`, exécutez :

```sql
alter table public.profiles          enable row level security;
alter table public.meal_types        enable row level security;
alter table public.meal_prices       enable row level security;
alter table public.reservations      enable row level security;
alter table public.reservation_items enable row level security;
alter table public.tickets           enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.app_settings      enable row level security;
```

---

## Étape C — Créer votre premier administrateur

1. Dans le tableau de bord : **Authentication → Users → Add user**.
2. Renseignez un email et un mot de passe, cochez **Auto Confirm User**.
3. Cliquez sur **Create user**.
4. Récupérez son identifiant :

```sql
select id, email from auth.users order by created_at desc limit 1;
```

5. Créez le profil administrateur :

```sql
insert into public.profiles (id, full_name, role, is_active)
values (
  'COLLEZ_ICI_L_ID',
  'Votre nom',
  'admin',
  true
);
```

Vous pouvez maintenant vous connecter sur `/login` avec ces identifiants.

---

## Étape D — Configurer le backend en local

```bash
cd backend
copy .env.example .env
```

Renseignez `.env` :

```ini
DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[motdepasse]@aws-0-[region].pooler.supabase.com:5432/postgres
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
QR_SECRET=une-cle-aleatoire-de-32-caracteres-minimum
ENVIRONMENT=development
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
```

Pour générer un `QR_SECRET` solide :

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Puis lancez :

```bash
uvicorn app.main:app --reload
```

Vérifiez http://localhost:8000/health → doit répondre `{"status":"ok",...}`

---

## Étape E — Configurer le frontend en local

```bash
cd frontend
copy .env.example .env.local
```

Renseignez `.env.local` :

```ini
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Puis :

```bash
npm run dev
```

Ouvrez http://localhost:3000 — vous devriez voir la page de connexion.

---

## Étape F — Pousser sur GitHub

Le dépôt local est prêt. Sur https://github.com/new :

- **Repository name** : `resto-smart`
- **Visibilité** : **Private** (le code contient de la logique métier)
- Ne cochez **rien** d'autre (pas de README, pas de .gitignore, le projet en a déjà)

Puis, dans le dossier du projet :

```bash
git remote add origin https://github.com/VOTRE-COMPTE/resto-smart.git
git push -u origin main
```

---

## Étape G — Déployer

Une fois le code sur GitHub :

| Service | Action |
|---|---|
| **Railway** (backend) | New Project → Deploy from GitHub → choisir `backend` → renseigner les variables d'environnement |
| **Vercel** (frontend) | Import Project → choisir `resto-smart` → Root Directory = `frontend` → renseigner les variables |

Les détails complets, y compris la tâche cron d'expiration des tickets, sont
dans `docs/etape-09-deploiement.md`.

---

## Ce qu'il vous faut me donner pour avancer

Une fois le projet Supabase créé, transmettez-moi :

1. La **Project URL**
2. La clé **anon public**

Je pourrai alors configurer les fichiers `.env` et `.env.local` avec vos vraies
valeurs.

> Ne me communiquez **jamais** la clé `service_role` ni le mot de passe de la
> base : la première est à mettre directement dans les variables
> d'environnement de Railway, le second dans celles de Supabase.
