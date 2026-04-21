from __future__ import annotations

import asyncio
import html
import json
import math
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Query

TIMEOUT = float(os.getenv("INTENTIONAL_TIMEOUT", "60"))
CACHE_TTL_SECONDS = int(os.getenv("INTENTIONAL_CACHE_TTL", "900"))
USER_AGENT = os.getenv(
    "INTENTIONAL_USER_AGENT",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
)

NUMUNDO_URL = "https://numundo.org/centers"
TRIBES_URL = "https://tribesplatform.app/neighborhoods/"
TRIBES_WP_GROUPS = "https://tribesplatform.app/wp-json/buddyboss/v1/groups"
TRANSITION_AJAX = "https://maps.transitionnetwork.org/wp-admin/admin-ajax.php"
ECOBASA_URL = "https://ecobasa.org/en/communities/"
AGARTHA_BASE = "https://www.agartha.one"
AGARTHA_ENDPOINT = "/api/hubs"
ECOVILLAGE_URL = "https://ecovillage.org/ecovillages/map/"
IC_LISTINGS = "https://www.ic.org/wp-json/v1/directory/entries/"
IC_ENTRY = "https://www.ic.org/wp-json/v1/directory/entry/"

app = FastAPI(title="Intentional Community Unified API", version="1.0.0")

_cache_lock = asyncio.Lock()
_cache: dict[str, Any] = {"expires": 0.0, "payload": None, "key": None}


def now_ts() -> float:
    return time.time()


def _to_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def _norm_text(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def _canonical_url(v: Any) -> str:
    s = str(v or "").strip()
    if not s:
        return ""
    if s.startswith("//"):
        s = "https:" + s
    if not s.startswith("http"):
        return s.rstrip("/")
    try:
        p = urlparse(s)
        path = p.path.rstrip("/")
        return f"{p.netloc.lower()}{path}"
    except Exception:
        return s.rstrip("/")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _richness_score(rec: dict[str, Any]) -> float:
    fields = [
        rec.get("name"),
        rec.get("url"),
        rec.get("description"),
        rec.get("country"),
        rec.get("city"),
        rec.get("state"),
        rec.get("source_id"),
        rec.get("image_url"),
    ]
    score = sum(1 for x in fields if x not in (None, "", [], {}))
    tags = rec.get("tags") or []
    categories = rec.get("categories") or []
    activities = rec.get("activities") or []
    score += min(5, len(tags)) * 0.5
    score += min(5, len(categories)) * 0.5
    score += min(5, len(activities)) * 0.5
    desc_len = len(str(rec.get("description") or ""))
    score += min(6, desc_len / 80.0)
    raw = rec.get("raw")
    if isinstance(raw, dict):
        score += min(8, len([k for k, v in raw.items() if v not in (None, "", [], {})]) * 0.15)
    if rec.get("lat") is not None and rec.get("lon") is not None:
        score += 2
    return score


async def _get_text(client: httpx.AsyncClient, url: str, *, retries: int = 3) -> str:
    last_error: Optional[Exception] = None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    for attempt in range(1, retries + 1):
        try:
            r = await client.get(url, headers=headers)
            if r.status_code >= 400:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
            return r.text
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                await asyncio.sleep(0.6 * attempt)
    raise RuntimeError(f"Failed GET {url}: {last_error}")


async def _get_json(client: httpx.AsyncClient, url: str, *, params: Optional[dict[str, Any]] = None, retries: int = 3) -> Any:
    last_error: Optional[Exception] = None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://www.ic.org/directory/",
    }
    for attempt in range(1, retries + 1):
        try:
            r = await client.get(url, params=params, headers=headers)
            if r.status_code >= 400:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
            return r.json()
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                await asyncio.sleep(0.6 * attempt)
    raise RuntimeError(f"Failed GET JSON {url}: {last_error}")


def _balanced_array(src: str, start_idx: int) -> str:
    in_string = False
    q = ""
    esc = False
    depth = 0
    start = -1
    for i in range(start_idx, len(src)):
        ch = src[i]
        if in_string:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == q:
                in_string = False
            continue
        if ch in ('"', "'"):
            in_string = True
            q = ch
            continue
        if ch == "[":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "]":
            if depth > 0:
                depth -= 1
                if depth == 0 and start >= 0:
                    return src[start : i + 1]
    raise ValueError("balanced array not found")


async def fetch_numundo(client: httpx.AsyncClient) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    html_text = await _get_text(client, NUMUNDO_URL)
    idx = -1
    for marker in ["w.allCenters", "window.allCenters", "allCenters"]:
        i = html_text.find(marker)
        if i != -1 and (idx == -1 or i < idx):
            idx = i
    if idx == -1:
        raise RuntimeError("numundo allCenters marker missing")
    eq = html_text.find("=", idx)
    arr_start = html_text.find("[", eq)
    arr_text = _balanced_array(html_text, arr_start)
    rows = json.loads(arr_text)

    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        coords = ((row.get("location") or {}).get("coords") or [])
        lon = lat = None
        if isinstance(coords, list) and len(coords) >= 2:
            lon = _to_float(coords[0])
            lat = _to_float(coords[1])
        if lat is None or lon is None:
            pos = ((row.get("marker") or {}).get("position") or {})
            lat = _to_float(pos.get("lat"))
            lon = _to_float(pos.get("lng"))

        out.append(
            {
                "source": "numundo",
                "source_id": row.get("id") or row.get("_id"),
                "name": row.get("title"),
                "url": f"https://numundo.org/center/{row.get('slug')}" if row.get("slug") else None,
                "description": ((row.get("mission") or {}).get("en") if isinstance(row.get("mission"), dict) else None),
                "country": ((row.get("location") or {}).get("country") if isinstance(row.get("location"), dict) else None),
                "city": None,
                "state": None,
                "lat": lat,
                "lon": lon,
                "categories": [c.get("name") for c in (row.get("categories") or []) if isinstance(c, dict)],
                "activities": [a.get("name") for a in (row.get("activities") or []) if isinstance(a, dict)],
                "tags": row.get("highlights") or [],
                "image_url": None,
                "raw": row,
            }
        )

    return out, {"source": "numundo", "rows": len(out)}


async def fetch_tribes(client: httpx.AsyncClient) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # Primary path: parse front_ajax_object from neighborhoods page.
    # Fallback #1: BuddyBoss groups WP-JSON API.
    # Fallback #2: jina.ai mirror parse of neighborhoods listing links.
    html_error: Optional[Exception] = None
    wp_error: Optional[Exception] = None

    try:
        def _sync_fetch() -> str:
            headers = {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://tribesplatform.app/",
                "Upgrade-Insecure-Requests": "1",
            }
            r = requests.get(TRIBES_URL, headers=headers, timeout=40)
            if r.status_code >= 400:
                raise RuntimeError(f"tribes HTTP {r.status_code}: {r.text[:300]}")
            return r.text

        html_text = await asyncio.to_thread(_sync_fetch)
        m = re.search(r"front_ajax_object\s*=\s*(\{.*?\})\s*;", html_text, re.DOTALL)
        if not m:
            raise RuntimeError("tribes front_ajax_object missing")
        blob = re.sub(r",\s*([}\]])", r"\1", m.group(1).strip())
        data = json.loads(blob)
        locs = data.get("locations", []) if isinstance(data, dict) else []

        out: list[dict[str, Any]] = []
        for row in locs:
            if not isinstance(row, dict):
                continue
            lat = _to_float(row.get("lat"))
            lon = _to_float(row.get("lon"))
            title = html.unescape(str(row.get("title", "")).strip()) or None
            out.append(
                {
                    "source": "tribes-neighborhoods",
                    "source_id": row.get("id") or row.get("link") or title,
                    "name": title,
                    "url": row.get("link"),
                    "description": None,
                    "country": None,
                    "city": None,
                    "state": None,
                    "lat": lat,
                    "lon": lon,
                    "categories": [],
                    "activities": [],
                    "tags": [],
                    "image_url": None,
                    "raw": row,
                }
            )

        return out, {"source": "tribes-neighborhoods", "rows": len(out), "mode": "front_ajax_object"}
    except Exception as exc:
        html_error = exc

    # Fallback #1 via WP REST API.
    try:
        out: list[dict[str, Any]] = []
        page = 1
        per_page = 100
        while True:
            payload = await _get_json(client, TRIBES_WP_GROUPS, params={"per_page": per_page, "page": page})
            if not isinstance(payload, list) or not payload:
                break

            for row in payload:
                if not isinstance(row, dict):
                    continue
                name = row.get("name")
                url = row.get("link")
                desc = None
                d = row.get("description")
                if isinstance(d, dict):
                    desc = d.get("rendered") or d.get("raw")
                elif isinstance(d, str):
                    desc = d
                out.append(
                    {
                        "source": "tribes-neighborhoods",
                        "source_id": row.get("id") or row.get("slug") or name,
                        "name": name,
                        "url": url,
                        "description": desc,
                        "country": None,
                        "city": None,
                        "state": None,
                        "lat": None,
                        "lon": None,
                        "categories": row.get("types") if isinstance(row.get("types"), list) else [],
                        "activities": [],
                        "tags": [row.get("group_type_label")] if row.get("group_type_label") else [],
                        "image_url": ((row.get("avatar_urls") or {}).get("full") if isinstance(row.get("avatar_urls"), dict) else None),
                        "raw": row,
                    }
                )

            if len(payload) < per_page:
                break
            page += 1

        if out:
            return out, {
                "source": "tribes-neighborhoods",
                "rows": len(out),
                "mode": "buddyboss_wp_json_fallback",
                "fallback_reason": str(html_error) if html_error else None,
            }
    except Exception as exc:
        wp_error = exc

    # Fallback #2 via jina.ai mirror (limited but resilient against direct 403).
    mirror_url = "https://r.jina.ai/http://tribesplatform.app/neighborhoods/"
    mirror_text = await _get_text(client, mirror_url)
    links = sorted(set(re.findall(r"https?://tribesplatform\.app/groups/[^)\s\"']+", mirror_text)))

    out: list[dict[str, Any]] = []
    for i, link in enumerate(links, start=1):
        slug = link.rstrip("/").split("/")[-1]
        name_guess = slug.replace("-", " ").strip().title() if slug else None
        out.append(
            {
                "source": "tribes-neighborhoods",
                "source_id": f"mirror:{slug or i}",
                "name": name_guess,
                "url": link,
                "description": None,
                "country": None,
                "city": None,
                "state": None,
                "lat": None,
                "lon": None,
                "categories": [],
                "activities": [],
                "tags": ["mirror-derived"],
                "image_url": None,
                "raw": {"mirror_url": mirror_url, "slug": slug},
            }
        )

    return out, {
        "source": "tribes-neighborhoods",
        "rows": len(out),
        "mode": "jina_mirror_fallback",
        "fallback_reason": {
            "html_error": str(html_error) if html_error else None,
            "wp_error": str(wp_error) if wp_error else None,
        },
    }


async def fetch_transition(client: httpx.AsyncClient) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    headers = {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": USER_AGENT,
        "Origin": "https://maps.transitionnetwork.org",
        "Referer": "https://maps.transitionnetwork.org/map/?type=2",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }
    data = {"action": "getMarkers", "value[params][type]": "1"}
    r = await client.post(TRANSITION_AJAX, data=data, headers=headers)
    if r.status_code >= 400:
        raise RuntimeError(f"transition HTTP {r.status_code}")
    payload = r.json()
    if not isinstance(payload, dict):
        raise RuntimeError("transition payload not dict")

    out: list[dict[str, Any]] = []
    for section in ("initiatives", "trainers", "hubs"):
        part = payload.get(section)
        if not isinstance(part, dict):
            continue
        for k, v in part.items():
            if not isinstance(v, dict):
                continue
            lat = _to_float(v.get("lat"))
            lon = _to_float(v.get("lng"))
            out.append(
                {
                    "source": "transitionnetwork",
                    "source_id": k,
                    "name": v.get("title"),
                    "url": v.get("permalink"),
                    "description": None,
                    "country": None,
                    "city": None,
                    "state": None,
                    "lat": lat,
                    "lon": lon,
                    "categories": [section],
                    "activities": [],
                    "tags": [v.get("type")] if v.get("type") else [],
                    "image_url": None,
                    "raw": v,
                }
            )
    return out, {"source": "transitionnetwork", "rows": len(out)}


async def fetch_ecobasa(client: httpx.AsyncClient) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    text = await _get_text(client, ECOBASA_URL)
    marker_pattern = re.compile(
        r"EcobasaMap\.addMarker\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*'(.*?)'\s*\);",
        re.DOTALL,
    )
    matches = list(marker_pattern.finditer(text))

    out: list[dict[str, Any]] = []
    for idx, m in enumerate(matches, start=1):
        lat = _to_float(m.group(1))
        lon = _to_float(m.group(2))
        popup_html = html.unescape(m.group(3).replace("\\'", "'"))
        soup = BeautifulSoup(popup_html, "html.parser")
        h5a = soup.select_one("h5 a")
        name = h5a.get_text(" ", strip=True) if h5a else None
        url = h5a.get("href") if h5a else None
        if url and url.startswith("/"):
            url = "https://ecobasa.org" + url
        img = soup.select_one("img")
        image_url = img.get("src") if img else None
        if image_url and image_url.startswith("/"):
            image_url = "https://ecobasa.org" + image_url
        spans = soup.find_all("span")
        summary = spans[1].get_text(" ", strip=True) if len(spans) >= 2 else None
        out.append(
            {
                "source": "ecobasa",
                "source_id": f"ecobasa:{idx}",
                "name": name,
                "url": url,
                "description": summary,
                "country": None,
                "city": None,
                "state": None,
                "lat": lat,
                "lon": lon,
                "categories": [],
                "activities": [],
                "tags": [],
                "image_url": image_url,
                "raw": {"popup_html": popup_html},
            }
        )

    return out, {"source": "ecobasa", "rows": len(out)}


async def fetch_agartha(client: httpx.AsyncClient) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    url = AGARTHA_BASE.rstrip("/") + AGARTHA_ENDPOINT
    rows: list[dict[str, Any]] = []
    for rating in range(1, 6):
        payload = await _get_json(client, url, params={"rating": rating})
        if not isinstance(payload, list):
            continue
        rows.extend([x for x in payload if isinstance(x, dict)])

    out: list[dict[str, Any]] = []
    for row in rows:
        c = row.get("coordinates")
        lat = lon = None
        if isinstance(c, list) and len(c) >= 2:
            lat = _to_float(c[0])
            lon = _to_float(c[1])
        out.append(
            {
                "source": "agartha",
                "source_id": f"{row.get('name','')}::{row.get('index','')}",
                "name": row.get("name"),
                "url": row.get("url"),
                "description": row.get("description"),
                "country": row.get("country"),
                "city": None,
                "state": None,
                "lat": lat,
                "lon": lon,
                "categories": [],
                "activities": [],
                "tags": row.get("tags") if isinstance(row.get("tags"), list) else [],
                "image_url": row.get("logo"),
                "raw": row,
            }
        )

    return out, {"source": "agartha", "rows": len(out)}


async def fetch_ecovillage(client: httpx.AsyncClient) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    text = await _get_text(client, ECOVILLAGE_URL)
    m = re.search(r"var\s+locations\s*=\s*(\[.*?\])\s*;", text, re.DOTALL)
    if not m:
        raise RuntimeError("ecovillage locations payload missing")
    raw = re.sub(r",\s*([}\]])", r"\1", m.group(1).strip())
    rows = json.loads(raw)
    out: list[dict[str, Any]] = []
    if not isinstance(rows, list):
        rows = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        out.append(
            {
                "source": "ecovillage",
                "source_id": row.get("ID"),
                "name": html.unescape(str(row.get("post_title") or "")).strip() or None,
                "url": row.get("guid") if row.get("guid") else None,
                "description": None,
                "country": None,
                "city": None,
                "state": None,
                "lat": _to_float(row.get("lat")),
                "lon": _to_float(row.get("lng")),
                "categories": [row.get("post_type")] if row.get("post_type") else [],
                "activities": [],
                "tags": [],
                "image_url": None,
                "raw": row,
            }
        )
    return out, {"source": "ecovillage", "rows": len(out)}


async def fetch_ic_directory(client: httpx.AsyncClient, include_details: bool = True) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    first = await _get_json(client, IC_LISTINGS, params={"page": 1})
    listings = first.get("listings", []) if isinstance(first, dict) else []
    if not isinstance(listings, list):
        listings = []
    total_count = int((first or {}).get("totalCount", len(listings))) if isinstance(first, dict) else len(listings)
    page_size = 25
    total_pages = max(1, (total_count + page_size - 1) // page_size)

    sem = asyncio.Semaphore(10)

    async def fetch_page(page: int) -> list[dict[str, Any]]:
        async with sem:
            p = await _get_json(client, IC_LISTINGS, params={"page": page})
            rows = p.get("listings", []) if isinstance(p, dict) else []
            return rows if isinstance(rows, list) else []

    if total_pages > 1:
        pages = await asyncio.gather(*[fetch_page(p) for p in range(2, total_pages + 1)])
        for pr in pages:
            listings.extend(pr)

    # dedupe listing IDs
    seen = set()
    deduped = []
    for row in listings:
        rid = row.get("id") if isinstance(row, dict) else None
        if rid in seen:
            continue
        seen.add(rid)
        if isinstance(row, dict):
            deduped.append(row)
    listings = deduped

    details_by_slug: dict[str, dict[str, Any]] = {}
    if include_details:
        slugs = [str(r.get("slug", "")).strip() for r in listings if str(r.get("slug", "")).strip()]

        async def fetch_detail(slug: str) -> tuple[str, Optional[dict[str, Any]]]:
            async with sem:
                try:
                    d = await _get_json(client, IC_ENTRY, params={"slug": slug})
                    return slug, d if isinstance(d, dict) else None
                except Exception:
                    return slug, None

        details = await asyncio.gather(*[fetch_detail(s) for s in slugs])
        for slug, d in details:
            if d:
                details_by_slug[slug] = d

    out: list[dict[str, Any]] = []
    for row in listings:
        slug = str(row.get("slug", "")).strip()
        detail = details_by_slug.get(slug, {})
        lat = lon = None
        map_coords = detail.get("mapCoordinates") if isinstance(detail, dict) else None
        if isinstance(map_coords, dict):
            lat = _to_float(map_coords.get("latitude"))
            lon = _to_float(map_coords.get("longitude"))
        if lat is None or lon is None:
            latlon = detail.get("latitude-longitude") if isinstance(detail, dict) else None
            if isinstance(latlon, str) and "," in latlon:
                p = [x.strip() for x in latlon.split(",", 1)]
                if len(p) == 2:
                    lat = _to_float(p[0])
                    lon = _to_float(p[1])

        out.append(
            {
                "source": "ic-directory",
                "source_id": row.get("id"),
                "name": row.get("name"),
                "url": f"https://www.ic.org/directory/{slug}/" if slug else None,
                "description": None,
                "country": row.get("country"),
                "city": row.get("city"),
                "state": row.get("state"),
                "lat": lat,
                "lon": lon,
                "categories": row.get("communityTypes") if isinstance(row.get("communityTypes"), list) else [],
                "activities": [],
                "tags": [row.get("communityStatus")] if row.get("communityStatus") else [],
                "image_url": row.get("thumbnailUrl"),
                "raw": {**row, "detail": detail if include_details else None},
            }
        )

    return out, {"source": "ic-directory", "rows": len(out), "details": include_details}


def _same_community(a: dict[str, Any], b: dict[str, Any]) -> bool:
    ua = _canonical_url(a.get("url"))
    ub = _canonical_url(b.get("url"))
    if ua and ub and ua == ub:
        return True

    na = _norm_text(a.get("name"))
    nb = _norm_text(b.get("name"))
    if not na or not nb or na != nb:
        return False

    alat, alon = a.get("lat"), a.get("lon")
    blat, blon = b.get("lat"), b.get("lon")
    if alat is not None and alon is not None and blat is not None and blon is not None:
        try:
            return _haversine_km(float(alat), float(alon), float(blat), float(blon)) <= 25.0
        except Exception:
            return False

    ca = _norm_text(a.get("country"))
    cb = _norm_text(b.get("country"))
    if ca and cb and ca == cb:
        return True

    return False


def dedupe_richest(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    merged = 0
    replaced = 0
    for row in rows:
        idx = None
        for i, u in enumerate(unique):
            if _same_community(row, u):
                idx = i
                break
        if idx is None:
            candidate = dict(row)
            candidate["merged_sources"] = [row.get("source")]
            unique.append(candidate)
            continue

        merged += 1
        current = unique[idx]
        cscore = _richness_score(current)
        nscore = _richness_score(row)
        ms = set(current.get("merged_sources") or [])
        ms.add(row.get("source"))
        if nscore > cscore:
            replaced += 1
            candidate = dict(row)
            candidate["merged_sources"] = sorted(ms)
            unique[idx] = candidate
        else:
            current["merged_sources"] = sorted(ms)
            unique[idx] = current

    return unique, {"merged_duplicates": merged, "replaced_with_richer": replaced}


async def build_dataset(force_refresh: bool = False, include_ic_details: bool = True) -> dict[str, Any]:
    key = f"details:{include_ic_details}"
    if not force_refresh and _cache.get("payload") is not None and _cache.get("key") == key and now_ts() < float(_cache.get("expires", 0.0)):
        return _cache["payload"]

    async with _cache_lock:
        if not force_refresh and _cache.get("payload") is not None and _cache.get("key") == key and now_ts() < float(_cache.get("expires", 0.0)):
            return _cache["payload"]

        started = now_ts()
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            tasks = [
                fetch_numundo(client),
                fetch_tribes(client),
                fetch_transition(client),
                fetch_ecobasa(client),
                fetch_agartha(client),
                fetch_ecovillage(client),
                fetch_ic_directory(client, include_details=include_ic_details),
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        all_rows: list[dict[str, Any]] = []
        source_stats: list[dict[str, Any]] = []
        errors: list[str] = []

        for res in results:
            if isinstance(res, Exception):
                errors.append(str(res))
                continue
            rows, stat = res
            all_rows.extend(rows)
            source_stats.append(stat)

        unique, dedupe_stats = dedupe_richest(all_rows)
        with_coords = sum(1 for x in unique if x.get("lat") is not None and x.get("lon") is not None)

        payload = {
            "metadata": {
                "generated_at_unix": now_ts(),
                "elapsed_seconds": round(now_ts() - started, 2),
                "sources_requested": 7,
                "sources_succeeded": len(source_stats),
                "sources_failed": len(errors),
                "rows_collected_total": len(all_rows),
                "rows_unique_total": len(unique),
                "rows_unique_with_coordinates": with_coords,
                "dedupe": dedupe_stats,
                "include_ic_details": include_ic_details,
            },
            "source_stats": source_stats,
            "errors": errors,
            "items": unique,
        }

        _cache["payload"] = payload
        _cache["key"] = key
        _cache["expires"] = now_ts() + CACHE_TTL_SECONDS
        return payload


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "cache_ttl_seconds": CACHE_TTL_SECONDS,
        "timeout_seconds": TIMEOUT,
        "sources": [
            "numundo",
            "tribes-neighborhoods",
            "transitionnetwork",
            "ecobasa",
            "agartha",
            "ecovillage",
            "ic-directory",
        ],
    }


@app.get("/communities/summary")
async def communities_summary(
    force_refresh: bool = Query(False),
    include_ic_details: bool = Query(True),
) -> dict[str, Any]:
    ds = await build_dataset(force_refresh=force_refresh, include_ic_details=include_ic_details)
    return {
        "metadata": ds["metadata"],
        "source_stats": ds["source_stats"],
        "errors": ds["errors"],
    }


@app.get("/communities")
async def communities(
    force_refresh: bool = Query(False),
    include_ic_details: bool = Query(True),
    with_coordinates_only: bool = Query(False),
    source: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=20000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    ds = await build_dataset(force_refresh=force_refresh, include_ic_details=include_ic_details)
    rows = ds["items"]

    if source:
        src = _norm_text(source)
        rows = [x for x in rows if _norm_text(x.get("source")) == src or src in [_norm_text(s) for s in (x.get("merged_sources") or [])]]

    if with_coordinates_only:
        rows = [x for x in rows if x.get("lat") is not None and x.get("lon") is not None]

    total = len(rows)
    page = rows[offset : offset + limit]

    return {
        "metadata": {
            **ds["metadata"],
            "total_filtered": total,
            "offset": offset,
            "limit": limit,
            "returned": len(page),
            "with_coordinates_only": with_coordinates_only,
            "source_filter": source,
        },
        "items": page,
    }


@app.get("/communities/geojson")
async def communities_geojson(
    force_refresh: bool = Query(False),
    include_ic_details: bool = Query(True),
    source: Optional[str] = Query(None),
) -> dict[str, Any]:
    ds = await build_dataset(force_refresh=force_refresh, include_ic_details=include_ic_details)
    rows = ds["items"]
    if source:
        src = _norm_text(source)
        rows = [x for x in rows if _norm_text(x.get("source")) == src or src in [_norm_text(s) for s in (x.get("merged_sources") or [])]]

    features: list[dict[str, Any]] = []
    for idx, row in enumerate(rows):
        lat = row.get("lat")
        lon = row.get("lon")
        if lat is None or lon is None:
            continue
        features.append(
            {
                "type": "Feature",
                "id": row.get("source_id") or idx,
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "name": row.get("name"),
                    "source": row.get("source"),
                    "merged_sources": row.get("merged_sources") or [row.get("source")],
                    "url": row.get("url"),
                    "country": row.get("country"),
                    "city": row.get("city"),
                    "state": row.get("state"),
                    "tags": row.get("tags") or [],
                    "categories": row.get("categories") or [],
                    "activities": row.get("activities") or [],
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "metadata": {
            **ds["metadata"],
            "feature_count": len(features),
            "source_filter": source,
        },
        "features": features,
    }


@app.post("/refresh")
async def refresh(include_ic_details: bool = Query(True)) -> dict[str, Any]:
    ds = await build_dataset(force_refresh=True, include_ic_details=include_ic_details)
    return {"ok": True, "metadata": ds["metadata"], "source_stats": ds["source_stats"], "errors": ds["errors"]}
