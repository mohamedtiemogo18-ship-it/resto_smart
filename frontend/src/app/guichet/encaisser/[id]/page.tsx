'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, Check, Banknote } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useReservation } from '@/hooks/use-api'
import { formatDateTime } from '@/lib/format/date'
import { computeChange, formatMoney } from '@/lib/format/money'
import { statusLabel } from '@/lib/format/status'
import { ApiError } from '@/lib/api'

export default function EncaisserDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: reservation, isLoading, isError, error, refetch } = useReservation(params.id)

  const [cashReceived, setCashReceived] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ ticket_count: number; sheet_url: string | null } | null>(null)

  const total = Number.parseFloat(reservation?.total_amount ?? '0')
  const received = Number.parseFloat(cashReceived) || 0
  const change = computeChange(total, received)
  const isPending = reservation?.status === 'PENDING_PAYMENT'

  async function confirmPayment() {
    if (!reservation) return
    setConfirming(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reservations/${reservation.id}/confirm-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cash_received: received, change_given: change }),
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
      setResult({ ticket_count: data.ticket_count, sheet_url: data.sheet_pdf_url })
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
      setConfirming(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (isError || !reservation) {
    return (
      <div className="p-4 lg:p-6">
        <ErrorState error={error ?? new Error('Réservation introuvable')} onRetry={refetch} />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-xl font-bold">{reservation.reservation_number}</h1>
          <Badge status={reservation.status}>{statusLabel(reservation.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{formatDateTime(reservation.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Détail de la commande */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail de la commande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{reservation.student.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {reservation.student.matricule && `${reservation.student.matricule} · `}
                {reservation.student.room && `Chambre ${reservation.student.room}`}
              </p>
            </div>

            <ul className="divide-y border-t pt-2">
              {reservation.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {item.meal_name}{' '}
                    <span className="text-muted-foreground">× {item.quantity}</span>
                  </span>
                  <span className="tabular-nums">{formatMoney(item.line_total)}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-medium">Total à encaisser</span>
              <span className="text-2xl font-bold tabular-nums">
                {formatMoney(reservation.total_amount)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {reservation.items_count} repas → {reservation.items_count} tickets seront générés.
            </p>
          </CardContent>
        </Card>

        {/* Encaissement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encaissement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isPending && !result && (
              <div className="rounded-md bg-success/10 p-4 text-sm text-success">
                <p className="font-medium">Réservation déjà payée</p>
                {reservation.paid_at && (
                  <p className="mt-1 text-xs">Le {formatDateTime(reservation.paid_at)}</p>
                )}
              </div>
            )}

            {result && (
              <div className="rounded-md bg-success/10 p-4 text-sm text-success space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  <p className="font-medium">Paiement confirmé</p>
                </div>
                <p>{result.ticket_count} tickets générés.</p>
                {result.sheet_url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={result.sheet_url} target="_blank" rel="noopener noreferrer">
                      <Printer className="h-4 w-4" />
                      Imprimer la feuille de tickets
                    </a>
                  </Button>
                )}
              </div>
            )}

            {isPending && (
              <>
                <div className="space-y-2">
                  <label htmlFor="cash" className="text-sm font-medium">
                    Espèces reçues
                  </label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="cash"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0"
                      className="pl-9 tabular-nums"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <span className="text-sm text-muted-foreground">Monnaie à rendre</span>
                  <span className="text-lg font-bold tabular-nums">{formatMoney(change.toFixed(2))}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={confirming || received < total}
                  onClick={confirmPayment}
                >
                  {confirming ? 'Confirmation…' : 'Confirmer le paiement'}
                </Button>

                {received < total && cashReceived !== '' && (
                  <p className="text-xs text-destructive">
                    Le montant reçu est inférieur au total.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Un second clic est sans effet : la confirmation est idempotente.
                </p>
              </>
            )}

            <Button variant="ghost" className="w-full" onClick={() => router.push('/guichet/encaisser')}>
              Retour à la file d'attente
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
