import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TableWrapper, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/layout'
import { formatMoney } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import type { Meal } from '@/types'

export const metadata = { title: 'Tarifs' }

async function fetchMeals(token: string) {
  try {
    return await api<Meal[]>('/meals?include_inactive=true', token)
  } catch {
    return null
  }
}

export default async function TarifsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const meals = session ? await fetchMeals(session.access_token) : null

  return (
    <div className="page">
      <PageHeader
        title="Tarifs"
        description="Les prix sont historisés : un changement n'altère jamais les ventes passées."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {(meals ?? []).map((meal) => (
          <Card key={meal.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <CardTitle className="text-base">{meal.name}</CardTitle>
              {!meal.is_active && <Badge variant="outline">Inactif</Badge>}
            </CardHeader>
            <CardContent>
              {meal.price ? (
                <>
                  <p className="text-3xl font-bold tabular-nums">
                    {formatMoney(meal.price.amount)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    En vigueur depuis le {formatDate(meal.price.effective_from)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun prix en vigueur</p>
              )}
              <p className="mt-3 font-mono text-xs text-muted-foreground">{meal.code}</p>
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
            Un nouveau prix est ouvert pour une date de prise d'effet future. Le
            prix courant est automatiquement clôturé ce jour-là : l'historique
            des ventes reste intact.
          </p>
          <TableWrapper>
            <THead>
              <TR>
                <TH>Endpoint</TH>
                <TH>Effet</TH>
              </TR>
            </THead>
            <TBody>
              <TR>
                <TD className="font-mono text-xs">PUT /meals/prices/{'{meal_type_id}'}</TD>
                <TD>Clôture le prix courant et en ouvre un nouveau</TD>
              </TR>
            </TBody>
          </TableWrapper>
        </CardContent>
      </Card>
    </div>
  )
}
