'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useCreateReservation, useMeals } from '@/hooks/use-api'
import { formatMoney } from '@/lib/format/money'
import { ApiError } from '@/lib/api'
import type { Meal } from '@/types'

interface Line {
  meal: Meal
  quantity: number
}

export default function ReserverPage() {
  const router = useRouter()
  const { data: meals, isLoading, isError, error, refetch } = useMeals()
  const create = useCreateReservation()

  const [lines, setLines] = useState<Line[]>([])
  const [note, setNote] = useState('')

  const available = (meals ?? []).filter((m) => m.price)

  function add(meal: Meal) {
    setLines((prev) => {
      const existing = prev.find((l) => l.meal.id === meal.id)
      if (existing) {
        return prev.map((l) =>
          l.meal.id === meal.id ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l
        )
      }
      return [...prev, { meal, quantity: 1 }]
    })
  }

  function setQuantity(mealId: number, quantity: number) {
    if (quantity < 1) return remove(mealId)
    setLines((prev) =>
      prev.map((l) => (l.meal.id === mealId ? { ...l, quantity: Math.min(99, quantity) } : l))
    )
  }

  function remove(mealId: number) {
    setLines((prev) => prev.filter((l) => l.meal.id !== mealId))
  }

  // Le total est un aperçu : le montant officiel est recalculé par le backend
  const total = lines.reduce(
    (sum, l) => sum + Number.parseFloat(l.meal.price!.amount) * l.quantity,
    0
  )

  async function submit() {
    if (lines.length === 0) {
      toast.error('Ajoutez au moins un repas')
      return
    }
    try {
      const reservation = await create.mutateAsync({
        items: lines.map((l) => ({ meal_type_id: l.meal.id, quantity: l.quantity })),
        note: note.trim() || undefined,
      })
      toast.success('Réservation enregistrée', {
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
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Réserver</h1>
        <p className="text-sm text-muted-foreground">
          Choisissez vos repas, le montant sera calculé automatiquement.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Sélection des repas */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Repas disponibles</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {available.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => add(meal)}
                className="rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <p className="font-medium">{meal.name}</p>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  {formatMoney(meal.price!.amount)}
                </p>
              </button>
            ))}
          </div>
          {available.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun repas n'est disponible à la réservation pour le moment.
            </p>
          )}
        </section>

        {/* Panier */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ma commande</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un repas pour commencer.
                </p>
              ) : (
                <ul className="space-y-3">
                  {lines.map(({ meal, quantity }) => (
                    <li key={meal.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{meal.name}</span>
                        <button
                          type="button"
                          onClick={() => remove(meal.id)}
                          aria-label={`Retirer ${meal.name}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setQuantity(meal.id, quantity - 1)}
                            aria-label="Diminuer"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-10 text-center text-sm tabular-nums">{quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setQuantity(meal.id, quantity + 1)}
                            aria-label="Augmenter"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-sm tabular-nums">
                          {formatMoney(
                            (Number.parseFloat(meal.price!.amount) * quantity).toFixed(2)
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t pt-3">
                <label htmlFor="note" className="text-xs text-muted-foreground">
                  Note (optionnel)
                </label>
                <Input
                  id="note"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Précision pour le logisticien"
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">Total estimé</span>
                <span className="text-lg font-bold tabular-nums">
                  {formatMoney(total.toFixed(2))}
                </span>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={lines.length === 0 || create.isPending}
                onClick={submit}
              >
                {create.isPending ? 'Envoi…' : 'Confirmer la demande'}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}