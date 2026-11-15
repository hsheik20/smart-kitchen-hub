#!/usr/bin/env node
// Repeatable browser walkthrough of the demo journeys (no npm dependencies).
// Drives a locally installed Chrome/Chromium over the DevTools protocol using Node's built-in WebSocket.
//
// Prerequisites: backend on 127.0.0.1:8000 and `npm run dev` on 127.0.0.1:5173.
// Usage:  npm run walkthrough            (screenshots + report to <tmp>/skh-walkthrough)
//         node scripts/walkthrough.mjs --out ./some/dir
// Env:    CHROME_PATH=/path/to/chrome    BASE_URL=http://127.0.0.1:5173/
// Exit code is 1 if any check fails. Clears this app's localStorage in a throwaway browser profile only.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(tmpdir(), 'skh-walkthrough')
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
mkdirSync(OUT, { recursive: true })
const PROFILE = join(OUT, 'chrome-profile')
rmSync(PROFILE, { recursive: true, force: true })

try { await fetch(BASE) } catch { console.error(`Frontend not reachable at ${BASE}. Start the backend and \`npm run dev\` first.`); process.exit(2) }

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets = []
for (let i = 0; i < 50 && !targets.some((t) => t.type === 'page'); i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))

let seq = 0
const pending = new Map()
const problems = []
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text))
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push(`console.${m.params.type} ` + m.params.args.map((a) => a.value ?? a.description).join(' '))
  if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) {
    const e = m.params.entry
    // 409 from the deliberate undo-conflict check is expected.
    if (!(e.text.includes('409') && (e.url ?? '').includes('/api/deductions/undo'))) problems.push(`log.${e.level} ${e.text} ${e.url ?? ''}`)
  }
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++seq
  pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)))
  ws.send(JSON.stringify({ id: n, method, params }))
})
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).split('\n')[0])
  return r.result.value
}
const viewport = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
const shot = async (name) => {
  await sleep(350)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
}
const HELPERS = `window.__t = {
  all(s){ return [...document.querySelectorAll(s)] },
  q(s){ const e=document.querySelector(s); if(!e) throw new Error('missing '+s); return e },
  byText(text, sel='button,a', root=document){ const e=[...root.querySelectorAll(sel)].find(x=>x.textContent.replace(/\\s+/g,' ').trim().includes(text)); if(!e) throw new Error('not found: '+text+' in '+sel); return e },
  click(text, sel){ const e=this.byText(text, sel); if(e.disabled) throw new Error('disabled: '+text); e.click(); return true },
  set(el, v){ const p = el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p,'value').set.call(el,v); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})) },
  row(name){ const r=[...document.querySelectorAll('.verify-row')].find(x=>x.querySelector('strong').textContent.trim().toLowerCase()===name); if(!r) throw new Error('row '+name); return r },
  state(){ return JSON.parse(localStorage.getItem('skh.state')) },
  inv(name){ const i=this.state().inventory.find(x=>x.display_name.toLowerCase()===name); return i ? (i.availability==='out'?'OUT ':'')+(i.quantity.amount===null?'unknown':i.quantity.amount+' '+i.quantity.unit)+' '+i.quantity.accuracy : 'none' },
  overflow(){ const m=document.querySelector('.main'); return { page: m.scrollHeight>m.clientHeight+1 ? m.scrollHeight+'/'+m.clientHeight : 'fits', hscroll: document.documentElement.scrollWidth>innerWidth,
    inner: [...document.querySelectorAll('.scroll-y, .recipe-view.fit .panel, .cook-main, .cook-side, .sheet-body')].filter(e=>e.scrollHeight>e.clientHeight+1).map(e=>e.className.split(' ')[0]),
    clipped: [...document.querySelectorAll('.main *:not(.sr-only)')].filter(e=>e.scrollWidth>e.clientWidth+1 && getComputedStyle(e).overflowX!=='visible' && e.clientWidth>0).map(e=>e.className.split(' ')[0]||e.tagName),
    offscreen: [...document.querySelectorAll('.main button, .main a.btn')].filter(e=>{const r=e.getBoundingClientRect(), m=document.querySelector('.main').getBoundingClientRect(); return r.width>0 && (r.right>m.right+1 || r.left<m.left-1)}).map(e=>e.textContent.trim().slice(0,20)) } },
  small(){ return [...document.querySelectorAll('button, a.btn, input:not([type=checkbox]), select, .nav a')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && r.height<44}).map(e=>(e.getAttribute('aria-label')||e.textContent.trim()||e.tagName).slice(0,30)+':'+Math.round(e.getBoundingClientRect().height)) },
}`
const load = async (path = '', reload = true) => {
  await send('Page.navigate', { url: BASE + path }); await sleep(300)
  if (reload) { await send('Page.reload', { ignoreCache: true }) }
  await sleep(1100); await ev(HELPERS)
}
const hash = async (h) => { await ev(`location.hash=${JSON.stringify(h)}`); await sleep(800) }

const log = []
let failures = 0
const check = async (label, fn, expect) => {
  try {
    const v = await fn()
    if (expect && !expect(v)) { failures++; log.push(`FAIL ${label} → ${JSON.stringify(v)}`) } else log.push(`PASS ${label}${v !== undefined ? ' → ' + JSON.stringify(v) : ''}`)
  } catch (e) { failures++; log.push(`FAIL ${label}: ${e.message}`) }
}
const layout = {}
const measure = async (name) => {
  const o = await ev('__t.overflow()')
  layout[name] = o
  if (o.hscroll || o.clipped.length || o.offscreen.length) { failures++; log.push(`FAIL layout ${name}: horizontal overflow ${JSON.stringify(o)}`) }
}

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable')
await viewport(1280, 720)
await load(''); await ev('localStorage.clear()'); await load('')

// ---------------------------------------------------------------- 1. scan → kitchen
await check('home: demo labels', () => ev(`__t.all('.home-status .badge').map(b=>b.textContent).join(', ')`), (v) => v.includes('Scanning is simulated'))
await check('touch targets ≥44px on home', () => ev('__t.small()'), (v) => v.length === 0)
await shot('01-home'); await measure('home')
await hash('#/scan')
await check('scan: simulated banner', () => ev(`__t.q('.banner-demo').textContent`), (v) => v.includes('SIMULATED SCAN'))
await check('scan: choose + verify + save', async () => {
  await ev(`__t.click('Load sample suggestions')`)
  for (const t of ['Olive Oil', 'tofu']) { await ev(`__t.set(__t.q('#typed'), ${JSON.stringify(t)})`); await sleep(80); await ev(`__t.click('Add','form button')`); await sleep(120) }
  await ev(`__t.click('Next: verify amounts')`); await sleep(250)
  const fill = async (name, acc, amount, unit) => {
    await ev(`__t.byText(${JSON.stringify(acc)}, '.segmented button', __t.row(${JSON.stringify(name)})).click()`); await sleep(60)
    if (amount) { await ev(`__t.set(__t.row(${JSON.stringify(name)}).querySelector('input'), ${JSON.stringify(amount)})`); await ev(`__t.set(__t.row(${JSON.stringify(name)}).querySelector('select'), ${JSON.stringify(unit)})`) }
  }
  await fill('chicken', 'Exact', '250', 'g'); await fill('zucchini', 'Exact', '2', 'each'); await fill('sweet potato', 'Unknown')
  await fill('rice', 'Estimate', '1', 'kg'); await fill('oil', 'Exact', '500', 'ml'); await fill('tofu', 'Exact', '1', 'package')
  await shot('02-scan-verify'); await measure('scan-verify')
  await ev(`__t.click('Save','.action-bar button')`); await sleep(300)
  return ev(`__t.state().inventory.length`)
}, (v) => v === 6)
await check('unknown amount saved as null', () => ev(`__t.inv('sweet potato')`), (v) => v === 'unknown unknown')
await check('persistence after refresh', async () => { await load('#/kitchen'); return ev(`__t.all('.inv-card').length`) }, (v) => v === 6)
await shot('03-kitchen'); await measure('kitchen')

// ---------------------------------------------------------------- 2. recipe shortage → grocery
await hash('#/recipes'); await sleep(500)
await check('recipe card adds missing items to grocery list', async () => {
  await ev(`__t.q('[aria-label*="for Sweet Potato Skillet"]').click()`); await sleep(700)
  return ev(`__t.state().groceries.map(g=>g.display_name+'='+(g.quantity.display_text||g.quantity.amount))`)
}, (v) => v.join() === 'onion=1 small,salt=1/4 tsp')
await check('grocery wording keeps recipe text', async () => { await hash('#/grocery'); const t = await ev(`__t.all('.grocery-qty').map(e=>e.textContent)`); await hash('#/recipes'); return t }, (v) => v.join() === '1 small,1/4 tsp')
await shot('04-recipes-toast'); await measure('recipes')
await measure('recipe-view')
await check('recipe view: shortage keeps backend shortfall; unknown dup skipped', async () => {
  await hash('#/recipe/chicken-rice-bowl'); await sleep(600)
  await ev(`__t.click('missing to grocery list')`); await sleep(700)
  return [await ev(`__t.q('.toast').textContent`), await ev(`(()=>{const g=__t.state().groceries.find(x=>x.ingredient_id==='chicken'); return g.quantity.amount+' '+g.quantity.unit+' '+g.source})()`)]
}, (v) => v[1] === '50 g recipe_shortfall' && v[0].includes('Already on the list: salt'))
await hash('#/grocery')
const addManual = async (name, acc, amount, unit) => {
  await ev(`__t.click('Add item','.header-actions button')`); await sleep(250)
  await ev(`__t.set(__t.q('#grocery-name'), ${JSON.stringify(name)})`); await sleep(80)
  await ev(`__t.byText(${JSON.stringify(acc)}, '.sheet .segmented button').click()`); await sleep(60)
  if (amount) { await ev(`__t.set(__t.q('.sheet .qty-fields input'), ${JSON.stringify(amount)})`); await ev(`__t.set(__t.q('.sheet .qty-fields select'), ${JSON.stringify(unit)})`) }
  await ev(`__t.click('Save','.sheet-foot button')`); await sleep(700)
}
await check('manual add combines compatible duplicate (50 g + 1 lb)', async () => {
  await addManual('Chicken', 'Exact', '1', 'lb')
  return ev(`__t.state().groceries.filter(g=>g.ingredient_id==='chicken').map(g=>g.quantity.amount+' '+g.quantity.unit)`)
}, (v) => v.join() === '503.592 g')
await check('incompatible duplicate kept separate, not merged', async () => {
  await addManual('chicken', 'Exact', '2', 'each')
  return ev(`__t.state().groceries.filter(g=>g.ingredient_id==='chicken').map(g=>g.quantity.amount+' '+g.quantity.unit+' | '+(g.note||''))`)
}, (v) => v.length === 2 && v[1].includes('Kept separate'))
await check('edit → remove grocery item with confirmation', async () => {
  await ev(`__t.all('[aria-label="Edit chicken"]').pop().click()`); await sleep(250)
  await ev(`__t.click('Remove','.sheet-foot button')`); await sleep(100)
  await ev(`__t.click('Confirm remove','.sheet-foot button')`); await sleep(300)
  return ev(`__t.state().groceries.filter(g=>g.ingredient_id==='chicken').length`)
}, (v) => v === 1)
await check('manual add rice 2 cups (incompatible with kitchen grams)', async () => { await addManual('rice', 'Exact', '2', 'cup'); return ev(`__t.state().groceries.length`) }, (v) => v === 4)
await shot('05-grocery'); await measure('grocery')
await check('touch targets ≥44px on grocery', () => ev('__t.small()'), (v) => v.length === 0)
await check('mark purchased does NOT change inventory', async () => {
  const before = await ev(`JSON.stringify(__t.state().inventory)`)
  for (const n of ['onion', 'boneless chicken breast', 'rice']) { await ev(`__t.q('[aria-label="Mark purchased: ${n}"]').click()`); await sleep(120) }
  return [await ev(`__t.state().groceries.filter(g=>g.purchased).length`), before === await ev(`JSON.stringify(__t.state().inventory)`)]
}, (v) => v[0] === 3 && v[1] === true)
await check('purchased state persists after refresh', async () => { await load('#/grocery'); return ev(`__t.all('.grocery-row.is-bought').length`) }, (v) => v === 3)
await shot('06-grocery-purchased')
await check('move to My Kitchen: review shows add / new / conflict', async () => {
  await ev(`__t.click('Move to My Kitchen')`); await sleep(300)
  await shot('07-move-step1')
  await ev(`__t.click('Review','.sheet-foot button')`); await sleep(700)
  await shot('08-move-step2')
  return ev(`__t.all('.move-list li').map(li=>li.textContent.replace(/\\s+/g,' ').trim().slice(0,80))`)
}, (v) => v.some((t) => t.includes('253.592 g') === false && t.includes('753.592 g')) && v.some((t) => t.includes('New in My Kitchen')) && v.some((t) => t.includes("Units can't be combined")))
await check('confirm move: kitchen updated, conflict kept kitchen amount, list cleared', async () => {
  await ev(`__t.click('Move 3 to My Kitchen','.sheet-foot button')`); await sleep(400)
  return [await ev(`__t.inv('chicken')`), await ev(`__t.inv('onion')`), await ev(`__t.inv('rice')`), await ev(`__t.state().groceries.length`)]
}, (v) => v[0] === '753.592 g exact' && v[1] === '1 each exact' && v[2] === '1 kg estimated' && v[3] === 1)

// ---------------------------------------------------------------- 3. cook → review → confirm → undo
await check('guided cooking to finish offers review', async () => {
  await hash('#/cook/chicken-rice-bowl/1'); await sleep(600)
  for (let i = 0; i < 4; i++) { await ev(`__t.q('.cook-nav .btn-primary').click()`); await sleep(250) }
  return ev(`__t.q('.cook-done').textContent`)
}, (v) => v.includes('Review inventory usage'))
await shot('09-cook-done')
await check('review: deductible vs not deductible', async () => {
  await ev(`__t.click('Review inventory usage')`); await sleep(1000)
  return { will: await ev(`__t.all('.review-panel:first-child .review-text strong').map(e=>e.textContent)`), wont: await ev(`__t.all('.review-panel:last-child li').map(e=>e.textContent.replace(/\\s+/g,' ').slice(0,60))`) }
}, (v) => v.will.length === 4 && v.wont.length === 1 && v.wont[0].startsWith('salt') && v.wont[0].includes('Not in My Kitchen'))
await shot('10-review'); await measure('review')
await check('touch targets ≥44px on review', () => ev('__t.small()'), (v) => v.length === 0)
await check('nothing changes before confirm', () => ev(`__t.inv('chicken')`), (v) => v === '753.592 g exact')
await check('confirm with oil unticked', async () => {
  await ev(`__t.q('[aria-label="Deduct cooking oil"]').click()`); await sleep(100)
  await ev(`__t.click('Update My Kitchen','.action-bar button')`); await sleep(900)
  return [await ev(`__t.inv('chicken')`), await ev(`__t.inv('rice')`), await ev(`__t.inv('zucchini')`), await ev(`__t.inv('oil')`), await ev(`__t.inv('sweet potato')`)]
}, (v) => v.join('|') === '453.592 g exact|0.85 kg estimated|1 each exact|500 ml exact|unknown unknown')
await shot('11-review-done')
await check('undo survives refresh and restores exactly', async () => {
  await load('#/kitchen')
  const banner = await ev(`__t.q('.banner-info').textContent`)
  await ev(`__t.click('Undo','.banner button')`); await sleep(800)
  return [banner.includes('Updated after cooking'), await ev(`__t.inv('chicken')`), await ev(`__t.inv('rice')`), await ev(`__t.inv('zucchini')`), await ev(`__t.state().lastDeduction`)]
}, (v) => v[0] && v[1] === '753.592 g exact' && v[2] === '1 kg estimated' && v[3] === '2 each exact' && v[4] === null)
await check('insufficient stock → used up (unknown, never negative); undo refused after later edit', async () => {
  // Cook for 12 servings: needs 1800 g chicken; kitchen has 753.592 g.
  await ev(`(()=>{const s=__t.state(); s.prefs.servings=12; localStorage.setItem('skh.state', JSON.stringify(s))})()`)
  await load('#/review/chicken-rice-bowl')
  const warn = await ev(`__t.q('.review-panel').textContent`)
  await ev(`__t.click('Update My Kitchen','.action-bar button')`); await sleep(900)
  const after = await ev(`__t.inv('chicken')`)
  await hash('#/kitchen'); await sleep(400)
  await ev(`__t.q('[aria-label="Edit zucchini"]').click()`); await sleep(250)
  await ev(`__t.byText('Have it','.sheet .segmented button').click()`); await ev(`__t.byText('Exact','.sheet .qty-editor .segmented button').click()`)
  await ev(`__t.set(__t.q('.sheet .qty-fields input'),'5')`); await ev(`__t.set(__t.q('.sheet .qty-fields select'),'each')`)
  await ev(`__t.click('Save','.sheet-foot button')`); await sleep(400)
  await ev(`__t.click('Undo','.banner button')`); await sleep(800)
  const msg = await ev(`__t.q('.banner-warn').textContent`)
  await ev(`__t.click('Dismiss','.banner button')`); await sleep(200)
  return [warn.includes('Used up'), after, msg.includes('zucchini (changed since cooking)'), await ev(`__t.state().lastDeduction`)]
}, (v) => v[0] && v[1] === 'OUT unknown unknown' && v[2] && v[3] === null)
await ev(`(()=>{const s=__t.state(); s.prefs.servings=2; localStorage.setItem('skh.state', JSON.stringify(s))})()`)

// ---------------------------------------------------------------- 4. display modes
await load('#/review/chicken-rice-bowl')
await viewport(1600, 960)
await check('device preview toggles on', async () => { await ev(`__t.click('Device preview')`); await sleep(600); return ev(`document.documentElement.dataset.display`) }, (v) => v === 'framed')
await shot('12-framed-review')
await hash('#/grocery'); await shot('13-framed-grocery')
await viewport(1280, 720)
await load('?mode=kiosk#/grocery')
await check('kiosk: no bezel or toggle', () => ev(`[document.documentElement.dataset.display, !!document.querySelector('.bezel'), !!document.querySelector('.preview-btn')]`), (v) => v.join() === 'kiosk,false,false')
await shot('14-kiosk-grocery'); await measure('kiosk-grocery')
await viewport(390, 844, true)
await load('#/grocery'); await shot('15-phone-grocery'); await measure('phone-grocery')
await load('#/review/chicken-rice-bowl'); await shot('16-phone-review'); await measure('phone-review')
await load('#/'); await shot('17-phone-home')
await viewport(1280, 720)

// ---------------------------------------------------------------- 5. reset + storage migration
await load('#/')
await shot('18-home-with-data'); await measure('home-with-data')
await check('reset demo data (with confirmation)', async () => {
  await ev(`__t.click('Reset demo data')`); await sleep(250)
  await shot('19-reset-confirm')
  await ev(`__t.click('Clear everything','.sheet-foot button')`); await sleep(300)
  const s = await ev('__t.state()')
  return [s.inventory.length, s.groceries.length, s.lastDeduction, s.prefs.devicePreview]
}, (v) => v[0] === 0 && v[1] === 0 && v[2] === null && v[3] === true)
await check('v1 storage migrates (inventory kept, empty grocery list)', async () => {
  await ev(`localStorage.setItem('skh.state', JSON.stringify({version:1, inventory:[{id:'a',ingredient_id:'rice',display_name:'rice',availability:'available',quantity:{amount:'1',unit:'kg',accuracy:'exact'},low_stock_threshold:null,created_at:'x',updated_at:'x'}], prefs:{servings:3}}))`)
  await load('#/kitchen')
  const s = await ev('__t.state()')
  return [s.version, s.inventory.length, s.groceries.length, s.prefs.servings]
}, (v) => v[0] === 2 && v[1] === 1 && v[2] === 0 && v[3] === 3)

log.push('', 'LAYOUT (page = .main overflow; inner = regions that scroll inside their panel):', ...Object.entries(layout).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`))
log.push('', 'CONSOLE / EXCEPTIONS:', ...(problems.length ? problems : ['  none']))
log.push('', `${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} · screenshots in ${OUT}`)
writeFileSync(join(OUT, 'report.txt'), log.join('\n'))
console.log(log.join('\n'))
ws.close(); chrome.kill(); await sleep(500)
try { rmSync(PROFILE, { recursive: true, force: true }) } catch { /* Chrome may still hold files */ }
process.exit(failures || problems.length ? 1 : 0)
