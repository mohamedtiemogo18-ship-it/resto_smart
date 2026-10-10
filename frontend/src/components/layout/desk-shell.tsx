'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  QrCode,
  Receipt,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LayoutProfile } from './types'

const NAV = [
  { href: '/guichet/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/guichet/encaisser', label: 'Encaisser', icon: Receipt },
  { href: '/guichet/scanner', label: 'Scanner', icon: QrCode },
  { href: '/guichet/reservations', label: 'Réservations', icon: ClipboardList },
]

function SignOutButton() {
  const supabase = createClient()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
      }}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Déconnexion</span>
    </Button>
  )
}

export function DeskShell({
  profile,
  children,
}: {
  profile: LayoutProfile
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-muted/25">
      {/* Barre latérale — bureau */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
          >
            R
          </span>
          <span className="font-semibold">Resto Smart</span>
        </div>

        <nav aria-label="Navigation du guichet" className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  'transition-colors',
                  active
                    ? 'bg-primary-muted text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar name={profile.full_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {profile.role === 'admin' ? 'Administrateur' : 'Logisticien'}
              </p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Barre supérieure — mobile */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background px-4 lg:hidden">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
          >
            R
          </span>
          <span className="text-sm font-semibold">Resto Smart</span>
        </span>
        <div className="flex items-center gap-2">
          <Avatar name={profile.full_name} size="sm" />
          <SignOutButton />
        </div>
      </header>

      {/* Onglets bas — mobile */}
      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-md lg:hidden"
      >
        <ul className="flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-16 flex-col items-center justify-center gap-1',
                    'text-[10px] font-medium',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-4 top-0 h-0.5 rounded-full',
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

      <div className="pb-20 lg:pb-0">{children}</div>
    </div>
  )
}
