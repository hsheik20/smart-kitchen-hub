// Display-only helpers. No quantity arithmetic happens in the browser (ADR-016/021).
import type { Accuracy, Ingredient, Quantity } from './types'

export const cleanText = (v: string) => v.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ')

/**
 * Map typed text to a catalog id using the catalog's own names and aliases
 * (same normalization as backend/app/catalog.py). Used to keep one inventory
 * item per ingredient; the backend remains authoritative.
 */
export function lookupIngredient(text: string, catalog: Ingredient[]): Ingredient | null {
  const t = cleanText(text)
  if (!t) return null
  return catalog.find((i) =>
    [i.id, i.id.replace(/-/g, ' '), i.name, ...i.aliases].some((k) => cleanText(k) === t),
  ) ?? null
}

const UNIT_LABELS: Record<string, string> = { fl_oz: 'fl oz', each: 'whole', package: 'pkg' }
const PLURALS: Record<string, string> = { clove: 'cloves', can: 'cans', bunch: 'bunches', slice: 'slices', cup: 'cups' }

/** Unit code → short display label (display only). */
export const unitLabel = (code: string | null) => (code ? UNIT_LABELS[code] ?? code : '')

function unitFor(amount: string, code: string | null) {
  if (code && PLURALS[code] && Number(amount) !== 1) return PLURALS[code]
  return unitLabel(code)
}

export function formatAmount(q: Quantity | null | undefined): string {
  if (!q || q.amount === null) return 'Amount unknown'
  const unit = unitFor(q.amount, q.unit)
  const text = unit ? `${q.amount} ${unit}` : q.amount
  return q.accuracy === 'estimated' ? `~${text}` : text
}

/** Recipe amounts: prefer the recipe's own wording ("1 medium", "to taste"). */
export function formatRecipeAmount(q: Quantity): string {
  if (q.display_text) return q.display_text
  return q.amount === null ? 'amount not stated' : formatAmount(q)
}

export const ACCURACY_LABEL: Record<Accuracy, string> = {
  exact: 'Exact',
  estimated: 'Estimated',
  unknown: 'Amount unknown',
}

export const UNIT_GROUP_LABEL: Record<string, string> = { mass: 'Weight', volume: 'Volume', count: 'Count' }

/** Validate a typed amount: a positive decimal (no fractions/expressions). */
export function parseAmount(text: string): string | null {
  const t = text.trim()
  if (!/^\d{1,7}(\.\d{1,3})?$|^\.\d{1,3}$/.test(t)) return null
  const n = Number(t)
  if (!(n > 0) || n > 1_000_000) return null
  return t.startsWith('.') ? `0${t}` : t
}

export function minutesLabel(m: number | null) {
  return m === null ? 'Time not stated' : `${m} min`
}
