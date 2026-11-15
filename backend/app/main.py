from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .catalog import BY_ID, INGREDIENTS, clean_text, lookup_id
from .data import RECIPES, RECIPES_BY_ID
from .deductions import preview_deduction
from .inventory import InventoryInputError
from .matching import match_recipes
from .models import (
    DeductionPreviewRequest,
    DeductionProposal,
    Ingredient,
    MatchRequest,
    MatchResponse,
    Recipe,
    StockStatus,
    StockStatusRequest,
    UnitInfo,
)
from .stock import stock_statuses
from .units import UNITS

app = FastAPI(title="Smart Kitchen Hub API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET"], allow_headers=["*"])


def normalize(value: str) -> str:
    """Legacy name normalization: catalog name if known, otherwise cleaned text."""
    v = clean_text(value)
    ing_id = lookup_id(v)
    return BY_ID[ing_id].name if ing_id else v


# ------------------------------------------------------------ legacy contract
class RecipeResult(BaseModel):
    """Flat v0.1 response shape still used by the frontend (ADR-016).

    Derived from the structured `Recipe`; `ingredients` lists required
    ingredient names only (optional ones are omitted so presence matching is
    unchanged).
    """

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


def _legacy_names(recipe: Recipe) -> list[str]:
    return [BY_ID[i.ingredient_id].name if i.ingredient_id else clean_text(i.display_name)
            for i in recipe.ingredients if not i.optional]


def to_legacy(recipe: Recipe, **extra) -> RecipeResult:
    return RecipeResult(
        id=recipe.id,
        title=recipe.title,
        source=recipe.source.name,
        source_url=str(recipe.source.url) if recipe.source.url else None,
        author=recipe.source.author,
        servings=recipe.servings,
        minutes=recipe.total_minutes,
        rating=recipe.rating.value if recipe.rating else None,
        review_count=recipe.rating.review_count if recipe.rating else None,
        instruction_display_allowed=recipe.source.instruction_display_allowed,
        ingredients=_legacy_names(recipe),
        steps=[s.text for s in recipe.steps],
        **extra,
    )


@app.get("/api/health")
def health():
    return {"status":"ok", "mode":"seed-demo", "vision_enabled":False}


@app.get("/api/recipes", response_model=list[RecipeResult])
def recipes(ingredients: str = "", max_minutes: Optional[int] = Query(default=None, ge=1, le=1440), servings: Optional[int] = Query(default=None, ge=1, le=30)):
    pantry = {normalize(x) for x in ingredients.split(",") if normalize(x)}
    out=[]
    for recipe in RECIPES:
        if max_minutes is not None and recipe.total_minutes is not None and recipe.total_minutes > max_minutes:
            continue
        needed=set(_legacy_names(recipe))
        matched=sorted(needed & pantry)
        missing=sorted(needed - pantry)
        percentage=round(len(matched) / len(needed) * 100) if needed else 0
        out.append(to_legacy(recipe, matched=matched, missing=missing, match_pct=percentage))
    # Servings is informational on this legacy endpoint; POST /api/recipes/match scales quantities.
    return sorted(out, key=lambda x:(-x.match_pct, len(x.missing), x.minutes or 9999, x.title))


@app.get("/api/recipes/{recipe_id}", response_model=RecipeResult)
def recipe_detail(recipe_id: str):
    recipe = RECIPES_BY_ID.get(recipe_id)
    if recipe is None: raise HTTPException(status_code=404, detail="Recipe not found")
    return to_legacy(recipe)


# ------------------------------------------------------------- new endpoints
@app.get("/api/recipes/{recipe_id}/full", response_model=Recipe)
def recipe_full(recipe_id: str):
    """Complete structured recipe (quantities, steps, notes, substitutions, cautions, source)."""
    recipe = RECIPES_BY_ID.get(recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@app.get("/api/units", response_model=list[UnitInfo])
def units():
    """Canonical unit codes accepted in quantities, with their dimension."""
    return [UnitInfo(code=code, dimension=dim.value) for code, (dim, _) in UNITS.items()]


@app.post("/api/inventory/stock-status", response_model=list[StockStatus])
def inventory_stock_status(request: StockStatusRequest):
    """Derived low-stock status for client-supplied inventory; stores nothing."""
    return stock_statuses(request.inventory)


@app.get("/api/ingredients", response_model=list[Ingredient])
def ingredients():
    """Ingredient catalog (small, fixed list covering the sample recipes)."""
    return sorted(INGREDIENTS, key=lambda i: i.name)


@app.post("/api/recipes/match", response_model=MatchResponse)
def match(request: MatchRequest):
    try:
        return match_recipes(RECIPES, request)
    except InventoryInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


@app.post("/api/deductions/preview", response_model=DeductionProposal)
def deductions_preview(request: DeductionPreviewRequest):
    """Preview only: computes proposed deductions and writes nothing."""
    recipe = RECIPES_BY_ID.get(request.recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    try:
        return preview_deduction(recipe, request.inventory, request.servings_cooked)
    except InventoryInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
