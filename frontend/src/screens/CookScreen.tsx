// Guided cooking: one step at a time, large controls, progress, link back to the full recipe.
import { useEffect } from 'react'
import { Icon } from '../components/Icon'
import { Badge, ErrorState, Loading } from '../components/ui'
import { useMatches, useRecipe } from '../hooks'
import { href, navigate } from '../router'
import { useStore } from '../state'
import { CheckBadge, checksFor, isScaled, shownAmount } from './recipeParts'

export function CookScreen({ id, step }: { id: string; step: number }) {
  const { setPrefs } = useStore()
  const recipe = useRecipe(id)
  const matches = useMatches({ applyTimeFilter: false })
  const r = recipe.data
  const total = r?.steps.length ?? 0
  const done = !!r && step > total
  const current = r && !done ? r.steps[Math.min(step, total) - 1] : undefined

  useEffect(() => {
    if (r && current) setPrefs({ lastCooking: { recipeId: r.id, title: r.title, step: current.number } })
    if (r && done) setPrefs({ lastCooking: null })
  }, [r?.id, current?.number, done]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!r || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight' && step <= total) navigate({ name: 'cook', id, step: step + 1 }, true)
      if (e.key === 'ArrowLeft' && step > 1) navigate({ name: 'cook', id, step: step - 1 }, true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [r, id, step, total])

  if (recipe.loading && !r) return <div className="screen-body"><Loading label="Loading recipe…" /></div>
  if (recipe.error || !r) return <div className="screen-body"><ErrorState message={recipe.error ?? 'Recipe not found'} onRetry={recipe.reload} /></div>
  if (!r.source.instruction_display_allowed || total === 0) {
    return <div className="screen-body"><ErrorState message="This recipe's directions can't be shown in the app." /></div>
  }

  const match = matches.data?.matches.find((m) => m.recipe_id === r.id)
  const checks = checksFor(r, match)
  const scaled = isScaled(match)
  const go = (n: number) => navigate({ name: 'cook', id, step: n }, true)

  return (
    <div className="screen-body cook">
      <div className="cook-top">
        <a className="btn btn-secondary" href={href({ name: 'recipe', id })}><Icon name="book" size={20} /> Full recipe</a>
        <div className="cook-title">
          <strong>{r.title}</strong>
          <span className="muted">{done ? 'All steps done' : `Step ${step} of ${total}`}{r.source.is_sample_data ? ' · sample recipe' : ''}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done ? total : step}
          aria-label="Cooking progress">
          {r.steps.map((s) => (
            <button key={s.number} type="button" aria-label={`Go to step ${s.number}`}
              className={s.number < step || done ? 'seg done' : s.number === step ? 'seg current' : 'seg'}
              onClick={() => go(s.number)} />
          ))}
        </div>
      </div>

      {done ? (
        <div className="cook-stage cook-done">
          <span className="big-check"><Icon name="check" size={48} /></span>
          <h1>Enjoy your meal!</h1>
          <p className="muted">My Kitchen hasn't changed. Review what this recipe used and confirm before anything is deducted.</p>
          <div className="action-row">
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => go(total)}><Icon name="left" size={22} /> Last step</button>
            <a className="btn btn-secondary btn-lg" href={href({ name: 'home' })}>Done — no changes</a>
            <a className="btn btn-primary btn-lg" href={href({ name: 'review', id })}><Icon name="kitchen" size={22} /> Review inventory usage</a>
          </div>
        </div>
      ) : current && (
        <div className="cook-stage">
          <div className="cook-main">
            <p className="step-kicker">Step {current.number}</p>
            <p className="step-text">{current.text}</p>
            {current.safety_note && (
              <p className="safety-callout"><Icon name="shield" size={24} /> {current.safety_note}</p>
            )}
          </div>
          <aside className="cook-side" aria-label="Ingredients for this step">
            <h2>For this step</h2>
            {current.ingredient_refs.length === 0 ? <p className="muted">No ingredients needed.</p> : (
              <ul>
                {current.ingredient_refs.map((ref) => {
                  const i = r.ingredients.findIndex((x) => x.ingredient_id === ref)
                  const ing = r.ingredients[i]
                  if (!ing) return null
                  return (
                    <li key={ref}>
                      <span className="ing-qty">{shownAmount(ing.quantity, checks[i], scaled)}</span>
                      <span>{ing.display_name}{ing.optional && <Badge tone="neutral">optional</Badge>}</span>
                      <CheckBadge check={checks[i]} />
                    </li>
                  )
                })}
              </ul>
            )}
            {scaled && <p className="hint">Amounts scaled for your servings.</p>}
          </aside>
        </div>
      )}

      {!done && (
        <div className="cook-nav">
          <button type="button" className="btn btn-secondary btn-xl" disabled={step <= 1} onClick={() => go(step - 1)}>
            <Icon name="left" size={28} /> Previous
          </button>
          <button type="button" className="btn btn-primary btn-xl" onClick={() => go(step + 1)}>
            {step >= total ? <>Finish <Icon name="check" size={28} /></> : <>Next step <Icon name="right" size={28} /></>}
          </button>
        </div>
      )}
    </div>
  )
}
