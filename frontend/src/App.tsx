import { useEffect, useRef, useState } from 'react'
import { DeviceFrame } from './components/DeviceFrame'
import { Icon } from './components/Icon'
import { NavRail } from './components/NavRail'
import { Banner } from './components/ui'
import { useRoute, type Route } from './router'
import { CookScreen } from './screens/CookScreen'
import { GroceryScreen } from './screens/GroceryScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { HomeScreen } from './screens/HomeScreen'
import { KitchenScreen } from './screens/KitchenScreen'
import { RecipeScreen } from './screens/RecipeScreen'
import { RecipesScreen } from './screens/RecipesScreen'
import { ScanScreen } from './screens/ScanScreen'
import { useStore } from './state'

const MIN_FRAME_WIDTH = 900

/** `?mode=kiosk` is how the Pi's browser launches the app: full screen, no bezel, no preview toggle. */
export const isKiosk = () => new URLSearchParams(window.location.search).get('mode') === 'kiosk'

function screenFor(route: Route) {
  switch (route.name) {
    case 'home': return <HomeScreen />
    case 'scan': return <ScanScreen />
    case 'kitchen': return <KitchenScreen />
    case 'recipes': return <RecipesScreen />
    case 'recipe': return <RecipeScreen key={route.id} id={route.id} />
    case 'cook': return <CookScreen key={route.id} id={route.id} step={route.step} />
    case 'grocery': return <GroceryScreen />
    case 'review': return <ReviewScreen key={route.id} id={route.id} />
  }
}

export function App() {
  const route = useRoute()
  const { prefs, setPrefs, storageNotice, dismissNotice, toast } = useStore()
  const kiosk = isKiosk()
  // The bezel only makes sense on a desktop-sized window; phones always get the normal layout.
  const [wide, setWide] = useState(() => window.innerWidth >= MIN_FRAME_WIDTH)
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= MIN_FRAME_WIDTH)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const framed = !kiosk && wide && prefs.devicePreview
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [route.name, route.name === 'recipe' ? route.id : ''])
  useEffect(() => { document.documentElement.dataset.display = kiosk ? 'kiosk' : framed ? 'framed' : 'browser' }, [kiosk, framed])

  const previewControl = kiosk || !wide ? undefined : (
    <button type="button" className="preview-btn" aria-pressed={framed} onClick={() => setPrefs({ devicePreview: !framed })}
      title={framed ? 'Return to normal browser view' : 'Show inside a simulated 1280×720 touchscreen'}>
      <Icon name="monitor" size={22} />
      <span>{framed ? 'Browser view' : 'Device preview'}</span>
    </button>
  )

  const app = (
    <div className="app">
      <div className="shell">
      <NavRail current={route} previewControl={previewControl} />
      <main className="main" ref={mainRef} id="main">
        {storageNotice && (
          <div className="notice-wrap">
            <Banner tone="warn" icon="alert" title="Demo data reset"
              action={<button type="button" className="btn btn-secondary" onClick={dismissNotice}>OK</button>}>{storageNotice}</Banner>
          </div>
        )}
        {screenFor(route)}
        {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      </main>
      </div>
    </div>
  )

  return framed ? <DeviceFrame onExit={() => setPrefs({ devicePreview: false })}>{app}</DeviceFrame> : <div className="viewport">{app}</div>
}
