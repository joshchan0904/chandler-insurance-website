# SEO Harden — 15 Sep 2026

Desk PRIORITY work in `/workspace/chandler-insurance-website` only. No deploy. No new pages. Preview server left alone. Live-synced pages preserved (no Ubuntu Aug overwrite).

## 1–2) Title & meta shorten batch (before → after)

| Page | Before title (len) | After title (len) | Before meta (len) | After meta (len) |
|---|---|---|---|---|
| `life.html` | Life Insurance Grand Rapids & Virginia MN \| Chandler Insurance Agency (**69**) | Life Insurance \| Grand Rapids & Virginia MN \| Chandler (**54**) | Protect your family's future with life insurance from Chandler Insurance Agency. Term, whole life, and final expense coverage tailored for families in Grand Rapids, Virginia, and across Minnesota. (**196**) | Term, whole life & final expense coverage for Grand Rapids & Virginia MN. Chandler Insurance Agency since 1977. Protect your family with a free quote. (**150**) |
| `home.html` | Free Home Insurance Quote \| Compare Top Carriers – Chandler Insurance Since 1977 (**80**) | Home & Cabin Insurance \| Ice Dam \| Chandler Since 1977 (**54**) | Get a fast, free home & cabin insurance quote from an independent agency. We shop top carriers for the best rates including ice dam coverage. Serving Minnesota since 1977. (**171**) | Home & cabin insurance with ice dam coverage in Minnesota. Independent Chandler Insurance Agency since 1977. Free quotes for Grand Rapids & Virginia. (**149**) |
| `business.html` | Free Business Insurance Quote \| Compare Top Carriers – Chandler Insurance Since 1977 (**84**) | Business Insurance \| Liability, BOP & Workers Comp \| Chandler (**61**) | Get a fast, free business insurance quote from an independent agency. We shop top carriers for the best rates on liability, BOP & workers’ comp. Serving Minnesota since 1977. (**174**) | Business liability, BOP & workers comp from Chandler Insurance. Independent agency serving Minnesota since 1977. Free quotes in Grand Rapids & Virginia. (**152**) |
| `recreational.html` | Recreational Vehicle Insurance Minnesota \| ATV, Snowmobile, Boat & RV – Chandler Insurance (**90**) | ATV, Snowmobile, Boat & RV Insurance MN \| Chandler (**50**) | Recreational vehicle insurance in Minnesota for ATVs, snowmobiles, boats & RVs. Independent agency comparing top carriers since 1977. Serving Grand Rapids, Virginia & all of MN. (**177**) | ATV, snowmobile, boat & RV insurance across Minnesota. Chandler Insurance compares top carriers since 1977. Serving Grand Rapids, Virginia & all of MN. (**151**) |
| `landlord.html` | Landlord & Rental Insurance Grand Rapids MN \| Chandler Insurance Agency (**71**) | Landlord Insurance \| Grand Rapids & Virginia MN \| Chandler (**58**) | Protect your rental properties with landlord insurance from Chandler Insurance Agency. Dwelling, liability, loss of rents, and tenant screening coverage for landlords in Grand Rapids, Virginia, and across Minnesota. (**215**) | Landlord & rental insurance for Minnesota property owners. Dwelling, liability & loss of rents from Chandler Insurance since 1977. Free quotes available. (**153**) |
| `commercial-insurance.html` | Commercial Insurance Grand Rapids MN \| Business Insurance Virginia MN \| Chandler Insurance (**90**) | Commercial Insurance \| Grand Rapids & Virginia MN \| Chandler (**60**) | Commercial insurance for businesses in Grand Rapids, Virginia & Itasca County. General liability, BOP, workers comp, commercial auto and contractors insurance from a local independent agency since 1977. (**202**) | Commercial insurance for Grand Rapids, Virginia & Itasca County. Liability, BOP, workers comp & commercial auto from Chandler Insurance since 1977. (**147**) |
| `grand-rapids-mn-insurance.html` | Insurance Grand Rapids MN \| Auto, Home, Business & More \| Chandler Insurance (**76**) | Insurance Agency Grand Rapids MN \| Chandler Since 1977 (**54**) | Local insurance agency serving Grand Rapids and Itasca County since 1977. Get fast, free quotes for auto, home, business, recreational, life and landlord insurance from an independent agent who knows Northern Minnesota. (**219**) | Local insurance in Grand Rapids & Itasca County since 1977. Auto, home, business, life & more from Chandler Insurance. Free quotes from a local agent. (**150**) |
| `about.html` | About Us \| Chandler Insurance Agency \| Grand Rapids & Virginia MN Since 1977 (**76**) | About Chandler Insurance \| Grand Rapids & Virginia Since 1977 (**61**) | Meet the team at Chandler Insurance Agency. Family-owned since 1977, proudly serving families and businesses across all of Minnesota with personalized auto, home, business, and recreational insurance. (**200**) | Family-owned Chandler Insurance Agency since 1977. Meet our team serving Minnesota with auto, home, business & recreational coverage in Grand Rapids & Virginia. (**160**) |
| `schedule.html` | Schedule Appointment \| Chandler Insurance Agency Grand Rapids & Virginia MN (**75**) | Schedule Appointment \| Chandler Insurance \| Grand Rapids MN (**59**) | Book a consultation at our Grand Rapids office (Mon–Fri) or Virginia office (appointments Monday and Wednesday only). Call (218) 326-4655 or request a time online. (**163**) | Book a consultation at our Grand Rapids office (Mon–Fri) or Virginia office (appointments Mon & Wed). Call (218) 326-4655 or request a time online. (**147**) |
| `services.html` | Insurance Services \| Auto, Home, Business \| Grand Rapids & Virginia MN (**70**) | Insurance Services \| Auto, Home, Business \| Chandler MN (**55**) | Comprehensive insurance services in Minnesota. Auto, Home, Business, Recreational, Life, and Landlord insurance from Chandler Insurance Agency since 1977. (**154**) | Comprehensive insurance services in Minnesota. Auto, Home, Business, Recreational, Life, and Landlord insurance from Chandler Insurance Agency since 1977. (**154**) |
| `blog.html` | Insurance Resources & Guides \| Minnesota Insurance Tips – Chandler Insurance (**76**) | Insurance Guides & Tips \| Minnesota \| Chandler Insurance (**56**) | Helpful guides and articles about auto, home, business, and recreational insurance in Minnesota. Expert advice from Chandler Insurance Agency since 1977. (**153**) | Helpful guides and articles about auto, home, business, and recreational insurance in Minnesota. Expert advice from Chandler Insurance Agency since 1977. (**153**) |

On each edited page above, matching `og:title` / `og:description` / `twitter:title` / `twitter:description` were synced to the new title/description (where those tags exist). Brand **Chandler Insurance** retained. No keyword stuffing.

### Untouched (per Desk rules)
- `index.html` homepage title / meta / JSON-LD — **not changed** (Labor Day UI only).
- `quote.html`, `virginia-mn-insurance.html`, `auto.html` titles/meta, `business-quote.html`, `snowmobile-insurance-minnesota.html`
- favicon, sitemap membership, robots, redirects, URLs

Note: `auto.html` title/meta left untouched; only CTA hrefs updated (see below).

## 3) Labor Day 2026 removal (`index.html` only)

Removed expired Labor Day banner:
- HTML block `.labor-day-notice`
- All `.labor-day-*` CSS (including `html.labor-day-over` rules and related media queries)
- Head date-gate script that added `labor-day-over`
- Body script that queried `.labor-day-notice` and removed it after 2026-09-08

**Confirm:** zero `labor-day` / `Labor Day` string leftovers in `index.html`. Homepage title/meta/JSON-LD unchanged.

## 4) CTA polish → `quote.html` (`/quote`)

Primary header **Get Quote** + main hero/final CTA buttons now point to `/quote` (site extensionless URL for `quote.html`). Product `*-quote.html` links may remain as secondary.

| Page | Nav Get Quote | Main CTA | Secondary retained |
|---|---|---|---|
| `home.html` | `/home-quote` → `/quote` | `/home-quote` → `/quote` | — |
| `business.html` | `/business-quote` → `/quote` | `/business-quote` → `/quote` | — |
| `recreational.html` | `/recreational-quote` → `/quote` | `/recreational-quote` → `/quote` | — |
| `landlord.html` | `/home-quote` → `/quote` | `/landlord-quote` → `/quote` | — |
| `life.html` | already `/quote` | `/life-quote` → `/quote` | — |
| `commercial-insurance.html` | already `/quote` | hero `/business-quote` → `/quote` | bottom CTA still `/business-quote` |
| `auto.html` | `/auto-quote` → `/quote` | `/auto-quote` → `/quote` | JSON-LD Offer URL still auto-quote (not a button) |

## 5) Cabin mention on `home.html`

**No copy added.** `home.html` already clearly covers cabin / seasonal / lake-home intent in H1 (“Home & Cabin Insurance”), body sections, ice-dam coverage, and FAQ (“Can I insure my cabin if I only use it seasonally?”). CTAs now point to `/quote` (and `home-quote.html` remains available as a product page). No new URL / no `cabin.html`.

## Verification table (python `len()`, HTML entities decoded)

| File | title len | description len |
|---|---:|---:|
| `life.html` | 54 | 150 |
| `home.html` | 54 | 149 |
| `business.html` | 61 | 152 |
| `recreational.html` | 50 | 151 |
| `landlord.html` | 58 | 153 |
| `commercial-insurance.html` | 60 | 147 |
| `grand-rapids-mn-insurance.html` | 54 | 150 |
| `about.html` | 61 | 160 |
| `schedule.html` | 59 | 147 |
| `services.html` | 55 | 154 |
| `blog.html` | 56 | 153 |
| `index.html` | 37 | 156 |
| `auto.html` | 54 | 155 |

## Success checklist

- [x] Changelog written
- [x] Labor Day gone from `index.html`
- [x] `life.html` meta ~150–160 (150)
- [x] Batch titles shortened (~50–65 where targeted)
- [x] No new pages
- [x] Homepage / quote titles untouched


## Follow-up CTA path
Primary CTAs updated from `/quote` → `quote.html` so local preview works and live avoids an extra 301 hop (GSC redirect noise).

## Follow-up internal links
Also restored `.html` paths on footers of CTA-edited pages (avoid `/about`→`about.html` 301 hops; local preview works).


## Follow-up — Snowmobile CTR + Auto + Cabin expand (15 Sep 2026, afternoon)

Live-synced pages rewritten in place. **No deploy. No new URLs.** Primary CTAs use `quote.html` (not `/quote`).

### Title / meta (before → after)

| Page | Before title (len) | After title (len) | Before meta (len) | After meta (len) |
|---|---|---|---|---|
| `snowmobile-insurance-minnesota.html` | Snowmobile Insurance Quote MN \| Grand Rapids, Virginia (**49**) | Snowmobile Insurance in Minnesota \| Chandler Quotes (**51**) | Get a free snowmobile quote in Minnesota. Compare liability, comprehensive, and storage. Serving Grand Rapids, Virginia, Itasca County & all of MN since 1977. (**157**) | MN snowmobile insurance for Grand Rapids & Virginia. Free quote covering liability, comprehensive & winter storage. Chandler Insurance since 1977. (**146**) |
| `auto.html` | Auto Insurance \| Grand Rapids & Virginia MN \| Chandler (**54**) | Chandler Auto Insurance \| Grand Rapids & Virginia MN (**52**) | Auto coverage for Minnesota winters and rural roads. Independent agency in Grand Rapids and Virginia, MN since 1977. Get a free quote. Call (218) 326-4655. (**155**) | Chandler auto insurance for Minnesota winters, deer & hail. Free quotes in Grand Rapids & Virginia. Independent agency since 1977. Call (218) 326-4655. (**151**) |
| `auto-quote.html` | Free Auto Insurance Quote Minnesota \| Compare Top Carriers – Chandler Insurance (**80**) | Free Auto Insurance Quote \| Chandler Grand Rapids MN (**52**) | Get a fast, free auto insurance quote from an independent agency. We shop 15+ top carriers for the best rates. Serving Grand Rapids, Virginia & all of Minnesota since 1977. Call (218) 326-4655. (**196**) | Get a free Chandler auto insurance quote in Minnesota. Local agents serving Grand Rapids & Virginia since 1977. Fast, no-obligation quotes today. (**145**) |
| `home.html` | *(kept from prior pass)* Home & Cabin Insurance \| Ice Dam \| Chandler Since 1977 (**54**) | **unchanged** | *(kept)* Home & cabin insurance with ice dam coverage… Free quotes for Grand Rapids & Virginia. (**149**) | **unchanged** (no meta tweak needed for cabin expand) |

Matching `og:title` / `og:description` / `twitter:title` / `twitter:description` synced on snowmobile, auto, and auto-quote.

### On-page / CTA notes

- **Snowmobile:** H1 → “Snowmobile Insurance in Minnesota”; northern MN trails/storage/bundle section; 5 FAQs + matching FAQPage JSON-LD; primary CTAs → `quote.html`, secondary → `recreational-quote.html`; nav/footer → `.html` paths; softened “significant savings” claim.
- **Auto:** H1 clarifies Chandler + northern MN; hero + final CTA → `quote.html` (secondary `auto-quote.html`); nav/footer → `.html` paths.
- **Auto-quote:** Title/meta only; form intact.
- **Home cabin expand:** New “Seasonal & Lake Cabin Insurance in Northern Minnesota” section before FAQs (vacancy, ice dams, frozen pipes, northern MN — no fake %, no carrier names, no savings claims). CTA line → `quote.html` + `home-quote.html`. Added 2 FAQs (vacancy; frozen pipes) + FAQPage JSON-LD entries. **No `cabin.html`.**

### Still out of scope this pass
- Deploy; new pages; `_redirects` edits (see `SEO-REDIRECT-AUDIT-2026-09-15.md`).
