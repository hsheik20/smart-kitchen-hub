// App-wide state: demo inventory + preferences (persisted) and the catalog/units (from the API).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from './api'
import { loadState, saveState, STORAGE_VERSION } from './storage'
import type { Ingredient, InventoryItem, Prefs, UnitInfo } from './types'
import { cleanText } from './format'

interface Catalog {
  ingredients: Ingredient[]
  units: UnitInfo[]
  loading: boolean
  error: string | null
  retry: () => void
}

interface Store {
  inventory: InventoryItem[]
  prefs: Prefs
  storageNotice: string | null
  dismissNotice: () => void
  /** Add or replace items (matched by ingredient id, else by cleaned name). Caller confirms first. */
  saveItems: (items: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>[]) => void
  updateItem: (item: InventoryItem) => void
  removeItem: (id: string) => void
  setPrefs: (patch: Partial<Prefs>) => void
  catalog: Catalog
}

const Ctx = createContext<Store | null>(null)

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/** Key used to keep one inventory item per ingredient (the backend rejects duplicates, ADR-017). */
export const itemKey = (i: { ingredient_id: string | null; display_name: string }) =>
  i.ingredient_id ?? `name:${cleanText(i.display_name)}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadState)
  const [inventory, setInventory] = useState<InventoryItem[]>(initial.state.inventory)
  const [prefs, setPrefsState] = useState<Prefs>(initial.state.prefs)
  const [storageNotice, setStorageNotice] = useState<string | null>(initial.notice)

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    saveState({ version: STORAGE_VERSION, inventory, prefs })
  }, [inventory, prefs])

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
  const setPrefs = useCallback((patch: Partial<Prefs>) => setPrefsState((p) => ({ ...p, ...patch })), [])

  const value = useMemo<Store>(() => ({
    inventory, prefs, storageNotice,
    dismissNotice: () => setStorageNotice(null),
    saveItems, updateItem, removeItem, setPrefs,
    catalog: {
      ingredients, units, loading: catalogLoading, error: catalogError,
      retry: () => setAttempt((n) => n + 1),
    },
  }), [inventory, prefs, storageNotice, saveItems, updateItem, removeItem, setPrefs, ingredients, units, catalogLoading, catalogError])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
