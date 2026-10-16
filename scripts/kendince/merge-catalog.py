"""Merge reviewed first-party feeds without changing source observations.

Writes a candidate by default. --write replaces the checked-in catalog only after
every feed has passed validation. Existing IDs/history survive new observations.
"""
import argparse
import collections
import datetime
import json
import pathlib
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGET = ROOT / 'public/kendince/catalog.json'
REQUIRED = ('id', 'name', 'brand', 'retailer', 'category', 'kind', 'price',
            'url', 'image', 'modelId', 'checkedAt')


def validate(product):
    missing = [key for key in REQUIRED if not product.get(key)]
    if missing:
        raise ValueError(f"{product.get('id')}: missing {', '.join(missing)}")
    if not isinstance(product['price'], (int, float)) or product['price'] <= 0:
        raise ValueError(f"{product['id']}: invalid price")
    if product['category'] not in ('top', 'layer', 'outer', 'bottom', 'shoe'):
        raise ValueError(f"{product['id']}: invalid category")
    for key in ('url', 'image'):
        parsed = urllib.parse.urlparse(product[key])
        if parsed.scheme != 'https' or not parsed.hostname:
            raise ValueError(f"{product['id']}: invalid {key}")
    stock = product.get('stock', {})
    if stock.get('status') not in ('available', 'unknown', 'out_of_stock'):
        raise ValueError(f"{product['id']}: missing stock status")
    if product.get('priceStatus') == 'verified':
        if not product.get('verifiedAt') or not product.get('verification', {}).get('price'):
            raise ValueError(f"{product['id']}: price lacks evidence")
        if not product.get('priceHistory') or product['priceHistory'][-1]['price'] != product['price']:
            raise ValueError(f"{product['id']}: current observation/history mismatch")
    if stock.get('status') == 'available':
        if not stock.get('checkedAt') or not stock.get('method') or not product.get('verification', {}).get('stock'):
            raise ValueError(f"{product['id']}: available stock lacks evidence")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('feeds', type=pathlib.Path, nargs='+')
    parser.add_argument('--base', type=pathlib.Path, default=TARGET)
    parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'kendince-audit/expanded-catalog.json')
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    old = json.loads(args.base.read_text())
    by_id = {p['id']: p for p in old['products']}
    sources = list(old.get('sources', []))
    feed_reports = []
    for path in args.feeds:
        feed = json.loads(path.read_text())
        products = feed['products']
        ids = [p['id'] for p in products]
        if len(set(ids)) != len(ids):
            raise ValueError(f'{path.name}: duplicate IDs')
        for product in products:
            validate(product)
            previous = by_id.get(product['id'])
            if previous:
                history = previous.get('priceHistory', []) + product.get('priceHistory', [])
                observations = {}
                for item in history:
                    observations[(item.get('observedAt') or item.get('date'), item['price'])] = item
                product['priceHistory'] = list(observations.values())[-12:]
            by_id[product['id']] = product
        sources.extend(feed.get('sources', []))
        feed_reports.append({'feed': path.name, 'models': len({(p['retailer'], p['modelId']) for p in products}),
                             'records': len(products), 'stats': feed.get('stats', {}), 'errors': feed.get('errors', [])})
    # Legacy Mavi IDs intentionally remain stable for owned and saved pieces.
    for product in by_id.values():
        if not product.get('retailer'):
            product['retailer'] = product.get('brand') or 'Diğer'
    products = list(by_id.values())
    stamps = [p['verifiedAt'] for p in products if p.get('verifiedAt')]
    eligible = [p for p in products if p.get('priceStatus') == 'verified' and p['stock']['status'] == 'available']
    stats = {'total': len(products), 'modelCount': len({(p['retailer'], p.get('modelId') or p['id']) for p in products}),
             'priceVerified': sum(p.get('priceStatus') == 'verified' for p in products),
             'stockAvailable': sum(p['stock']['status'] == 'available' for p in products),
             'stockOut': sum(p['stock']['status'] == 'out_of_stock' for p in products),
             'stockUnknown': sum(p['stock']['status'] == 'unknown' for p in products),
             'priceConflicts': sum(p.get('verification', {}).get('reason') == 'price_sources_disagree' for p in products),
             'notReverified': sum(not p.get('verifiedAt') for p in products),
             'storeCount': len({p['retailer'] for p in products}), 'eligible': len(eligible),
             'eligibleStores': len({p['retailer'] for p in eligible}),
             'byStore': dict(collections.Counter(p['retailer'] for p in products)),
             'eligibleByStore': dict(collections.Counter(p['retailer'] for p in eligible)),
             'byKind': dict(collections.Counter(p['kind'] for p in eligible))}
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).date().isoformat()
    catalog = {**old, 'schemaVersion': 4, 'checkedAt': today,
               'verifiedAt': max(stamps) if stamps else old.get('verifiedAt'),
               'verificationWindow': {'start': min(stamps), 'end': max(stamps)} if stamps else old.get('verificationWindow'),
               'stats': stats, 'products': products, 'sources': sources}
    report = {'preparedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'stats': stats, 'verificationWindow': catalog['verificationWindow'],
              'sources': sources, 'feeds': feed_reports,
              'method': 'First-party product pages and structured offers. Dates remain per observation. '
                        'Offer-level stock does not imply an available selected size. No invented variants, prices or history.'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    args.output.with_name('expanded-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if args.write:
        TARGET.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
        (TARGET.parent / 'catalog-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
