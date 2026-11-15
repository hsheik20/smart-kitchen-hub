import { useUndoDeduction } from '../hooks'
import { Banner } from './ui'

/** Shows the latest confirmed cooking deduction with an Undo action (persisted across refresh). */
export function UndoBanner() {
  const { lastDeduction, undo, busy, error, dismiss } = useUndoDeduction()
  if (!lastDeduction) return null
  const n = lastDeduction.batch.lines.length
  const when = new Date(lastDeduction.batch.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (error) {
    return (
      <Banner tone="warn" icon="alert" title="Undo not possible" action={
        <button type="button" className="btn btn-secondary" onClick={dismiss}>Dismiss</button>}>
        {error}. Edit the items by hand if needed.
      </Banner>
    )
  }
  return (
    <Banner tone="info" icon="chef" title={`Updated after cooking ${lastDeduction.recipe_title}`} action={
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={undo}>{busy ? 'Undoing…' : 'Undo'}</button>}>
      {n} item{n === 1 ? '' : 's'} changed at {when}.
    </Banner>
  )
}
