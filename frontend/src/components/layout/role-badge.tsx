'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/types'

export function SignOutButton({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button variant={variant} size="sm" onClick={handleSignOut}>
      <LogOut className="h-4 w-4" />
      Déconnexion
    </Button>
  )
}

export function RoleBadge({ role }: { role: Profile['role'] }) {
  const labels = {
    student: 'Étudiant',
    logistician: 'Logisticien',
    admin: 'Administrateur',
  }
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {labels[role]}
    </span>
  )
}