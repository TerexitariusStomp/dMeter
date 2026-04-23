---
name: fetch-resilience-score
version: 1
description: Retrieve the composite country resilience score (0-100) and its domain/pillar breakdown for a single country.
---

# fetch-resilience-score

Use this skill when the user asks how "resilient" a country is, or wants the numeric resilience score, trend, or per-domain breakdown. The score is a composite of economic, institutional, security, social, infrastructure, and environmental indicators, recomputed daily.

## Authentication — required

`/api/resilience/v1/get-resilience-score` is a paid endpoint. Callers must present either:

- A World Monitor API key: `Authorization: Bearer wm_live_…` (see https://www.worldmonitor.app/docs/documentation for issuance).
- Or a Pro user session (browser only; not applicable to server-to-server agents).

Unauthenticated requests return `401`.

## Endpoint

```
GET https://api.worldmonitor.app/api/resilience/v1/get-resilience-score
```

## Parameters

| Name | In | Required | Shape |
|---|---|---|---|
| `countryCode` | query | yes | ISO 3166-1 alpha-2, uppercase (e.g. `DE`, `KE`, `BR`) |

## Response shape

```json
{
  "countryCode": "DE",
  "overallScore": 78.4,
  "level": "HIGH",
  "trend": "STABLE",
  "change30d": -0.2,
  "lowConfidence": false,
  "imputationShare": 0.04,
  "baselineScore": 79.1,
  "stressScore": 78.4,
  "stressFactor": 0.99,
  "dataVersion": "2026-04-23",
  "scoreInterval": { "lower": 76.1, "upper": 80.7 },
  "domains": [ { "name": "Economic", "score": 82.1, … } ],
  "pillars": [ { "name": "Fiscal Capacity", "score": 80.0, … } ]
}
```

Key fields for agents:

- `overallScore` (0–100): headline number.
- `level`: `LOW` / `MODERATE` / `HIGH` / `VERY_HIGH` — human-readable bucket.
- `change30d`: rolling 30-day delta.
- `scoreInterval`: `{lower, upper}` confidence band — quote this when the user asks for precision.
- `domains` / `pillars`: drill-down components if the user asks "why".

## Worked example

```bash
curl -s -H "Authorization: Bearer $WM_API_KEY" \
  'https://api.worldmonitor.app/api/resilience/v1/get-resilience-score?countryCode=DE' \
  | jq '{country: .countryCode, score: .overallScore, level, trend, change30d}'
```

## Errors

- `400` — `countryCode` missing or malformed.
- `401` — missing/invalid API key.
- `403` — API key present but lacks the tier that covers this RPC.
- `404` — country not yet scored (rare; some micro-states).
- `429` — per-key rate limit hit.

## When NOT to use

- For a sorted list across all countries, call `GetResilienceRanking` (`/api/resilience/v1/get-resilience-ranking`) instead of N per-country calls.
- For a narrative summary rather than a number, use `fetch-country-brief`.

## References

- OpenAPI: [ResilienceService.openapi.yaml](https://www.worldmonitor.app/openapi.yaml) — operation `GetResilienceScore`.
- Methodology: https://www.worldmonitor.app/docs/documentation
