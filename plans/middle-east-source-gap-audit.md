# Middle East source gap audit

**Date**: 2026-04-20
**Scope**: Compare WorldMonitor's ME source coverage against an external ME conflict dashboard's 152-source roster. Identify direct feeds we're missing, prioritize, and scope follow-up PRs.

## Method

Audited an external Middle East conflict monitor (152 declared sources spanning International, USA, UAE, Israel, Saudi Arabia, Kuwait, Qatar, Bahrain, Iran, Oman) against `src/config/feeds.ts` (523 feeds) plus `scripts/` seed configs. Matched by publisher name and canonical domain. Provenance URL stashed in `docs/internal/me-source-audit-source-url.md` (gitignored) per the no-competitor-disclosure rule.

## Current coverage — what we already have

| Category | WorldMonitor source |
|---|---|
| Iran-diaspora | BBC Persian, Iran International (Google News wrapper) |
| Israel | Haaretz (Google News wrapper) |
| Saudi | Arab News (Google News wrapper), Asharq News, Asharq Business |
| UAE | The National (Google News wrapper), Arabian Business (Google News wrapper) |
| Pan-Arab | Al Jazeera (direct RSS EN + AR), Al Arabiya (AR direct, EN via Google News) |
| US Gov | White House, State Dept, Pentagon, Treasury (all Google News wrappers) |
| Oman | Oman Observer (direct RSS) |
| NOTAMs | FAA ArcGIS FeatureServer (US-centric, partial global coverage) |

**Takeaway**: Our ME coverage is thin, indirect, and depends heavily on Google News wrappers (brittle under rate-limits, adds 15–60 min latency, omits non-English content).

## Gaps — direct feeds we're missing

Grouped by priority. "Direct RSS" = publisher's own RSS endpoint. Effort tiers: `S` = add feed entry; `M` = needs custom fetcher (HTML scrape, JSON API, auth); `L` = new relay / proxy / paid API.

### Priority 1 — State wires (replace fragile Google News wrappers with direct RSS)

Every GCC country + Iran has an official state news agency. These are first-party, low-latency, high-value for any ME event. Currently 100% missing.

| Source | Domain | Country | Effort | Notes |
|---|---|---|---|---|
| WAM (Emirates News Agency) | wam.ae | UAE | S | English + Arabic; direct RSS |
| SPA (Saudi Press Agency) | spa.gov.sa | KSA | S | EN + AR |
| QNA (Qatar News Agency) | qna.org.qa | QA | S | EN + AR |
| KUNA (Kuwait News Agency) | kuna.net.kw | KW | S | EN + AR |
| BNA (Bahrain News Agency) | bna.bh | BH | S | EN + AR |
| IRNA | en.irna.ir | IR | S | English + Persian |
| Tasnim News Agency | tasnimnews.com | IR | S | IRGC-aligned; important signal |
| Mehr News Agency | en.mehrnews.com | IR | S | |
| ISNA (Iranian Students') | en.isna.ir | IR | S | |
| Tehran Times | tehrantimes.com | IR | S | English daily |
| Press TV | presstv.ir | IR | M | May block cloud IPs; check |
| Khamenei office (EN) | english.khamenei.ir | IR | M | Supreme Leader statements; HTML scrape |

### Priority 2 — Israeli domestic media (critical during escalations, currently only Haaretz)

| Source | Domain | Language | Effort |
|---|---|---|---|
| Times of Israel | timesofisrael.com | EN | S |
| Jerusalem Post | jpost.com | EN | S |
| Ynet / Ynetnews | ynetnews.com | EN + HE | S |
| i24 News | i24news.tv | EN | S |
| Globes | en.globes.co.il | EN | S — business/markets |
| Calcalist | calcalistech.com | EN + HE | S — tech/business |
| Israel Hayom | israelhayom.com | EN | M — has 403'd cloud IPs for others |
| Mako / N12 | mako.co.il | HE | S |
| Channel 13 (Reshet 13) | 13tv.co.il | HE | S |
| Kan News | kan.org.il | HE | S — public broadcaster |
| Maariv | maariv.co.il | HE | S |
| Walla! News | news.walla.co.il | HE | S |
| IDF Spokesperson | idf.il | EN + HE | S — high-signal official channel |
| Israeli Prime Minister's Office | gov.il | EN + HE | S |
| Israeli MoFA | gov.il | EN + HE | S |
| The Knesset | knesset.gov.il | EN + HE | M — may lack RSS, needs scrape |

### Priority 3 — Gulf Arabic dailies (we have zero)

Arabic-language Gulf newspapers break regional stories 6–24 h before English pickups. Zero direct feeds currently.

| Country | Publications |
|---|---|
| UAE | Al Bayan, Al Ittihad, Al Khaleej |
| KSA | Okaz, Al Riyadh, Al Watan SA, Al Madina, Al Jazirah, Sabq |
| Qatar | Al Raya, Al Sharq, Al Watan QA, Lusail News |
| Kuwait | Al Qabas, Al Rai, Al Jarida, Al Anba, Al Seyassah |
| Bahrain | Al Bilad, Al Ayam, Akhbar Al Khaleej |
| Oman | (Oman Observer only — we have it) |

Effort: `S` per title if direct RSS exists; `M` per title if HTML scrape needed. Batch Arabic feeds into a single PR so translation / normalization can be centralized.

### Priority 4 — Gulf English dailies

| Source | Domain | Country | Effort |
|---|---|---|---|
| Gulf News | gulfnews.com | UAE | S |
| Khaleej Times | khaleejtimes.com | UAE | S |
| Emirates 24/7 | emirates247.com | UAE | S |
| Saudi Gazette | saudigazette.com.sa | KSA | S |
| Kuwait Times | kuwaittimes.com | KW | S |
| Arab Times | arabtimesonline.com | KW | S |
| The Peninsula | thepeninsulaqatar.com | QA | S |
| Gulf Times | gulf-times.com | QA | S |
| Qatar Tribune | qatar-tribune.com | QA | S |
| Gulf Daily News | gdnonline.com | BH | S |
| Daily Tribune (Bahrain) | newsofbahrain.com | BH | S |
| Muscat Daily | muscatdaily.com | OM | S (intermittent 500s noted elsewhere) |
| Times of Oman | timesofoman.com | OM | S |

### Priority 5 — US Gov fine-grained feeds (currently coarse)

Our Google-News wrappers collapse multiple distinct feeds into one noisy stream. Direct RSS exists for each sub-feed.

| Current (coarse) | Recommended (granular) |
|---|---|
| "White House" GNews | White House — All News, Briefings & Statements, Presidential Actions (3 feeds) |
| "State Dept" GNews | Press Releases, Secretary's Remarks, Near East Bureau, Press Briefings, Travel Advisories (5 feeds) |
| "Pentagon" GNews | DoD news, US CENTCOM (centcom.mil) |
| "Treasury" GNews | Treasury press, OFAC sanctions actions |

Effort: `S` each. Highest ROI is US CENTCOM + State Dept Near East + Travel Advisories for Iran / Yemen / etc.

### Priority 6 — City / ministry-level gov comms

| Source | Country | Value |
|---|---|---|
| Dubai Media Office (mediaoffice.ae) | UAE | S — official Dubai crisis comms |
| Abu Dhabi Media Office (mediaoffice.abudhabi) | UAE | S |
| RTA Dubai (rta.ae) | UAE | S — transport / infrastructure notices |
| MoFA + MoD for each GCC state | 6× | S each; direct RSS varies |

### Priority 7 — International press with deeper ME coverage

We already carry most majors. Verify coverage of:

- Asharq Al-Awsat (english.aawsat.com) — cross-pan-Arab, missing
- Financial Times Middle East (dedicated feed, we only have generic FT)
- Sky News Arabia (skynewsarabia.com) — distinct from Sky News main
- NHK World, TASS, DW, Politico, Fox News — verify direct feeds vs. current Google News

### Priority 8 — NOTAM coverage upgrade

We rely on FAA ArcGIS FeatureServer for NOTAMs. Coverage is US-centric; global NOTAMs (especially civil aviation authorities in IR / IQ / SY / LB / YE) are patchy. The external dashboard uses Notamify (commercial API) for cross-authority coverage. For ME conflict monitoring this is a real gap — e.g. Iranian FIR closures won't appear in FAA data.

Options:

- **A.** Evaluate Notamify pricing ($L effort, recurring cost).
- **B.** Build a relay scraping EUROCONTROL AIS + ICAO regional offices' NOTAM portals ($L effort, no recurring cost).
- **C.** Accept FAA-only coverage, document the limitation.

## Proposed follow-up PRs

Each a separate PR, each a few feeds → fast merge, isolated blast radius.

1. **feat(feeds): direct state wires** — adds P1 sources (WAM/SPA/QNA/KUNA/BNA/IRNA/Tasnim/Mehr/ISNA/Tehran Times). Replaces `{Iran International}` Google-News wrapper with direct IRNA/Tasnim/Mehr. ~10 feeds.
2. **feat(feeds): Israeli domestic EN** — P2 English half (Times of Israel, Jerusalem Post, Ynetnews, i24, Globes, IDF Spokesperson RSS, PMO, MoFA). ~8 feeds.
3. **feat(feeds): Israeli domestic Hebrew + Knesset** — P2 Hebrew (Ynet HE, Mako, Channel 13, Kan, Maariv, Walla) + Knesset scrape. ~7 feeds.
4. **feat(feeds): Gulf Arabic dailies** — P3 batched per country. ~25 feeds across 5 PRs or 1 batch.
5. **feat(feeds): Gulf English dailies** — P4 batch. ~13 feeds.
6. **feat(feeds): US gov fine-grained** — P5. Replace coarse wrappers with direct sub-feeds; add CENTCOM + Travel Advisories. ~10 feeds.
7. **feat(feeds): city/ministry comms** — P6. ~10 feeds.
8. **spike: NOTAM coverage upgrade** — P8. Decision doc + cost estimate for Notamify vs. self-built EUROCONTROL relay.

## Caveats / implementation notes

- Several publishers block cloud IPs (Washington Post, Israel Hayom, Arabian Business, Press TV). Route through our existing Decodo proxy (see `scripts/decodo/`) and per-source UA overrides per `feedback_jrc_waf_chrome_ua_returns_html.md`.
- Arabic + Hebrew feeds need UTF-8 normalization + right-to-left rendering sanity check in the NewsPanel.
- State wires (IRNA / Tasnim / Press TV) carry strong editorial slant — tag clearly in metadata so downstream classifiers / digest dedup don't treat them as neutral.
- Government source rate limits vary wildly — budget per-source `cadenceMin` (some daily, some hourly). Default to 30 min; tighten only where volume justifies it.
- Google News fallback is a second-class citizen — prefer direct RSS whenever the publisher offers it. When fallback is required (cloud IP block, paywall, or RSS genuinely missing), document the reason inline in the feed entry comment.

## Not in scope

- Building the feeds themselves — this plan captures the inventory + prioritization only. Each follow-up PR does its own feed-URL verification and testing.
- Social / Telegram sources — separate audit (see prior PR #2848 for ADS-B military + Telegram baseline).
- Flight tracking data providers — covered by aviation domain; not in this gap list.
- Paid data sources (Notamify etc.) beyond the P8 spike.
