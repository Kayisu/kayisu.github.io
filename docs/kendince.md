# Kendince

Standalone outfit workshop at https://kayisu.github.io/kendince/. Runtime files in `public/kendince/` are copied unchanged to `dist/kendince/`. Document base and canonical URL use `/kendince/`. No AI, server, framework island or model API is used.

## Catalog and evidence

The 2026-10-14 update expands the catalog from 36 to 204 products with stable IDs and first-party page/image URLs. 175 LCW prices were cross-checked against product-page metadata and `view_item` values. Exact color-option variant quantities show 127 products with stock, 6 fully sold out, and 42 whose size quantities could not be confirmed. The 29 existing Mavi records could not be reverified in this run and keep their old price dates with `priceStatus: unverified`, `stock.status: unknown`. Overall stock unknown: 71. No positive stock is inferred from a size button merely being present.

The verification window is 2026-10-14 18:32:20–18:32:59 UTC (21:32 Turkey). `catalog-audit.json` preserves sources, counts, and unavailable verification reasons. The data is a dated snapshot, not a live inventory service. Each verified product includes source timestamp, body hash, individual variant quantities and prices. History includes only actual retained observations; newly discovered products start with one observation.

## Rules and pricing

Default recommendations require a verified price and available stock. Optional upper size, pant waist or exact waist/length label, and EU shoe size select available variants. XXL and 2XL aliases are recognized. Owned and custom wardrobe items require no purchase stock and count as zero new spending. For variant prices, the most expensive matching available size is used so the budget is conservative; exact profile selections narrow this set. Manual price notes override outfit spending, but never alter comparison medians.

Price bands compare the same category and product kind among at least four verified, available products matching the profile size. Quartiles label low/middle/high; median and min/max are exposed. Broad category summary cards are labeled separately. This is a selected catalog price comparison, not a quality score or a market-wide cheapest-price claim. Shipping, coupons and cart discounts are excluded. Outfit details show compatible lower-spending alternatives.

Pairing uses color, fit, occasion, weather, explicit feedback and a bounded candidate shortlist. Like/dislike feedback changes five preference axes. The algorithm avoids thin shirt layers over sweatshirts. Local user data continues to use `kendince-v1` and retains existing saved outfits, IDs, likes, wardrobe items and manual notes. It is stored only in browser localStorage; no user records are committed. Typography and controls are larger across desktop and mobile.

## Validation and refreshing

`node scripts/kendince/test.mjs` checks catalog evidence, 75 budget/weather/style/size scenarios, stock and size aliases, conservative prices, owned exceptions, genuine source history, alternatives and application flows with a DOM mock. The Pages workflow runs this check, Astro/TypeScript, the portfolio build, and route/bundle verification before deployment. Browser visual verification was unavailable during this update.

`Kendince catalog audit` is a read-only GitHub Actions workflow. `scripts/kendince/refresh.py` fetches anonymous public LCW pages and emits a candidate catalog and report in logs/artifacts. It has `contents: read`, no schedule, no automatic repository commit or push. A maintainer must review and publish the candidate. The application makes no automatic background retailer requests. Retailer photos stay on the source CDNs; `no-referrer` is preserved for their access policy. CSS/module URLs are versioned and catalog fetch avoids a stale HTTP cache.
