// Versioned localStorage for DEMO inventory and UI preferences (browser-only, per device).
import type { InventoryItem, Prefs } from './types'

export const STORAGE_KEY = 'skh.state'
export const STORAGE_VERSION = 1

export interface StoredState {
  version: typeof STORAGE_VERSION
  inventory: InventoryItem[]
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

const fresh = (): StoredState => ({ version: STORAGE_VERSION, inventory: [], prefs: { ...DEFAULT_PREFS } })

function looksLikeItem(x: unknown): x is InventoryItem {
  const i = x as InventoryItem
  return !!i && typeof i.id === 'string' && typeof i.display_name === 'string'
    && !!i.quantity && typeof i.quantity.accuracy === 'string'
}

export function loadState(): LoadResult {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return { state: fresh(), notice: 'Browser storage is unavailable; demo data will not be kept.' }
  }
  if (!raw) return { state: fresh(), notice: null }
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.version !== STORAGE_VERSION) {
      return { state: fresh(), notice: 'Saved demo data was from an older version and has been reset.' }
    }
    const inventory = Array.isArray(parsed.inventory) ? parsed.inventory.filter(looksLikeItem) : []
    return {
      state: { version: STORAGE_VERSION, inventory, prefs: { ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) } },
      notice: null,
    }
  } catch {
    return { state: fresh(), notice: 'Saved demo data could not be read and has been reset.' }
  }
}

export function saveState(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* storage full or blocked: the app keeps working in memory */ }
}
