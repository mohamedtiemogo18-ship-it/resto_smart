import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { roleLabel } from '@/lib/format/status'
import type { AppUser } from '@/types'

export const metadata = { title: 'Utilisateurs' }

async function fetchUsers(token: string, params: URLSearchParams) {
  params.set('page_size', '20')
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/admin/users?${params}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  )
  if (!res.ok) return { items: [] as AppUser[], pagination: null }
  const body = await res.json()
  return body.data as { items: AppUser[]; pagination: Record<string, number> }
}

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams: { role?: string; search?: string; page?: string }
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const params = new URLSearchParams()
  if (searchParams.role) params.set('role', searchParams.role)
  if (searchParams.search) params.set('search', searchParams.search)
  if (searchParams.page) params.set('page', searchParams.page)

  const data = session ? await fetchUsers(session.access_token, params) : { items: [], pagination: null }

  const roleFilters = [
    { value: undefined, label: 'Tous' },
    { value: 'student', label: 'Étudiants' },
    { value: 'logistician', label: 'Logisticiens' },
    { value: 'admin', label: 'Administrateurs' },
  ]

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">
          Comptes créés par l'administrateur — aucune inscription libre.
        </p>
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <input
          type="search"
          name="search"
          defaultValue={searchParams.search ?? ''}
          placeholder="Nom ou matricule"
          aria-label="Rechercher un utilisateur"
          className="h-10 flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="role"
          defaultValue={searchParams.role ?? ''}
          aria-label="Filtrer par rôle"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tous les rôles</option>
          <option value="student">Étudiants</option>
          <option value="logistician">Logisticiens</option>
          <option value="admin">Administrateurs</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Rechercher
        </button>
      </form>

      <div className="flex gap-2">
        {roleFilters.map((f) => {
          const active = (searchParams.role ?? undefined) === f.value
          const href = f.value ? `/admin/utilisateurs?role=${f.value}` : '/admin/utilisateurs'
          return (
            <a
              key={f.label}
              href={href}
              aria-current={active ? 'true' : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {f.label}
            </a>
          )
        })}
      </div>

      {data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun utilisateur.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Matricule</th>
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium">Chambre</th>
                    <th className="px-4 py-3 font-medium">Rôle</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{u.matricule ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{u.full_name}</td>
                      <td className="px-4 py-3">{u.room ?? '—'}</td>
                      <td className="px-4 py-3">{roleLabel(u.role)}</td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <Badge variant="success">Actif</Badge>
                        ) : (
                          <Badge variant="destructive">Désactivé</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}