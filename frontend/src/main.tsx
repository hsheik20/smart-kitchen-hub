import React, {useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'

type Recipe={id:string,title:string,source:string,source_url:string|null,ingredients:string[],matched:string[],missing:string[],match_pct:number,minutes:number|null,servings:number|null,rating:number|null,review_count:number|null,steps:string[],instruction_display_allowed:boolean}
const options=['chicken','zucchini','sweet potato','rice','garlic','onion','oil','salt']
function App(){
 const [pantry,setPantry]=useState<string[]>(['chicken','zucchini','sweet potato','rice'])
 const [recipes,setRecipes]=useState<Recipe[]>([])
 const [detail,setDetail]=useState<Recipe|null>(null)
 const [step,setStep]=useState(0)
 const [maxTime,setMaxTime]=useState('')
 const [servings,setServings]=useState('2')
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 async function findRecipes(){
   setError('');setLoading(true);setDetail(null)
   try{
     const query=new URLSearchParams({ingredients:pantry.join(','),servings})
     if(maxTime) query.set('max_minutes',maxTime)
     const response=await fetch('/api/recipes?'+query.toString())
     if(!response.ok)throw new Error('Recipe API returned '+response.status)
     setRecipes(await response.json())
   }catch(e){setError('Cannot reach the backend. Start FastAPI on port 8000. '+String(e))}
   finally{setLoading(false)}
 }
 useEffect(()=>{void findRecipes()},[])
 const toggle=(x:string)=>setPantry(a=>a.includes(x)?a.filter(v=>v!==x):[...a,x])
 return <main><header><div className="eyebrow">TCSS 490 · Artifact 5</div><h1>Smart Kitchen Hub</h1><p>From ingredients to dinner.</p><div className="warning">SIMULATION MODE · Ingredient selections are manual. No camera or AI scan is connected yet.</div></header>
 <section className="panel"><h2>1. Confirm your ingredients</h2><p>For this Week 1 demo, pretend the camera suggested these ingredients. Select what you actually have.</p><div className="chips">{options.map(x=><button className={pantry.includes(x)?'selected':''} key={x} onClick={()=>toggle(x)} aria-pressed={pantry.includes(x)}>{pantry.includes(x)?'✓ ': '+ '}{x}</button>)}</div>
 <div className="filters"><label>Maximum cook time (min)<input type="number" min="1" placeholder="Any" value={maxTime} onChange={e=>setMaxTime(e.target.value)}/></label><label>Desired servings <input type="number" min="1" max="30" value={servings} onChange={e=>setServings(e.target.value)}/></label></div>
 <p className="note">Serving count is saved as a request preference in this demo; recipes are not yet scaled or filtered by servings.</p><button className="primary" onClick={findRecipes} disabled={loading||!servings||Number(servings)<1}>{loading?'Loading…':'2. Find matching recipes →'}</button>{error&&<p className="error">{error}</p>}</section>
 {!detail?<section className="panel"><h2>Recipe matches</h2><p className="note">Original demonstration recipes only. No external provider ratings are available.</p>{recipes.length===0?<p>No results yet. Try a different time limit or start the backend.</p>:<div className="recipegrid">{recipes.map(r=><article key={r.id} className="recipe"><div className="score">{r.match_pct}% ingredient match</div><h3>{r.title}</h3><p>{r.minutes??'Unknown'} min · Recipe for {r.servings??'?'} · {r.source}</p><p><strong>Missing:</strong> {r.missing.length?r.missing.join(', '):'Nothing'}</p><p className="note">Rating: unavailable</p><button onClick={()=>{setDetail(r);setStep(0)}}>3. Start cooking →</button></article>)}</div>}</section>:<section className="panel"><button className="back" onClick={()=>setDetail(null)}>← Back to recommendations</button><h2>{detail.title}</h2><p>{detail.source} · {detail.minutes} min · Recipe for {detail.servings}</p><p><strong>Ingredients:</strong> {detail.ingredients.join(', ')}</p>{detail.instruction_display_allowed?<div className="guide"><div className="eyebrow">COOKING MODE · STEP {step+1} OF {detail.steps.length}</div><h3>{detail.steps[step]}</h3><p className="note">Use a food thermometer for food safety. Demonstration instructions only.</p><div className="buttons"><button disabled={step===0} onClick={()=>setStep(n=>n-1)}>← Previous</button><button disabled={step===detail.steps.length-1} onClick={()=>setStep(n=>n+1)}>Next step →</button></div></div>:<p>Instructions are unavailable in-app. Open the original publisher's recipe.</p>}</section>}
 <footer>Prototype v0.1 · No physical scanning or live recipe discovery yet · <a href="https://www.raspberrypi.com/documentation/accessories/camera-software.html">Planned camera setup</a></footer></main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
