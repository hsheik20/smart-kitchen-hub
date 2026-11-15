from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .data import RECIPES

app = FastAPI(title="Smart Kitchen Hub API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET"], allow_headers=["*"])

ALIASES = {"chicken breast":"chicken", "chicken breasts":"chicken", "sweet potatoes":"sweet potato", "courgette":"zucchini", "white rice":"rice", "olive oil":"oil"}

def normalize(value: str) -> str:
    v = " ".join(value.strip().lower().split())
    return ALIASES.get(v, v)

class RecipeResult(BaseModel):
    id: str
    title: str
    source: str
    source_url: Optional[str] = None
    author: Optional[str] = None
    servings: Optional[int] = None
    minutes: Optional[int] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    instruction_display_allowed: bool
    ingredients: list[str]
    steps: list[str]
    missing: list[str] = []
    matched: list[str] = []
    match_pct: int = 0

@app.get("/api/health")
def health():
    return {"status":"ok", "mode":"seed-demo", "vision_enabled":False}

@app.get("/api/recipes", response_model=list[RecipeResult])
def recipes(ingredients: str = "", max_minutes: Optional[int] = Query(default=None, ge=1, le=1440), servings: Optional[int] = Query(default=None, ge=1, le=30)):
    pantry = {normalize(x) for x in ingredients.split(",") if normalize(x)}
    out=[]
    for recipe in RECIPES:
        if max_minutes is not None and recipe["minutes"] is not None and recipe["minutes"] > max_minutes:
            continue
        needed={normalize(x) for x in recipe["ingredients"]}
        matched=sorted(needed & pantry)
        missing=sorted(needed - pantry)
        percentage=round(len(matched) / len(needed) * 100) if needed else 0
        out.append(RecipeResult(**recipe, matched=matched, missing=missing, match_pct=percentage))
    # Servings is informational in v0.1, not a filter or automatic quantity scaling.
    return sorted(out, key=lambda x:(-x.match_pct, len(x.missing), x.minutes or 9999, x.title))

@app.get("/api/recipes/{recipe_id}", response_model=RecipeResult)
def recipe_detail(recipe_id: str):
    recipe=next((r for r in RECIPES if r["id"]==recipe_id), None)
    if recipe is None: raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeResult(**recipe)
