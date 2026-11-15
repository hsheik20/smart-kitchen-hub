// After cooking: review the backend's proposed inventory deductions, confirm, and (optionally) undo.
// Nothing changes until the user confirms; all amounts come from the backend (ADR-010/025).
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { Icon } from '../components/Icon'
import { UndoBanner } from '../components/UndoBanner'
import { AccuracyBadge, Badge, Banner, EmptyState, ErrorState, Loading, ScreenHeader, Stepper } from '../components/ui'
import { formatAmount, formatRecipeAmount } from '../format'
import { useRecipe } from '../hooks'
import { href } from '../router'
import { useStore } from '../state'
import type { DeductionApplyResponse, DeductionLine, DeductionProposal } from '../types'

const keyOf = (l: DeductionLine) => l.ingredient_id ?? l.display_name
const deductible = (l: DeductionLine) => l.status === 'will_deduct' || l.status === 'will_deduct_to_zero'

export function ReviewScreen({ id }: { id: string }) {
  const { inventory, prefs, catalog, applyServerInventory, setLastDeduction, setPrefs } = useStore()
  const recipe = useRecipe(id)
  const [servings, setServings] = useState(prefs.servings)
  const [proposal, setProposal] = useState<DeductionProposal | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [include, setInclude] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [done, setDone] = useState<DeductionApplyResponse | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (done) return
    let live = true
    setLoadError(null)
    api.deductionPreview(id, servings, inventory)
      .then((p) => {
        if (!live) return
        setProposal(p)
        setInclude(Object.fromEntries(p.lines.filter(deductible).map((l) => [keyOf(l), l.include])))
      })
      .catch((e: Error) => live && setLoadError(e.message))
    return () => { live = false }
  }, [id, servings, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  const staples = useMemo(() => new Set(catalog.ingredients.filter((i) => i.is_staple).map((i) => i.id)), [catalog.ingredients])
  const title = recipe.data?.title ?? 'this recipe'

  const confirm = async () => {
    if (!proposal) return
    setBusy(true); setApplyError(null)
    try {
      const chosen = Object.entries(include).filter(([, v]) => v).map(([k]) => k)
      const res = await api.deductionApply(id, servings, inventory, chosen)
      applyServerInventory(res.inventory)
      setLastDeduction(res.batch.lines.length ? { batch: res.batch, recipe_title: title } : null)
      setPrefs({ lastCooking: null })
      setDone(res)
    } catch (e) {
      setApplyError((e as Error).message)
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="screen-body review">
        <div className="panel review-done">
          <span className="big-check"><Icon name="check" size={40} /></span>
          <h1>{done.applied.length ? 'My Kitchen updated' : 'No changes made'}</h1>
          {done.applied.length > 0 && <p>Updated: {done.applied.join(', ')}</p>}
          {done.not_applied.length > 0 && <p className="muted">Not changed: {done.not_applied.map((n) => n.display_name).join(', ')}</p>}
          <UndoBanner />
          <div className="action-row">
            <a className="btn btn-secondary btn-lg" href={href({ name: 'home' })}>Home</a>
            <a className="btn btn-primary btn-lg" href={href({ name: 'kitchen' })}><Icon name="kitchen" size={22} /> View My Kitchen</a>
          </div>
        </div>
      </div>
    )
  }

  const lines = proposal?.lines ?? []
  const will = lines.filter(deductible)
  const wont = lines.filter((l) => !deductible(l))
  const chosenCount = will.filter((l) => include[keyOf(l)]).length

  return (
    <div className="screen-body review fit">
      <ScreenHeader title="Review inventory usage" subtitle={<>{title} · <Badge tone="demo" icon="info">Demo inventory</Badge> Nothing changes until you confirm</>}>
        <div className="servings-inline">
          <span className="label">Servings cooked</span>
          <Stepper label="servings cooked" value={servings} min={1} max={12} onChange={setServings} />
        </div>
      </ScreenHeader>

      {recipe.error && <ErrorState message={recipe.error} onRetry={recipe.reload} />}
      {loadError && <ErrorState message={loadError} onRetry={() => setAttempt((n) => n + 1)} />}
      {!proposal && !loadError && <Loading label="Calculating usage…" />}
      {proposal && inventory.length === 0 && (
        <EmptyState icon="kitchen" title="My Kitchen is empty" action={<a className="btn btn-primary" href={href({ name: 'scan' })}>Add ingredients</a>}>
          There's nothing to deduct. Add ingredients first if you want My Kitchen to track what you use.
        </EmptyState>
      )}

      {proposal && inventory.length > 0 && (
        <>
          <div className="review-columns">
            <section className="panel review-panel" aria-labelledby="will-h">
              <div className="panel-head">
                <h2 id="will-h"><Icon name="check" size={20} /> Can be deducted <span className="count">{will.length}</span></h2>
              </div>
              {will.length === 0 ? <p className="muted">Nothing can be safely deducted — see the list on the right.</p> : (
                <ul className="review-list scroll-y">
                  {will.map((l) => {
                    const k = keyOf(l)
                    const on = !!include[k]
                    return (
                      <li key={k} className={on ? '' : 'is-off'}>
                        <button type="button" className="check-btn" role="checkbox" aria-checked={on}
                          aria-label={`Deduct ${l.display_name}`} onClick={() => setInclude((x) => ({ ...x, [k]: !on }))}>
                          {on && <Icon name="check" size={22} />}
                        </button>
                        <div className="review-text">
                          <strong>{l.display_name}{l.include === false && <Badge tone="neutral">optional</Badge>}</strong>
                          <span className="change">
                            {formatAmount(l.on_hand)} <Icon name="right" size={16} />{' '}
                            {l.status === 'will_deduct' ? <b>{formatAmount(l.resulting)}</b> : <b className="warn-text">Used up</b>}
                          </span>
                          <span className="muted small">Uses {formatAmount(l.deduct)} (recipe: {formatRecipeAmount(l.required)})</span>
                          {l.status === 'will_deduct_to_zero' && (
                            <span className="warn-text small"><Icon name="alert" size={16} /> {l.note?.startsWith('Recipe needs more')
                              ? 'Recipe needs more than My Kitchen shows. It will be marked used up — the remaining amount becomes unknown, never negative.'
                              : 'Uses all remaining stock; it will be marked used up.'}</span>
                          )}
                        </div>
                        {l.resulting && <AccuracyBadge accuracy={l.resulting.accuracy} />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="panel review-panel" aria-labelledby="wont-h">
              <div className="panel-head"><h2 id="wont-h"><Icon name="info" size={20} /> Won't change <span className="count">{wont.length}</span></h2></div>
              {wont.length === 0 ? <p className="muted">Every ingredient can be deducted.</p> : (
                <ul className="review-list scroll-y">
                  {wont.map((l) => (
                    <li key={keyOf(l)}>
                      <div className="review-text">
                        <strong>{l.display_name}</strong>
                        <SkipReason line={l} assumed={prefs.assumeStaples && !!l.ingredient_id && staples.has(l.ingredient_id)} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {applyError && <ErrorState message={applyError} />}
          <div className="action-bar">
            <a className="btn btn-secondary" href={href({ name: 'recipe', id })}>Skip — leave My Kitchen unchanged</a>
            <button type="button" className="btn btn-primary btn-lg" disabled={busy || chosenCount === 0} onClick={confirm}>
              <Icon name="check" size={22} /> {busy ? 'Updating…' : `Update My Kitchen (${chosenCount})`}
            </button>
          </div>
        </>
      )}
      {proposal?.warnings.filter((w) => !w.startsWith('Original sample')).map((w) => <Banner key={w} tone="warn" icon="alert">{w}</Banner>)}
    </div>
  )
}

function SkipReason({ line: l, assumed }: { line: DeductionLine; assumed: boolean }) {
  switch (l.status) {
    case 'skip_not_in_inventory':
      return assumed
        ? <span><Badge tone="neutral">Assumed staple</Badge> <span className="muted small">not tracked in My Kitchen</span></span>
        : <span><Badge tone="neutral">{l.inventory_item_id ? 'Used up in My Kitchen' : 'Not in My Kitchen'}</Badge></span>
    case 'skip_recipe_amount_unknown':
      return <span><Badge tone="sage">Recipe amount not stated</Badge> <span className="muted small">“{l.required.display_text ?? 'not stated'}” — not deducted</span></span>
    case 'skip_inventory_amount_unknown':
      return <span><Badge tone="sage">Kitchen amount unknown</Badge> <span className="muted small">needs {formatRecipeAmount(l.required)}; update it by hand if you like</span></span>
    case 'skip_incompatible_units':
      return <span><Badge tone="warn">Units can't be compared</Badge> <span className="muted small">recipe {formatAmount(l.required)} vs kitchen {formatAmount(l.on_hand)}</span></span>
    default:
      return null
  }
}
