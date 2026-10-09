'use client'

import { useEffect, useState } from 'react'

/**
 * Rendu d'un QR code côté client.
 *
 * Le QR est généré à partir du `qr_payload` signé par le backend : il n'est
 * jamais construit côté frontend, ce qui rend toute falsification inopérante.
 */
export function TicketQr({ payload, size = 160 }: { payload: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // qrcode est chargé dynamiquement pour rester hors du bundle initial
    import('qrcode')
      .then((mod) => mod.default.toDataURL(payload, { width: size, margin: 1 }))
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [payload, size])

  if (!dataUrl) {
    return (
      <div
        className="animate-pulse rounded bg-muted"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    )
  }

  return (
    // next/image n'est pas pertinent ici : la source est une data URL
    // produite à la volée par le navigateur, pas un fichier servi.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="QR code du ticket"
      className="rounded"
    />
  )
}