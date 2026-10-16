"""Build a first-party DeFacto / Koton catalog candidate without publishing it.

Anonymous, read-only HTML requests. Product prices must agree between JSON-LD
and a separate first-party product data object. DeFacto size quantities are
reported only when present; Koton's offer availability is not a size claim.
Run: python scripts/kendince/retailers-a.py --output /tmp/catalog-a.json
"""
import argparse
import collections
import concurrent.futures
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
import pathlib
import re
import subprocess
import unicodedata
from urllib.parse import urlparse

UTC = dt.timezone.utc
TR = dt.timezone(dt.timedelta(hours=3))
CACHE = pathlib.Path('/tmp/kendince-retailers-a-http')
ALLOWED = {'www.defacto.com.tr', 'www.koton.com'}
# Garment construction and role take priority over additional colors.
PLAN = [
    ('DeFacto', '/erkek-kazak', 'top', 13),
    ('Koton', '/erkek-kazak-suveter/', 'top', 13),
    ('DeFacto', '/erkek-hirka-suveter', 'layer', 10),
    ('Koton', '/erkek-hirka/', 'layer', 10),
    ('DeFacto', '/erkek-dis-giyim', 'outer', 12),
    ('Koton', '/erkek-ceket/', 'outer', 12),
    ('DeFacto', '/erkek-oduncu-gomlek', 'layer', 9),
    ('Koton', '/erkek-kaban/', 'outer', 7),
    ('DeFacto', '/erkek-jean-pantolon', 'bottom', 9),
    ('Koton', '/erkek-pantolon/', 'bottom', 13),
    ('DeFacto', '/erkek-pantolon', 'bottom', 12),
    ('Koton', '/erkek-mont/', 'outer', 10),
    ('DeFacto', '/erkek-sweatshirt', 'top', 10),
    ('Koton', '/erkek-gomlek/', 'layer', 9),
    ('DeFacto', '/erkek-yagmurluk', 'outer', 6),
    ('Koton', '/erkek-sweatshirt/', 'top', 9),
    ('Koton', '/dokulu-kazak-erkek/', 'top', 8),
    ('DeFacto', '/erkek-deri-ceket', 'outer', 6),
    ('DeFacto', '/erkek-bomber-ceket', 'outer', 6),
]
HOST = {'DeFacto': 'https://www.defacto.com.tr', 'Koton': 'https://www.koton.com'}
# Exact first-party product URLs found through the retailer's indexed pages.
# These fill construction/material gaps rather than adding color variants.
SEEDS = [
    ('DeFacto', 'https://www.defacto.com.tr/100-yun-standart-fit-dik-yaka-yarim-fermuarli-triko-kazak-3314695', 'top'),
    ('DeFacto', 'https://www.defacto.com.tr/100-yun-standart-fit-polo-yaka-triko-kazak-3314715', 'top'),
    ('DeFacto', 'https://www.defacto.com.tr/100-yun-standart-fit-bisiklet-yaka-triko-kazak-3314685', 'top'),
    ('DeFacto', 'https://www.defacto.com.tr/wide-leg-kargo-cepli-duz-paca-kadife-pantolon-3195201', 'bottom'),
    ('DeFacto', 'https://www.defacto.com.tr/tailored-regular-fit-kadife-duz-paca-pantolon-3315061', 'bottom'),
]


def now():
    return dt.datetime.now(UTC).isoformat()


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value).lower().replace('ı', 'i')) if not unicodedata.combining(c))


def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', str(value)))).strip()


def fetch(url):
    if urlparse(url).hostname not in ALLOWED:
        raise ValueError('Source hostname is not supported')
    CACHE.mkdir(exist_ok=True)
    key = hashlib.sha256(url.encode()).hexdigest()
    page, evidence = CACHE / (key + '.html'), CACHE / (key + '.json')
    if page.exists() and evidence.exists() and dt.datetime.now().timestamp() - page.stat().st_mtime < 3600:
        return page.read_text(), json.loads(evidence.read_text())
    process = subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '35', url], capture_output=True)
    if process.returncode:
        raise ValueError('Anonymous source fetch failed (curl %d)' % process.returncode)
    raw = process.stdout.decode('utf-8', 'replace')
    if len(raw) < 5000:
        raise ValueError('Source did not return a product/category HTML page')
    info = {'url': url, 'retrievedAt': now(), 'bodyHash': hashlib.sha256(raw.encode()).hexdigest()}
    page.write_text(raw)
    evidence.write_text(json.dumps(info))
    return raw, info


class Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def ld_product(raw):
    decoder = json.JSONDecoder()
    for blob in re.findall(r'<script[^>]*type=["\']?application/ld\+json["\']?[^>]*>(.*?)</script>', raw, re.S | re.I):
        try:
            obj, _ = decoder.raw_decode(blob.strip())
            objects = obj if isinstance(obj, list) else [obj]
            for item in objects:
                if item.get('@type') == 'Product':
                    return item
        except (ValueError, AttributeError):
            continue
    raise ValueError('Missing first-party Product JSON-LD')


def div_json(raw, classname):
    found = re.search(r'<div[^>]*class=["\'][^"\']*\b' + re.escape(classname) + r'\b[^"\']*["\'][^>]*>\s*(\{.*?\})\s*</div>', raw, re.S)
    return json.loads(found.group(1)) if found else {}


def family(color):
    color = norm(color)
    for needles, result in [(['siyah', 'black'], 'black'), (['antrasit', 'gri', 'grey'], 'gray'), (['lacivert', 'navy'], 'navy'), (['mavi', 'indigo', 'blue', 'petrol'], 'blue'), (['bej', 'ekru', 'beyaz', 'krem', 'tas', 'ecru'], 'cream'), (['kahve', 'brown', 'camel', 'deve', 'taba', 'kum'], 'brown'), (['yesil', 'haki', 'green', 'olive', 'mint'], 'olive'), (['bordo', 'kirmizi', 'kiremit'], 'red'), (['mor', 'purple'], 'purple'), (['sari', 'yellow'], 'yellow')]:
        if any(word in color for word in needles):
            return result
    return 'gray'


def classify(name, hint, facts):
    n = norm(name)
    if hint == 'bottom' or 'pantolon' in n:
        return 'bottom', 'cargo' if 'kargo' in n else 'corduroy' if 'kadife' in n else 'jean' if re.search(r'jean|denim|\bkot\b', n) else 'jogger' if re.search('jogger|esofman', n) else 'chino'
    if 'hirka' in n:
        return 'layer', 'cardigan'
    if 'suveter' in n or 'yelek' in n:
        return ('outer', 'jacket') if re.search('sisme|dolgulu', n) else ('layer', 'vest')
    if 'gomlek ceket' in n or ('oduncu' in n and 'gomlek' in n):
        return 'layer', 'overshirt'
    if re.search('kaban|palto', n):
        return 'outer', 'coat'
    if 'parka' in n:
        return 'outer', 'parka'
    if re.search('yagmurluk|trenckot', n):
        return 'outer', 'raincoat'
    if 'sisme' in n or 'puffer' in n:
        return 'outer', 'puffer'
    if 'blazer' in n:
        return 'outer', 'blazer'
    if re.search('ceket|mont|bomber', n):
        return 'outer', 'jacket'
    if re.search('kazak|triko', n):
        return 'top', 'turtleneck' if re.search('balikci|bogazli|dik yaka', n) and 'fermuar' not in n else 'knit'
    if 'gomlek' in n:
        return 'layer', 'shirt'
    if 'sweat' in n or 'kapuson' in n or 'kapson' in n:
        return ('layer', 'cardigan') if re.search('fermuarli|tam fermuar', n) and 'yarim' not in n else ('top', 'hoodie' if re.search('kapuson|kapson', n) else 'sweat')
    return hint, 'longtee' if 'uzun kollu' in n else 'polo' if 'polo' in n else 'tee'


def dimensions(name, kind, facts):
    fitlabel = next((v for k, v in facts.items() if norm(k) in ['kalip', 'fit', 'kesim']), '')
    fittext = norm(fitlabel + ' ' + name)
    fit = 'wide' if re.search('loose|oversize|relax|baggy|rahat|bol kesim|wide', fittext) else 'slim' if re.search('slim|skinny|dar kesim', fittext) else 'regular'
    thickness = ' '.join(v for k, v in facts.items() if 'kalin' in norm(k))
    thick = norm(thickness)
    # Conflicting source attributes are retained as facts and do not justify a
    # stronger insulation assertion. Defaults are recommendation heuristics.
    warmth = 2 if 'kalin' in thick and 'ince' in thick else 3 if 'kalin' in thick else 1 if 'ince' in thick else 3 if kind in ['coat', 'parka', 'puffer'] else 2 if kind in ['knit', 'turtleneck', 'cardigan', 'sweat', 'hoodie', 'corduroy'] else 1
    formal = 2 if kind in ['chino', 'coat', 'blazer', 'turtleneck'] else 0 if fit == 'wide' or kind in ['cargo', 'hoodie', 'sweat', 'jogger'] else 1
    return fit, fitlabel, warmth, formal


def product(job):
    retailer, url, hint, discovery = job
    raw, evidence = fetch(url)
    ld = ld_product(raw)
    offer = ld.get('offers', {})
    if isinstance(offer, list):
        offer = offer[0] if offer else {}
    if offer.get('priceCurrency') != 'TRY':
        raise ValueError('Price is not explicitly denominated in TRY')
    price = float(offer['price'])
    values = [price]
    facts, variants = {}, []
    if retailer == 'DeFacto':
        match = re.search(r'window\.VIEWED_PRODUCT\s*=\s*', raw)
        if not match:
            raise ValueError('Missing independent first-party VIEWED_PRODUCT price data')
        data, _ = json.JSONDecoder().raw_decode(raw[match.end():])
        if data.get('ServedFromStaleCache'):
            raise ValueError('Retailer reports this product data was served from stale cache')
        if data.get('ProductGender') not in ['Erkek', 'Man', 'Male'] and str(data.get('ProductCategoryGender', '')).lower() not in ['erkek', 'man', 'male']:
            # Some first-party pages encode the gender in categories instead.
            gender = ' '.join(str(x.get('CategoryName', '')) for x in data.get('ProductDetailCategories', []))
            if 'Erkek' not in gender or 'Çocuk' in gender:
                raise ValueError('Product is not verified adult menswear')
        values.append(float(data['ProductVariantDiscountedPriceInclTax']))
        name = data.get('ProductVariantLongWebName') or ld['name']
        color = data.get('ProductVariantColorName') or 'Belirtilmedi'
        sku = data.get('ProductLongCode') or data.get('ProductMainCode')
        model = data.get('ProductCode') or discovery.get('model')
        if not model:
            raise ValueError('Missing real model identifier')
        pid = str(data.get('ProductVariantIndex') or url.rsplit('-', 1)[-1])
        facts = {x['AttributeName']: str(x.get('TagName', '')) for x in data.get('ProductVariantPropertyDatas', []) if x.get('AttributeName')}
        material = data.get('CompositionDescription') or 'Belirtilmedi'
        facts.update({'Ana Kumaş İçeriği': material, 'Ürün Tipi': data.get('ProductCategoryName', ''), 'Kaynak Sezon': data.get('ProductSeasonName', ''), 'Üretim Menşei': data.get('CountryOfOrigin', '')})
        match = re.search(r'(?<!var )PRODUCT_DETAIL_SIZE_DATA\s*=\s*(\[)', raw)
        if match:
            sizes, _ = json.JSONDecoder().raw_decode(raw[match.start(1):])
            for row in sizes:
                if row.get('Size') and isinstance(row.get('StockQuantity'), (int, float)):
                    size = str(row['Size']) + ('/' + str(row['Length']) if row.get('Length') else '')
                    qty = int(row['StockQuantity'])
                    variants.append({'size': size, 'available': qty > 0, 'quantity': qty, 'price': price})
        desc = clean(data.get('ProductVariantLongDescription') or ld.get('description', ''))
        source_price = 'Product JSON-LD offers + VIEWED_PRODUCT discounted price'
        facts_source = 'VIEWED_PRODUCT textile composition and product variant attributes'
    else:
        ga = div_json(raw, 'js-ga4-product')
        insider = div_json(raw, 'insider-analytics-data')
        if 'price' not in ga or not ga.get('base_code'):
            raise ValueError('Missing independent GA4 product price or model identifier')
        values.append(float(ga['price']))
        if insider.get('unit_sale_price') is not None:
            values.append(float(insider['unit_sale_price']))
        if ga.get('item_category3') != 'MEN':
            raise ValueError('Product is not verified adult menswear')
        name, color, sku, model = ld['name'], ld.get('color') or insider.get('color') or 'Belirtilmedi', ld.get('sku', ''), ga['base_code']
        pid = re.search(r'data-product-page="true"', raw)
        tag = re.search(r'<div[^>]*class="product-page js-product-page"[^>]*data-pk="(\d+)"', raw)
        pid = tag.group(1) if tag else str(sku)
        for block in re.findall(r'<div[^>]*class="[^"]*modal-product-attributes-text[^"]*"[^>]*>(.*?)</div>', raw, re.S):
            match = re.search(r'<strong>(.*?)</strong>\s*:\s*(.*)', block, re.S)
            if match:
                key, value = clean(match.group(1)), clean(match.group(2))
                if key not in ['Posta Adresi', 'E-Posta Adresi', 'Modelin Ölçüleri', 'Modelin Bedeni', 'Satıcı/İmalatçı/İthalatçı İsmi']:
                    facts[key] = value
        material = facts.get('Kumaş', 'Belirtilmedi')
        facts['Kaynak Sezon'] = ga.get('item_season', '')
        descmatch = re.search(r'<div[^>]*class="[^"]*product-info__description[^"]*"[^>]*>(.*?)</div>', raw, re.S)
        desc = clean(descmatch.group(1)) if descmatch else clean(ld.get('description', ''))
        source_price = 'Product JSON-LD offers + GA4 product price + insider analytics price'
        facts_source = 'Product-page product attributes modal + GA4 season'
    if not (0 < price < 100000):
        raise ValueError('Invalid price')
    consistent = len(values) > 1 and max(values) - min(values) < .021
    if not consistent:
        raise ValueError('First-party product price sources disagree: ' + str(values))
    category, kind = classify(name, hint, facts)
    fit, fitlabel, warmth, formal = dimensions(name, kind, facts)
    images = ld.get('image', [])
    images = [images] if isinstance(images, str) else images
    images = [i for i in images if isinstance(i, str) and i.startswith('https://')]
    if not images:
        raise ValueError('Missing exact product image')
    stamp = evidence['retrievedAt']
    day = dt.datetime.fromisoformat(stamp).astimezone(TR).date().isoformat()
    availability = str(offer.get('availability', '')).rsplit('/', 1)[-1]
    status = 'available' if availability == 'InStock' else 'out_of_stock' if availability in ['OutOfStock', 'Discontinued', 'SoldOut'] else 'unknown'
    method = 'product_json_ld_offer_availability'
    if variants:
        status = 'available' if any(v['available'] for v in variants) else 'out_of_stock'
        method = 'product_page_size_quantity'
    return {
        'id': retailer.lower() + '-' + str(pid), 'sku': str(sku), 'modelId': retailer.lower() + ':' + str(model),
        'name': name, 'brand': retailer, 'retailer': retailer, 'seller': retailer,
        'category': category, 'kind': kind, 'price': price, 'originalPrice': price,
        'url': url, 'source': 'Ürünün resmî mağaza sayfası', 'checkedAt': day, 'verifiedAt': stamp,
        'priceStatus': 'verified', 'color': color, 'family': family(color), 'fit': fit,
        'fitLabel': fitlabel or {'wide': 'Rahat / bol', 'slim': 'Dar / slim', 'regular': 'Regular / düz'}[fit],
        'material': material, 'description': desc[:500], 'sourceFacts': facts,
        'patterned': bool(re.search('baskili|desen|ekose|cizgili|nakis|jakar', norm(name))),
        'warmth': warmth, 'formality': formal, 'sizes': variants, 'image': images[0],
        'alternateImage': images[1] if len(images) > 1 else images[0], 'sourceImages': images[:4],
        'stock': {'status': status, 'checkedAt': stamp, 'method': method, 'availableCount': sum(v['available'] for v in variants), 'totalCount': len(variants)},
        'verification': {'price': True, 'stock': status != 'unknown', 'priceSource': source_price,
                         'stockSource': 'PRODUCT_DETAIL_SIZE_DATA explicit size quantities' if variants else 'Product JSON-LD Offer availability; sizes are not verified',
                         'factsSource': facts_source, 'sourcePrices': values, 'reason': None,
                         'bodyHash': evidence['bodyHash'], 'discoveryUrl': discovery.get('source'),
                         'availability': availability, 'modelSource': 'VIEWED_PRODUCT.ProductCode (color-independent)' if retailer == 'DeFacto' else 'GA4 base_code'},
        'priceHistory': [{'date': day, 'observedAt': stamp, 'price': price, 'source': 'product_page'}],
    }


def discover_plan(plan):
    retailer, path, role, quota = plan
    seen, jobs, sources, errors = set(), [], [], []
    for page in [1, 2, 3]:
        url = HOST[retailer] + path + ('?page=' + str(page) if page > 1 else '')
        try:
            raw, evidence = fetch(url)
            cards = []
            if retailer == 'DeFacto':
                parser = Tags()
                parser.feed(raw)
                for tag, attrs in parser.tags:
                    if tag != 'a' or not attrs.get('data-productcode') or not attrs.get('href'):
                        continue
                    adult_category = attrs.get('data-category', '').startswith('Erkek/') and 'Çocuk' not in attrs.get('data-category', '')
                    if attrs.get('data-gender') != 'Erkek' and not adult_category:
                        continue
                    name = attrs.get('aria-label', '') + ' ' + attrs.get('data-name', '')
                    cards.append({'url': HOST[retailer] + attrs['href'] if attrs['href'].startswith('/') else attrs['href'], 'model': attrs['data-productcode'], 'name': name})
            else:
                for block in re.split(r'<div[^>]*class="js-product-wrapper product-item[^\"]*"', raw)[1:]:
                    item = div_json(block, 'js-insider-product')
                    ga = div_json(block, 'js-ga4-product')
                    if item.get('url') and ga.get('base_code') and ga.get('item_category3') == 'MEN':
                        cards.append({'url': item['url'], 'model': ga['base_code'], 'name': item.get('name', ''), 'stock': item.get('stock', 0)})
                cards.sort(key=lambda p: p.get('stock', 0) <= 0)
            added = 0
            for card in cards:
                if card['model'] in seen or re.search('cocuk|sort|bermuda|mayo|ic giyim|atlet|takim elbise', norm(card['name'])):
                    continue
                if re.search('kisa kollu|keten|yazlik', norm(card['name'])) and role in ['top', 'layer']:
                    continue
                seen.add(card['model'])
                card['source'] = url
                jobs.append((retailer, card['url'], role, card))
                added += 1
                if len(jobs) >= quota:
                    break
            sources.append({**evidence, 'retailer': retailer, 'role': role, 'foundCards': len(cards), 'selectedDistinctModels': added, 'maxColorsPerModel': 1})
            if len(jobs) >= quota or not cards:
                break
        except Exception as error:
            errors.append({'url': url, 'retailer': retailer, 'error': str(error)})
            break
    print('DISCOVER', retailer, path, len(jobs), flush=True)
    return jobs, sources, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='catalog-a-candidate.json')
    parser.add_argument('--limit', type=int, default=0, help='Maximum distinct models; 0 means category quotas')
    args = parser.parse_args()
    started = now()
    sources, errors, buckets = [], [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for jobs, evidence, failed in pool.map(discover_plan, PLAN):
            buckets.append(collections.deque(jobs))
            sources.extend(evidence)
            errors.extend(failed)
    # Round robin preserves retailer/category balance when --limit is supplied.
    jobs, used = [], set()
    while any(buckets):
        for bucket in buckets:
            if not bucket:
                continue
            job = bucket.popleft()
            key = job[0] + ':' + job[3]['model']
            if key not in used:
                used.add(key)
                jobs.append(job)
    known_urls = {job[1] for job in jobs}
    for retailer, url, role in SEEDS:
        if url not in known_urls:
            jobs.append((retailer, url, role, {'source': url, 'model': ''}))
    if args.limit > 0:
        jobs = jobs[:args.limit]
    products, actual_models = [], set()

    def one(job):
        try:
            result = product(job)
            print('VERIFIED', result['id'], result['kind'], result['stock']['status'], flush=True)
            return result, None
        except Exception as error:
            print('FAILED', job[1], str(error), flush=True)
            return None, {'url': job[1], 'retailer': job[0], 'error': str(error)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for result, error in pool.map(one, jobs):
            if result and result['modelId'] not in actual_models:
                products.append(result)
                actual_models.add(result['modelId'])
            if error:
                errors.append(error)
    end = now()
    result = {'schemaVersion': 3, 'checkedAt': dt.datetime.now(TR).date().isoformat(), 'verifiedAt': end,
              'verificationWindow': {'start': started, 'end': end}, 'live': False,
              'method': 'Anonymous first-party product HTML. Prices cross-checked between JSON-LD and independent embedded product analytics/data. One exact color per actual model identifier. Size quantities are reported only where explicitly available; offer-level stock never implies a verified size.',
              'products': products, 'sources': sources, 'errors': errors,
              'stats': {'attempted': len(jobs), 'total': len(products), 'distinctModels': len({p['modelId'] for p in products}),
                        'retailers': dict(collections.Counter(p['retailer'] for p in products)),
                        'kinds': dict(collections.Counter(p['kind'] for p in products)),
                        'priceVerified': len(products), 'stockAvailable': sum(p['stock']['status'] == 'available' for p in products),
                        'stockOut': sum(p['stock']['status'] == 'out_of_stock' for p in products), 'stockUnknown': sum(p['stock']['status'] == 'unknown' for p in products),
                        'sizeVerifiedProducts': sum(bool(p['sizes']) for p in products), 'failed': len(errors)}}
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print('SUMMARY', json.dumps(result['stats'], ensure_ascii=False), flush=True)
    print('OUTPUT', str(output.resolve()), flush=True)


if __name__ == '__main__':
    main()
