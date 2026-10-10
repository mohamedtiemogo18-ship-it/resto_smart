'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarPlus,
  Home,
  LogOut,
  Ticket as TicketIcon,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Avatar, RoleBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LayoutProfile } from './types'

const NAV = [
  { href: '/etudiant/tableau-de-bord', label: 'Accueil', icon: Home },
  { href: '/etudiant/reserver', label: 'Réserver', icon: CalendarPlus },
  { href: '/etudiant/mes-tickets', label: 'Tickets', icon: TicketIcon },
]

function SignOutButton() {
  const supabase = createClient()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Se déconnecter"
      onClick={async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
      }}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  )
}

export function StudentShell({
  profile,
  children,
}: {
  profile: LayoutProfile
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* En-tête collant, effet de flou */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Link
            href="/etudiant/tableau-de-bord"
            className="flex items-center gap-2.5"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
            >
              R
            </span>
            <span className="text-sm font-semibold leading-tight">
              Restauration
              <span className="block text-[10px] font-normal text-muted-foreground">
                Universitaire
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <RoleBadge role={profile.role} className="hidden sm:inline-flex" />
            <span title={profile.full_name}>
              <Avatar name={profile.full_name} size="sm" />
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
        {children}
      </main>

      {/* Onglets bas avec filet actif */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-md"
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
                    'relative flex h-16 flex-col items-center justify-center gap-1',
                    'text-[11px] font-medium transition-colors',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-6 top-0 h-0.5 rounded-full transition-colors',
                      active ? 'bg-primary' : 'bg-transparent'
                    )}
                  />
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
