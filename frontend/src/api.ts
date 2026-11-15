// Thin client for the FastAPI backend. All quantity/matching logic stays server-side.
import type {
  DeductionApplyResponse, DeductionBatch, DeductionProposal, Ingredient, InventoryItem, InventoryRecord,
  MatchRequest, MatchResponse, Quantity, QuantityCombineResult, Recipe, StockStatus, UnitInfo,
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
  deductionPreview: (recipe_id: string, servings_cooked: number | null, items: InventoryItem[]) =>
    request<DeductionProposal>('/api/deductions/preview', post({ recipe_id, servings_cooked, inventory: items.map(toRecord) })),
  deductionApply: (recipe_id: string, servings_cooked: number | null, items: InventoryItem[], include: string[]) =>
    request<DeductionApplyResponse>('/api/deductions/apply', post({ recipe_id, servings_cooked, inventory: items.map(toRecord), include })),
  deductionUndo: (batch: DeductionBatch, items: InventoryItem[]) =>
    request<{ inventory: InventoryRecord[]; restored: string[] }>('/api/deductions/undo', post({ batch, inventory: items.map(toRecord) })),
  combine: (pairs: { existing: Quantity | null; incoming: Quantity | null }[]) =>
    request<QuantityCombineResult[]>('/api/quantities/combine', post({ pairs })),
}

/** Quantities sent to the API must not carry unknown keys or empty display text. */
export const cleanQuantity = (q: Quantity): Quantity =>
  ({ amount: q.amount, unit: q.unit, accuracy: q.accuracy, display_text: q.display_text ?? null })
