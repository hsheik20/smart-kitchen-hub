// App-wide state: demo inventory, groceries, last deduction (persisted) and the catalog/units (from the API).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from './api'
import { freshState, loadState, saveState, STORAGE_VERSION } from './storage'
import type { GroceryItem, Ingredient, InventoryItem, InventoryRecord, LastDeduction, Prefs, UnitInfo } from './types'
import { cleanText } from './format'

interface Catalog {
  ingredients: Ingredient[]
  units: UnitInfo[]
  loading: boolean
  error: string | null
  retry: () => void
}

export type NewInventoryItem = Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>
export type NewGroceryItem = Omit<GroceryItem, 'id' | 'created_at' | 'updated_at' | 'purchased' | 'purchased_at'>

interface Store {
  inventory: InventoryItem[]
  groceries: GroceryItem[]
  lastDeduction: LastDeduction | null
  prefs: Prefs
  storageNotice: string | null
  dismissNotice: () => void
  /** Add or replace items (matched by ingredient id, else by cleaned name). Caller confirms first. */
  saveItems: (items: NewInventoryItem[]) => void
  updateItem: (item: InventoryItem) => void
  removeItem: (id: string) => void
  /** Take quantity/availability for matching ids from backend-computed records (deduction apply/undo). */
  applyServerInventory: (records: InventoryRecord[]) => void
  setLastDeduction: (d: LastDeduction | null) => void
  setGroceries: (update: (current: GroceryItem[]) => GroceryItem[]) => void
  setPrefs: (patch: Partial<Prefs>) => void
  /** Clear inventory, groceries, undo state and cooking position; keep display preferences. */
  resetDemo: () => void
  toast: string | null
  notify: (message: string) => void
  catalog: Catalog
}

const Ctx = createContext<Store | null>(null)

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/** Key used to keep one item per ingredient (the backend rejects duplicate inventory, ADR-017). */
export const itemKey = (i: { ingredient_id: string | null; display_name: string }) =>
  i.ingredient_id ?? `name:${cleanText(i.display_name)}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadState)
  const [inventory, setInventory] = useState<InventoryItem[]>(initial.state.inventory)
  const [groceries, setGroceriesState] = useState<GroceryItem[]>(initial.state.groceries)
  const [lastDeduction, setLastDeduction] = useState<LastDeduction | null>(initial.state.lastDeduction)
  const [prefs, setPrefsState] = useState<Prefs>(initial.state.prefs)
  const [storageNotice, setStorageNotice] = useState<string | null>(initial.notice)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    saveState({ version: STORAGE_VERSION, inventory, groceries, lastDeduction, prefs })
  }, [inventory, groceries, lastDeduction, prefs])

  useEffect(() => {
    let live = true
    setCatalogLoading(true)
    Promise.all([api.ingredients(), api.units()])
      .then(([ing, u]) => {
        if (!live) return
        setIngredients(ing)
        setUnits(u)
        setCatalogError(null)
      })
      .catch((e: ApiError) => live && setCatalogError(e.message))
      .finally(() => live && setCatalogLoading(false))
    return () => { live = false }
  }, [attempt])

  const saveItems = useCallback<Store['saveItems']>((items) => {
    const now = new Date().toISOString()
    setInventory((current) => {
      const next = [...current]
      for (const item of items) {
        const idx = next.findIndex((x) => itemKey(x) === itemKey(item))
        if (idx >= 0) next[idx] = { ...next[idx], ...item, updated_at: now }
        else next.push({ ...item, id: newId(), created_at: now, updated_at: now })
      }
      return next
    })
  }, [])

  const updateItem = useCallback((item: InventoryItem) => {
    setInventory((cur) => cur.map((x) => (x.id === item.id ? { ...item, updated_at: new Date().toISOString() } : x)))
  }, [])

  const removeItem = useCallback((id: string) => setInventory((cur) => cur.filter((x) => x.id !== id)), [])

  const applyServerInventory = useCallback((records: InventoryRecord[]) => {
    const now = new Date().toISOString()
    const byId = new Map(records.map((r) => [r.id, r]))
    setInventory((cur) => cur.map((x) => {
      const r = byId.get(x.id)
      if (!r) return x
      const same = JSON.stringify([r.quantity, r.availability]) === JSON.stringify([x.quantity, x.availability])
      return same ? x : { ...x, quantity: r.quantity, availability: r.availability, updated_at: now }
    }))
  }, [])

  const setGroceries = useCallback((update: (c: GroceryItem[]) => GroceryItem[]) => setGroceriesState(update), [])
  const setPrefs = useCallback((patch: Partial<Prefs>) => setPrefsState((p) => ({ ...p, ...patch })), [])

  const resetDemo = useCallback(() => {
    const blank = freshState()
    setInventory(blank.inventory)
    setGroceriesState(blank.groceries)
    setLastDeduction(null)
    setPrefsState((p) => ({ ...p, lastCooking: null }))
  }, [])

  const notify = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4500)
  }, [])

  const value = useMemo<Store>(() => ({
    inventory, groceries, lastDeduction, prefs, storageNotice,
    dismissNotice: () => setStorageNotice(null),
    saveItems, updateItem, removeItem, applyServerInventory, setLastDeduction, setGroceries, setPrefs, resetDemo,
    toast, notify,
    catalog: {
      ingredients, units, loading: catalogLoading, error: catalogError,
      retry: () => setAttempt((n) => n + 1),
    },
  }), [inventory, groceries, lastDeduction, prefs, storageNotice, saveItems, updateItem, removeItem, applyServerInventory,
    setGroceries, setPrefs, resetDemo, toast, notify, ingredients, units, catalogLoading, catalogError])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
