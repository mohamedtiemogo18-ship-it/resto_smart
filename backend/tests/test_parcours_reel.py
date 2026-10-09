"""Test de bout en bout du parcours métier sur une base réelle.

Ces tests exigent une vraie base PostgreSQL accessible via `DATABASE_URL`.
Ils sont ignorés automatiquement si la variable n'est pas définie :

    DATABASE_URL=postgresql+asyncgp://... pytest tests/test_parcours_reel.py

Le test se déroule entièrement dans une transaction annulée à la fin : la
base reste intacte. Seules les séquences de numérotation avancent, ce qui est
voulu — `nextval()` n'est pas transactionnel, justement pour qu'un rollback
ne puisse pas réattribuer un numéro déjà utilisé.

Les étapes qui provoquent volontairement une erreur utilisent des points de
sauvegarde (`begin_nested`) : une exception empoisonne la transaction
PostgreSQL. En production, chaque appel API a sa propre transaction, donc ce
cas ne se présente pas.

Chaque test crée son propre engine et le ferme ensuite : pytest-asyncio
fournit un nouvel event loop par test, et les connexions d'un pool partagé
resteraient attachées à une boucle fermée.
"""

import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL non défini : test réservé à une base réelle",
)


@pytest.fixture
async def db():
    """Session asynchrone sur un engine dédié, fermé en fin de test."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import NullPool

    from app.database import build_engine

    # build_engine applique le réglage adapté au pooler Supabase
    # (désactivation du cache de requêtes préparées en mode transaction).
    engine = build_engine(os.environ["DATABASE_URL"], poolclass=NullPool)
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with factory() as session:
            yield session
            await session.rollback()
    finally:
        await engine.dispose()


@pytest.fixture
async def operateur(db):
    from sqlalchemy import text

    result = await db.execute(
        text(
            "SELECT id FROM public.profiles "
            "WHERE role IN ('admin', 'logistician') LIMIT 1"
        )
    )
    oid = result.scalar_one_or_none()
    if oid is None:
        pytest.skip("Aucun compte admin ou logisticien : profil non créé")
    return oid


@pytest.fixture
async def prix_disponibles(db):
    """Vérifie que des prix sont en vigueur, sinon saute le test."""
    from sqlalchemy import text

    n = (
        await db.execute(
            text("SELECT count(*) FROM meal_prices WHERE effective_to IS NULL")
        )
    ).scalar_one()
    if n == 0:
        pytest.skip("Aucun prix en vigueur : seed non appliqué")


async def _creer_etudiant(db):
    """Crée un étudiant jetable et renvoie son identifiant."""
    from sqlalchemy import text

    uid = uuid.uuid4()
    await db.execute(
        text(
            "INSERT INTO auth.users (id, instance_id, aud, role, email, "
            "encrypted_password, email_confirmed_at, created_at, updated_at) "
            "VALUES (:i, '00000000-0000-0000-0000-000000000000', 'authenticated', "
            "'authenticated', :e, 'x', now(), now(), now())"
        ),
        {"i": uid, "e": f"test-{uid.hex[:8]}@example.com"},
    )
    await db.execute(
        text(
            "INSERT INTO public.profiles "
            "(id, full_name, role, matricule, room, is_active) "
            "VALUES (:i, 'Test Parcours', 'student', 'ETU-TEST-0001', 'B12-000', true)"
        ),
        {"i": uid},
    )
    return uid


async def _creer_reservation(db, etudiant_id, lignes):
    """Crée une réservation en attente avec les lignes (code repas, quantité)."""
    from sqlalchemy import text

    result = await db.execute(
        text(
            "INSERT INTO reservations (student_id, status) "
            "VALUES (:s, 'PENDING_PAYMENT') RETURNING id, reservation_number"
        ),
        {"s": etudiant_id},
    )
    row = result.one()

    for code, quantite in lignes:
        await db.execute(
            text(
                "INSERT INTO reservation_items "
                "(reservation_id, meal_type_id, quantity, unit_price) "
                "SELECT :r, m.id, :q, "
                "       (SELECT amount FROM meal_prices "
                "         WHERE meal_type_id = m.id AND effective_to IS NULL) "
                "FROM meal_types m WHERE m.code = :c"
            ),
            {"r": row[0], "q": quantite, "c": code},
        )
    await db.flush()
    return row[0], row[1]


async def _encaisser(db, reservation_id, operateur_id):
    """Appelle fn_confirm_payment et renvoie la réponse JSON."""
    import json

    from sqlalchemy import text

    result = await db.execute(
        text("SELECT public.fn_confirm_payment(:i, :a, 30, NULL, NULL)::text"),
        {"i": reservation_id, "a": operateur_id},
    )
    return json.loads(result.scalar_one())


async def _premier_ticket(db, reservation_id):
    from sqlalchemy import text

    return (
        await db.execute(
            text(
                "SELECT ticket_number FROM tickets "
                "WHERE reservation_id = :i ORDER BY ticket_number LIMIT 1"
            ),
            {"i": reservation_id},
        )
    ).scalar_one()


class TestParcoursComplet:
    @pytest.mark.asyncio
    async def test_paiement_genere_un_ticket_par_repas(
        self, db, operateur, prix_disponibles
    ):
        """Règle 7 : 17 tickets pour une commande de 10 + 5 + 2."""
        from sqlalchemy import text

        etudiant = await _creer_etudiant(db)
        rid, _ = await _creer_reservation(
            db, etudiant, [("LUNCH", 10), ("DINNER", 5), ("BREAKFAST", 2)]
        )

        data = await _encaisser(db, rid, operateur)

        assert data["status"] == "PAID"
        assert data["ticket_count"] == 17, (
            f"{data['ticket_count']} tickets générés, 17 attendus"
        )
        assert data["already_confirmed"] is False

        n = (
            await db.execute(
                text("SELECT count(*) FROM tickets WHERE reservation_id = :i"), {"i": rid}
            )
        ).scalar_one()
        assert n == 17

    @pytest.mark.asyncio
    async def test_double_clic_ne_cree_pas_de_doublon(
        self, db, operateur, prix_disponibles
    ):
        """Règle 9 : la confirmation de paiement est idempotente."""
        from sqlalchemy import text

        etudiant = await _creer_etudiant(db)
        rid, _ = await _creer_reservation(db, etudiant, [("LUNCH", 3)])

        await _encaisser(db, rid, operateur)
        await db.flush()

        data = await _encaisser(db, rid, operateur)

        assert data["already_confirmed"] is True
        assert data["ticket_count"] == 3

        n = (
            await db.execute(
                text("SELECT count(*) FROM tickets WHERE reservation_id = :i"), {"i": rid}
            )
        ).scalar_one()
        assert n == 3, "le second clic a créé des tickets en trop"

    @pytest.mark.asyncio
    async def test_double_scan_est_refuse(self, db, operateur, prix_disponibles):
        """Règle 6 : un ticket consommé est définitif."""
        from sqlalchemy import text

        etudiant = await _creer_etudiant(db)
        rid, _ = await _creer_reservation(db, etudiant, [("LUNCH", 2)])

        await _encaisser(db, rid, operateur)
        await db.flush()

        numero = await _premier_ticket(db, rid)

        # Premier scan : doit réussir
        premier = await db.execute(
            text("SELECT public.fn_consume_ticket(:n, :a, NULL, NULL)::text"),
            {"n": numero, "a": operateur},
        )
        assert "USED" in premier.scalar_one()

        # Second scan du MÊME ticket : doit être refusé
        try:
            async with db.begin_nested():
                await db.execute(
                    text(
                        "SELECT public.fn_consume_ticket(:n, :a, NULL, NULL)::text"
                    ),
                    {"n": numero, "a": operateur},
                )
            pytest.fail("le second scan aurait dû être refusé")
        except Exception as e:
            assert "TICKET_ALREADY_USED" in str(getattr(e, "orig", e))

    @pytest.mark.asyncio
    async def test_ticket_perime_est_refuse(self, db, operateur, prix_disponibles):
        from sqlalchemy import text

        etudiant = await _creer_etudiant(db)
        rid, _ = await _creer_reservation(db, etudiant, [("LUNCH", 1)])

        await _encaisser(db, rid, operateur)
        await db.flush()

        numero = await _premier_ticket(db, rid)
        await db.execute(
            text("UPDATE tickets SET valid_until = current_date - 1 WHERE ticket_number = :n"),
            {"n": numero},
        )
        await db.flush()

        try:
            async with db.begin_nested():
                await db.execute(
                    text(
                        "SELECT public.fn_consume_ticket(:n, :a, NULL, NULL)::text"
                    ),
                    {"n": numero, "a": operateur},
                )
            pytest.fail("un ticket périmé aurait dû être refusé")
        except Exception as e:
            assert "TICKET_EXPIRED" in str(getattr(e, "orig", e))

    @pytest.mark.asyncio
    async def test_un_etudiant_ne_peut_pas_encaisser(self, db, prix_disponibles):
        """Règle 4 : seul le personnel confirme un paiement."""
        from sqlalchemy import text

        etudiant = await _creer_etudiant(db)
        rid, _ = await _creer_reservation(db, etudiant, [("LUNCH", 1)])

        try:
            async with db.begin_nested():
                await db.execute(
                    text(
                        "UPDATE reservations SET status = 'PAID', paid_at = now() "
                        "WHERE id = :i"
                    ),
                    {"i": rid},
                )
            pytest.fail("le passage à PAID aurait dû être refusé")
        except Exception as e:
            assert "PAYMENT_CONFIRM_FORBIDDEN" in str(getattr(e, "orig", e))

    @pytest.mark.asyncio
    async def test_annulation_interdite_apres_paiement(
        self, db, operateur, prix_disponibles
    ):
        from sqlalchemy import text

        etudiant = await _creer_etudiant(db)
        rid, _ = await _creer_reservation(db, etudiant, [("LUNCH", 1)])

        await _encaisser(db, rid, operateur)
        await db.flush()

        try:
            async with db.begin_nested():
                await db.execute(
                    text(
                        "SELECT public.fn_cancel_reservation(:i, :a, 'test', NULL, NULL)::text"
                    ),
                    {"i": rid, "a": operateur},
                )
            pytest.fail("l'annulation après paiement aurait dû être refusée")
        except Exception as e:
            assert "RESERVATION_PAID_FINAL" in str(getattr(e, "orig", e))

    @pytest.mark.asyncio
    async def test_operations_sensibles_sont_tracees(
        self, db, operateur, prix_disponibles
    ):
        """Règle 10 : toute opération sensible laisse une trace."""
        from sqlalchemy import text

        etudiant = await _creer_etudiant(db)
        rid, numero = await _creer_reservation(db, etudiant, [("LUNCH", 1)])

        await _encaisser(db, rid, operateur)
        await db.flush()

        n = (
            await db.execute(
                text(
                    "SELECT count(*) FROM audit_logs "
                    "WHERE entity_id = :n AND action = 'payment.confirm'"
                ),
                {"n": numero},
            )
        ).scalar_one()
        assert n >= 1, "aucune trace d'audit pour la confirmation de paiement"
