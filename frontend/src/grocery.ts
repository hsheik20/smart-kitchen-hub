// Grocery-list helpers. Quantity arithmetic is delegated to POST /api/quantities/combine (ADR-026).
import { api, cleanQuantity } from './api'
import { formatAmount } from './format'
import { itemKey, newId, type NewGroceryItem } from './state'
import type { GroceryItem, RecipeMatch } from './types'

export interface AddResult {
  next: GroceryItem[]
  added: string[]
  combined: string[]
  separate: string[]
  skipped: string[]
}

const make = (g: NewGroceryItem, now: string, note: string | null = g.note): GroceryItem =>
  ({ ...g, quantity: cleanQuantity(g.quantity), note, id: newId(), purchased: false, purchased_at: null, created_at: now, updated_at: now })

/**
 * Add items to the list. Duplicates (same ingredient, not yet purchased) are combined only when the
 * backend says both amounts are known and compatible; otherwise the new entry is kept separately with
 * a note, or skipped when it carries no amount. Nothing is merged silently.
 */
export async function addToGroceryList(current: GroceryItem[], incoming: NewGroceryItem[]): Promise<AddResult> {
  const now = new Date().toISOString()
  const res: AddResult = { next: [...current], added: [], combined: [], separate: [], skipped: [] }
  const seen = new Set<string>()
  const dupes: { item: NewGroceryItem; index: number }[] = []

  for (const item of incoming) {
    const key = itemKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    const index = res.next.findIndex((g) => !g.purchased && itemKey(g) === key)
    if (index < 0) { res.next.push(make(item, now)); res.added.push(item.display_name); continue }
    if (item.quantity.amount === null) { res.skipped.push(res.next[index].display_name); continue }
    dupes.push({ item, index })
  }

  if (dupes.length) {
    const results = await api.combine(dupes.map((d) => ({ existing: res.next[d.index].quantity, incoming: cleanQuantity(d.item.quantity) })))
    dupes.forEach((d, i) => {
      const r = results[i]
      const existing = res.next[d.index]
      if (r.combinable && r.result) {
        res.next[d.index] = { ...existing, quantity: r.result, updated_at: now }
        res.combined.push(`${existing.display_name} (${formatAmount(existing.quantity)} → ${formatAmount(r.result)})`)
      } else {
        res.next.push(make(d.item, now, `Kept separate: ${r.reason.toLowerCase()}`))
        res.separate.push(d.item.display_name)
      }
    })
  }
  return res
}

export function summarize(r: AddResult): string {
  const parts: string[] = []
  if (r.added.length) parts.push(`Added ${r.added.join(', ')}`)
  if (r.combined.length) parts.push(`Updated ${r.combined.join(', ')}`)
  if (r.separate.length) parts.push(`Kept separate (amounts can't be combined): ${r.separate.join(', ')}`)
  if (r.skipped.length) parts.push(`Already on the list: ${r.skipped.join(', ')}`)
  return parts.length ? `${parts.join('. ')}.` : 'Nothing to add.'
}

/** Missing ingredients (recipe amount) and shortages (backend shortfall) from a match, for the grocery list. */
export function groceryFromMatch(m: RecipeMatch): NewGroceryItem[] {
  const out: NewGroceryItem[] = []
  for (const c of m.checks) {
    if (c.optional) continue
    if (c.status === 'missing') {
      out.push({ ingredient_id: c.ingredient_id, display_name: c.display_name, quantity: c.required, source: 'recipe_missing',
        recipe_id: m.recipe_id, recipe_title: m.title, note: null })
    } else if (c.status === 'have_insufficient' && c.shortfall) {
      out.push({ ingredient_id: c.ingredient_id, display_name: c.display_name, quantity: c.shortfall, source: 'recipe_shortfall',
        recipe_id: m.recipe_id, recipe_title: m.title, note: 'Amount still needed' })
    }
  }
  return out
}
