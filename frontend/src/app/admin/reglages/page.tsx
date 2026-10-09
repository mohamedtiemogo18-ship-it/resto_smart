import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Setting } from '@/types'

export const metadata = { title: 'Réglages' }

async function fetchSettings(token: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return [] as Setting[]
  const body = await res.json()
  return (body.data ?? []) as Setting[]
}

export default async function ReglagesPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const settings = session ? await fetchSettings(session.access_token) : []

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Réglages</h1>
        <p className="text-sm text-muted-foreground">
          Identité du restaurant, validité des tickets et gabarit PDF.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Images du PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signature et cachet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UploadField
              label="Signature"
              endpoint="/admin/settings/signature"
              hint="PNG, JPG ou WebP — 2 Mo maximum. Apparaît en tête des tickets."
            />
            <UploadField
              label="Cachet université"
              endpoint="/admin/settings/cachet"
              hint="PNG, JPG ou WebP — 2 Mo maximum. Apparaît en bas des tickets."
            />
          </CardContent>
        </Card>

        {/* Paramètres courants */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paramètres enregistrés</CardTitle>
          </CardHeader>
          <CardContent>
            {settings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paramètre.</p>
            ) : (
              <dl className="divide-y">
                {settings.map((s) => (
                  <div key={s.key} className="py-3">
                    <dt className="font-mono text-xs text-muted-foreground">{s.key}</dt>
                    <dd className="mt-1 text-sm">
                      {typeof s.value === 'object'
                        ? JSON.stringify(s.value)
                        : String(s.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Validité des tickets</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Par défaut, un ticket est valable 30 jours après le paiement, sans être lié à un jour de
            repas précis. Une tâche planifiée expire automatiquement les tickets périmés.
          </p>
          <p className="font-mono text-xs">app_settings → tickets.validity_days</p>
        </CardContent>
      </Card>
    </div>
  )
}

/** Champ d'upload — composant client pour le formulaire multipart. */
function UploadField({
  label,
  endpoint,
  hint,
}: {
  label: string
  endpoint: string
  hint: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <form
        action={`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`}
        method="post"
        encType="multipart/form-data"
        className="flex flex-wrap items-center gap-3"
      >
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={label}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        />
        <button
          type="submit"
          className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-accent"
        >
          Envoyer
        </button>
      </form>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}