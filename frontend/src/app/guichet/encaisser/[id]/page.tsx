'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Printer, Receipt, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useReservation } from '@/hooks/use-api'
import { computeChange, formatMoney } from '@/lib/format/money'
import { formatDateTime } from '@/lib/format/date'
import { statusLabel } from '@/lib/format/status'
import { ApiError } from '@/lib/api'
import { API_URL } from '@/lib/api-url'

export default function EncaisserDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: reservation, isLoading, isError, error, refetch } = useReservation(params.id)

  const [especes, setEspeces] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [resultat, setResultat] = useState<{
    tickets: number
    feuille: string | null
  } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const total = Number.parseFloat(reservation?.total_amount ?? '0')
  const recu = Number.parseFloat(especes) || 0
  const monnaie = computeChange(total, recu)
  const encaissable = reservation?.status === 'PENDING_PAYMENT'

  // Focus automatique sur le montant reçu : le logisticien saisit en boucle
  useEffect(() => {
    if (encaissable && !resultat) inputRef.current?.focus()
  }, [encaissable, resultat])

  const confirmer = useCallback(async () => {
    if (!reservation) return
    setConfirmation(true)

    try {
      const res = await fetch(
        `${API_URL}/reservations/${reservation.id}/confirm-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cash_received: recu,
            change_given: monnaie,
          }),
        }
      )
      const body = await res.json()

      if (!res.ok) {
        throw new ApiError(
          body.error?.code ?? 'UNKNOWN',
          body.error?.message ?? 'Échec de la confirmation',
          res.status,
          body.error?.details
        )
      }

      const data = body.data
      setResultat({
        tickets: data.ticket_count,
        feuille: data.sheet_pdf_url ?? null,
      })
      toast.success(`${data.ticket_count} tickets générés`, {
        description: data.already_confirmed
          ? 'Ce paiement avait déjà été confirmé.'
          : `Réservation ${data.reservation_number}`,
      })
      refetch()
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null
      toast.error(apiError?.message ?? 'Échec de la confirmation', {
        description: apiError?.code,
      })
    } finally {
      setConfirmation(false)
    }
  }, [reservation, recu, monnaie, refetch])

  if (isLoading) {
    return (
      <div className="page">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !reservation) {
    return (
      <div className="page">
        <ErrorState
          error={error ?? new Error('Réservation introuvable')}
          onRetry={refetch}
        />
      </div>
    )
  }

  return (
    <div className="page">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold">{reservation.reservation_number}</h1>
        <Badge status={reservation.status} dot>
          {statusLabel(reservation.status)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatDateTime(reservation.created_at)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Commande */}
        <Card>
          <CardHeader>
            <CardTitle>Commande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-muted text-primary">
                <Receipt className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {reservation.student.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reservation.student.matricule && `${reservation.student.matricule} · `}
                  {reservation.student.room && `Chambre ${reservation.student.room}`}
                </p>
              </div>
            </div>

            <ul className="divide-y">
              {reservation.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.meal_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatMoney(item.unit_price)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums">
                    {formatMoney(item.line_total)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t pt-4">
              <span className="font-medium">Total à encaisser</span>
              <span className="text-2xl font-bold tabular-nums">
                {formatMoney(reservation.total_amount)}
              </span>
            </div>

            <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              {reservation.items_count} repas →{' '}
              <span className="font-semibold text-foreground">
                {reservation.items_count} tickets
              </span>{' '}
              seront générés.
            </p>
          </CardContent>
        </Card>

        {/* Encaissement */}
        <Card>
          <CardHeader>
            <CardTitle>Encaissement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultat ? (
              <div className="space-y-4">
                <Alert variant="success" title="Paiement confirmé">
                  {resultat.tickets} ticket{resultat.tickets > 1 ? 's' : ''} généré
                  {resultat.tickets > 1 ? 's' : ''}.
                </Alert>

                {resultat.feuille && (
                  <Button asChild className="w-full" size="lg">
                    <a href={resultat.feuille} target="_blank" rel="noopener noreferrer">
                      <Printer className="h-4 w-4" />
                      Imprimer la feuille de tickets
                    </a>
                  </Button>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push('/guichet/encaisser')}
                  >
                    File d'attente
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setResultat(null)
                      setEspeces('')
                      refetch()
                    }}
                  >
                    Nouvelle opération
                  </Button>
                </div>
              </div>
            ) : encaissable ? (
              <>
                <Field
                  label="Espèces reçues"
                  htmlFor="especes"
                  hint="Montant remis par l'étudiant"
                >
                  <div className="relative">
                    <Input
                      id="especes"
                      ref={inputRef}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={especes}
                      onChange={(e) => setEspeces(e.target.value)}
                      placeholder="0"
                      className="pr-14 text-lg font-semibold tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      FCFA
                    </span>
                  </div>
                </Field>

                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Monnaie à rendre</span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatMoney(monnaie.toFixed(2))}
                  </span>
                </div>

                {especes !== '' && recu < total && (
                  <Alert variant="warning">
                    Le montant reçu est inférieur au total à encaisser.
                  </Alert>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  variant="success"
                  disabled={recu < total}
                  loading={confirmation}
                  onClick={confirmer}
                >
                  {confirmation ? (
                    'Confirmation…'
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirmer le paiement
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Un second clic est sans effet : la confirmation est idempotente.
                </p>
              </>
            ) : (
              <>
                <Alert
                  variant="success"
                  title="Réservation déjà payée"
                >
                  {reservation.paid_at ? `Payée le ${formatDateTime(reservation.paid_at)}` : 'Paiement déjà enregistré.'}
                </Alert>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/guichet/encaisser')}
                >
                  Retour à la file d'attente
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
