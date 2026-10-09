import { describe, expect, it } from 'vitest'

import { mealLabel, roleLabel, statusLabel } from '@/lib/format/status'

describe('statusLabel', () => {
  it('traduit les statuts de réservation', () => {
    expect(statusLabel('PENDING_PAYMENT')).toBe('En attente de paiement')
    expect(statusLabel('PAID')).toBe('Payée')
    expect(statusLabel('CANCELLED')).toBe('Annulée')
  })

  it('traduit les statuts de ticket', () => {
    expect(statusLabel('GENERATED')).toBe('Valide')
    expect(statusLabel('USED')).toBe('Consommé')
    expect(statusLabel('EXPIRED')).toBe('Expiré')
  })

  it('renvoie la valeur brute si inconnue', () => {
    expect(statusLabel('INCONNU' as never)).toBe('INCONNU')
  })
})

describe('mealLabel', () => {
  it('traduit les créneaux de repas', () => {
    expect(mealLabel('BREAKFAST')).toBe('Petit-déjeuner')
    expect(mealLabel('LUNCH')).toBe('Déjeuner')
    expect(mealLabel('DINNER')).toBe('Dîner')
  })
})

describe('roleLabel', () => {
  it('traduit les rôles', () => {
    expect(roleLabel('student')).toBe('Étudiant')
    expect(roleLabel('logistician')).toBe('Logisticien')
    expect(roleLabel('admin')).toBe('Administrateur')
  })
})