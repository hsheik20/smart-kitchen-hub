// Thin client for the FastAPI backend. All quantity/matching logic stays server-side.
import type {
  Ingredient, InventoryItem, InventoryRecord, MatchRequest, MatchResponse, Recipe, StockStatus, UnitInfo,
} from './types'

export class ApiError extends Error {
  constructor(message: string, public status: number | null) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the Smart Kitchen Hub backend. Start FastAPI on port 8000.', null)
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) detail = body.detail.map((d: { msg: string }) => d.msg).join('; ')
    } catch { /* keep generic message */ }
    throw new ApiError(detail, response.status)
  }
  return response.json() as Promise<T>
}

/** Strip browser-only fields: the backend forbids unknown keys. */
export function toRecord(item: InventoryItem): InventoryRecord {
  return {
    id: item.id,
    ingredient_id: item.ingredient_id,
    display_name: item.display_name,
    availability: item.availability,
    quantity: item.quantity,
    low_stock_threshold: item.low_stock_threshold,
  }
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  ingredients: () => request<Ingredient[]>('/api/ingredients'),
  units: () => request<UnitInfo[]>('/api/units'),
  recipe: (id: string) => request<Recipe>(`/api/recipes/${encodeURIComponent(id)}/full`),
  match: (body: MatchRequest) => request<MatchResponse>('/api/recipes/match', post(body)),
  stockStatus: (items: InventoryItem[]) =>
    request<StockStatus[]>('/api/inventory/stock-status', post({ inventory: items.map(toRecord) })),
}
