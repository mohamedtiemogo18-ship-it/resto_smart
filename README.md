# Resto Smart — Digitalisation des tickets de restauration universitaire

Application complète de réservation, paiement en espèces et consommation des tickets de restauration universitaire.

## Architecture

| Composant | Technologie | Rôle |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | Interfaces étudiant, guichet et administration |
| **Backend** | FastAPI + SQLAlchemy async | API REST, orchestration métier |
| **Base** | PostgreSQL via Supabase | Vérité métier : contraintes, RLS, fonctions SQL |
| **Stockage** | Supabase Storage | PDF des tickets, signature, cachet |
| **Auth** | Supabase Auth (JWT) | Authentification et rôles |

Le backend est volontairement **fin** : toutes les règles métier critiques
(numérotation, statuts, idempotence, anti-réutilisation) vivent dans les
fonctions SQL. Le backend valide les entrées, orchestre, génère les PDF et
les QR signés.

## Structure du projet

```
resto_smart/
├── sql/                      # Schéma SQL complet, à exécuter dans l'ordre
│   ├── 00_extensions_enums.sql
│   ├── 01_tables.sql
│   ├── 02_functions_triggers.sql
│   ├── 03_rls.sql
│   ├── 04_views.sql
│   ├── 05_seed.sql
│   └── 06_storage.sql
│
├── backend/                  # API FastAPI
│   ├── app/
│   │   ├── main.py           # Application, middlewares, enveloppe d'erreur
│   │   ├── config.py         # Settings pydantic
│   │   ├── database.py       # Engine et session async
│   │   ├── models/           # 8 modèles SQLAlchemy
│   │   ├── schemas/          # Schémas Pydantic requête/réponse
│   │   ├── api/
│   │   │   ├── deps.py       # Session, current_user, gardes de rôle
│   │   │   └── router.py     # Agrégateur /api/v1
│   │   ├── routers/          # 7 routers
│   │   ├── services/         # 9 services métier
│   │   ├── core/             # Erreurs, sécurité, logs, rate limit
│   │   └── templates/
│   ├── migrations/           # Alembic
│   ├── tests/                # 42 tests
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                 # Application Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/        # Connexion
│   │   │   ├── etudiant/     # Espace étudiant (mobile)
│   │   │   ├── guichet/      # Espace guichet (bureau)
│   │   │   └── admin/        # Espace administration
│   │   ├── components/       # UI, layout, réservations, tickets, scanner…
│   │   ├── hooks/            # TanStack Query
│   │   ├── lib/              # Client API, Supabase, formats
│   │   ├── providers/
│   │   └── types/
│   ├── tests/unit/           # 14 tests
│   ├── package.json
│   └── next.config.js
│
├── docs/                     # Cahier des charges (étapes 1 à 10)
└── README.md
```

## Démarrage rapide

### Prérequis

- Python 3.12+
- Node.js 20+
- Un projet Supabase

### 1. Base de données (Supabase)

Dans le SQL Editor de votre projet Supabase, exécutez dans l'ordre :

```
sql/00_extensions_enums.sql
sql/01_tables.sql
sql/02_functions_triggers.sql
sql/03_rls.sql
sql/04_views.sql
sql/05_seed.sql
sql/06_storage.sql
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux : source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env            # puis renseigner vos valeurs Supabase
uvicorn app.main:app --reload
```

API sur http://localhost:8000 — documentation interactive sur `/docs`

### 3. Frontend

```bash
cd frontend
npm install

cp .env.example .env.local      # puis renseigner vos valeurs Supabase
npm run dev
```

Application sur http://localhost:3000

## Tests

```bash
# Backend — 42 tests (règles métier, QR falsifié, gardes de rôle)
cd backend && pytest

# Frontend — 14 tests (formatage monétaire, libellés)
cd frontend && npm test

# Vérifications complètes
cd frontend && npm run typecheck && npm run lint && npm run build
```

## Règles métier clés

1. Une réservation contient au moins un repas, quantité ≥ 1.
2. Le prix vient toujours de la base ; le backend recalcule le total.
3. Le `unit_price` est figé dans `reservation_items`.
4. L'étudiant ne confirme jamais son paiement.
5. `PENDING_PAYMENT → PAID | CANCELLED`, sans retour arrière.
6. `GENERATED → USED | EXPIRED`. Un ticket `USED` est définitif.
7. Un ticket par repas : 17 tickets pour 10 + 5 + 2.
8. Numéros uniques : `RES-YYYY-000001`, `TKT-YYYY-000001`.
9. Confirmation de paiement atomique et idempotente.
10. Toute opération sensible est tracée dans `audit_logs`.

## Choix techniques notables

| Sujet | Décision | Pourquoi |
|---|---|---|
| PDF | ReportLab | Aucune dépendance système : fonctionne sur Windows comme sur Linux |
| QR | `segno` + HMAC-SHA256 | Signature serveur, inviolable sans la clé |
| Routes | Segments réels (`/etudiant`, `/guichet`, `/admin`) | Les groupes `(x)` partagent la même URL et entraient en conflit |
| Police | Pile système | Aucun appel réseau au build, donc un build reproductible hors ligne |
| Montants | `Decimal` côté Python, chaîne côté JSON | Jamais de flottant sur de l'argent |

## Documentation

| Étape | Fichier |
|---|---|
| 1. Vision du produit | `docs/etape-01-vision.md` |
| 2. Architecture globale | `docs/etape-02-architecture.md` |
| 3. Base de données | `docs/etape-03-base-de-donnees.md` |
| 4. Backend FastAPI | `docs/etape-04-backend.md` |
| 5. API REST | `docs/etape-05-api.md` |
| 6. Frontend Next.js | `docs/etape-06-frontend.md` |
| 7. UX/UI | `docs/etape-07-ux-ui.md` |
| 8. Sécurité | `docs/etape-08-securite.md` |
| 9. Déploiement | `docs/etape-09-deploiement.md` |
| 10. Roadmap | `docs/etape-10-roadmap.md` |
