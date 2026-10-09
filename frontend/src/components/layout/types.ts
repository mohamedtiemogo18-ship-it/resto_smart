/** Profil allégé, tel que renvoyé par les layouts serveur. */

import type { UserRole } from '@/types'

export interface LayoutProfile {
  id: string
  full_name: string
  matricule?: string | null
  room?: string | null
  role: UserRole
  is_active: boolean
}