# Kendince

Personal, AI-free outfit workshop: https://kayisu.github.io/kendince/.
The canonical source is `public/kendince/` in this repository. Astro copies it
unchanged to `dist/kendince/`. No model API, account or server is required.
Profile, owned items, saved looks, feedback and manual price observations stay
in browser localStorage (`kendince-v1`); existing IDs and saved slots survive.

## October 22 — Men's style atlas / 07

The male-only update adds **127 distinct models from Folk (33), YMC (35),
Gramicci (27), and Service Works (32)**. Source catalog: **24 storefronts,
1,024 model families and 1,132 product/color records**. One legacy beret record
is retained for identity/history but excluded from clothing discovery and
recommendations; it was incorrectly imported as knitwear. Visible styles have
not been inferred from a brand name alone.

Twelve recipe-backed directions include modern tailoring, heritage and
artisan/craft-led outfits. `style-atlas.json` contains real source product IDs
and explicit assigned slots for 12 reference outfits. The atlas is inspiration
at 16°C, independent of a user's filters. Its actions re-enter the workshop
with the user's budget, climate and profile intact, or filter the catalog by
style. `build-style-atlas.mjs` rebuilds references after reviewed data changes.

Discovery now supports style, cut, color family and declared composition in
addition to existing shop, texture, size and price filters. Default discovery
rotates stores and garment categories. Price sorts remain available. Model/color
grouping, per-product dates, foreign currency disclosures and material warnings
remain explicit; unknown source fit is not labelled regular.

The illustrative male mannequin has revised anatomy, actual shorts, different
trouser widths, garment details and a studio plinth. Without a validated source
texture, source-described patterns use labelled representative SVG motifs.
No body measurement simulation, virtual fit, exact print or drape is claimed.

Source-title repairs prevent Oxford fabric, boot-print tees and Paraboot
collaborations becoming shoes, and prioritize shorts over corduroy texture.
The source importer avoids treating the word boot inside a brand name as a boot.
User localStorage key/version and valid existing source IDs remain unchanged.

Validation includes 12 atlas/assigned-slot checks, combined catalog filters,
store/category variety, preserved budget/climate actions, and clothing identity
regressions. The new style and mannequin suites complement all prior checks.
`verify-live.mjs` compares the two new presentation assets as well as core files.

## Current discovery expansion

The October 18 update adds **369 selected product records from 12 new storefronts**:
A Kind of Guise, Drake’s, Les Benjamins, Norse Projects, Percival, Portuguese
Flannel, Stan Ray, Story mfg., Studio Nicholson, Universal Works, Wax London
and mfpen. The combined catalog has **20 storefronts, 897 source models and
1,005 product/color records**. Existing IDs, ownership and browser state remain.
Selection rotates garment types and avoids filling each source with sibling colors.
Only available feed variants with a successful, identity-checked first-party product
page are accepted. Deleted/draft pages are skipped. Store names and product brands
remain separate, including Paraboot and Clarks products sold by these stores.

Both budget inputs now reach **300,000 TL**, with 10/30/75/150/300-thousand presets.
The explicit “Yeni markalarla kombin dene” action selects the new stores and sets
that discovery ceiling; existing personal budgets are otherwise preserved. The
catalog has a new-brands-only browse toggle, independent of material composition.

**No fabric is automatically excluded.** `materials.js` identifies declared synthetic
fibers (including a small elastane fraction and separate polyester lining), natural
fiber statements, regenerated cellulose and leather statements. Missing percentages
or composition remain explicit. Natural outer fabric is never a certification that
lining, fill, soles and trims are synthetic-free. Composition and uncertainty appear
on product cards, outfit details, alternatives and product modals; outfit cards carry
a short summary. Qualitative statements are retained without invented percentages.

Foreign records preserve source currency/amount, variant prices, and the dated
TCMB selling rate in `priceOrigin`. TL amounts are **estimates for comparison**,
not verified Turkish sale prices or landed cost. Cards, totals and details disclose
conversion; shipping, customs, taxes and availability of Turkish delivery are not
assumed. The current captured rate is the October 16 TCMB bulletin. Original feed
and product-page check times stay separate; cache reuse does not refresh timestamps.

`independent-brands.py --cache /absolute/cache/path` fetches source feeds, shop
currencies, TCMB rates and page evidence, then prepares a local candidate. Add
`--write` for explicit local acceptance; `--cached` reuses captured responses with
their original observation times. It does not commit or deploy. All prior catalog,
season, budget, size and saved-state checks remain deployment gates; material and
300k/discovery UI regression checks were added. Browser pixel QA remains unavailable
in this session; functional DOM tests and static build checks are used.

## October 16 baseline (before the current expansion)

The October 16 expansion replaces a practical single-store recommendation pool
with **8 storefronts, 528 distinct source models and
636 product/color records**. 624 source prices are verified;
581 records have explicit stock evidence. 569 records
have both verified prices and available stock, across all eight storefronts.
7 sold-out records, 48 unknown-stock records and
12 conflicting prices remain visible with their actual status;
they are excluded from default purchase recommendations.

| Storefront | Records | Verified price + available stock |
| --- | ---: | ---: |
| LCW | 295 | 231 |
| Mavi | 48 | 46 |
| DeFacto | 92 | 91 |
| Koton | 85 | 85 |
| Mango | 37 | 37 |
| Decathlon | 31 | 31 |
| Boyner | 32 | 32 |
| AVVA | 16 | 16 |

A storefront and a brand are separate fields. Boyner includes multiple brands;
they do not count as multiple shops. Source model IDs group actual sibling
colors; equal generic titles do not merge unrelated items. Existing Mavi IDs
were retained while their source observations were refreshed.

Every product links to its exact first-party page and image. Per-product
`verifiedAt`, source price observations, stock method, source textile facts,
and response hashes retain the evidence. The overall preparation date does
not imply every product was checked at one instant. Failed sources do not
become invented products. Offer-level InStock is explicitly distinguished
from size-level data: when a purchase size is selected, products without an
available matching size cannot enter recommendations or replacements.

Conditional Boyner cart/coupon offers are separate `conditionalPrice` records.
The regular, cross-checked source price is used in product/variant budgets;
the detail view explains the promotion and its conditions. Shipping, coupons
and cart discounts are never silently deducted. Manual user notes remain
separate from source prices and do not change peer medians.

## Usable variety

Nine visible directions are available: clean casual, earthy, relaxed street,
smart casual, a bolder accent, workwear, preppy, outdoor and tonal.
The last four require recognizable recipes rather than relabeling random
basics. Workwear combines workwear layers and appropriate bottoms/boots;
preppy requires relevant uppers and chinos/formal shoes; outdoor uses actual
technical/outer/fleece constructions; tonal looks constrain actual colors.

The engine scores models before colors, reserves structure/kind/cut options,
and distinguishes texture and visible outermost construction. Store identity
alone never counts as silhouette variety. Recent dominant garments and
12-look history reduce repetition, while a useful owned basic can recur
under different layers. Store filters are hard constraints for new purchases;
owned items still cost zero and remain usable. A structurally limited pool
returns fewer honest cards. Feedback rejects exact model sets across sibling
colors in generation and replacements.

Bounded shortlists preserve a cheapest valid model/color witness. Increasing
budget cannot erase that valid outfit simply because a preferred color is
more expensive. Minimum budgets include the selected style recipe, source
stock, sizes, weather, store selection and disliked combinations. Replacements
revalidate every retained purchase as well as the new piece.

## Feels-like temperature

A manual numeric temperature overrides calendar and legacy weather presets.
The user enters the feels-like value from their weather app; the site does
not request location or fetch a forecast. Season mode remains available and
clears the numeric override. Existing saved state migrates safely.

| Feels-like band | Clothing rules |
| --- | --- |
| 4°C or below | Long-sleeved base + warm mid + insulating outer; 0°C and below also require thicker trousers and boots |
| Above 4°C, below 12°C | Warm long upper or mid, insulating outer and closed non-mesh shoes |
| 12°C to below 18°C | A real removable layer and long trousers |
| 18°C to below 24°C | Light upper arrangement; heavy insulation excluded |
| 24°C or above | Light uppers/bottoms, no heavy knits or boots; 30°C+ requires a single short-sleeved upper |

These are transparent clothing heuristics, not tested comfort guarantees.
Retailer construction facts override generic category names. Waterproof and
windproof do not imply insulation. Contradictory thickness properties cannot
create a heavy insulation claim. Extremely cold inputs of −15°C and below
return an explicit unsupported result when thermal-base evidence is absent.
Insufficient budgets never weaken seasonal rules.

## Browsing and visual preview

“Parça keşfi” supports store, brand, garment, visible texture, text, size,
stock and min/max price filters. Image cards and compact lists group colors
by model by default, with 24-item progressive loading. The same source records
support the outfit cards and actual product-detail photographs.

The illustrative mannequin preserves top/mid/outer slots and independent
open/closed outer layers. Coats, puffers, shells, knit collars, sleeveless
sweater vests and footwear have distinct approximate outlines. Existing source
swatches remain validated against recorded images. Other items use explicitly
labelled representative colors. This is not garment reconstruction, virtual
fit, body measurement simulation or an exact fabric/drape rendering.

## Source maintenance

`python scripts/kendince/refresh-all.py` prepares a candidate and evidence in
`kendince-audit/`; `--write` is an explicit local acceptance step. It never
commits, pushes or deploys. Its components are:

- `refresh.py`: existing LCW source refresh and legacy observations.
- `retailers-a.py`: DeFacto + Koton.
- `retailers-b.py`: Mango + Decathlon + Boyner.
- `retailers-c.py`: Mavi + AVVA, preserving prior IDs.
- `merge-catalog.py`: validates feeds, retains observation history and merges
  reviewed candidates without fabricating timestamps or inventory.

Each new feed accepts `--output FILE` and `--limit N` for bounded review.
The Actions catalog workflow uploads candidates/reports only. No recurring
schedule or automatic source-data publication is installed.

## Validation

Deployment gates on source-evidence invariants, the seasonal/model suite,
focused temperature/diversity/budget regressions, UI DOM integration checks,
42 mannequin checks and the existing real-catalog/application suite. Campaign
prices, unknown sizes, strict stores, saved-look swaps, sibling-color dislikes,
minimum budgets, zero/negative temperatures and all new recipe directions
are covered. Astro/TypeScript, the full portfolio build and static route/bundle
verification remain required. Publication compares nine live files against
the committed bytes.

Browser pixel QA was unavailable in this cloud session because its supported
browser-control skill was not available. DOM rendering and functional checks
were completed without claiming visual browser verification.
