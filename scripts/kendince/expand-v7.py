"""Prepare a first-party, review-only discovery candidate from four Shopify brands.

Writes kendince-audit/expansion-v7.json. It never edits the live catalog.
Prices and stock come from the captured first-party feed; each accepted product
must have a successful identity-matched first-party product page.
"""
import argparse, collections, concurrent.futures, datetime, hashlib, importlib.util, json, pathlib, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'kendince-audit/expansion-v7.json'
STORES = {
    'Folk': 'https://folkclothing.com',
    'YMC': 'https://www.youmustcreate.com',
    'Gramicci': 'https://gramicci.com',
    'Service Works': 'https://serviceworks.xyz',
}

spec = importlib.util.spec_from_file_location('independent_brands', ROOT / 'scripts/kendince/independent-brands.py')
common = importlib.util.module_from_spec(spec); spec.loader.exec_module(common)

def classify(p):
    result = common.classify(p)
    title = p.get('title', '')
    if result and result[0] == 'shoe' and re.search(r'\b(?:shirt|pant|trouser|jeans?|tee|t-shirt|sweatshirt)\b', title, re.I):
        # Oxford shirts and boot-print tees are garments. Remove the misleading
        # shoe token, then classify from the remaining first-party title/type.
        q = dict(p, title=re.sub(r'\b(?:oxford|boot|derby)\b', '', title, flags=re.I))
        result = common.classify(q)
    return result

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Kendince catalog review)'})
    return urllib.request.urlopen(req, timeout=22).read()

def stamp(path):
    return datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat()

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--cache', type=pathlib.Path, default=ROOT / 'kendince-audit/cache-v7')
    ap.add_argument('--per-brand', type=int, default=36)
    ap.add_argument('--cached', action='store_true')
    args = ap.parse_args(); args.cache.mkdir(parents=True, exist_ok=True)
    if not args.cached:
        for name, base in STORES.items():
            (args.cache / (name+'.json')).write_bytes(get(base + '/products.json?limit=250'))
            cart = json.loads(get(base + '/cart.js'))
            (args.cache / (name+'-meta.json')).write_text(json.dumps({'base': base, 'currency': cart.get('currency')}))
        (args.cache / 'fx.xml').write_bytes(get('https://www.tcmb.gov.tr/kurlar/today.xml'))
    fx = ET.fromstring((args.cache/'fx.xml').read_bytes())
    rates = {c.attrib['Kod']: float(c.findtext('ForexSelling')) / int(c.findtext('Unit')) for c in fx if c.findtext('ForexSelling')}
    rates['TRY'] = 1
    fxdate = datetime.datetime.strptime(fx.attrib['Date'], '%m/%d/%Y').date().isoformat()
    fxurl = 'https://www.tcmb.gov.tr/kurlar/'+fxdate[:4]+fxdate[5:7]+'/'+fxdate[8:10]+fxdate[5:7]+fxdate[:4]+'.xml'
    tasks=[]; sources=[]
    for name, base in STORES.items():
        feedpath=args.cache/(name+'.json'); meta=json.loads((args.cache/(name+'-meta.json')).read_text()); currency=meta['currency']
        if meta['base'] != base or currency not in rates: raise ValueError(f'{name}: missing/unsupported first-party currency evidence')
        products=json.loads(feedpath.read_text())['products']; seen=set(); grouped=collections.defaultdict(list)
        for p in products:
            typ=classify(p)
            if not typ or not p.get('images'): continue
            variants=[v for v in p.get('variants',[]) if float(v.get('price') or 0)>0]
            if not variants: continue
            # Model-level deduplication, retaining actual feed product IDs.
            signature=re.sub(r'\([^)]*\)|\b(?:black|navy|white|brown|green|grey|blue|olive|cream|red)\b','',p['title'].split('|')[0].split(' - ')[0],flags=re.I).strip().lower()
            if signature in seen: continue
            seen.add(signature); grouped[typ].append(p)
        selected=[]
        while grouped and len(selected)<args.per_brand:
            for typ in list(grouped):
                if grouped[typ]: selected.append((grouped[typ].pop(0),typ))
                if not grouped[typ]: del grouped[typ]
                if len(selected)>=args.per_brand: break
        observed=stamp(feedpath)
        sources.append({'retailer':name,'url':base+'/products.json?limit=250','method':'First-party Shopify product feed and cart.js currency; accepted item has successful identity-matched first-party product page. Variant.available is offer-level availability.','responseSha256':hashlib.sha256(feedpath.read_bytes()).hexdigest(),'retrievedAt':observed,'currency':currency})
        tasks.extend((name,base,currency,observed,p,typ) for p,typ in selected)
    def prepare(task):
        name,base,currency,observed,p,(category,kind)=task; url=base+'/products/'+urllib.parse.quote(p['handle'], safe='-._~/'); path=args.cache/('page-'+str(p['id'])+'.html')
        try:
            raw=path.read_bytes() if path.exists() else get(url)
            if not path.exists(): path.write_bytes(raw)
            page=raw.decode('utf-8',errors='replace')
            if str(p['id']) not in page or p['handle'] not in page: raise ValueError('product identity absent from successful page')
            variants=p['variants']; options=p.get('options',[])
            si=next((i for i,o in enumerate(options) if re.search(r'size|beden',o['name'],re.I)),None)
            ci=next((i for i,o in enumerate(options) if re.search(r'colou?r|renk',o['name'],re.I)),None)
            colors=[str(v.get('option'+str(ci+1)) or '') for v in variants] if ci is not None else ['']
            color=next((c for c in colors if any(v.get('available') and float(v.get('price') or 0)>0 for v in variants if ci is None or str(v.get('option'+str(ci+1)) or '')==c)),None)
            if color is None: return None
            chosen=[v for v in variants if (ci is None or str(v.get('option'+str(ci+1)) or '')==color) and float(v.get('price') or 0)>0]
            available=[v for v in chosen if v.get('available')]
            if not available: return None
            family=common.family((color+' '+p['title']+' '+p.get('handle','')+' '+' '.join(p.get('tags',[]))) or p['title'])
            if not family: return None
            source_price=max(float(v['price']) for v in available); rate=rates[currency]; price=round(source_price*rate,2)
            body=p.get('body_html') or ''; material=common.material_lines(page,body)
            description=' '.join(common.visible(body)); description=re.split(r'Sizing \(|Size guide|SIZE GUIDE',description)[0][:900]
            sizes=[]
            if si is not None:
                for v in chosen:
                    size=str(v.get('option'+str(si+1)) or '')
                    if size: sizes.append({'size':size,'available':bool(v.get('available')),'price':round(float(v['price'])*rate,2),'sourcePrice':float(v['price']),'sourceCurrency':currency,'variantId':str(v['id'])})
            slug=re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-'); image=p['images'][0]['src']
            image += ('&' if '?' in image else '?')+'width=700'
            product={'id':slug+'-'+str(p['id']),'sku':available[0].get('sku',''),'modelId':slug+':'+str(p['id']),'name':p['title'],'brand':p.get('vendor') or name,'retailer':name,'seller':name,'category':category,'kind':kind,'price':price,'originalPrice':price,'url':url,'image':image,'alternateImage':p['images'][1]['src'] if len(p['images'])>1 else image,'source':'First-party product page and Shopify variant record','checkedAt':observed[:10],'verifiedAt':observed,'priceStatus':'verified','color':color or p['title'],'family':family,'material':material,'description':description,'sourceFacts':{'Source product type':p.get('product_type',''),'Source tags':', '.join(p.get('tags',[])[:12]),'Fabric composition':material,'Source size labels':'Original store variant labels; no conversion'},'sizes':sizes,'stock':{'status':'available','checkedAt':observed,'method':'First-party Shopify variants.available for selected color; offer-level, not size-level inference'},'verification':{'price':True,'stock':True,'sourcePrices':[price],'responseSha256':hashlib.sha256(raw).hexdigest(),'pageCheckedAt':stamp(path),'sourceUrl':url,'feedUrl':base+'/products.json?limit=250'},'priceHistory':[{'date':observed[:10],'observedAt':observed,'price':price,'source':'product_feed','currency':currency,'sourcePrice':source_price}],'discovery':True,'priceOrigin':{'currency':currency,'amount':source_price,'tlEstimate':currency!='TRY','rate':rate,'rateDate':fxdate,'rateSource':fxurl,'note':'Kargo, gümrük, vergiler ve Türkiye teslimatı doğrulanmadı; özgün mağaza fiyatının kur karşılığı.' if currency!='TRY' else 'Markanın TL mağaza fiyatı.'},'patterned':bool(re.search(r'check|stripe|patchwork|embroider|jacquard|print|floral|graphic',p['title'],re.I))}
            # Only set a fit when the source makes a clear fit claim.
            fittext=p['title']+' '+description+' '+' '.join(p.get('tags',[]))
            fit='wide' if re.search(r'oversized|boxy|wide.?leg|relaxed fit|loose fit',fittext,re.I) else 'slim' if re.search(r'\bslim fit\b',fittext,re.I) else None
            if fit: product.update(fit=fit,fitLabel={'wide':'Rahat / bol','slim':'Dar / slim'}[fit])
            return product
        except Exception as e: return {'error':str(e),'retailer':name,'url':url}
    products=[]; errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for r in pool.map(prepare,tasks):
            if r and 'error' in r: errors.append(r)
            elif r: products.append(r)
    ids=[p['id'] for p in products]; models=[p['modelId'] for p in products]
    if len(ids)!=len(set(ids)) or len(models)!=len(set(models)): raise ValueError('duplicate product IDs or model families')
    bybrand=collections.Counter(p['retailer'] for p in products); bykind=collections.Counter(p['kind'] for p in products)
    report={'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'products':products,'sources':sources,'stats':{'total':len(products),'modelCount':len(set(models)),'newSourceCount':len(sources),'byBrand':dict(bybrand),'byKind':dict(bykind),'available':sum(p['stock']['status']=='available' for p in products),'priceVerified':sum(p['priceStatus']=='verified' for p in products)},'errors':errors,'fx':{'date':fxdate,'source':fxurl,'rates':rates},'reviewOnly':True,'styleGaps':['Brand breadth is four Shopify storefronts; additional non-Shopify first-party feeds remain unexplored.','No reliable size measurements or fit claims are inferred when source copy omits them.','Stock is offer-level and does not prove every selected size is available.']}
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['stats']|{'errors':len(errors),'candidate':str(OUT)},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
