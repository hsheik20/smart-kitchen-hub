// Versioned localStorage for DEMO data: inventory, groceries, last deduction (for undo), and UI preferences.
// Browser-only and per device (ADR-022). v1 → v2 is migrated explicitly; unknown versions reset with a notice.
import type { GroceryItem, InventoryItem, LastDeduction, Prefs } from './types'

export const STORAGE_KEY = 'skh.state'
export const STORAGE_VERSION = 2

export interface StoredState {
  version: typeof STORAGE_VERSION
  inventory: InventoryItem[]
  groceries: GroceryItem[]
  lastDeduction: LastDeduction | null
  prefs: Prefs
}

export const DEFAULT_PREFS: Prefs = {
  devicePreview: false,
  servings: 2,
  maxMinutes: null,
  assumeStaples: false,
  lastCooking: null,
}

export interface LoadResult {
  state: StoredState
  /** Set when stored data existed but could not be used (old version or corrupt). */
  notice: string | null
}

export const freshState = (prefs: Prefs = DEFAULT_PREFS): StoredState =>
  ({ version: STORAGE_VERSION, inventory: [], groceries: [], lastDeduction: null, prefs: { ...prefs } })

const hasQuantity = (x: { quantity?: { accuracy?: unknown } }) => !!x.quantity && typeof x.quantity.accuracy === 'string'

function looksLikeItem(x: unknown): x is InventoryItem {
  const i = x as InventoryItem
  return !!i && typeof i.id === 'string' && typeof i.display_name === 'string' && hasQuantity(i)
}

function looksLikeGrocery(x: unknown): x is GroceryItem {
  const g = x as GroceryItem
  return !!g && typeof g.id === 'string' && typeof g.display_name === 'string' && typeof g.purchased === 'boolean' && hasQuantity(g)
}

function looksLikeDeduction(x: unknown): x is LastDeduction {
  const d = x as LastDeduction
  return !!d && typeof d.recipe_title === 'string' && !!d.batch && Array.isArray(d.batch.lines)
}

export function loadState(): LoadResult {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return { state: freshState(), notice: 'Browser storage is unavailable; demo data will not be kept.' }
  }
  if (!raw) return { state: freshState(), notice: null }
  try {
    const parsed = JSON.parse(raw)
    const prefs = { ...DEFAULT_PREFS, ...(parsed?.prefs ?? {}) }
    const inventory = Array.isArray(parsed?.inventory) ? parsed.inventory.filter(looksLikeItem) : []
    if (parsed?.version === 1) {
      // v1 had inventory + prefs only; keep them and start an empty grocery list.
      return { state: { ...freshState(prefs), inventory }, notice: null }
    }
    if (parsed?.version !== STORAGE_VERSION) {
      return { state: freshState(), notice: 'Saved demo data was from an unsupported version and has been reset.' }
    }
    return {
      state: {
        version: STORAGE_VERSION,
        inventory,
        groceries: Array.isArray(parsed.groceries) ? parsed.groceries.filter(looksLikeGrocery) : [],
        lastDeduction: looksLikeDeduction(parsed.lastDeduction) ? parsed.lastDeduction : null,
        prefs,
      },
      notice: null,
    }
  } catch {
    return { state: freshState(), notice: 'Saved demo data could not be read and has been reset.' }
  }
}

export function saveState(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* storage full or blocked: the app keeps working in memory */ }
}
