import { describe, expect, it } from 'vitest'

import { computeChange, formatAmount, formatMoney } from '@/lib/format/money'

/**
 * `Intl.NumberFormat('fr-FR')` sépare les milliers par une espace fine
 * insécable (U+202F), pas une espace ordinaire.
 */
const NNBSP = '\u202f'

describe('formatMoney', () => {
  it('ajoute la devise et sépare les milliers', () => {
    expect(formatMoney('6300.00')).toBe(`6${NNBSP}300 XOF`)
  })

  it('accepte un nombre', () => {
    expect(formatMoney(1500)).toBe(`1${NNBSP}500 XOF`)
  })

  it('respecte une devise fournie', () => {
    expect(formatMoney('200.00', 'EUR')).toBe('200 EUR')
  })

  it('gère une valeur nulle', () => {
    expect(formatMoney('0.00')).toBe('0 XOF')
  })

  it('renvoie un tiret pour une valeur invalide', () => {
    expect(formatMoney('pas-un-nombre')).toBe('—')
  })
})

describe('formatAmount', () => {
  it('formate sans devise', () => {
    expect(formatAmount('6300.00')).toBe(`6${NNBSP}300`)
  })
})

describe('computeChange', () => {
  it('calcule la monnaie à rendre', () => {
    expect(computeChange(6300, 6500)).toBe(200)
  })

  it('ne descend jamais sous zéro', () => {
    expect(computeChange(6300, 6000)).toBe(0)
  })

  it('gère le compte juste', () => {
    expect(computeChange(6300, 6300)).toBe(0)
  })
})