# SEO Redirect Audit — 15 Sep 2026

REPORT ONLY. No changes made to `_redirects` or site files for redirects.

**GSC context (Desk):** 37 Failed redirect; 17 redirect error (Started). `apex/` shows 20 clicks / 1,578 impr — identity unknown; do not invent meaning.

## Sample: extensionless → .html (www host)

| Request URL | Final URL | HTTP chain (codes) |
|---|---|---|
| `https://www.chandlerinsurancemn.com/quote` | `200 https://chandlerinsurancemn.com/quote.html 2` | first: `301|https://chandlerinsurancemn.com/quote` |
| `https://www.chandlerinsurancemn.com/auto` | `200 https://chandlerinsurancemn.com/auto.html 2` | first: `301|https://chandlerinsurancemn.com/auto` |
| `https://www.chandlerinsurancemn.com/home` | `200 https://chandlerinsurancemn.com/home.html 2` | first: `301|https://chandlerinsurancemn.com/home` |
| `https://www.chandlerinsurancemn.com/snowmobile-insurance-minnesota` | `200 https://chandlerinsurancemn.com/snowmobile-insurance-minnesota.html 2` | first: `301|https://chandlerinsurancemn.com/snowmobile-insurance-minnesota` |
| `https://www.chandlerinsurancemn.com/auto-quote` | `200 https://chandlerinsurancemn.com/auto-quote.html 2` | first: `301|https://chandlerinsurancemn.com/auto-quote` |
| `https://www.chandlerinsurancemn.com/about` | `200 https://chandlerinsurancemn.com/about.html 2` | first: `301|https://chandlerinsurancemn.com/about` |
| `https://www.chandlerinsurancemn.com/services` | `200 https://chandlerinsurancemn.com/services.html 2` | first: `301|https://chandlerinsurancemn.com/services` |
| `https://www.chandlerinsurancemn.com/recreational-quote` | `200 https://chandlerinsurancemn.com/recreational-quote.html 2` | first: `301|https://chandlerinsurancemn.com/recreational-quote` |

## Sample: extensionless → .html (apex / non-www host)

| Request URL | Result |
|---|---|
| `https://chandlerinsurancemn.com/quote` | `200 https://chandlerinsurancemn.com/quote.html 1` | first: `301|https://chandlerinsurancemn.com/quote.html` |
| `https://chandlerinsurancemn.com/auto` | `200 https://chandlerinsurancemn.com/auto.html 1` | first: `301|https://chandlerinsurancemn.com/auto.html` |
| `https://chandlerinsurancemn.com/snowmobile-insurance-minnesota` | `200 https://chandlerinsurancemn.com/snowmobile-insurance-minnesota.html 1` | first: `301|https://chandlerinsurancemn.com/snowmobile-insurance-minnesota.html` |
| `https://chandlerinsurancemn.com/` | `200 https://chandlerinsurancemn.com/ 0` | first: `200|` |

## Sample: www vs non-www on .html canonicals

| Request URL | Result |
|---|---|
| `https://www.chandlerinsurancemn.com/quote.html` | `200 https://chandlerinsurancemn.com/quote.html 1` | first: `301|https://chandlerinsurancemn.com/quote.html` |
| `https://chandlerinsurancemn.com/quote.html` | `200 https://chandlerinsurancemn.com/quote.html 0` | first: `200|` |
| `https://www.chandlerinsurancemn.com/auto.html` | `200 https://chandlerinsurancemn.com/auto.html 1` | first: `301|https://chandlerinsurancemn.com/auto.html` |
| `https://chandlerinsurancemn.com/auto.html` | `200 https://chandlerinsurancemn.com/auto.html 0` | first: `200|` |
| `https://www.chandlerinsurancemn.com/snowmobile-insurance-minnesota.html` | `200 https://chandlerinsurancemn.com/snowmobile-insurance-minnesota.html 1` | first: `301|https://chandlerinsurancemn.com/snowmobile-insurance-minnesota.html` |
| `https://chandlerinsurancemn.com/snowmobile-insurance-minnesota.html` | `200 https://chandlerinsurancemn.com/snowmobile-insurance-minnesota.html 0` | first: `200|` |
| `https://www.chandlerinsurancemn.com/home.html` | `200 https://chandlerinsurancemn.com/home.html 1` | first: `301|https://chandlerinsurancemn.com/home.html` |
| `https://chandlerinsurancemn.com/home.html` | `200 https://chandlerinsurancemn.com/home.html 0` | first: `200|` |
| `https://www.chandlerinsurancemn.com/` | `200 https://chandlerinsurancemn.com/ 1` | first: `301|https://chandlerinsurancemn.com/` |
| `https://chandlerinsurancemn.com/` | `200 https://chandlerinsurancemn.com/ 0` | first: `200|` |

## Sample: legacy / Wix-style paths from `_redirects`

| Request URL | Result |
|---|---|
| `https://www.chandlerinsurancemn.com/get-a-free-quote` | `200 https://chandlerinsurancemn.com/quote.html 2` | first: `301|https://chandlerinsurancemn.com/get-a-free-quote` |
| `https://www.chandlerinsurancemn.com/about-us` | `200 https://chandlerinsurancemn.com/about.html 2` | first: `301|https://chandlerinsurancemn.com/about-us` |
| `https://www.chandlerinsurancemn.com/auto-insurance-grand-rapids-virginia-mn` | `200 https://chandlerinsurancemn.com/auto.html 2` | first: `301|https://chandlerinsurancemn.com/auto-insurance-grand-rapids-virginia-mn` |
| `https://www.chandlerinsurancemn.com/client-center` | `200 https://chandlerinsurancemn.com/ 2` | first: `301|https://chandlerinsurancemn.com/client-center` |
| `https://www.chandlerinsurancemn.com/business-insurance-minnesota.html` | `200 https://chandlerinsurancemn.com/commercial-insurance.html 2` | first: `301|https://chandlerinsurancemn.com/business-insurance-minnesota.html` |

## Notes / findings

- Curl sample run from agent box against live production (www + apex).
- Compare first-hop vs final: expect 301! from extensionless → `.html` per `_redirects`, then hopefully 200.
- GSC Failed redirect (37) / redirect error (17) may include chains, soft 404s, or host mismatches — this sample does not claim to enumerate all 37.
- `apex/` traffic mystery: GSC lists `apex/` with material clicks/impr; this audit does **not** invent what that path is. Flag for Website/Josh before any redirect change.
- No `_redirects` edits in this pass.

## Local `_redirects` inventory (read-only)

- File: `_redirects` present; includes force 301! consolidation extensionless → `.html` for main product/location/quote paths.
- Also legacy Wix paths → product pages; thin commercial `.html` → `commercial-insurance.html`.
- Preferred canonical form noted in file comments: `https://chandlerinsurancemn.com/<page>.html` (homepage `/`).


## Interpreted findings (sample only)

1. **Host canonical:** `www.chandlerinsurancemn.com` → `chandlerinsurancemn.com` with **301** (non-www is preferred). Every www hit adds **+1 redirect hop** before content.
2. **Extensionless → `.html`:** Sampled paths (`/quote`, `/auto`, `/home`, `/snowmobile-insurance-minnesota`, `/auto-quote`, etc.) ultimately land on the matching `.html` URL with **200**. On www, first hop is often host strip (www→apex) then path redirect — **2 redirects** before 200 (visible as `num_redirects=2` on some legacy paths; extensionless www samples should be checked in table above).
3. **Legacy Wix paths:** `/get-a-free-quote`, `/about-us`, `/auto-insurance-grand-rapids-virginia-mn`, `/client-center`, `/business-insurance-minnesota.html` all reach intended targets (quote/about/auto/home/commercial) with multi-hop chains on www.
4. **Possible GSC noise drivers (hypothesis, not proven):** multi-hop www+extensionless chains; any remaining soft-404 or broken legacy rules not in this sample; GSC “Failed redirect” / “redirect error” counts (37 / 17) are **not** fully explained by this curl sample.
5. **`apex/` mystery:** GSC page dimension lists `apex/` with **20 clicks / 1,578 impr**. This audit did **not** resolve what `apex/` is. Do not invent. Clarify with Website/Josh before changing redirects.
6. **No changes:** `_redirects` untouched this pass.

