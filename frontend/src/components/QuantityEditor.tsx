// Shared amount entry: exact / estimated / unknown, amount, unit. Unknown never becomes 0.
import { useId } from 'react'
import type { Accuracy, Quantity, UnitInfo } from '../types'
import { parseAmount, UNIT_GROUP_LABEL, unitLabel } from '../format'
import { Segmented } from './ui'

export interface QuantityDraft {
  accuracy: Accuracy
  amount: string
  unit: string
}

export const draftFrom = (q: Quantity | null | undefined, fallbackUnit: string): QuantityDraft => ({
  accuracy: q?.accuracy ?? 'unknown',
  amount: q?.amount ?? '',
  unit: q?.unit ?? fallbackUnit,
})

/** Returns the Quantity, or an error message when the draft is incomplete. */
export function draftToQuantity(d: QuantityDraft): Quantity | string {
  if (d.accuracy === 'unknown') return { amount: null, unit: null, accuracy: 'unknown' }
  const amount = parseAmount(d.amount)
  if (amount === null) return 'Enter a number greater than 0 (for example 250 or 0.5), or choose "Unknown".'
  if (!d.unit) return 'Choose a unit.'
  return { amount, unit: d.unit, accuracy: d.accuracy }
}

export function UnitSelect({ value, units, onChange, id, disabled }:
  { value: string; units: UnitInfo[]; onChange: (u: string) => void; id?: string; disabled?: boolean }) {
  const groups = ['mass', 'volume', 'count'] as const
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label="Unit">
      {groups.map((g) => (
        <optgroup key={g} label={UNIT_GROUP_LABEL[g]}>
          {units.filter((u) => u.dimension === g).map((u) => (
            <option key={u.code} value={u.code}>{u.code === 'each' ? 'each' : unitLabel(u.code)}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function QuantityEditor({ value, onChange, units, error, compact = false, allowUnknown = true }:
  { value: QuantityDraft; onChange: (d: QuantityDraft) => void; units: UnitInfo[]; error?: string | null; compact?: boolean; allowUnknown?: boolean }) {
  const id = useId()
  const options: { value: Accuracy; label: string }[] = [
    { value: 'exact', label: 'Exact' },
    { value: 'estimated', label: 'Estimate' },
    ...(allowUnknown ? [{ value: 'unknown' as Accuracy, label: 'Unknown' }] : []),
  ]
  const unknown = value.accuracy === 'unknown'
  return (
    <div className={`qty-editor${compact ? ' compact' : ''}`}>
      <Segmented label="How sure are you of the amount?" value={value.accuracy} options={options}
        onChange={(accuracy) => onChange({ ...value, accuracy })} />
      {unknown ? (
        <p className="qty-unknown">No amount will be saved. You can add one later.</p>
      ) : (
        <div className="qty-fields">
          <label className="sr-only" htmlFor={`${id}-amt`}>Amount</label>
          <input id={`${id}-amt`} inputMode="decimal" autoComplete="off" placeholder={value.accuracy === 'estimated' ? 'about…' : 'amount'}
            value={value.amount} aria-invalid={!!error} onChange={(e) => onChange({ ...value, amount: e.target.value })} />
          <UnitSelect value={value.unit} units={units} onChange={(unit) => onChange({ ...value, unit })} />
        </div>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
