import { useEffect, useState } from 'react'
import { api, toRecord } from './api'
import { addToGroceryList, summarize } from './grocery'
import { useStore, type NewGroceryItem } from './state'
import type { MatchResponse, Recipe } from './types'

export interface Async<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    setLoading(true)
    fn()
      .then((d) => { if (live) { setData(d); setError(null) } })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [...deps, n]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, loading, error, reload: () => setN((x) => x + 1) }
}

/** Matches for the current demo inventory and filters. All computation is server-side. */
export function useMatches(opts: { applyTimeFilter: boolean } = { applyTimeFilter: true }): Async<MatchResponse> {
  const { inventory, prefs } = useStore()
  const body = {
    inventory: inventory.map(toRecord),
    assume_staples: prefs.assumeStaples,
    max_minutes: opts.applyTimeFilter ? prefs.maxMinutes : null,
    servings: prefs.servings,
  }
  return useAsync(() => api.match(body), [JSON.stringify(body)])
}

export function useRecipe(id: string): Async<Recipe> {
  return useAsync(() => api.recipe(id), [id])
}

/** Add items to the grocery list (backend decides whether duplicates can be combined) and report what happened. */
export function useAddToGrocery() {
  const { groceries, setGroceries, notify } = useStore()
  return async (items: NewGroceryItem[]) => {
    const result = await addToGroceryList(groceries, items)
    setGroceries(() => result.next)
    notify(summarize(result))
    return result
  }
}

/** Undo the most recent confirmed cooking deduction. The backend refuses (409) if those items changed since. */
export function useUndoDeduction() {
  const { lastDeduction, inventory, applyServerInventory, setLastDeduction, notify } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const undo = async () => {
    if (!lastDeduction) return
    setBusy(true); setError(null)
    try {
      const res = await api.deductionUndo(lastDeduction.batch, inventory)
      applyServerInventory(res.inventory)
      setLastDeduction(null)
      notify(`Undone: restored ${res.restored.join(', ')}.`)
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }
  return { lastDeduction, undo, busy, error, dismiss: () => { setLastDeduction(null); setError(null) } }
}
