import type { Metadata, Viewport } from 'next'
import { QueryProvider } from '@/providers/query-provider'
import { Toaster } from 'sonner'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Restauration universitaire',
    template: '%s · Resto Smart',
  },
  description: 'Réservation, paiement et consommation des tickets de restauration',
  // Application privée : jamais indexée
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1D4ED8',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
