// My Kitchen: demo inventory (browser storage). Low-stock state comes from the backend
// and is shown only when a threshold and a comparable amount exist.
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { Icon } from '../components/Icon'
import { UndoBanner } from '../components/UndoBanner'
import { QuantityEditor, UnitSelect, draftFrom, draftToQuantity, type QuantityDraft } from '../components/QuantityEditor'
import { AccuracyBadge, Badge, Banner, EmptyState, ScreenHeader, Segmented, Sheet } from '../components/ui'
import { formatAmount, lookupIngredient, parseAmount } from '../format'
import { href } from '../router'
import { itemKey, useStore } from '../state'
import type { Availability, InventoryItem, Quantity, StockStatus } from '../types'

type Editing = { mode: 'add' } | { mode: 'edit'; item: InventoryItem }

export function KitchenScreen() {
  const { inventory, catalog } = useStore()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [stock, setStock] = useState<Map<string, StockStatus>>(new Map())
  const [stockError, setStockError] = useState<string | null>(null)

  useEffect(() => {
    if (!inventory.length) { setStock(new Map()); return }
    let live = true
    api.stockStatus(inventory)
      .then((rows) => { if (live) { setStock(new Map(rows.map((r) => [r.id ?? '', r]))); setStockError(null) } })
      .catch((e: Error) => live && setStockError(e.message))
    return () => { live = false }
  }, [inventory])

  const sorted = useMemo(
    () => [...inventory].sort((a, b) =>
      (a.availability === 'out' ? 1 : 0) - (b.availability === 'out' ? 1 : 0) || a.display_name.localeCompare(b.display_name)),
    [inventory],
  )
  const lowCount = [...stock.values()].filter((s) => s.status === 'low').length

  return (
    <div className="screen-body kitchen">
      <ScreenHeader title="My Kitchen" subtitle={
        <><Badge tone="demo" icon="info">Demo inventory</Badge> Saved only in this browser{inventory.length ? ` · ${inventory.length} item${inventory.length === 1 ? '' : 's'}` : ''}{lowCount ? ` · ${lowCount} low` : ''}</>
      }>
        <a className="btn btn-secondary" href={href({ name: 'scan' })}><Icon name="scan" size={20} /> Simulated scan</a>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: 'add' })} disabled={!catalog.units.length}>
          <Icon name="plus" size={20} /> Add item
        </button>
      </ScreenHeader>

      <UndoBanner />
      {stockError && <Banner tone="warn" icon="alert" title="Low-stock status unavailable">{stockError}</Banner>}

      {inventory.length === 0 ? (
        <EmptyState icon="kitchen" title="Your kitchen is empty"
          action={<a className="btn btn-primary" href={href({ name: 'scan' })}>Add ingredients</a>}>
          Add ingredients with the simulated scan or the “Add item” button.
        </EmptyState>
      ) : (
        <ul className="inventory-grid">
          {sorted.map((item) => {
            const s = stock.get(item.id)
            return (
              <li key={item.id}>
                <button type="button" className={`inv-card${item.availability === 'out' ? ' is-out' : ''}`}
                  onClick={() => setEditing({ mode: 'edit', item })} aria-label={`Edit ${item.display_name}`}>
                  <span className="inv-top">
                    <strong className="inv-name">{item.display_name}</strong>
                    <Icon name="edit" size={20} className="inv-edit" />
                  </span>
                  <span className="inv-amount">{item.availability === 'out' ? 'Used up' : item.quantity.amount === null ? 'Have it' : formatAmount(item.quantity)}</span>
                  <span className="inv-badges">
                    {item.availability === 'available' && <AccuracyBadge accuracy={item.quantity.accuracy} />}
                    {s?.status === 'low' && <Badge tone="warn" icon="alert">Low stock</Badge>}
                    {s?.status === 'out' && <Badge tone="danger">Out</Badge>}
                    {s?.status === 'ok' && <Badge tone="olive" icon="check">Stocked</Badge>}
                    {item.ingredient_id === null && <Badge tone="warn">not in catalog</Badge>}
                  </span>
                  {item.low_stock_threshold && s?.status === 'unknown' && <small className="muted">{s.reason}</small>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editing && <ItemSheet editing={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ItemSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const { catalog, inventory, saveItems, updateItem, removeItem } = useStore()
  const item = editing.mode === 'edit' ? editing.item : null
  const [name, setName] = useState(item?.display_name ?? '')
  const [availability, setAvailability] = useState<Availability>(item?.availability ?? 'available')
  const [draft, setDraft] = useState<QuantityDraft>(draftFrom(item?.quantity, 'g'))
  const [useThreshold, setUseThreshold] = useState(!!item?.low_stock_threshold)
  const [thAmount, setThAmount] = useState(item?.low_stock_threshold?.amount ?? '')
  const [thUnit, setThUnit] = useState(item?.low_stock_threshold?.unit ?? item?.quantity.unit ?? 'g')
  const [error, setError] = useState<string | null>(null)
  const [qtyError, setQtyError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const match = lookupIngredient(name, catalog.ingredients)
  // When adding, default the unit to the catalog's usual unit once an ingredient is recognised.
  useEffect(() => {
    if (!item && match?.default_unit && draft.amount === '') setDraft((d) => ({ ...d, unit: match.default_unit! }))
  }, [match?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const display = name.trim().replace(/\s+/g, ' ')
    if (!display) return setError('Enter a name.')
    if (display.length > 80) return setError('Keep the name under 80 characters.')
    const ingredient_id = match?.id ?? null
    const clash = inventory.find((x) => itemKey(x) === itemKey({ ingredient_id, display_name: display }) && x.id !== item?.id)
    if (clash) return setError(`“${clash.display_name}” is already in your kitchen. Edit that item instead.`)
    const q = draftToQuantity(draft)
    if (typeof q === 'string') return setQtyError(q)
    let threshold: Quantity | null = null
    if (useThreshold) {
      const amt = parseAmount(thAmount)
      if (!amt) return setError('Low-stock alert: enter a number greater than 0.')
      threshold = { amount: amt, unit: thUnit, accuracy: 'exact' }
    }
    const fields = { ingredient_id, display_name: match && !item ? match.name : display, availability, quantity: q, low_stock_threshold: threshold }
    if (item) updateItem({ ...item, ...fields })
    else saveItems([fields])
    onClose()
  }

  return (
    <Sheet title={item ? `Edit ${item.display_name}` : 'Add an item'} onClose={onClose} footer={
      <>
        {item && (confirmDelete
          ? <button type="button" className="btn btn-danger" onClick={() => { removeItem(item.id); onClose() }}>Confirm remove</button>
          : <button type="button" className="btn btn-ghost danger-text" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={20} /> Remove</button>)}
        <span className="spacer" />
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit}><Icon name="check" size={20} /> Save</button>
      </>
    }>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="item-name">Ingredient</label>
          <input id="item-name" list="catalog-names" value={name} maxLength={80} placeholder="e.g. rice"
            onChange={(e) => { setName(e.target.value); setError(null) }} />
          <datalist id="catalog-names">{catalog.ingredients.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          <small className="muted">{name.trim() ? (match ? `Catalog ingredient: ${match.name}` : 'Not in catalog — kept as typed; won’t match recipes.') : ' '}</small>
        </div>
        <div className="field">
          <span className="label">Availability</span>
          <Segmented label="Availability" value={availability} onChange={setAvailability}
            options={[{ value: 'available', label: 'Have it' }, { value: 'out', label: 'Used up' }]} />
        </div>
        <div className="field span-2">
          <span className="label">Amount</span>
          <QuantityEditor value={draft} units={catalog.units} error={qtyError} onChange={(d) => { setDraft(d); setQtyError(null) }} />
        </div>
        <div className="field span-2">
          <label className="check-row">
            <input type="checkbox" checked={useThreshold} onChange={(e) => setUseThreshold(e.target.checked)} />
            Warn me when this runs low
          </label>
          {useThreshold && (
            <div className="qty-fields">
              <input inputMode="decimal" aria-label="Low-stock threshold amount" placeholder="at or below…" value={thAmount} onChange={(e) => setThAmount(e.target.value)} />
              <UnitSelect value={thUnit} units={catalog.units} onChange={setThUnit} />
            </div>
          )}
          <small className="muted">Low stock is shown only when the amount is known and uses a comparable unit.</small>
        </div>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </Sheet>
  )
}
