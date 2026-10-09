# Étape 10 — Roadmap (Phases 0 à 7)

Chronologie projet, jalons et livrables. La durée estimée de l'étape 3 à l'étape 9 est de 4 à 6 semaines avec une équipe de 2-3 développeurs.

---

## Fiche de route globale

```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ P0  │ P1  │ P2  │ P3  │ P4  │ P5  │ P6  │
│ Sep │ Oct │ Nov │ Déc │ Jan │ Fév │ Mar │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

| Phase | Dates | Livrable | Rôles | Impact MVP |
|---|---|---|---|---|
| **0 – Préparation** | 09–15 Sep | Cahier des charges validé, environnement | PO, Admin | — |
| **1 – Foundation** | 16–30 Sep | BDD + RLS, Backend, API, Auth | Dev, DBA | Base fonctionnelle |
| **2 – MVP étudiant** | 01–15 Oct | Réservation, tickets, QR | Dev, UX | Les étudiants peuvent réserver et télécharger |
| **3 – MVP guichet** | 16–30 Oct | Encaissement, scan, file d'attente | Dev, Logisticien | Le logisticien accepte les paiements |
| **4 – Admin & rapports** | 01–15 Nov | Gestion comptes, tarifs, audit | Dev, Admin | L'admin gère la plateforme |
| **5 – Sécurité & conformité** | 16–30 Nov | Audit, backup, monitoring | DevSecOps | Conformité RGPD (données étudiantes) |
| **6 – Optimisation** | 01–15 Déc | Perf, tests charge, UX | DevOps, UX | Expérience fluide |
| **7 – Mise en production** | 16–31 Déc | Go-live université | Tous | Service disponible |

---

## Phase 0 – Préparation (1 semaine)

| Jalon | Tâches | Responsable | Validation |
|---|---|---|---|
| 0.1 | Validation du cahier des charges (étapes 1-4) | PO, Admin, Logisticien | `docs/` validés |
| 0.2 | Comptes services : Supabase projet, Railway, Vercel | DevOps | Accès vérifiés |
| 0.3 | Gestion des secrets initiales | DevOps | Variables `SUPABASE_*`, `QR_SECRET` stockées |
| 0.4 | Création du dépôt Git initial | Dev | `README.md`, `AGENTS.md` |

**Livrable** : dépôt fonctionnel, documentation initiale, secrets configurés.

---

## Phase 1 – Foundation (2 semaines)

| Jalon | Tâches | Technologie | Date cible |
|---|---|---|---|
| 1.1 | Base de données : migrations SQL 00–06 | PostgreSQL | S+3 |
| 1.2 | Tests de contraintes & RLS | psql / pytest | S+5 |
| 1.3 | API stub : routes d'accueil | FastAPI | S+7 |
| 1.4 | Authentification Supabase | Next.js, `@supabase/ssr` | S+10 |
| 1.5 | Backend connecté à la BDD | SQLAlchemy async | S+12 |
| 1.6 | Tests d'intégration BDD-API | pytest | S+14 |

**Critères d'acceptation** :
- ❏ 100 % des tables créées avec les bonnes contraintes.
- ❏ RLS bloquant l'accès non autorisé (tests E2E).
- ❏ Endpoint `/health` renvoie 200.
- ❏ JWT Supabase accepté par le backend.

---

## Phase 2 – MVP étudiant (2 semaines)

| Jalon | Tâches | Date cible |
|---|---|---|
| 2.1 | Page "Mes réservations" + création | S+16 |
| 2.2 | Formulaire réservation (repas + qty) | S+18 |
| 2.3 | Calcul total côté serveur (règle 2) | S+20 |
| 2.4 | Page mes tickets avec QR | S+22 |
| 2.5 | Téléchargement PDF individuel | S+24 |

**Critères d'acceptation** :
- ❏ Un étudiant peut créer une réservation de A à Z.
- ❏ Le QR code est scannable sans erreur.
- ❏ Le PDF contient la signature (placeholder) et le QR.

---

## Phase 3 – MVP guichet (2 semaines)

| Jalon | Tâches | Date cible |
|---|---|---|
| 3.1 | File d'attente temps réel | S+28 |
| 3.2 | Page encaissement (lecture uniquement) | S+30 |
| 3.3 | Bouton "Confirmer paiement" → tickets générés | S+32 |
| 3.4 | Scanner QR avec caméra | S+34 |
| 3.5 | Scan → consommation ticket (anti-fraude) | S+36 |
| 3.6 | Export caisse du jour | S+38 |
| 3.7 | Tests scénario complet | S+40 |

**Critères d'acceptation** :
- ❏ 10 réservations simulées, scannées, marquées `USED`.
- ❏ Doublon de scan → rejet avec code 409.
- ❏ Le logisticien ne voit que sa file.

---

## Phase 4 – Admin & rapports (2 semaines)

| Jalon | Tâches | Date cible |
|---|---|---|
| 4.1 | Gestion utilisateurs (création, rôle) | S+44 |
| 4.2 | Import par lot CSV | S+46 |
| 4.3 | Éditeur de tarifs | S+48 |
| 4.4 | Upload signature / cachet | S+50 |
| 4.5 | Dashboard admin (KPI) | S+52 |
| 4.6 | Audit logs (consultation + export) | S+54 |
| 4.7 | Rapports PDF hebdomadaires | S+56 |

**Critères d'acceptation** :
- ❏ L'admin peut changer le prix d'un repas sans casser l'historique.
- ❏ L'audit montre chaque étape d'une réservation.

---

## Phase 5 – Sécurité & conformité (1 semaine)

| Jalon | Tâches | Date cielle |
|---|---|---|
| 5.1 | Rotation clé HMAC (simulation) | S+58 |
| 5.2 | Tests d'injection SQL | S+60 |
| 5.3 | CSP configurée | S+62 |
| 5.4 | Sauvegarde automatisée | S+64 |
| 5.5 | Monitoring alertes (PagerDuty) | S+66 |

**Critères d'acceptation** :
- ❏ Aucun accès RLS bypassé détecté.
- ❏ Scan OWASP Basel II > 90 % de score.

---

## Phase 6 – Optimisation (2 semaines)

| Jalon | Tâches | Date cible |
|---|---|---|
| 6.1 | Métriques de performance (Lighthouse) | S+70 |
| 6.2 | Compression PDF (réduction 20 %) | S+72 |
| 6.3 | Taux d'erreur < 0,5 % | S+74 |
| 6.4 | Documentation utilisateur | S+76 |

---

## Phase 7 – Mise en production (2 semaines)

| Jalon | Tâches | Date cible |
|---|---|---|
| 7.1 | Migration données test → prod | S+78 |
| 7.2 | Formation logisticiens | S+80 |
| 7.3 | Go-live bêta (10 % étudiants) | S+81 |
| 7.4 | Retours corrigés | S+83 |
| 7.5 | Rollout général | S+84 |
| 7.6 | **Livrable final : MVP opérationnel** | S+84 |

---

## Dépendances critiques

| Élément | Dépend de | Impact si bloqué |
|---|---|---|
| Création des comptes étudiants | Admin (Phase 0) | Impossible de tester réservation |
| Signature du PDF | Admin (Phase 4) | Les PDF seront vierges |
| Prix des repas | Admin (Phase 4) | Aucun montant possible |
| Rotation des séquences numérotation | Cron (Phase 5) | Nouveau début d'année = conflit numéro |

---

## Risques majeurs & mitigation

| Risque | Probabilité | Impact | Plan B |
|---|---|---|---|
| Attaque DDoS sur le guichet (scans) | Moyen | Élevé | Rate limiter + WAF Cloudflare |
| Erreur de caisse (paiement) | Faible | Moyen | Export caisse quotidien, comparaison |
| Perte de données | Très faible | Critique | Sauvegarde hebdo, incrémentale |
| Ralentissement BDD | Moyen | Élevé | Indexs de performance surveillés, réplication lire |
| Réjet de l'API par l'université | Faible | Critique | Conformité aux normes IT de l'université |

---

## Communication

- **Réunions** : 1x/semaine le mardi 10h, récapitulatif dans Notion.
- **Tickets** : GitHub Issues (ou GitLab), labels `phase-0` à `phase-7`.
- **Slack** : canal `projet-resto-smart` pour questions rapides.
- **Livraison** : README.md à jour, `docs/` versionné, README de déploiement.

---

## Sprints concrets (exemple)**

### Sprint 1 – Setup & BDD (s. 1-2)

- [x] Étape 0 : créer repo + README
- [x] Étape 1 : vision produit
- [x] Étape 2 : architecture globale
- [x] Étape 3 : schéma DB
- [ ] Tests contraintes RLS

### Sprint 2 – API de base (s. 3-4)

- [x] Étape 4 : backend
- [x] Étape 5 : endpoints essentiels
- [ ] Tests CRUD réservations
- [ ] Auth JWT

### Sprint 3 – Étudiant (s. 5-6)

- [x] Étape 6 : frontend structure
- [x] Étape 7 : maquettes
- [ ] Réservation fonctionnelle
- [ ] PDF généré

### Sprint 4 – Guichet (s. 7-8)

- [ ] Encaissement
- [ ] Scan QR
- [ ] File d'attente

### Sprint 5 – Admin (s. 9-10)

- [x] Étape 8 : sécurité
- [x] Étape 9 : déploiement (staging)
- [ ] Gestion utilisateurs
- [ ] Rapports

---

## KPI de suivi (à reporter dans les réunions)

| KPI | Cible | Source |
|---|---|---|
| Temps moyen réservation → PDF | < 30 s | Logs backend |
| Taux d'erreur scan | < 0,5 % | Alertes Sentry |
| Nombre de tickets doublons | 0 | Audit logs |
| Temps réponse API | < 200 ms (p95) | Railway Metrics |
| Score Lighthouse | > 90 | CI |
| Couverture tests | > 80 % | pytest-cov, playwright |