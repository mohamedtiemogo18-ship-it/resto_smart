import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import type { Meal, Price } from '@/types'

export const metadata = { title: 'Tarifs' }

async function fetchMeals(token: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/meals?include_inactive=true`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return [] as Meal[]
  const body = await res.json()
  return (body.data ?? []) as Meal[]
}

export default async function TarifsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const meals = session ? await fetchMeals(session.access_token) : []

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Tarifs</h1>
        <p className="text-sm text-muted-foreground">
          Les prix sont historisés : un changement n'altère jamais les ventes passées.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {meals.map((meal) => (
          <Card key={meal.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{meal.name}</CardTitle>
                {!meal.is_active && <Badge variant="outline">Inactif</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {meal.price ? (
                <>
                  <p className="text-2xl font-bold tabular-nums">
                    {formatMoney(meal.price.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    En vigueur depuis le {formatDate(meal.price.effective_from)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun prix en vigueur</p>
              )}
              <p className="font-mono text-xs text-muted-foreground">{meal.code}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comment modifier un prix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Un nouveau prix est ouvert pour une date de prise d'effet future. Le prix courant est
            automatiquement clôturé ce jour-là : l'historique reste intact.
          </p>
          <p className="font-mono text-xs">
            PUT /api/v1/meals/prices/{'{meal_type_id}'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export type { Price }
