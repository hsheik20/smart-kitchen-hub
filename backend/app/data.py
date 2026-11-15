"""ORIGINAL SAMPLE DATA — demonstration recipes written for this student project.

These four recipes are not scraped, copied, or adapted from any published
source. Quantities, notes, and substitutions were added on Nov 14, 2026 with
AI assistance (Claude Code) and are illustrative sample values pending owner
review; they have not been kitchen-tested. No ratings or reviews exist for
them, so `rating` is always None.

Raw dicts are validated into `Recipe` models at import time by `load_recipes`,
which also checks every ingredient_id against the catalog.
"""
from __future__ import annotations

from typing import Any

from .catalog import is_known_id
from .models import Recipe

SAMPLE_SOURCE: dict[str, Any] = {
    "provider": "seed",
    "name": "Smart Kitchen Hub original sample recipe",
    "url": None,
    "author": "Smart Kitchen Hub project (sample data)",
    "license_note": (
        "Original sample data written for this TCSS 490 student project. Not scraped "
        "or adapted from a published recipe. Quantities are illustrative and not kitchen-tested."
    ),
    "instruction_display_allowed": True,
    "is_sample_data": True,
}

CHICKEN_SAFETY = "Cook chicken to an internal temperature of 165°F (74°C), checked with a food thermometer."
BOARD_SAFETY = "Use a separate cutting board and knife for raw chicken, and wash hands after handling it."
LEFTOVER_SAFETY = "Refrigerate leftovers within 2 hours of cooking."


def _q(amount: str | None, unit: str | None, text: str, accuracy: str = "exact") -> dict[str, Any]:
    if amount is None:
        return {"amount": None, "unit": None, "accuracy": "unknown", "display_text": text}
    return {"amount": amount, "unit": unit, "accuracy": accuracy, "display_text": text}


RAW_RECIPES: list[dict[str, Any]] = [
    {
        "id": "chicken-rice-bowl",
        "title": "Simple Chicken & Vegetable Rice Bowl",
        "source": SAMPLE_SOURCE,
        "servings": 2, "prep_minutes": 10, "cook_minutes": 25, "total_minutes": 35,
        "ingredients": [
            {"ingredient_id": "chicken", "display_name": "boneless chicken breast", "quantity": _q("300", "g", "300 g"),
             "preparation": "cut into bite-size pieces",
             "substitutions": [{"replacement": "boneless chicken thigh", "ingredient_id": "chicken", "note": "Same 165°F (74°C) target; may need a few more minutes."}]},
            {"ingredient_id": "rice", "display_name": "long-grain white rice", "quantity": _q("150", "g", "150 g, uncooked"),
             "substitutions": [{"replacement": "brown rice", "ingredient_id": None, "note": "Takes longer to cook; follow its package directions."}]},
            {"ingredient_id": "zucchini", "display_name": "zucchini", "quantity": _q("1", "each", "1 medium"),
             "preparation": "sliced into half-moons",
             "substitutions": [{"replacement": "yellow squash", "ingredient_id": None, "note": None}]},
            {"ingredient_id": "oil", "display_name": "cooking oil", "quantity": _q("1", "tbsp", "1 tbsp")},
            {"ingredient_id": "salt", "display_name": "salt", "quantity": _q(None, None, "to taste")},
        ],
        "steps": [
            {"number": 1, "text": "Cook the rice according to its package directions.", "ingredient_refs": ["rice"]},
            {"number": 2, "text": "Slice the zucchini, then cut the chicken on a separate cutting board.", "ingredient_refs": ["zucchini", "chicken"],
             "safety_note": BOARD_SAFETY},
            {"number": 3, "text": "Heat the oil in a skillet over medium-high heat and cook the chicken, turning occasionally, until no longer pink. Move it to a plate, then cook the zucchini in the same pan until tender.",
             "ingredient_refs": ["oil", "chicken", "zucchini"]},
            {"number": 4, "text": "Confirm the chicken has reached 165°F (74°C), season with salt, and serve over the rice.",
             "ingredient_refs": ["chicken", "salt", "rice"], "safety_note": CHICKEN_SAFETY},
        ],
        "notes": ["Sample recipe: quantities are illustrative and have not been kitchen-tested."],
        "safety_cautions": [CHICKEN_SAFETY, BOARD_SAFETY, LEFTOVER_SAFETY],
        "tags": ["dairy-free", "gluten-free"],
        "rating": None,
    },
    {
        "id": "sheet-pan-chicken",
        "title": "Sheet-Pan Chicken and Sweet Potato",
        "source": SAMPLE_SOURCE,
        "servings": 2, "prep_minutes": 15, "cook_minutes": 30, "total_minutes": 45,
        "ingredients": [
            {"ingredient_id": "chicken", "display_name": "boneless chicken breast", "quantity": _q("300", "g", "300 g"),
             "preparation": "cut into 1-inch pieces",
             "substitutions": [{"replacement": "boneless chicken thigh", "ingredient_id": "chicken", "note": "Same 165°F (74°C) target."}]},
            {"ingredient_id": "sweet-potato", "display_name": "sweet potato", "quantity": _q("1", "each", "1 large"),
             "preparation": "cut into 3/4-inch cubes"},
            {"ingredient_id": "zucchini", "display_name": "zucchini", "quantity": _q("1", "each", "1 medium"),
             "preparation": "cut into thick half-moons"},
            {"ingredient_id": "oil", "display_name": "cooking oil", "quantity": _q("2", "tbsp", "2 tbsp")},
            {"ingredient_id": "salt", "display_name": "salt", "quantity": _q("0.5", "tsp", "1/2 tsp")},
            {"ingredient_id": "black-pepper", "display_name": "ground black pepper", "quantity": _q("0.25", "tsp", "1/4 tsp"), "optional": True},
        ],
        "steps": [
            {"number": 1, "text": "Preheat the oven to 400°F (204°C)."},
            {"number": 2, "text": "Cut the sweet potato into small, even cubes and slice the zucchini.", "ingredient_refs": ["sweet-potato", "zucchini"]},
            {"number": 3, "text": "On a separate board, cut the chicken. Toss everything on a sheet pan with the oil, salt, and pepper (if using), spread in one layer.",
             "ingredient_refs": ["chicken", "oil", "salt", "black-pepper"], "safety_note": BOARD_SAFETY},
            {"number": 4, "text": "Roast about 25–30 minutes, stirring once, until the sweet potato is tender and the chicken is cooked through.",
             "ingredient_refs": ["sweet-potato", "chicken"]},
            {"number": 5, "text": "Check that the chicken has reached 165°F (74°C) before serving.", "ingredient_refs": ["chicken"],
             "safety_note": CHICKEN_SAFETY},
        ],
        "notes": [
            "Sample recipe: quantities are illustrative and have not been kitchen-tested.",
            "Even-sized pieces help the sweet potato and chicken finish at the same time.",
        ],
        "safety_cautions": [CHICKEN_SAFETY, BOARD_SAFETY, "Use oven mitts; the sheet pan will be very hot.", LEFTOVER_SAFETY],
        "tags": ["dairy-free", "gluten-free"],
        "rating": None,
    },
    {
        "id": "zucchini-rice",
        "title": "Garlic Zucchini Rice",
        "source": SAMPLE_SOURCE,
        "servings": 2, "prep_minutes": 5, "cook_minutes": 20, "total_minutes": 25,
        "ingredients": [
            {"ingredient_id": "rice", "display_name": "long-grain white rice", "quantity": _q("150", "g", "150 g, uncooked")},
            {"ingredient_id": "zucchini", "display_name": "zucchini", "quantity": _q("2", "each", "2 medium"), "preparation": "sliced"},
            {"ingredient_id": "garlic", "display_name": "garlic", "quantity": _q("2", "clove", "2 cloves"), "preparation": "minced"},
            {"ingredient_id": "oil", "display_name": "cooking oil", "quantity": _q("1", "tbsp", "1 tbsp")},
            {"ingredient_id": "salt", "display_name": "salt", "quantity": _q(None, None, "to taste")},
        ],
        "steps": [
            {"number": 1, "text": "Cook the rice according to its package directions.", "ingredient_refs": ["rice"]},
            {"number": 2, "text": "Slice the zucchini and mince the garlic.", "ingredient_refs": ["zucchini", "garlic"]},
            {"number": 3, "text": "Sauté the zucchini in the oil until tender. Add the garlic for the last minute so it doesn't burn.",
             "ingredient_refs": ["oil", "zucchini", "garlic"]},
            {"number": 4, "text": "Season with salt to taste and serve with the rice.", "ingredient_refs": ["salt", "rice"]},
        ],
        "notes": ["Sample recipe: quantities are illustrative and have not been kitchen-tested."],
        "safety_cautions": ["Hot oil can spatter; keep a lid nearby and add vegetables carefully.", LEFTOVER_SAFETY],
        "tags": ["vegetarian", "vegan", "dairy-free", "gluten-free"],
        "rating": None,
    },
    {
        "id": "sweet-potato-skillet",
        "title": "Sweet Potato Skillet",
        "source": SAMPLE_SOURCE,
        "servings": 2, "prep_minutes": 10, "cook_minutes": 20, "total_minutes": 30,
        "ingredients": [
            {"ingredient_id": "sweet-potato", "display_name": "sweet potato", "quantity": _q("2", "each", "2 medium"),
             "preparation": "diced into small cubes"},
            {"ingredient_id": "onion", "display_name": "onion", "quantity": _q("1", "each", "1 small"), "preparation": "finely chopped",
             "substitutions": [{"replacement": "shallot", "ingredient_id": None, "note": "Milder flavor."}]},
            {"ingredient_id": "oil", "display_name": "cooking oil", "quantity": _q("1", "tbsp", "1 tbsp")},
            {"ingredient_id": "salt", "display_name": "salt", "quantity": _q("0.25", "tsp", "1/4 tsp")},
        ],
        "steps": [
            {"number": 1, "text": "Dice the sweet potato into small cubes and finely chop the onion.", "ingredient_refs": ["sweet-potato", "onion"]},
            {"number": 2, "text": "Cook the sweet potato in a covered skillet with a splash of water until just tender.", "ingredient_refs": ["sweet-potato"]},
            {"number": 3, "text": "Uncover, add the onion and oil, and cook until everything is lightly browned.", "ingredient_refs": ["onion", "oil"]},
            {"number": 4, "text": "Season with the salt and serve.", "ingredient_refs": ["salt"]},
        ],
        "notes": [
            "Sample recipe: quantities are illustrative and have not been kitchen-tested.",
            "A splash of water is used for steaming; it is not tracked as an ingredient.",
        ],
        "safety_cautions": ["Add oil to a wet pan carefully; it can spatter.", LEFTOVER_SAFETY],
        "tags": ["vegetarian", "vegan", "dairy-free", "gluten-free"],
        "rating": None,
    },
]


def load_recipes(raw: list[dict[str, Any]]) -> list[Recipe]:
    """Validate raw recipe dicts. Raises ValueError on any schema or catalog problem."""
    recipes = [Recipe.model_validate(r) for r in raw]
    ids = [r.id for r in recipes]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate recipe ids")
    for r in recipes:
        for ing in r.ingredients:
            if ing.ingredient_id is not None and not is_known_id(ing.ingredient_id):
                raise ValueError(f"recipe {r.id}: ingredient_id '{ing.ingredient_id}' is not in the catalog")
            for sub in ing.substitutions:
                if sub.ingredient_id is not None and not is_known_id(sub.ingredient_id):
                    raise ValueError(f"recipe {r.id}: substitution ingredient_id '{sub.ingredient_id}' is not in the catalog")
    return recipes


RECIPES: list[Recipe] = load_recipes(RAW_RECIPES)
RECIPES_BY_ID: dict[str, Recipe] = {r.id: r for r in RECIPES}
