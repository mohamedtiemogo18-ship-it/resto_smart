# Étape 9 — Déploiement

## 9.1 Architecture cible

```
┌──────────────────────────────────────────────────────────────┐
│                     VERCEL (Edge Network)                   │
│  Next.js Frontend (App Router)                               │
│  → CDN global, previews, ISR pour routes publiques           │
└───────────────────────┬──────────────────────────────────────┘
                          │ HTTPS / JWT (Anon Key)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│            SUPABASE — Base de données Postgres              │
│  auth.users + profiles + toutes les tables métier           │
│  Storage bucket `tickets`                                     │
│  RLS activée, fonctions security definer installées          │
└───────────────────────┬──────────────────────────────────────┘
                          │
                          │ HTTPS (Service Role)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              RAILWAY / Render — Backend FastAPI             │
│  FastAPI + Uvicorn workers (auto-scaling)                   │
│  SQLAlchemy async, PDF + QR, audit                             │
│  Secrets : SUPABASE_SERVICE_ROLE_KEY, QR_SECRET               │
└──────────────────────────────────────────────────────────────┘
```

**Schéma de domaine recommandé :**
- Frontend : `resto-univ.edu` (ou `resto.smart` pour tests)
- API : `api.resto-univ.edu` (ou `api.resto.smart`)
- Supabase : géré, accès restreint aux admins.

---

## 9.2 Environnements

| Environnement | Backend | Frontend | Base | Secrets |
|---|---|---|---|---|
| **dev** | Railway `free` | Vercel `Development` | Projet Supabase Dev | `DEV_` prefix |
| **staging** | Railway `Standard` | Vercel `Preview` | Projet Supabase Staging | `STAGING_` prefix |
| **prod** | Railway `Pro` (2+ CPU) | Vercel `Production` | Projet Supabase Pro | pas de prefix |

Les connexions entre services utilisent **HTTPS** et les clés `anon` côté frontend, `service_role` côté backend.

---

## 9.3 Déploiement — Étapes

### 1. Base de données Supabase

```bash
# Dans le projet Supabase
supabase init
supabase status
# applique le schéma
psql -h db.supabase.co -U postgres -d postgres -f sql/00_extensions_enums.sql
psql -h db.supabase.co -U postgres -d postgres -f sql/01_tables.sql
psql -h db.supabase.co -U postgres -d postgres -f sql/02_functions_triggers.sql
psql -h db.supabase.co -U postgres -d postgres -f sql/03_rls.sql
psql -h db.supabase.co -U postgres -d postgres -f sql/04_views.sql
psql -h db.supabase.co -U postgres -d postgres -f sql/05_seed.sql
psql -h db.supabase.co -U postgres -d postgres -f sql/06_storage.sql
```

Vérification des RLS :

```sql
select * from pg_stat_user_tables where relname in ('profiles', 'reservations', ...)\G
```

Chaque table doit avoir `row_security = on`.

### 2. Backend FastAPI (Railway)

`Dockerfile` :

```dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y libpangocairo-1.0-0 libpango-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

Variables d'environnement (Railway > Settings > Variables) :

```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
QR_SECRET=<aléatoire 32 chars>
QR_SECRET_VERSION=1
BACKEND_CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

Déploiement :

```bash
git add .
git commit -m "Initial FastAPI"
git push railway main
```

### 3. Frontend (Vercel)

`vercel.json` :

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://api.resto-smart.railway.app/$1" }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Frame-Options", "value": "DENY" }] }
  ]
}
```

Variables d'environnement dans le dashboard Vercel :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=/api
```

Cliquez sur **Deploy**. Vercel détecte automatiquement le fichier `next.config.mjs` / `package.json`.

---

## 9.4 Migrations & Updates

### Alembic

```bash
# Créer une migration
alembic revision --autogenerate -m "ajout colonne"
alembic upgrade head

# Ou, dans un fichier dédié
sql/02_add_ticket_qr_image.sql
```

Pour les modifications non autogénérables (ex. extensions, fonctions), écrivez SQL DDL dans un fichier immédiatement après le `revision`.

### Hot-reload

- **Frontend** : Vercel → nouveau déploiement Preview à chaque push.
- **Backend** : Railway → rebuild sur push, ou Dockerfile statique à mettre à jour.

### Zero-downtime

Le backend expose `/health` pour le liveness probe.

Configuration Railway :
```
Health Check → Endpoint: /health → Interval: 30s
```

Le frontend a son propre réseau Edge ; il n'a pas de downtime lors d'une nouvelle deployment.

---

## 9.5 Tests

### Tests unitaires & d'intégration

```bash
# Backend
pytest -v tests/

# Frontend
npm run test
npm run test:e2e  # Playwright
```

### Tests e2e recommandés (GitHub Actions)

```yaml
- name: "Test réservation"
  run: npx playwright test e2e/reservation.spec.ts

- name: "Test encaissement"
  run: npx playwright test e2e/encaissement.spec.ts --retries 2
```

### Tests de sécurité

```bash
# Scan faille
python -m bandit -r app/
npx audit-ci --high

# JWT replay (test avec clé non expirée)
# SQL injection sur number
curl -H "Authorization: Bearer $TOKEN" "https://api.../reservations?number=' OR 1=1--"
```

---

## 9.6 Monitoring & alerting

### Logs

- **Backend** : Railway → Logs en temps réel. Export vers Papertrail ou Logtail.
- **Frontend** : Vercel → Insights > Logs.
- **Base** : Req Queries dans le tableau de bord Supabase.

### Monitoring de santé

```bash
# Script de ping (cron Railway)
curl -fsS https://api.resto.smart/health || echo "DOWN" | mail -s "API DOWN" admin@univ.edu
```

### Alertes critiques (à configurer)

| Événement | Niveau | Action |
|---|---|---|
| Erreur 5xx > 5/min | P1 | PagerDuty / Slack |
| `audit_logs` > 100 `FAILURE` en 10 min | P2 | Investigation |
| `ticket.consume` > 50 `TICKET_ALREADY_USED` | P3 | Possible tentative de fraude |
| `payment.confirm` échoue | P2 | Log détaillé |

---

## 9.7 Backup & recoverie

- **Supabase** : sauvegarde incrémentale journalière automatique (option `Backups` → 7 jours).
- **Export** : `pg_dump` périodique (nightly) vers S3 :

```bash
pg_dump -h db.supabase.co -U @ -Fc resto_db > backup_$(date +%F).dump
```

- **Récupération** : restauration depuis le dashboard Supabase → "Restore" → choisir la date.

---

## 9.8 Rollback

### Frontend
```bash
# Revert d'un commit Vercel
vercel git rollback
```

### Backend
- Sur Railway : le bouton "Redeploy previous release" ou un `git reset --hard` suivi d'un push.

### Base
- Révision sql `down` si des migrations sont inversibles (rare).
- Sinon : restaurer la sauvegarde complète.

---

## 9.9 Checklist de validation

- [ ] Le domaine `reso-smart.example.com` pointe vers Vercel.
- [ ] Le certificat SSL est valide (`curl -I https://... | grep strict`).
- [ ] Les variables `SUPABASE_*` sont présentes dans les deux environnements.
- [ ] La tâche cron `expire_tickets` s'exécute (vérifier `cron_jobs` Supabase).
- [ ] Le bouton “Réinitialiser les numéros” est désactivé pour tout le monde sauf admin (testé).
- [ ] Un étudiant ne peut accéder qu'aux siens via l'URL directe.
- [ ] Le scan d'un ticket réel consomme le ticket (test sur téléphone).
- [ ] Un ticket expiré le reste expiré après l'échéance automatique.
- [ ] L'export CSV des rapports fonctionne (format correct).
- [ ] Les fonctions `fn_*` sont bien `SECURITY DEFINER` (propriétaire `postgres`).
- [ ] Aucune donnée sensible dans les logs (`grep PASSWORD` → aucun résultat).

---

## 9.13 Points ouverts / recommandations

1. **Monitoring des erreurs** : intégrer Sentry pour le backend et le frontend. Capturer `error_code`, `request_id`, `user.id`.
2. **CI/CD avec Alembic** : ajouter une étape `alembic upgrade head` dans le pipeline `post-deploy` Railway (ou wrapper dans `entrypoint.sh`).
3. **Tests de charge** : Simuler 100 scans simultanés pour valider le `select for update` (PostgreSQL est fiable jusqu'à ~500).
4. **Redondance** : pour un SLA > 99.9 %, envisager un load balancer (Railway Auto-Scaling) ou un second région Vercel.