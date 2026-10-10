import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  TableWrapper,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@/components/ui/table'
import { PageHeader } from '@/components/ui/layout'
import { roleLabel } from '@/lib/format/status'
import type { AppUser } from '@/types'

export const metadata = { title: 'Utilisateurs' }

async function fetchUsers(token: string, params: URLSearchParams) {
  params.set('page_size', '20')
  try {
    return await api<{ items: AppUser[] }>(`/admin/users?${params}`, token)
  } catch {
    return null
  }
}

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams: { role?: string; search?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const params = new URLSearchParams()
  if (searchParams.role) params.set('role', searchParams.role)
  if (searchParams.search) params.set('search', searchParams.search)

  const page = session ? await fetchUsers(session.access_token, params) : null
  const users = page?.items ?? []

  const roles = [
    { value: undefined, label: 'Tous', href: '/admin/utilisateurs' },
    {
      value: 'student',
      label: 'Étudiants',
      href: '/admin/utilisateurs?role=student',
    },
    {
      value: 'logisticien',
      label: 'Logisticiens',
      href: '/admin/utilisateurs?role=logisticien',
    },
    {
      value: 'admin',
      label: 'Administrateurs',
      href: '/admin/utilisateurs?role=admin',
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Utilisateurs"
        description="Comptes créés par l'administration — aucune inscription libre."
      />

      <form className="flex flex-wrap gap-3" method="get">
        <input
          type="search"
          name="search"
          defaultValue={searchParams.search ?? ''}
          placeholder="Nom ou matricule"
          aria-label="Rechercher un utilisateur"
          className="h-10 min-w-[14rem] flex-1 rounded-lg border border-input bg-background px-3 text-sm shadow-xs"
        />
        <select
          name="role"
          defaultValue={searchParams.role ?? ''}
          aria-label="Filtrer par rôle"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-xs"
        >
          <option value="">Tous les rôles</option>
          <option value="student">Étudiants</option>
          <option value="logistician">Logisticiens</option>
          <option value="admin">Administrateurs</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          Rechercher
        </button>
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par rôle">
        {roles.map((r) => {
          const actif = (searchParams.role ?? undefined) === r.value
          return (
            <a
              key={r.label}
              href={r.href}
              aria-current={actif ? 'page' : undefined}
              className={
                actif
                  ? 'rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground'
                  : 'rounded-full border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
              }
            >
              {r.label}
            </a>
          )
        })}
      </nav>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun utilisateur ne correspond à cette recherche.
          </CardContent>
        </Card>
      ) : (
        <TableWrapper>
          <THead>
            <TR>
              <TH>Matricule</TH>
              <TH>Nom</TH>
              <TH>Chambre</TH>
              <TH>Rôle</TH>
              <TH>Statut</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="font-mono text-xs">{u.matricule ?? '—'}</TD>
                <TD className="font-medium">{u.full_name}</TD>
                <TD>{u.room ?? '—'}</TD>
                <TD>{roleLabel(u.role)}</TD>
                <TD>
                  {u.is_active ? (
                    <Badge variant="success" dot>
                      Actif
                    </Badge>
                  ) : (
                    <Badge variant="destructive" dot>
                      Désactivé
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
