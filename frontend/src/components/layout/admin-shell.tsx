'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  FileText,
  Receipt,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SignOutButton } from './role-badge'
import type { LayoutProfile } from '@/components/layout/types'

const NAV = [
  { href: '/admin/tableau-de-bord', label: 'Tableau de bord', icon: BarChart3 },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
  { href: '/admin/tarifs', label: 'Tarifs', icon: Receipt },
  { href: '/admin/reglages', label: 'Réglages', icon: Settings },
  { href: '/admin/rapports', label: 'Rapports', icon: FileText },
  { href: '/admin/audit', label: 'Audit', icon: FileText },
]

export function AdminShell({
  profile,
  children,
}: {
  profile: LayoutProfile
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
        <div className="flex h-14 items-center border-b px-5">
          <span className="text-sm font-semibold">Administration</span>
        </div>
        <nav aria-label="Navigation administration" className="flex-1 space-y-1 p-3">
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
          <div className="mb-2 px-3 text-xs text-muted-foreground">{profile.full_name}</div>
          <SignOutButton />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden">
        <span className="text-sm font-semibold">Administration</span>
        <SignOutButton />
      </header>

      <div className="lg:pl-64">{children}</div>
    </div>
  )
}