import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/format/date'
import type { AuditLogEntry } from '@/types'

export const metadata = { title: "Journal d'audit" }

const ACTION_LABELS: Record<string, string> = {
  'reservation.create': 'Création de réservation',
  'reservation.cancel': 'Annulation de réservation',
  'payment.confirm': 'Confirmation de paiement',
  'ticket.consume': 'Consommation de ticket',
  'ticket.expire': 'Expiration de ticket',
  'ticket.void': 'Annulation de ticket',
  'price.update': 'Modification de tarif',
  'user.create': 'Création de compte',
  'user.update': 'Modification de compte',
  'settings.update': 'Modification de réglage',
  'auth.login_failed': 'Échec de connexion',
  'system.sequence_reset': 'Remise à zéro des numéros',
}

async function fetchAudit(token: string, params: URLSearchParams) {
  params.set('page_size', '50')
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/admin/audit?${params}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  )
  if (!res.ok) return { items: [] as AuditLogEntry[], pagination: null }
  const body = await res.json()
  return body.data as { items: AuditLogEntry[]; pagination: Record<string, number> }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { action?: string; outcome?: string; page?: string }
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const params = new URLSearchParams()
  if (searchParams.action) params.set('action', searchParams.action)
  if (searchParams.outcome) params.set('outcome', searchParams.outcome)
  if (searchParams.page) params.set('page', searchParams.page)

  const data = session ? await fetchAudit(session.access_token, params) : { items: [], pagination: null }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Journal d'audit</h1>
        <p className="text-sm text-muted-foreground">
          Traces immuables de toutes les opérations sensibles.
        </p>
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <select
          name="action"
          defaultValue={searchParams.action ?? ''}
          aria-label="Filtrer par action"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="outcome"
          defaultValue={searchParams.outcome ?? ''}
          aria-label="Filtrer par résultat"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tous les résultats</option>
          <option value="SUCCESS">Succès</option>
          <option value="FAILURE">Échec</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrer
        </button>
      </form>

      <Card>
        <CardContent className="p-0">
          {data.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune entrée d'audit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Entité</th>
                    <th className="px-4 py-3 font-medium">Acteur</th>
                    <th className="px-4 py-3 font-medium">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {ACTION_LABELS[log.action] ?? log.action}
                        <span className="block font-mono text-xs text-muted-foreground">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {log.entity_type ?? '—'}
                        {log.entity_id && (
                          <span className="block text-muted-foreground">{log.entity_id}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {log.actor_name ?? log.actor_label ?? 'Système'}
                      </td>
                      <td className="px-4 py-3">
                        {log.outcome === 'SUCCESS' ? (
                          <Badge variant="success">Succès</Badge>
                        ) : (
                          <Badge variant="destructive">Échec</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.pagination && data.pagination.pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            Page {data.pagination.page} sur {data.pagination.pages}
          </span>
          <div className="flex gap-2">
            {data.pagination.page > 1 && (
              <a href={`/admin/audit?page=${data.pagination.page - 1}`} className="rounded-md border px-3 py-1.5 hover:bg-accent">
                Précédent
              </a>
            )}
            {data.pagination.page < data.pagination.pages && (
              <a href={`/admin/audit?page=${data.pagination.page + 1}`} className="rounded-md border px-3 py-1.5 hover:bg-accent">
                Suivant
              </a>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}