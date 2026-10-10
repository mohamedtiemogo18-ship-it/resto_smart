'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, EmptyState } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { PageHeader } from '@/components/ui/layout'
import { useCreateReservation, useMeals } from '@/hooks/use-api'
import { computeChange, formatMoney } from '@/lib/format/money'
import { ApiError } from '@/lib/api'
import type { Meal } from '@/types'

interface Ligne {
  meal: Meal
  quantite: number
}

export default function ReserverPage() {
  const router = useRouter()
  const { data: meals, isLoading, isError, error, refetch } = useMeals()

  const [lignes, setLignes] = useState<Ligne[]>([])
  const [note, setNote] = useState('')

  const disponibles = (meals ?? []).filter((m) => m.price)
  const creer = useCreateReservation()

  function ajouter(meal: Meal) {
    setLignes((prev) => {
      const existe = prev.find((l) => l.meal.id === meal.id)
      if (existe) {
        return prev.map((l) =>
          l.meal.id === meal.id
            ? { ...l, quantite: Math.min(99, l.quantite + 1) }
            : l
        )
      }
      return [...prev, { meal, quantite: 1 }]
    })
  }

  function changerQuantite(mealId: number, quantite: number) {
    if (quantite < 1) {
      retirer(mealId)
      return
    }
    setLignes((prev) =>
      prev.map((l) =>
        l.meal.id === mealId ? { ...l, quantite: Math.min(99, quantite) } : l
      )
    )
  }

  function retirer(mealId: number) {
    setLignes((prev) => prev.filter((l) => l.meal.id !== mealId))
  }

  // Aperçu uniquement : le montant officiel est recalculé par le serveur
  const apercu = lignes.reduce(
    (somme, l) => somme + Number.parseFloat(l.meal.price!.amount) * l.quantite,
    0
  )
  const totalTickets = lignes.reduce((somme, l) => somme + l.quantite, 0)

  async function soumettre() {
    if (lignes.length === 0) {
      toast.error('Ajoutez au moins un repas')
      return
    }

    try {
      const reservation = await creer.mutateAsync({
        items: lignes.map((l) => ({
          meal_type_id: l.meal.id,
          quantity: l.quantite,
        })),
        note: note.trim() || undefined,
      })
      toast.success('Demande enregistrée', {
        description: `Référence ${reservation.reservation_number}`,
      })
      router.push(`/etudiant/mes-reservations/${reservation.id}`)
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null
      toast.error(apiError?.message ?? 'Impossible de créer la réservation', {
        description: apiError?.code,
      })
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <PageHeader title="Réserver" description="Chargement des repas disponibles…" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) return <div className="page"><ErrorState error={error} onRetry={refetch} /></div>

  return (
    <div className="page">
      <PageHeader
        title="Réserver"
        description="Choisissez vos repas. Le montant sera calculé automatiquement."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        {/* Sélection des repas */}
        <section className="space-y-3">
          <h2 className="section-label">Repas disponibles</h2>

          {disponibles.length === 0 ? (
            <EmptyState
              icon={<UtensilsCrossed className="h-5 w-5" />}
              title="Aucun repas disponible"
              description="Aucun tarif n'est en vigueur pour le moment. Contactez le service de restauration."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {disponibles.map((meal) => {
                const dansPanier = lignes.find((l) => l.meal.id === meal.id)
                return (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => ajouter(meal)}
                    aria-label={`Ajouter ${meal.name}`}
                    className={
                      dansPanier
                        ? 'surface-hover group relative p-4 text-left ring-2 ring-primary/40'
                        : 'surface-hover group relative p-4 text-left'
                    }
                  >
                    <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      +
                    </span>
                    <p className="font-medium">{meal.name}</p>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      {formatMoney(meal.price!.amount)}
                    </p>
                    {meal.description && (
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {meal.description}
                      </p>
                    )}
                    {dansPanier && (
                      <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground">
                        {dansPanier.quantite}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Panier */}
        <aside className="lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>Ma commande</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lignes.length === 0 ? (
                <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                  Sélectionnez un repas pour commencer.
                </p>
              ) : (
                <ul className="divide-y">
                  {lignes.map(({ meal, quantite }) => (
                    <li key={meal.id} className="space-y-2 py-3 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {meal.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => retirer(meal.id)}
                          aria-label={`Retirer ${meal.name}`}
                          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => changerQuantite(meal.id, quantite - 1)}
                            aria-label="Diminuer la quantité"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-10 text-center text-sm font-medium tabular-nums">
                            {quantite}
                          </span>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => changerQuantite(meal.id, quantite + 1)}
                            aria-label="Augmenter la quantité"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-sm font-medium tabular-nums">
                          {formatMoney(
                            (Number.parseFloat(meal.price!.amount) * quantite).toFixed(2)
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Field label="Note (optionnel)" htmlFor="note">
                <Input
                  id="note"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Précision pour le logisticien"
                />
              </Field>

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Repas commandés</span>
                  <span className="tabular-nums">{totalTickets}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total estimé</span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatMoney(apercu.toFixed(2))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le montant définitif est recalculé par le serveur à partir des
                  tarifs en vigueur.
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={lignes.length === 0}
                loading={creer.isPending}
                onClick={soumettre}
              >
                {creer.isPending ? 'Envoi…' : 'Confirmer la demande'}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
