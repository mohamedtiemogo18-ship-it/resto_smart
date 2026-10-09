'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList,
  LayoutDashboard,
  QrCode,
  Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SignOutButton } from './role-badge'
import type { LayoutProfile } from '@/components/layout/types'

const NAV = [
  { href: '/guichet/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/guichet/encaisser', label: 'Encaisser', icon: Receipt },
  { href: '/guichet/scanner', label: 'Scanner', icon: QrCode },
  { href: '/guichet/reservations', label: 'Réservations', icon: ClipboardList },
]

export function DeskShell({
  profile,
  children,
}: {
  profile: LayoutProfile
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar bureau */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
        <div className="flex h-14 items-center border-b px-5">
          <span className="text-sm font-semibold">Resto Smart</span>
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
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 px-3 text-xs text-muted-foreground">
            {profile.full_name}
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Barre supérieure mobile */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden">
        <span className="text-sm font-semibold">Resto Smart</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{profile.full_name}</span>
          <SignOutButton />
        </div>
      </header>

      {/* Onglets bas mobile */}
      <nav
        aria-label="Navigation mobile"
        className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background lg:hidden"
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
                    'flex h-16 flex-col items-center justify-center gap-1 text-[10px]',
                    active ? 'text-primary' : 'text-muted-foreground'
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

      <div className="pb-20 lg:pb-0">{children}</div>
    </div>
  )
}