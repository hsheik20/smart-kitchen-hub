// Full recipe view: structured data from GET /api/recipes/{id}/full plus kitchen checks.
import { Icon } from '../components/Icon'
import { Badge, Banner, ErrorState, Loading, SampleBadge } from '../components/ui'
import { minutesLabel } from '../format'
import { groceryFromMatch } from '../grocery'
import { useAddToGrocery, useMatches, useRecipe } from '../hooks'
import { href } from '../router'
import { useStore } from '../state'
import { CheckBadge, checksFor, isScaled, shownAmount } from './recipeParts'

export function RecipeScreen({ id }: { id: string }) {
  const { prefs, notify } = useStore()
  const addToGrocery = useAddToGrocery()
  const recipe = useRecipe(id)
  const matches = useMatches({ applyTimeFilter: false })

  if (recipe.loading && !recipe.data) return <div className="screen-body"><Loading label="Loading recipe…" /></div>
  if (recipe.error || !recipe.data) {
    return (
      <div className="screen-body">
        <a className="btn btn-ghost back-link" href={href({ name: 'recipes' })}><Icon name="left" size={20} /> Recipes</a>
        <ErrorState message={recipe.error ?? 'Recipe not found'} onRetry={recipe.reload} />
      </div>
    )
  }

  const r = recipe.data
  const match = matches.data?.matches.find((m) => m.recipe_id === r.id)
  const checks = checksFor(r, match)
  const scaled = isScaled(match)
  const canShowSteps = r.source.instruction_display_allowed && r.steps.length > 0

  return (
    <div className="screen-body recipe-view fit">
      <div className="recipe-head">
        <a className="btn btn-ghost back-link" href={href({ name: 'recipes' })}><Icon name="left" size={20} /> Recipes</a>
        <div className="recipe-title">
          <h1>{r.title}</h1>
          <p className="meta">
            <span><Icon name="clock" size={18} /> {minutesLabel(r.total_minutes)}{r.prep_minutes !== null && r.cook_minutes !== null ? ` (prep ${r.prep_minutes} · cook ${r.cook_minutes})` : ''}</span>
            <span><Icon name="users" size={18} /> Serves {r.servings ?? '?'}</span>
            {r.source.is_sample_data && <SampleBadge />}
            <span className="muted">{r.rating ? `Rated ${r.rating.value}/${r.rating.scale_max} (${r.rating.provider})` : 'No ratings available'}</span>
          </p>
        </div>
        {canShowSteps && (
          <a className="btn btn-primary btn-lg" href={href({ name: 'cook', id: r.id, step: 1 })}>
            <Icon name="chef" size={24} /> Start guided cooking
          </a>
        )}
      </div>

      <div className="recipe-columns">
        <section className="panel ingredients-panel" aria-labelledby="ing-h">
          <div className="panel-head">
            <h2 id="ing-h">Ingredients</h2>
            {match && groceryFromMatch(match).length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addToGrocery(groceryFromMatch(match)).catch((e: Error) => notify(e.message))}>
                <Icon name="cart" size={18} /> Add {groceryFromMatch(match).length} missing to grocery list
              </button>
            )}
            {scaled
              ? <Badge tone="sage">Scaled for {prefs.servings} (×{match!.scale_factor})</Badge>
              : <span className="muted">As written</span>}
          </div>
          {matches.error && <p className="hint">Kitchen check unavailable: {matches.error}</p>}
          <ul className="ing-list">
            {r.ingredients.map((ing, i) => (
              <li key={`${ing.ingredient_id ?? ing.display_name}`}>
                <div className="ing-line">
                  <span className="ing-qty">{shownAmount(ing.quantity, checks[i], scaled)}</span>
                  <span className="ing-label">
                    {ing.display_name}{ing.preparation && <span className="muted">, {ing.preparation}</span>}
                    {ing.optional && <Badge tone="neutral">optional</Badge>}
                  </span>
                  <CheckBadge check={checks[i]} />
                </div>
                {scaled && ing.quantity.amount !== null && ing.quantity.display_text && <small className="muted as-written">Recipe says {ing.quantity.display_text}</small>}
                {ing.substitutions.map((s) => (
                  <p key={s.replacement} className="sub"><Icon name="swap" size={16} />Swap: <strong>{s.replacement}</strong>{s.note && ` — ${s.note}`}</p>
                ))}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel directions-panel" aria-labelledby="dir-h">
          <h2 id="dir-h">Directions</h2>
          {canShowSteps ? (
            <ol className="step-list">
              {r.steps.map((s) => (
                <li key={s.number}>
                  <span className="step-num">{s.number}</span>
                  <div>
                    <p>{s.text}</p>
                    {s.safety_note && <p className="safety-inline"><Icon name="shield" size={16} /> {s.safety_note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Banner tone="info" title="Directions not shown in the app">
              The source doesn't permit displaying its instructions here.{r.source.url && <> <a href={r.source.url} target="_blank" rel="noreferrer">Open the original recipe</a>.</>}
            </Banner>
          )}

          {r.safety_cautions.length > 0 && (
            <div className="callout callout-safety">
              <h3><Icon name="shield" size={20} /> Food safety</h3>
              <ul>{r.safety_cautions.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          {r.notes.length > 0 && (
            <div className="callout">
              <h3><Icon name="flag" size={20} /> Notes</h3>
              <ul>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
          <div className="source">
            <strong>Source:</strong> {r.source.name}{r.source.author ? ` · ${r.source.author}` : ''}
            {r.source.license_note && <p className="muted">{r.source.license_note}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
