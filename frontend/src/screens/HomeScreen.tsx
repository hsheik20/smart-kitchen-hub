import { useState } from 'react'
import { Icon } from '../components/Icon'
import { UndoBanner } from '../components/UndoBanner'
import { Badge, Banner, Sheet } from '../components/ui'
import { href } from '../router'
import { useStore } from '../state'

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 11 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function HomeScreen() {
  const { inventory, groceries, prefs, catalog, resetDemo, notify } = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const toBuy = groceries.filter((g) => !g.purchased).length
  const available = inventory.filter((i) => i.availability === 'available').length
  const last = prefs.lastCooking
  return (
    <div className="screen-body home">
      <section className="home-hero">
        <p className="eyebrow">Smart Kitchen Hub</p>
        <h1>{greeting()}. What's cooking?</h1>
        <p className="subtitle">Pick what you have, see what you can make, and cook step by step.</p>
        <div className="home-status">
          <Badge tone="demo" icon="info">Demo mode</Badge>
          <Badge tone="neutral">Scanning is simulated</Badge>
          <Badge tone="neutral">Original sample recipes</Badge>
          {catalog.error
            ? <Badge tone="danger" icon="alert">Backend offline</Badge>
            : catalog.loading ? <Badge tone="neutral">Connecting…</Badge> : <Badge tone="olive" icon="check">Backend connected</Badge>}
        </div>
      </section>

      <div className="home-tiles">
        <a className="tile tile-primary" href={href({ name: 'scan' })}>
          <span className="tile-icon"><Icon name="scan" size={34} /></span>
          <span className="tile-text">
            <strong>Add ingredients</strong>
            <small>Simulated scan — you choose items and amounts</small>
          </span>
          <Icon name="right" className="tile-arrow" />
        </a>
        <a className="tile" href={href({ name: 'kitchen' })}>
          <span className="tile-icon"><Icon name="kitchen" size={34} /></span>
          <span className="tile-text">
            <strong>My Kitchen</strong>
            <small>{inventory.length === 0 ? 'Empty — add ingredients to start' : `${available} available · ${inventory.length} total`}</small>
          </span>
          <Icon name="right" className="tile-arrow" />
        </a>
        <a className="tile" href={href({ name: 'recipes' })}>
          <span className="tile-icon"><Icon name="book" size={34} /></span>
          <span className="tile-text">
            <strong>Find recipes</strong>
            <small>Matched to your kitchen, with shortages</small>
          </span>
          <Icon name="right" className="tile-arrow" />
        </a>
        <a className="tile" href={href({ name: 'grocery' })}>
          <span className="tile-icon"><Icon name="cart" size={34} /></span>
          <span className="tile-text">
            <strong>Grocery list</strong>
            <small>{groceries.length === 0 ? 'Empty — add items or recipe shortages' : `${toBuy} to buy · ${groceries.length - toBuy} purchased`}</small>
          </span>
          <Icon name="right" className="tile-arrow" />
        </a>
        {last ? (
          <a className="tile" href={href({ name: 'cook', id: last.recipeId, step: last.step })}>
            <span className="tile-icon"><Icon name="chef" size={34} /></span>
            <span className="tile-text">
              <strong>Continue cooking</strong>
              <small>{last.title} · step {last.step}</small>
            </span>
            <Icon name="right" className="tile-arrow" />
          </a>
        ) : (
          <a className="tile" href={href({ name: 'recipes' })}>
            <span className="tile-icon"><Icon name="chef" size={34} /></span>
            <span className="tile-text">
              <strong>Guided cooking</strong>
              <small>Choose a recipe, then cook one step at a time</small>
            </span>
            <Icon name="right" className="tile-arrow" />
          </a>
        )}
      </div>
      <UndoBanner />
      <div className="home-foot">
        <span className="muted">Demo data is stored only in this browser.</span>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}><Icon name="reset" size={20} /> Reset demo data</button>
      </div>
      {confirmReset && (
        <Sheet title="Reset demo data?" onClose={() => setConfirmReset(false)} footer={<>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={() => { resetDemo(); setConfirmReset(false); notify('Demo data cleared.') }}>
            <Icon name="trash" size={20} /> Clear everything
          </button>
        </>}>
          <p>This permanently clears, in this browser only:</p>
          <ul className="plain-list">
            <li>My Kitchen ({inventory.length} item{inventory.length === 1 ? '' : 's'})</li>
            <li>Grocery list ({groceries.length} item{groceries.length === 1 ? '' : 's'})</li>
            <li>The undo for your last cooking update, and your cooking position</li>
          </ul>
          <p className="muted">Display settings (servings, filters, device preview) are kept. Recipes are not affected.</p>
        </Sheet>
      )}
      {catalog.error && (
        <Banner tone="danger" icon="alert" title="Backend not reachable"
          action={<button type="button" className="btn btn-secondary" onClick={catalog.retry}>Retry</button>}>
          {catalog.error}
        </Banner>
      )}
    </div>
  )
}
