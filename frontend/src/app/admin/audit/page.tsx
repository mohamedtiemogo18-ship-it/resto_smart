import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { TableWrapper, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/layout'
import { formatDateTime } from '@/lib/format/date'
import type { AuditLogEntry } from '@/types'

export const metadata = { title: "Journal d'audit" }

const ACTIONS: Record<string, string> = {
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
  try {
    return await api<{ items: AuditLogEntry[] }>(`/admin/audit?${params}`, token)
  } catch {
    return null
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { action?: string; outcome?: string; page?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const params = new URLSearchParams()
  if (searchParams.action) params.set('action', searchParams.action)
  if (searchParams.outcome) params.set('outcome', searchParams.outcome)
  if (searchParams.page) params.set('page', searchParams.page)

  const page = session ? await fetchAudit(session.access_token, params) : null
  const logs = page?.items ?? []

  return (
    <div className="page">
      <PageHeader
        title="Journal d'audit"
        description="Traces immuables de toutes les opérations sensibles."
      />

      <form className="flex flex-wrap gap-3" method="get">
        <select
          name="action"
          defaultValue={searchParams.action ?? ''}
          aria-label="Filtrer par action"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-xs"
        >
          <option value="">Toutes les actions</option>
          {Object.entries(ACTIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="outcome"
          defaultValue={searchParams.outcome ?? ''}
          aria-label="Filtrer par résultat"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-xs"
        >
          <option value="">Tous les résultats</option>
          <option value="SUCCESS">Succès</option>
          <option value="FAILURE">Échec</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          Filtrer
        </button>
      </form>

      {logs.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Aucune entrée d'audit.
        </Card>
      ) : (
        <TableWrapper>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Action</TH>
              <TH>Entité</TH>
              <TH>Acteur</TH>
              <TH>Résultat</TH>
            </TR>
          </THead>
          <TBody>
            {logs.map((log) => (
              <TR key={log.id}>
                <TD className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(log.created_at)}
                </TD>
                <TD>
                  {ACTIONS[log.action] ?? log.action}
                  <span className="block font-mono text-xs text-muted-foreground">
                    {log.action}
                  </span>
                </TD>
                <TD className="font-mono text-xs">
                  {log.entity_type ?? '—'}
                  {log.entity_id && (
                    <span className="block text-muted-foreground">{log.entity_id}</span>
                  )}
                </TD>
                <TD className="text-xs">
                  {log.actor_name ?? log.actor_label ?? 'Système'}
                </TD>
                <TD>
                  {log.outcome === 'SUCCESS' ? (
                    <Badge variant="success" dot>
                      Succès
                    </Badge>
                  ) : (
                    <Badge variant="destructive" dot>
                      Échec
                    </Badge>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrapper>
      )}
    </div>
  )
}
