Intentional Community Unified API

What this does
- Combines map/community data from:
  - numundo
  - tribes-neighborhoods
  - transitionnetwork
  - ecobasa
  - agartha
  - ecovillage
  - ic-directory
- Deduplicates cross-source matches.
- If duplicates exist, keeps the richest record and tracks merged_sources.

Endpoints
- GET /health
- GET /communities/summary?force_refresh=false&include_ic_details=true
- GET /communities?with_coordinates_only=false&source=&limit=200&offset=0
- GET /communities/geojson?source=
- POST /refresh?include_ic_details=true

Run
1) cd /root/workspace/intentional-community-api
2) python3 -m venv .venv
3) . .venv/bin/activate
4) pip install -r requirements.txt
5) uvicorn app.main:app --host 0.0.0.0 --port 8020

Quick checks
- curl 'http://127.0.0.1:8020/health'
- curl 'http://127.0.0.1:8020/communities/summary'
- curl 'http://127.0.0.1:8020/communities?with_coordinates_only=true&limit=5'
- curl 'http://127.0.0.1:8020/communities/geojson' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['metadata'])"
