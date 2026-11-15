// Minimal hash router (no dependency). Hash URLs survive reloads and work in kiosk Chromium.
import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'kitchen' }
  | { name: 'recipes' }
  | { name: 'recipe'; id: string }
  | { name: 'cook'; id: string; step: number }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  switch (parts[0]) {
    case 'scan': return { name: 'scan' }
    case 'kitchen': return { name: 'kitchen' }
    case 'recipes': return { name: 'recipes' }
    case 'recipe': return parts[1] ? { name: 'recipe', id: parts[1] } : { name: 'recipes' }
    case 'cook': {
      if (!parts[1]) return { name: 'recipes' }
      const step = Number(parts[2])
      return { name: 'cook', id: parts[1], step: Number.isInteger(step) && step >= 1 ? step : 1 }
    }
    default: return { name: 'home' }
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home': return '#/'
    case 'recipe': return `#/recipe/${encodeURIComponent(route.id)}`
    case 'cook': return `#/cook/${encodeURIComponent(route.id)}/${route.step}`
    default: return `#/${route.name}`
  }
}

export function navigate(route: Route, replace = false) {
  const target = href(route)
  if (replace) window.history.replaceState(null, '', target)
  else window.location.hash = target
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
