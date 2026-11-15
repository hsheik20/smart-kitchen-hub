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
