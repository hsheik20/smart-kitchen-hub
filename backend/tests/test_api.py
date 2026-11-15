from fastapi.testclient import TestClient
from app.main import app, normalize

client=TestClient(app)

def test_health_is_explicit_demo():
    r=client.get('/api/health')
    assert r.status_code==200
    assert r.json()['vision_enabled'] is False

def test_matching_and_missing():
    r=client.get('/api/recipes', params={'ingredients':'chicken breast, white rice, zucchini, oil, salt'})
    assert r.status_code==200
    data=r.json()
    assert data[0]['id']=='chicken-rice-bowl'
    assert data[0]['match_pct']==100
    assert data[0]['missing']==[]
    assert data[0]['rating'] is None

def test_time_filter():
    r=client.get('/api/recipes', params={'max_minutes':30})
    assert r.status_code==200
    assert all(item['minutes'] <= 30 for item in r.json())

def test_unavailable_recipe():
    assert client.get('/api/recipes/nope').status_code==404

def test_aliases():
    assert normalize('  Sweet  Potatoes ')=='sweet potato'


# ---------------------------------------------------------------- legacy shape
def test_legacy_detail_shape_preserved():
    r = client.get('/api/recipes/sheet-pan-chicken')
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'id', 'title', 'source', 'source_url', 'author', 'servings', 'minutes', 'rating', 'review_count',
                         'instruction_display_allowed', 'ingredients', 'steps', 'missing', 'matched', 'match_pct'}
    assert body['ingredients'] == ['chicken', 'sweet potato', 'zucchini', 'oil', 'salt']  # optional pepper omitted
    assert all(isinstance(s, str) for s in body['steps'])
    assert body['minutes'] == 45 and body['rating'] is None and body['review_count'] is None


def test_legacy_zero_match():
    data = client.get('/api/recipes', params={'ingredients': 'tofu'}).json()
    assert len(data) == 4 and all(item['match_pct'] == 0 for item in data)


# --------------------------------------------------------------- new endpoints
def test_ingredients_catalog():
    r = client.get('/api/ingredients')
    assert r.status_code == 200
    ids = [i['id'] for i in r.json()]
    assert {'chicken', 'rice', 'sweet-potato', 'salt'} <= set(ids)
    assert next(i for i in r.json() if i['id'] == 'salt')['is_staple'] is True


def test_match_endpoint():
    r = client.post('/api/recipes/match', json={
        'inventory': [
            {'display_name': 'chicken breast', 'quantity': {'amount': '250', 'unit': 'g', 'accuracy': 'exact'}},
            {'display_name': 'white rice', 'quantity': {'amount': 1, 'unit': 'kg', 'accuracy': 'estimated'}},
            {'display_name': 'zucchini', 'quantity': {'amount': 2, 'unit': 'each', 'accuracy': 'exact'}},
            {'display_name': 'tofu'},
        ],
        'assume_staples': True,
    })
    assert r.status_code == 200
    body = r.json()
    top = body['matches'][0]
    assert top['recipe_id'] == 'chicken-rice-bowl' and top['match_pct'] == 100
    assert top['shortages'] == ['boneless chicken breast']
    chicken = next(c for c in top['checks'] if c['ingredient_id'] == 'chicken')
    assert chicken['shortfall'] == {'amount': '50', 'unit': 'g', 'accuracy': 'exact', 'display_text': None}
    assert top['is_sample_data'] is True and top['rating'] is None
    assert body['unmapped_inventory'] == ['tofu']


def test_match_empty_body_is_valid():
    r = client.post('/api/recipes/match', json={})
    assert r.status_code == 200 and all(m['match_pct'] == 0 for m in r.json()['matches'])


def test_match_validation_errors():
    bad_qty = {'inventory': [{'display_name': 'rice', 'quantity': {'amount': 1, 'unit': 'kg', 'accuracy': 'unknown'}}]}
    assert client.post('/api/recipes/match', json=bad_qty).status_code == 422
    bad_unit = {'inventory': [{'display_name': 'rice', 'quantity': {'amount': 1, 'unit': 'handful', 'accuracy': 'exact'}}]}
    assert client.post('/api/recipes/match', json=bad_unit).status_code == 422
    dup = {'inventory': [{'display_name': 'rice'}, {'display_name': 'white rice'}]}
    r = client.post('/api/recipes/match', json=dup)
    assert r.status_code == 422 and 'more than one' in r.json()['detail']
    assert client.post('/api/recipes/match', json={'max_minutes': 0}).status_code == 422
    assert client.post('/api/recipes/match', json={'unexpected': True}).status_code == 422


def test_deduction_preview_endpoint():
    r = client.post('/api/deductions/preview', json={
        'recipe_id': 'chicken-rice-bowl',
        'servings_cooked': 2,
        'inventory': [{'id': 'inv-1', 'ingredient_id': 'oil', 'display_name': 'olive oil',
                       'quantity': {'amount': '500', 'unit': 'ml', 'accuracy': 'exact'}}],
    })
    assert r.status_code == 200
    body = r.json()
    assert body['preview_only'] is True and body['scale_factor'] == '1'
    oil = next(l for l in body['lines'] if l['ingredient_id'] == 'oil')
    assert oil['status'] == 'will_deduct'
    assert oil['deduct']['amount'] == '14.787' and oil['resulting']['amount'] == '485.213'


def test_deduction_preview_errors():
    assert client.post('/api/deductions/preview', json={'recipe_id': 'nope'}).status_code == 404
    assert client.post('/api/deductions/preview', json={'recipe_id': 'chicken-rice-bowl', 'servings_cooked': 0}).status_code == 422
    unknown_id = {'recipe_id': 'chicken-rice-bowl', 'inventory': [{'ingredient_id': 'dragonfruit', 'display_name': 'x'}]}
    assert client.post('/api/deductions/preview', json=unknown_id).status_code == 422
