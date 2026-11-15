// Pieces shared by the full recipe view and guided cooking (both render the same Recipe, ADR-013).
import { Badge } from '../components/ui'
import { formatAmount, formatRecipeAmount } from '../format'
import type { IngredientCheck, Recipe, RecipeMatch } from '../types'

/** Checks align 1:1 with recipe.ingredients (backend preserves order); verify by name. */
export function checksFor(recipe: Recipe, match: RecipeMatch | undefined): (IngredientCheck | undefined)[] {
  return recipe.ingredients.map((ing, i) => {
    const c = match?.checks[i]
    return c && c.display_name === ing.display_name && c.ingredient_id === ing.ingredient_id ? c : undefined
  })
}

export const isScaled = (m: RecipeMatch | undefined) => !!m?.scale_factor && m.scale_factor !== '1'

/** Amount to show: backend-scaled requirement when scaled, otherwise the recipe's own wording. */
export function shownAmount(ingQty: Parameters<typeof formatRecipeAmount>[0], check: IngredientCheck | undefined, scaled: boolean) {
  if (scaled && check) return formatRecipeAmount(check.required)
  return formatRecipeAmount(ingQty)
}

export function CheckBadge({ check }: { check: IngredientCheck | undefined }) {
  if (!check) return null
  switch (check.status) {
    case 'have_enough': return <Badge tone="olive" icon="check">Have enough</Badge>
    case 'have_insufficient': return <Badge tone="warn" icon="alert">Short {check.shortfall ? formatAmount(check.shortfall) : ''}</Badge>
    case 'have_unknown_amount': return <Badge tone="sage">Have it · amount not checked</Badge>
    case 'have_incompatible_unit': return <Badge tone="sage">Have it · units can’t be compared</Badge>
    case 'assumed_staple': return <Badge tone="neutral">Assumed staple</Badge>
    case 'missing': return <Badge tone="danger">Missing</Badge>
    case 'optional_missing': return null
  }
}
