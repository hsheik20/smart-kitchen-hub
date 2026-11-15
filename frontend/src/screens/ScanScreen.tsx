// Simulated scan: the user chooses ingredients (no camera, no AI), verifies them,
// enters exact / estimated / unknown amounts, then explicitly saves to demo inventory.
import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { QuantityEditor, draftFrom, draftToQuantity, type QuantityDraft } from '../components/QuantityEditor'
import { Badge, Banner, ErrorState, Loading, ScreenHeader } from '../components/ui'
import { cleanText, formatAmount, lookupIngredient } from '../format'
import { href } from '../router'
import { itemKey, useStore } from '../state'
import type { Ingredient } from '../types'

interface Pick {
  key: string
  ingredient_id: string | null
  display_name: string
  draft: QuantityDraft
}

// Fixed sample used by "Load sample suggestions". This is NOT recognition output.
const SAMPLE_SUGGESTIONS = ['chicken', 'zucchini', 'sweet-potato', 'rice']

type Stage = 'choose' | 'verify' | 'saved'

export function ScanScreen() {
  const { catalog, inventory, saveItems } = useStore()
  const [stage, setStage] = useState<Stage>('choose')
  const [picks, setPicks] = useState<Pick[]>([])
  const [typed, setTyped] = useState('')
  const [typedNote, setTypedNote] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedCount, setSavedCount] = useState(0)

  const byKey = useMemo(() => new Map(inventory.map((i) => [itemKey(i), i])), [inventory])
  const selected = new Set(picks.map((p) => p.key))

  const pickFor = (ing: Ingredient): Pick => ({
    key: ing.id, ingredient_id: ing.id, display_name: ing.name,
    draft: draftFrom(null, ing.default_unit ?? 'each'),
  })

  const toggle = (ing: Ingredient) =>
    setPicks((cur) => (cur.some((p) => p.key === ing.id) ? cur.filter((p) => p.key !== ing.id) : [...cur, pickFor(ing)]))

  const loadSample = () => {
    const add = catalog.ingredients.filter((i) => SAMPLE_SUGGESTIONS.includes(i.id) && !selected.has(i.id))
    setPicks((cur) => [...cur, ...add.map(pickFor)])
  }

  const addTyped = () => {
    const text = typed.trim().replace(/\s+/g, ' ')
    if (!text) return
    if (text.length > 80) { setTypedNote('Please keep names under 80 characters.'); return }
    const ing = lookupIngredient(text, catalog.ingredients)
    const key = ing ? ing.id : `name:${cleanText(text)}`
    if (selected.has(key)) { setTypedNote(`"${ing?.name ?? text}" is already selected.`); setTyped(''); return }
    setPicks((cur) => [...cur, ing ? pickFor(ing) : { key, ingredient_id: null, display_name: text, draft: draftFrom(null, 'each') }])
    setTypedNote(ing ? `Matched "${text}" to catalog ingredient "${ing.name}".` : `"${text}" isn't in the catalog; it will be kept as typed but won't match recipe ingredients.`)
    setTyped('')
  }

  const updateDraft = (key: string, draft: QuantityDraft) => {
    setPicks((cur) => cur.map((p) => (p.key === key ? { ...p, draft } : p)))
    setErrors((e) => { const { [key]: _, ...rest } = e; return rest })
  }

  const save = () => {
    const errs: Record<string, string> = {}
    const items = picks.map((p) => {
      const q = draftToQuantity(p.draft)
      if (typeof q === 'string') { errs[p.key] = q; return null }
      const existing = byKey.get(p.key)
      return {
        ingredient_id: p.ingredient_id, display_name: p.display_name, availability: 'available' as const,
        quantity: q, low_stock_threshold: existing?.low_stock_threshold ?? null,
      }
    })
    setErrors(errs)
    if (Object.keys(errs).length) return
    saveItems(items.filter((x) => x !== null))
    setSavedCount(items.length)
    setPicks([])
    setStage('saved')
  }

  const steps: { id: Stage; label: string }[] = [
    { id: 'choose', label: 'Choose' }, { id: 'verify', label: 'Verify amounts' }, { id: 'saved', label: 'Saved' },
  ]

  return (
    <div className="screen-body scan fit">
      <ScreenHeader title="Add ingredients" subtitle="Simulated scan: you choose what you have.">
        <ol className="progress-steps" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s.id} className={s.id === stage ? 'current' : steps.findIndex((x) => x.id === stage) > i ? 'done' : ''}
              aria-current={s.id === stage ? 'step' : undefined}>
              <span>{i + 1}</span>{s.label}
            </li>
          ))}
        </ol>
      </ScreenHeader>

      <Banner tone="demo" icon="scan" title="SIMULATED SCAN">
        No camera or AI recognition is connected. Nothing here is detected automatically; you pick every ingredient yourself.
      </Banner>

      {catalog.loading && <Loading label="Loading ingredient catalog…" />}
      {catalog.error && <ErrorState message={catalog.error} onRetry={catalog.retry} />}

      {stage === 'choose' && !catalog.loading && (
        <div className="scan-choose">
          <div className="panel scan-catalog">
            <div className="panel-head">
              <h2>Tap what you have</h2>
              <button type="button" className="btn btn-secondary" onClick={loadSample} disabled={!catalog.ingredients.length}>
                Load sample suggestions
              </button>
            </div>
            <p className="hint">“Sample suggestions” is a fixed demo list, not camera or AI output.</p>
            <div className="ingredient-grid">
              {catalog.ingredients.map((ing) => {
                const on = selected.has(ing.id)
                const have = byKey.get(ing.id)
                return (
                  <button key={ing.id} type="button" className={`ing-tile${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(ing)}>
                    <span className="ing-check"><Icon name={on ? 'check' : 'plus'} size={20} /></span>
                    <span className="ing-name">{ing.name}</span>
                    <small>{have ? `In kitchen: ${formatAmount(have.quantity)}` : ing.is_staple ? 'Pantry staple' : ing.category ?? ''}</small>
                  </button>
                )
              })}
            </div>
            <form className="typed-add" onSubmit={(e) => { e.preventDefault(); addTyped() }}>
              <label htmlFor="typed">Something else?</label>
              <input id="typed" value={typed} maxLength={80} placeholder="Type an ingredient, e.g. olive oil" onChange={(e) => setTyped(e.target.value)} />
              <button type="submit" className="btn btn-secondary" disabled={!typed.trim()}><Icon name="plus" size={20} /> Add</button>
            </form>
            {typedNote && <p className="hint" role="status">{typedNote}</p>}
          </div>

          <aside className="panel scan-selected">
            <h2>Selected <span className="count">{picks.length}</span></h2>
            {picks.length === 0 ? <p className="muted">Nothing selected yet.</p> : (
              <ul className="chip-list">
                {picks.map((p) => (
                  <li key={p.key}>
                    <span>{p.display_name}</span>
                    {p.ingredient_id === null && <Badge tone="warn">not in catalog</Badge>}
                    <button type="button" className="icon-btn" aria-label={`Remove ${p.display_name}`}
                      onClick={() => setPicks((cur) => cur.filter((x) => x.key !== p.key))}><Icon name="x" size={18} /></button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="btn btn-primary btn-block" disabled={!picks.length} onClick={() => setStage('verify')}>
              Next: verify amounts <Icon name="right" size={20} />
            </button>
          </aside>
        </div>
      )}

      {stage === 'verify' && (
        <div className="panel scan-verify">
          <div className="panel-head">
            <h2>Check each ingredient and its amount</h2>
            <span className="muted">Estimated and unknown amounts are fine — they are saved as such.</span>
          </div>
          <ul className="verify-list scroll-y">
            {picks.map((p) => {
              const existing = byKey.get(p.key)
              return (
                <li key={p.key} className="verify-row">
                  <div className="verify-name">
                    <strong>{p.display_name}</strong>
                    {p.ingredient_id === null && <Badge tone="warn">not in catalog</Badge>}
                    {existing && <small className="replace-note">Replaces current: {formatAmount(existing.quantity)}</small>}
                  </div>
                  <QuantityEditor compact value={p.draft} units={catalog.units} error={errors[p.key]} onChange={(d) => updateDraft(p.key, d)} />
                  <button type="button" className="icon-btn" aria-label={`Remove ${p.display_name}`}
                    onClick={() => setPicks((cur) => cur.filter((x) => x.key !== p.key))}><Icon name="trash" size={20} /></button>
                </li>
              )
            })}
          </ul>
          <div className="action-bar">
            <button type="button" className="btn btn-secondary" onClick={() => setStage('choose')}><Icon name="left" size={20} /> Back</button>
            <button type="button" className="btn btn-primary" disabled={!picks.length} onClick={save}>
              <Icon name="check" size={20} /> Save {picks.length} to My Kitchen
            </button>
          </div>
        </div>
      )}

      {stage === 'saved' && (
        <div className="panel scan-saved">
          <span className="big-check"><Icon name="check" size={40} /></span>
          <h2>Saved {savedCount} ingredient{savedCount === 1 ? '' : 's'} to your demo kitchen</h2>
          <p className="muted">Stored only in this browser. Nothing was detected by a camera.</p>
          <div className="action-row">
            <a className="btn btn-secondary" href={href({ name: 'kitchen' })}>View My Kitchen</a>
            <a className="btn btn-primary" href={href({ name: 'recipes' })}>Find recipes <Icon name="right" size={20} /></a>
            <button type="button" className="btn btn-ghost" onClick={() => setStage('choose')}>Add more</button>
          </div>
        </div>
      )}
    </div>
  )
}
