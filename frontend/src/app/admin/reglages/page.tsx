import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { PageHeader } from '@/components/ui/layout'
import type { Setting } from '@/types'

export const metadata = { title: 'Réglages' }

async function fetchSettings(token: string) {
  try {
    return await api<Setting[]>('/admin/settings', token)
  } catch {
    return null
  }
}

export default async function ReglagesPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const settings = session ? await fetchSettings(session.access_token) : null
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  return (
    <div className="page">
      <PageHeader
        title="Réglages"
        description="Identité du restaurant, validité des tickets et gabarit PDF."
      />

      {/* Dépôt des images */}
      <div className="surface p-5">
        <h2 className="font-semibold">Signature et cachet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les images déposées ici apparaissent sur chaque ticket PDF généré.
          Formats acceptés : PNG, JPG, WebP — 2 Mo maximum.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <UploadField
            label="Signature"
            kind="signature"
            apiUrl={apiUrl}
          />
          <UploadField
            label="Cachet de l'université"
            kind="cachet"
            apiUrl={apiUrl}
          />
        </div>
      </div>

      {/* Paramètres */}
      <div className="surface p-5">
        <h2 className="font-semibold">Paramètres enregistrés</h2>

        {settings && settings.length > 0 ? (
          <dl className="mt-4 divide-y">
            {settings.map((s) => (
              <div key={s.key} className="py-3 first:pt-0 last:pb-0">
                <dt className="font-mono text-xs text-muted-foreground">{s.key}</dt>
                <dd className="mt-1 text-sm">
                  {typeof s.value === 'object'
                    ? JSON.stringify(s.value)
                    : String(s.value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Aucun paramètre.</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        La validité des tickets est définie dans la clé{' '}
        <code className="rounded bg-muted px-1 font-mono">tickets.validity_days</code>{' '}
        (30 jours par défaut). Une tâche planifiée expire automatiquement les
        tickets périmés.
      </p>
    </div>
  )
}

function UploadField({
  label,
  kind,
  apiUrl,
}: {
  label: string
  kind: string
  apiUrl: string | undefined
}) {
  return (
    <form
      action={`${apiUrl}/admin/settings/${kind}`}
      method="post"
      encType="multipart/form-data"
      className="space-y-2"
    >
      <p className="text-sm font-medium">{label}</p>
      <input
        type="file"
        name="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={label}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
      />
      <button
        type="submit"
        className="h-9 rounded-lg border px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
      >
        Envoyer
      </button>
    </form>
  )
}
