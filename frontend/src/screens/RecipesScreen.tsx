// Recipe discovery via POST /api/recipes/match (quantity-aware; computed by the backend).
import { Icon } from '../components/Icon'
import { Badge, Banner, EmptyState, ErrorState, Loading, ScreenHeader, Stepper, Toggle } from '../components/ui'
import { minutesLabel } from '../format'
import { useMatches } from '../hooks'
import { href } from '../router'
import { useStore } from '../state'
import type { RecipeMatch } from '../types'

const TIMES: (number | null)[] = [null, 20, 30, 45, 60]

export function RecipesScreen() {
  const { prefs, setPrefs, inventory } = useStore()
  const { data, loading, error, reload } = useMatches()

  return (
    <div className="screen-body recipes fit">
      <ScreenHeader title="Find recipes" subtitle="Ranked by what's in My Kitchen. Amounts are checked by the backend." />
      <div className="recipes-layout">
        <aside className="panel filters" aria-label="Filters">
          <div className="filter">
            <span className="label"><Icon name="users" size={20} /> Servings</span>
            <Stepper label="servings" value={prefs.servings} min={1} max={12} onChange={(servings) => setPrefs({ servings })} />
            <small className="muted">Amounts are scaled when the recipe states its servings.</small>
          </div>
          <div className="filter">
            <span className="label"><Icon name="clock" size={20} /> Time limit</span>
            <div className="chip-row" role="radiogroup" aria-label="Time limit">
              {TIMES.map((t) => (
                <button key={t ?? 'any'} type="button" role="radio" aria-checked={prefs.maxMinutes === t}
                  className={`chip${prefs.maxMinutes === t ? ' on' : ''}`} onClick={() => setPrefs({ maxMinutes: t })}>
                  {t === null ? 'Any' : `≤ ${t}`}
                </button>
              ))}
            </div>
          </div>
          <div className="filter">
            <Toggle checked={prefs.assumeStaples} onChange={(assumeStaples) => setPrefs({ assumeStaples })}
              label="Assume pantry staples" hint="Treat salt, oil, pepper and water as on hand when they're not in My Kitchen. Amounts aren't checked." />
          </div>
        </aside>

        <section className="results scroll-y" aria-live="polite">
          {inventory.length === 0 && (
            <Banner tone="info" icon="info" title="My Kitchen is empty"
              action={<a className="btn btn-secondary" href={href({ name: 'scan' })}>Add ingredients</a>}>
              Every recipe will show as missing ingredients until you add some.
            </Banner>
          )}
          {error && <ErrorState message={error} onRetry={reload} />}
          {loading && !data && <Loading label="Matching recipes…" />}
          {data && (
            <>
              {data.unmapped_inventory.length > 0 && (
                <p className="hint">Not used for matching (not in catalog): {data.unmapped_inventory.join(', ')}</p>
              )}
              {data.matches.length === 0 ? (
                <EmptyState icon="clock" title="No recipes fit this time limit"
                  action={<button type="button" className="btn btn-secondary" onClick={() => setPrefs({ maxMinutes: null })}>Show all</button>} />
              ) : (
                <ul className={`recipe-grid${loading ? ' is-stale' : ''}`}>
                  {data.matches.map((m) => <li key={m.recipe_id}><RecipeCard match={m} /></li>)}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function RecipeCard({ match: m }: { match: RecipeMatch }) {
  // Reasons already shown as labelled lines (or as the sample badge) are not repeated.
  const shown = ['Original sample', 'Missing', 'Not enough', 'All required', 'Amount not compared', 'Assumed pantry', 'Enough of every']
  const reasons = m.rank_reasons.filter((r) => !shown.some((p) => r.startsWith(p)))
  return (
    <article className="recipe-card">
      <div className="recipe-card-top">
        <div className="match-meter" style={{ ['--pct' as string]: `${m.match_pct}%` }} aria-label={`${m.match_pct}% of required ingredients on hand`}>
          <span>{m.match_pct}%</span>
        </div>
        <div>
          <h2>{m.title}</h2>
          <p className="meta">
            <span><Icon name="clock" size={18} /> {minutesLabel(m.total_minutes)}</span>
            <span><Icon name="users" size={18} /> {m.servings_requested && m.scale_factor ? `For ${m.servings_requested} (recipe serves ${m.servings})` : `Serves ${m.servings ?? '?'}`}</span>
          </p>
        </div>
      </div>
      <div className="recipe-card-body">
        {m.missing.length > 0 && <p className="line line-missing"><strong>Missing</strong> {m.missing.join(', ')}</p>}
        {m.shortages.length > 0 && <p className="line line-short"><strong>Not enough</strong> {m.shortages.join(', ')}</p>}
        {m.cannot_compare.length > 0 && <p className="line line-unknown"><strong>Not checked</strong> {m.cannot_compare.join(', ')}</p>}
        {m.assumed_staples.length > 0 && <p className="line line-assumed"><strong>Assumed</strong> {m.assumed_staples.join(', ')} (staple)</p>}
        {m.missing.length === 0 && m.shortages.length === 0 && <p className="line line-ok"><strong>Ready</strong> {m.cannot_compare.length ? 'All required ingredients on hand' : 'Enough of everything'}</p>}
        {reasons.length > 0 && <ul className="reasons">{reasons.slice(0, 2).map((r) => <li key={r}>{r}</li>)}</ul>}
      </div>
      <div className="recipe-card-foot">
        {m.is_sample_data ? <SampleBadgeSmall /> : <span className="muted">{m.source_name}</span>}
        <span className="muted rating">{m.rating ? `${m.rating.value}/${m.rating.scale_max}` : 'No ratings'}</span>
        <a className="btn btn-primary" href={href({ name: 'recipe', id: m.recipe_id })}>View <Icon name="right" size={20} /></a>
      </div>
    </article>
  )
}

const SampleBadgeSmall = () => <Badge tone="demo" icon="leaf">Sample recipe</Badge>
