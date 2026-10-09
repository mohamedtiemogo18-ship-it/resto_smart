/** Formatage monétaire — jamais de flottant affiché. */

const XOF = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** « 6300.00 » → « 6 300 FCFA » */
export function formatMoney(amount: string | number, currency = 'XOF'): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (Number.isNaN(value)) return '—'
  return `${XOF.format(value)} ${currency}`
}

/** « 6300.00 » → « 6 300 » (sans devise) */
export function formatAmount(amount: string | number): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (Number.isNaN(value)) return '—'
  return XOF.format(value)
}

/** Calcule la monnaie à rendre. */
export function computeChange(total: number, received: number): number {
  return Math.max(0, received - total)
}