import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { href, type Route } from '../router'

const ITEMS: { route: Route; label: string; icon: string; match: Route['name'][] }[] = [
  { route: { name: 'home' }, label: 'Home', icon: 'home', match: ['home'] },
  { route: { name: 'scan' }, label: 'Scan', icon: 'scan', match: ['scan'] },
  { route: { name: 'kitchen' }, label: 'My Kitchen', icon: 'kitchen', match: ['kitchen'] },
  { route: { name: 'recipes' }, label: 'Recipes', icon: 'book', match: ['recipes', 'recipe', 'cook'] },
]

export function NavRail({ current, previewControl }: { current: Route; previewControl?: ReactNode }) {
  return (
    <nav className="nav" aria-label="Main">
      <div className="brand" aria-label="Smart Kitchen Hub">
        <span className="brand-mark"><Icon name="leaf" size={22} /></span>
        <span className="brand-name">Kitchen<br />Hub</span>
      </div>
      <ul>
        {ITEMS.map((item) => {
          const active = item.match.includes(current.name)
          return (
            <li key={item.label}>
              <a href={href(item.route)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                <Icon name={item.icon} size={26} />
                <span>{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
      {previewControl && <div className="nav-foot">{previewControl}</div>}
    </nav>
  )
}
