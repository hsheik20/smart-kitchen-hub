// Grocery list (demo data in browser storage). Purchased items are NOT inventory until the user
// explicitly moves them to My Kitchen and confirms the resulting amounts (ADR-011).
import { useMemo, useState } from 'react'
import { api, cleanQuantity } from '../api'
import { Icon } from '../components/Icon'
import { QuantityEditor, draftFrom, draftToQuantity, type QuantityDraft } from '../components/QuantityEditor'
import { Badge, Banner, EmptyState, ScreenHeader, Segmented, Sheet } from '../components/ui'
import { formatAmount, formatRecipeAmount, lookupIngredient } from '../format'
import { useAddToGrocery } from '../hooks'
import { href } from '../router'
import { itemKey, useStore } from '../state'
import type { GroceryItem, InventoryItem, Quantity } from '../types'

type Editing = { mode: 'add' } | { mode: 'edit'; item: GroceryItem }

export function GroceryScreen() {
  const { groceries, setGroceries } = useStore()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [moving, setMoving] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const toBuy = groceries.filter((g) => !g.purchased)
  const bought = groceries.filter((g) => g.purchased)

  const toggle = (g: GroceryItem) => {
    const now = new Date().toISOString()
    setGroceries((cur) => cur.map((x) => x.id === g.id
      ? { ...x, purchased: !x.purchased, purchased_at: x.purchased ? null : now, updated_at: now } : x))
  }

  return (
    <div className="screen-body grocery fit">
      <ScreenHeader title="Grocery list" subtitle={
        <><Badge tone="demo" icon="info">Demo list</Badge> Saved only in this browser · purchased items are not added to My Kitchen automatically</>
      }>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: 'add' })}>
          <Icon name="plus" size={20} /> Add item
        </button>
      </ScreenHeader>

      {groceries.length === 0 ? (
        <EmptyState icon="cart" title="Your grocery list is empty"
          action={<div className="action-row">
            <a className="btn btn-secondary" href={href({ name: 'recipes' })}>Find recipes</a>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: 'add' })}><Icon name="plus" size={20} /> Add item</button>
          </div>}>
          Add items yourself, or use “Add to grocery list” on a recipe to add what you're missing or short of.
        </EmptyState>
      ) : (
        <div className="grocery-columns">
          <section className="panel grocery-panel" aria-labelledby="tobuy-h">
            <div className="panel-head"><h2 id="tobuy-h">To buy <span className="count">{toBuy.length}</span></h2></div>
            {toBuy.length === 0 ? <p className="muted">Everything is checked off.</p> : (
              <ul className="grocery-list scroll-y">
                {toBuy.map((g) => <GroceryRow key={g.id} item={g} onToggle={() => toggle(g)} onEdit={() => setEditing({ mode: 'edit', item: g })} />)}
              </ul>
            )}
          </section>
          <section className="panel grocery-panel" aria-labelledby="bought-h">
            <div className="panel-head">
              <h2 id="bought-h">Purchased <span className="count">{bought.length}</span></h2>
              {bought.length > 0 && (confirmClear
                ? <span className="inline-confirm">
                    <button type="button" className="btn btn-danger" onClick={() => { setGroceries((c) => c.filter((g) => !g.purchased)); setConfirmClear(false) }}>Remove {bought.length}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
                  </span>
                : <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(true)}>Clear</button>)}
            </div>
            {bought.length === 0 ? <p className="muted">Tap the circle next to an item once you've bought it.</p> : (
              <>
                <ul className="grocery-list scroll-y">
                  {bought.map((g) => <GroceryRow key={g.id} item={g} onToggle={() => toggle(g)} onEdit={() => setEditing({ mode: 'edit', item: g })} />)}
                </ul>
                <div className="move-bar">
                  <p className="hint">Not in My Kitchen yet. Review amounts before moving.</p>
                  <button type="button" className="btn btn-primary" onClick={() => setMoving(true)}>
                    <Icon name="kitchen" size={20} /> Move to My Kitchen…
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {editing && <GrocerySheet editing={editing} onClose={() => setEditing(null)} />}
      {moving && <MoveSheet items={bought} onClose={() => setMoving(false)} />}
    </div>
  )
}

function GroceryRow({ item, onToggle, onEdit }: { item: GroceryItem; onToggle: () => void; onEdit: () => void }) {
  return (
    <li className={`grocery-row${item.purchased ? ' is-bought' : ''}`}>
      <button type="button" className="check-btn" role="checkbox" aria-checked={item.purchased}
        aria-label={`${item.purchased ? 'Mark not purchased' : 'Mark purchased'}: ${item.display_name}`} onClick={onToggle}>
        {item.purchased && <Icon name="check" size={22} />}
      </button>
      <div className="grocery-text">
        <strong>{item.display_name}</strong>
        <span className="grocery-qty">{item.quantity.amount === null && !item.quantity.display_text ? 'No amount' : formatRecipeAmount(item.quantity)}</span>
        <span className="grocery-meta">
          {item.recipe_title && <span>{item.source === 'recipe_shortfall' ? 'Short for' : 'For'} {item.recipe_title}</span>}
          {item.ingredient_id === null && <Badge tone="warn">not in catalog</Badge>}
          {item.note && item.source !== 'recipe_shortfall' && <span className="muted">{item.note}</span>}
        </span>
      </div>
      <button type="button" className="icon-btn" aria-label={`Edit ${item.display_name}`} onClick={onEdit}><Icon name="edit" size={20} /></button>
    </li>
  )
}

function GrocerySheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const { catalog, setGroceries } = useStore()
  const addToGrocery = useAddToGrocery()
  const item = editing.mode === 'edit' ? editing.item : null
  const [name, setName] = useState(item?.display_name ?? '')
  const [draft, setDraft] = useState<QuantityDraft>(draftFrom(item?.quantity, 'each'))
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const match = lookupIngredient(name, catalog.ingredients)

  const submit = async () => {
    const display = name.trim().replace(/\s+/g, ' ')
    if (!display) return setError('Enter a name.')
    if (display.length > 80) return setError('Keep the name under 80 characters.')
    const q = draftToQuantity(draft)
    if (typeof q === 'string') return setError(q)
    // Keep the recipe's wording ("1 small") only if the amount wasn't changed.
    const keepText = item && item.quantity.amount === q.amount && item.quantity.unit === q.unit && item.quantity.accuracy === q.accuracy
    const quantity: Quantity = { ...q, display_text: keepText ? item!.quantity.display_text ?? null : null }
    const ingredient_id = match?.id ?? null
    if (item) {
      const now = new Date().toISOString()
      setGroceries((cur) => cur.map((g) => g.id === item.id ? { ...g, display_name: display, ingredient_id, quantity, updated_at: now } : g))
      onClose()
      return
    }
    setBusy(true)
    try {
      await addToGrocery([{ ingredient_id, display_name: match ? match.name : display, quantity, source: 'manual', recipe_id: null, recipe_title: null, note: null }])
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <Sheet title={item ? `Edit ${item.display_name}` : 'Add to grocery list'} onClose={onClose} footer={
      <>
        {item && (confirmDelete
          ? <button type="button" className="btn btn-danger" onClick={() => { setGroceries((c) => c.filter((g) => g.id !== item.id)); onClose() }}>Confirm remove</button>
          : <button type="button" className="btn btn-ghost danger-text" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={20} /> Remove</button>)}
        <span className="spacer" />
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}><Icon name="check" size={20} /> Save</button>
      </>
    }>
      <div className="form-grid single">
        <div className="field">
          <label htmlFor="grocery-name">Item</label>
          <input id="grocery-name" list="grocery-catalog" value={name} maxLength={80} placeholder="e.g. garlic"
            onChange={(e) => { setName(e.target.value); setError(null) }} />
          <datalist id="grocery-catalog">{catalog.ingredients.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          <small className="muted">{name.trim() ? (match ? `Catalog ingredient: ${match.name}` : 'Not in catalog — kept as typed.') : ' '}</small>
        </div>
        <div className="field">
          <span className="label">Amount (optional)</span>
          <QuantityEditor value={draft} units={catalog.units} onChange={(d) => { setDraft(d); setError(null) }} />
        </div>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </Sheet>
  )
}

// ------------------------------------------------------------- move purchased → My Kitchen
type Outcome =
  | { kind: 'new'; quantity: Quantity }
  | { kind: 'restock'; quantity: Quantity; existing: InventoryItem }
  | { kind: 'add'; quantity: Quantity; result: Quantity; existing: InventoryItem }
  | { kind: 'conflict'; quantity: Quantity; existing: InventoryItem; reason: string; choice: 'keep' | 'replace' }

function MoveSheet({ items, onClose }: { items: GroceryItem[]; onClose: () => void }) {
  const { catalog, inventory, saveItems, setGroceries, notify } = useStore()
  const byKey = useMemo(() => new Map(inventory.map((i) => [itemKey(i), i])), [inventory])
  const [stage, setStage] = useState<'amounts' | 'review'>('amounts')
  const [drafts, setDrafts] = useState<Record<string, QuantityDraft>>(
    () => Object.fromEntries(items.map((g) => [g.id, draftFrom(g.quantity, byKey.get(itemKey(g))?.quantity.unit ?? 'each')])))
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((g) => g.id)))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const chosen = items.filter((g) => selected.has(g.id))

  const review = async () => {
    const errs: Record<string, string> = {}
    const qs: Record<string, Quantity> = {}
    for (const g of chosen) {
      const q = draftToQuantity(drafts[g.id])
      if (typeof q === 'string') errs[g.id] = q
      else qs[g.id] = cleanQuantity(q)
    }
    setErrors(errs)
    if (Object.keys(errs).length || !chosen.length) return
    const out: Record<string, Outcome> = {}
    const toCombine: GroceryItem[] = []
    for (const g of chosen) {
      const existing = byKey.get(itemKey(g))
      if (!existing) out[g.id] = { kind: 'new', quantity: qs[g.id] }
      else if (existing.availability === 'out') out[g.id] = { kind: 'restock', quantity: qs[g.id], existing }
      else toCombine.push(g)
    }
    setBusy(true); setFailure(null)
    try {
      if (toCombine.length) {
        const results = await api.combine(toCombine.map((g) => ({ existing: cleanQuantity(byKey.get(itemKey(g))!.quantity), incoming: qs[g.id] })))
        toCombine.forEach((g, i) => {
          const existing = byKey.get(itemKey(g))!
          const r = results[i]
          out[g.id] = r.combinable && r.result
            ? { kind: 'add', quantity: qs[g.id], result: r.result, existing }
            : { kind: 'conflict', quantity: qs[g.id], existing, reason: r.reason, choice: 'keep' }
        })
      }
      setOutcomes(out)
      setStage('review')
    } catch (e) {
      setFailure((e as Error).message)
    } finally { setBusy(false) }
  }

  const confirm = () => {
    const now = chosen.map((g) => {
      const o = outcomes[g.id]
      const existing = 'existing' in o ? o.existing : undefined
      const quantity = o.kind === 'add' ? o.result : o.kind === 'conflict' && o.choice === 'keep' ? existing!.quantity : o.quantity
      return {
        ingredient_id: g.ingredient_id, display_name: existing?.display_name ?? g.display_name,
        availability: 'available' as const, quantity, low_stock_threshold: existing?.low_stock_threshold ?? null,
      }
    })
    saveItems(now)
    const moved = new Set(chosen.map((g) => g.id))
    setGroceries((cur) => cur.filter((g) => !moved.has(g.id)))
    notify(`Moved ${chosen.length} item${chosen.length === 1 ? '' : 's'} to My Kitchen.`)
    onClose()
  }

  return (
    <Sheet title={stage === 'amounts' ? 'Move purchased items to My Kitchen' : 'Confirm changes to My Kitchen'} onClose={onClose} footer={
      stage === 'amounts' ? (
        <>
          <span className="hint">Step 1 of 2 · check what you actually bought</span>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy || !chosen.length} onClick={review}>Review {chosen.length} <Icon name="right" size={20} /></button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setStage('amounts')}><Icon name="left" size={20} /> Back</button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={confirm}><Icon name="check" size={20} /> Move {chosen.length} to My Kitchen</button>
        </>
      )
    }>
      {failure && <Banner tone="danger" icon="alert" title="Couldn't check amounts">{failure}</Banner>}
      {stage === 'amounts' ? (
        <ul className="move-list">
          {items.map((g) => {
            const existing = byKey.get(itemKey(g))
            return (
              <li key={g.id} className={selected.has(g.id) ? '' : 'is-off'}>
                <label className="check-row">
                  <input type="checkbox" checked={selected.has(g.id)} onChange={(e) => setSelected((s) => {
                    const n = new Set(s); if (e.target.checked) n.add(g.id); else n.delete(g.id); return n
                  })} />
                  <strong>{g.display_name}</strong>
                </label>
                <small className="muted">{existing ? `In My Kitchen: ${existing.availability === 'out' ? 'used up' : formatAmount(existing.quantity)}` : 'Not in My Kitchen yet'}</small>
                {selected.has(g.id) && (
                  <QuantityEditor compact value={drafts[g.id]} units={catalog.units} error={errors[g.id]}
                    onChange={(d) => { setDrafts((x) => ({ ...x, [g.id]: d })); setErrors((x) => ({ ...x, [g.id]: '' })) }} />
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="move-list">
          {chosen.map((g) => {
            const o = outcomes[g.id]
            return (
              <li key={g.id}>
                <strong>{g.display_name}</strong>
                {o.kind === 'new' && <p>New in My Kitchen: <b>{formatAmount(o.quantity)}</b></p>}
                {o.kind === 'restock' && <p>Was used up → <b>{formatAmount(o.quantity)}</b></p>}
                {o.kind === 'add' && <p>{formatAmount(o.existing.quantity)} + {formatAmount(o.quantity)} → <b>{formatAmount(o.result)}</b></p>}
                {o.kind === 'conflict' && (
                  <>
                    <p className="warn-text"><Icon name="alert" size={18} /> {o.reason}. Kitchen has {formatAmount(o.existing.quantity)}; you bought {formatAmount(o.quantity)}.</p>
                    <Segmented label={`What to keep for ${g.display_name}`} value={o.choice}
                      onChange={(choice) => setOutcomes((x) => ({ ...x, [g.id]: { ...o, choice } }))}
                      options={[{ value: 'keep', label: 'Keep kitchen amount' }, { value: 'replace', label: 'Use purchased amount' }]} />
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
