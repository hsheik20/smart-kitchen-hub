// Shared presentational components.
import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import type { Accuracy } from '../types'
import { ACCURACY_LABEL } from '../format'

type Tone = 'neutral' | 'olive' | 'sage' | 'warn' | 'danger' | 'demo'

export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{icon && <Icon name={icon} size={16} />}{children}</span>
}

export function SampleBadge() {
  return <Badge tone="demo" icon="leaf">Original sample recipe</Badge>
}

export function AccuracyBadge({ accuracy }: { accuracy: Accuracy }) {
  const tone: Tone = accuracy === 'exact' ? 'olive' : accuracy === 'estimated' ? 'sage' : 'neutral'
  return <Badge tone={tone}>{ACCURACY_LABEL[accuracy]}</Badge>
}

export function Banner({ tone = 'demo', icon = 'info', title, children, action }:
  { tone?: 'demo' | 'warn' | 'danger' | 'info'; icon?: string; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`banner banner-${tone}`} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon name={icon} size={22} />
      <div className="banner-body">{title && <strong>{title}</strong>}{children && <span>{children}</span>}</div>
      {action}
    </div>
  )
}

export function ScreenHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="screen-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children && <div className="header-actions">{children}</div>}
    </header>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }:
  { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, min, max, onChange, label }:
  { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Icon name="minus" />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Icon name="plus" />
      </button>
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }:
  { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="toggle" onClick={() => onChange(!checked)}>
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      <span className="toggle-text"><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    </button>
  )
}

export function Sheet({ title, onClose, children, footer }:
  { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, select, button')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={36} /></span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" />{label}</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Banner tone="danger" icon="alert" title="Something went wrong" action={onRetry &&
      <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>}>
      {message}
    </Banner>
  )
}
