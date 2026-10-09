'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Check, X, Keyboard } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConsumeTicket } from '@/hooks/use-api'
import { ApiError } from '@/lib/api'
import type { ConsumeResult } from '@/types'

type Outcome =
  | { kind: 'idle' }
  | { kind: 'success'; data: ConsumeResult }
  | { kind: 'error'; code: string; message: string; details?: Record<string, unknown> }

export default function ScannerPage() {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [manualNumber, setManualNumber] = useState('')
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })
  const consume = useConsumeTicket()
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const busyRef = useRef(false)

  // Démarre la caméra et lit les QR en continu
  useEffect(() => {
    if (mode !== 'camera') return
    let cancelled = false

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return

        const scanner = new Html5Qrcode('reader')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 260, height: 260 } },
          async (decoded: string) => {
            // Un seul scan à la fois : la caméra est mise en pause
            if (busyRef.current) return
            busyRef.current = true
            scanner.pause(true)
            await handleConsume({ qr_payload: decoded })
            scanner.resume()
            busyRef.current = false
          },
          undefined
        )
      } catch {
        if (!cancelled) {
          setMode('manual')
          toast.error('Caméra indisponible', {
            description: 'Utilisez la saisie manuelle du numéro.',
          })
        }
      }
    }

    start()

    return () => {
      cancelled = true
      scannerRef.current?.stop().catch(() => {})
      scannerRef.current?.clear()
      scannerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function handleConsume(body: { qr_payload?: string; ticket_number?: string }) {
    setOutcome({ kind: 'idle' })
    try {
      const result = await consume.mutateAsync(body)
      setOutcome({ kind: 'success', data: result })
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null
      setOutcome({
        kind: 'error',
        code: apiError?.code ?? 'UNKNOWN',
        message: apiError?.message ?? 'Échec de la consommation',
        details: apiError?.details,
      })
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Scanner</h1>
          <p className="text-sm text-muted-foreground">
            Scannez le QR du ticket pour le consommer.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={mode === 'camera' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('camera')}
          >
            <Camera className="h-4 w-4" />
            Caméra
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('manual')}
          >
            <Keyboard className="h-4 w-4" />
            Saisie
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Zone de scan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {mode === 'camera' ? 'Caméra' : 'Saisie manuelle'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'camera' ? (
              <>
                <div id="reader" className="overflow-hidden rounded-lg border bg-black" />
                <p className="text-center text-xs text-muted-foreground">
                  Placez le QR code dans le cadre.
                </p>
              </>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (manualNumber.trim()) {
                    handleConsume({ ticket_number: manualNumber.trim().toUpperCase() })
                    setManualNumber('')
                  }
                }}
              >
                <label htmlFor="ticket-number" className="text-sm font-medium">
                  Numéro du ticket
                </label>
                <Input
                  id="ticket-number"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  placeholder="TKT-2026-000412"
                  className="font-mono"
                  autoComplete="off"
                />
                <Button type="submit" className="w-full" disabled={consume.isPending}>
                  {consume.isPending ? 'Vérification…' : 'Consommer'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Résultat */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Résultat</CardTitle>
          </CardHeader>
          <CardContent>
            <div aria-live="assertive" aria-atomic="true" className="space-y-3">
              {outcome.kind === 'idle' && !consume.isPending && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  En attente d'un scan…
                </p>
              )}

              {consume.isPending && (
                <p className="py-8 text-center text-sm text-muted-foreground">Vérification…</p>
              )}

              {outcome.kind === 'success' && (
                <div className="rounded-lg border-2 border-success bg-success/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-success">
                    <Check className="h-5 w-5" />
                    <p className="font-semibold">Ticket valide</p>
                  </div>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Étudiant</dt>
                      <dd className="font-medium">{outcome.data.student_name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Repas</dt>
                      <dd>{outcome.data.meal_name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Ticket</dt>
                      <dd className="font-mono text-xs">{outcome.data.ticket_number}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {outcome.kind === 'error' && (
                <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <X className="h-5 w-5" />
                    <p className="font-semibold">Ticket refusé</p>
                  </div>
                  <p className="text-sm">{outcome.message}</p>
                  <p className="font-mono text-xs text-muted-foreground">{outcome.code}</p>
                  {Boolean(outcome.details?.used_at) && (
                    <p className="text-xs text-muted-foreground">
                      Déjà consommé le{' '}
                      {new Date(String(outcome.details!.used_at)).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {mode === 'camera' && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CameraOff className="h-3 w-3" />
          Si la caméra ne démarre pas, passez en saisie manuelle.
        </p>
      )}
    </div>
  )
}