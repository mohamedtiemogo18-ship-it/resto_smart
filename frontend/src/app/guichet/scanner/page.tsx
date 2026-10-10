'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  CameraOff,
  Check,
  Keyboard,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { PageHeader } from '@/components/ui/layout'
import { useConsumeTicket } from '@/hooks/use-api'
import { API_URL } from '@/lib/api-url'
import { ApiError } from '@/lib/api'
import type { ConsumeResult } from '@/types'

type Etat =
  | { kind: 'attente' }
  | { kind: 'verification' }
  | { kind: 'succes'; data: ConsumeResult }
  | { kind: 'erreur'; code: string; message: string; details?: Record<string, unknown> }

export default function ScannerPage() {
  const [mode, setMode] = useState<'camera' | 'saisie'>('camera')
  const [numero, setNumero] = useState('')
  const [etat, setEtat] = useState<Etat>({ kind: 'attente' })

  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const occupeRef = useRef(false)

  const consommer = useCallback(
    async (body: { qr_payload?: string; ticket_number?: string }) => {
      if (occupeRef.current) return
      occupeRef.current = true
      setEtat({ kind: 'verification' })

      try {
        const res = await fetch(`${API_URL}/tickets/consume`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await res.json().catch(() => null)

        if (res.ok && payload?.success) {
          setEtat({ kind: 'succes', data: payload.data })
        } else {
          setEtat({
            kind: 'erreur',
            code: payload?.error?.code ?? `HTTP_${res.status}`,
            message: payload?.error?.message ?? 'Ticket refusé.',
            details: payload?.error?.details,
          })
        }
      } catch {
        setEtat({
          kind: 'erreur',
          code: 'NETWORK',
          message: 'Impossible de joindre le serveur.',
        })
      } finally {
        occupeRef.current = false
      }
    },
    []
  )

  // Caméra
  useEffect(() => {
    if (mode !== 'camera') return
    let annule = false

    async function demarrer() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (annule) return

        const scanner = new Html5Qrcode('reader')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 260, height: 260 } },
          async (decode: string) => {
            // Un seul scan à la fois : on met la caméra en pause
            if (occupeRef.current) return
            scanner.pause(true)
            await consommer({ qr_payload: decode })
            scanner.resume()
          },
          undefined
        )
      } catch {
        if (!annule) {
          setMode('saisie')
          toast.error('Caméra indisponible', {
            description: 'Utilisez la saisie manuelle du numéro.',
          })
        }
      }
    }

    demarrer()

    return () => {
      annule = true
      scannerRef.current?.stop().catch(() => {})
      scannerRef.current?.clear()
      scannerRef.current = null
    }
  }, [mode, consommer])

  // Reset automatique du résultat pour enchaîner les scans
  useEffect(() => {
    if (etat.kind === 'attente' || etat.kind === 'verification') return
    const timer = setTimeout(() => setEtat({ kind: 'attente' }), 6000)
    return () => clearTimeout(timer)
  }, [etat])

  return (
    <div className="page">
      <PageHeader
        title="Scanner"
        description="Scannez le QR code du ticket pour le consommer."
        actions={
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
              variant={mode === 'saisie' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('saisie')}
            >
              <Keyboard className="h-4 w-4" />
              Saisie
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Zone de scan */}
        <Card>
          <CardHeader>
            <CardTitle>{mode === 'camera' ? 'Caméra' : 'Saisie manuelle'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'camera' ? (
              <>
                <div
                  id="reader"
                  className="overflow-hidden rounded-lg border bg-black"
                />
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <CameraOff className="h-3 w-3" />
                  Si la caméra ne démarre pas, passez en saisie manuelle.
                </p>
              </>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const valeur = numero.trim()
                  if (!valeur) return
                  consommer({ ticket_number: valeur.toUpperCase() })
                  setNumero('')
                }}
              >
                <Field
                  label="Numéro du ticket"
                  htmlFor="ticket-number"
                  hint="Exemple : TKT-2026-000412"
                >
                  <Input
                    id="ticket-number"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="TKT-2026-000412"
                    className="font-mono"
                    autoComplete="off"
                  />
                </Field>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={!numero.trim()}
                >
                  Consommer
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Résultat */}
        <Card>
          <CardHeader>
            <CardTitle>Résultat</CardTitle>
          </CardHeader>
          <CardContent>
            <div aria-live="assertive" aria-atomic="true" className="min-h-[12rem]">
              <Resultat etat={etat} onReessayer={() => setEtat({ kind: 'attente' })} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Resultat({ etat, onReessayer }: { etat: Etat; onReessayer: () => void }) {
  if (etat.kind === 'attente') {
    return (
      <div className="grid min-h-[10rem] place-items-center text-center">
        <div>
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Camera className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">En attente d'un scan…</p>
        </div>
      </div>
    )
  }

  if (etat.kind === 'verification') {
    return (
      <div className="grid min-h-[10rem] place-items-center text-center">
        <div>
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Vérification…</p>
        </div>
      </div>
    )
  }

  if (etat.kind === 'succes') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border-2 border-success bg-success-muted p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
            <Check className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-success">Ticket valide</p>
            <p className="text-sm text-success/90">{etat.data.meal_name}</p>
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Étudiant</dt>
            <dd className="text-right font-medium">{etat.data.student_name}</dd>
          </div>
          {etat.data.student_matricule && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Matricule</dt>
              <dd className="font-mono text-xs">{etat.data.student_matricule}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Ticket</dt>
            <dd className="font-mono text-xs">{etat.data.ticket_number}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Consommé par</dt>
            <dd className="text-right">{etat.data.consumed_by}</dd>
          </div>
        </dl>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border-2 border-destructive bg-destructive-muted p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
          <AlertCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-destructive">Ticket refusé</p>
          <p className="mt-0.5 text-sm text-destructive/90">{etat.message}</p>
          <p className="mt-1 font-mono text-xs text-destructive/70">{etat.code}</p>
          {Boolean(etat.details?.used_at) && (
            <p className="mt-1 text-xs text-destructive/80">
              Déjà consommé le{' '}
              {new Date(String(etat.details!.used_at)).toLocaleString('fr-FR')}
            </p>
          )}
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={onReessayer}>
        Scanner un autre ticket
      </Button>
    </div>
  )
}
