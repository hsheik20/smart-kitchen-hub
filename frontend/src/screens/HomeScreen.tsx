import { Icon } from '../components/Icon'
import { Badge, Banner } from '../components/ui'
import { href } from '../router'
import { useStore } from '../state'

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 11 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function HomeScreen() {
  const { inventory, prefs, catalog } = useStore()
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
      {catalog.error && (
        <Banner tone="danger" icon="alert" title="Backend not reachable"
          action={<button type="button" className="btn btn-secondary" onClick={catalog.retry}>Retry</button>}>
          {catalog.error}
        </Banner>
      )}
    </div>
  )
}
