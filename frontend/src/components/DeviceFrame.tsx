// Desktop presentation mode: renders the app at exactly 1280×720 inside a simulated
// touchscreen bezel, scaled down to fit the browser window. Not used in kiosk mode.
import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

export const SCREEN_W = 1280
export const SCREEN_H = 720
const BEZEL = 34
const TOOLBAR = 64
const MARGIN = 24

function fitScale() {
  const w = (window.innerWidth - MARGIN * 2) / (SCREEN_W + BEZEL * 2)
  const h = (window.innerHeight - MARGIN * 2 - TOOLBAR) / (SCREEN_H + BEZEL * 2)
  return Math.min(1, w, h)
}

export function DeviceFrame({ children, onExit }: { children: ReactNode; onExit: () => void }) {
  const [scale, setScale] = useState(fitScale)
  useEffect(() => {
    const onResize = () => setScale(fitScale())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const outerW = (SCREEN_W + BEZEL * 2) * scale
  const outerH = (SCREEN_H + BEZEL * 2) * scale
  return (
    <div className="stage">
      <div className="stage-bar">
        <span><Icon name="monitor" size={20} /> Device preview · simulated 1280×720 touchscreen{scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ''}</span>
        <button type="button" className="btn btn-ghost-light" onClick={onExit}>Exit device preview</button>
      </div>
      <div style={{ width: outerW, height: outerH }}>
        <div className="bezel" style={{ transform: `scale(${scale})`, padding: BEZEL }}>
          <div className="screen" style={{ width: SCREEN_W, height: SCREEN_H }}>{children}</div>
          <span className="bezel-cam" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
