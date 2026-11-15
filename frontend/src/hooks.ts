import { useEffect, useState } from 'react'
import { api, toRecord } from './api'
import { useStore } from './state'
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
