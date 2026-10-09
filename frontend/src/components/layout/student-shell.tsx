'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarPlus, LayoutDashboard, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SignOutButton } from './role-badge'
import type { LayoutProfile } from '@/components/layout/types'

const NAV = [
  { href: '/etudiant/tableau-de-bord', label: 'Accueil', icon: LayoutDashboard },
  { href: '/etudiant/reserver', label: 'Réserver', icon: CalendarPlus },
  { href: '/etudiant/mes-tickets', label: 'Tickets', icon: Ticket },
]

export function StudentShell({
  profile,
  children,
}: {
  profile: LayoutProfile
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Restauration universitaire</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {profile.full_name}
              {profile.matricule && ` · ${profile.matricule}`}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</div>

      {/* Onglets bas — navigation mobile */}
      <nav
        aria-label="Navigation principale"
        className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-3xl">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center gap-1 text-xs transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}