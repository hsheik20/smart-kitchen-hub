// Types mirroring backend/app/models.py. Amounts are Decimal strings (ADR-019).

export type Accuracy = 'exact' | 'estimated' | 'unknown'
export type Availability = 'available' | 'out'

export interface Quantity {
  amount: string | null
  unit: string | null
  accuracy: Accuracy
  display_text?: string | null
}

export interface Ingredient {
  id: string
  name: string
  aliases: string[]
  category: string | null
  default_unit: string | null
  is_staple: boolean
}

export interface UnitInfo {
  code: string
  dimension: 'mass' | 'volume' | 'count'
}

/** Demo inventory item kept in browser storage. Sent to the backend as an InventoryRecord. */
export interface InventoryItem {
  id: string
  ingredient_id: string | null
  display_name: string
  availability: Availability
  quantity: Quantity
  low_stock_threshold: Quantity | null
  created_at: string
  updated_at: string
}

export interface InventoryRecord {
  id: string
  ingredient_id: string | null
  display_name: string
  availability: Availability
  quantity: Quantity
  low_stock_threshold: Quantity | null
}

export type CheckStatus =
  | 'have_enough'
  | 'have_unknown_amount'
  | 'have_insufficient'
  | 'have_incompatible_unit'
  | 'assumed_staple'
  | 'missing'
  | 'optional_missing'

export interface IngredientCheck {
  ingredient_id: string | null
  display_name: string
  optional: boolean
  status: CheckStatus
  required: Quantity
  on_hand: Quantity | null
  shortfall: Quantity | null
}

export interface RecipeRating {
  value: number
  scale_max: number
  review_count: number | null
  provider: string
  retrieved_at: string
}

export interface RecipeMatch {
  recipe_id: string
  title: string
  source_name: string
  is_sample_data: boolean
  total_minutes: number | null
  servings: number | null
  servings_requested: number | null
  scale_factor: string | null
  checks: IngredientCheck[]
  match_pct: number
  missing: string[]
  shortages: string[]
  cannot_compare: string[]
  assumed_staples: string[]
  rank_reasons: string[]
  rating: RecipeRating | null
}

export interface MatchResponse {
  matches: RecipeMatch[]
  unmapped_inventory: string[]
  assume_staples: boolean
  data_note: string
}

export interface MatchRequest {
  inventory: InventoryRecord[]
  assume_staples: boolean
  max_minutes: number | null
  servings: number | null
}

export interface RecipeSource {
  provider: string
  provider_recipe_id: string | null
  name: string
  url: string | null
  author: string | null
  license_note: string | null
  instruction_display_allowed: boolean
  retrieved_at: string | null
  is_sample_data: boolean
}

export interface Substitution {
  replacement: string
  ingredient_id: string | null
  note: string | null
}

export interface RecipeIngredient {
  ingredient_id: string | null
  display_name: string
  quantity: Quantity
  preparation: string | null
  optional: boolean
  group: string | null
  substitutions: Substitution[]
}

export interface RecipeStep {
  number: number
  text: string
  ingredient_refs: string[]
  timer_seconds: number | null
  safety_note: string | null
}

export interface Recipe {
  id: string
  title: string
  source: RecipeSource
  servings: number | null
  prep_minutes: number | null
  cook_minutes: number | null
  total_minutes: number | null
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  notes: string[]
  safety_cautions: string[]
  tags: string[]
  rating: RecipeRating | null
}

export interface StockStatus {
  id: string | null
  display_name: string
  status: 'out' | 'low' | 'ok' | 'unknown'
  reason: string
}

export interface Prefs {
  devicePreview: boolean
  servings: number
  maxMinutes: number | null
  assumeStaples: boolean
  lastCooking: { recipeId: string; title: string; step: number } | null
}
