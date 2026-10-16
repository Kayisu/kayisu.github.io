#!/usr/bin/env python3
"""Refresh Mavi records and discover distinct Mavi/AVVA menswear.

Reads anonymous, first-party product pages only. Writes a candidate feed, never
the live catalog. No cart, session, account, or purchase API is used.

python scripts/kendince/retailers-c.py --output /tmp/catalog-c.json --limit 78
"""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT.parent / 'catalog-c.json'
CACHE_DIR = None
MAVI_SEEDS = [
    ('knit', 'https://www.mavi.com/erkek/triko/c/2', 11),
    ('jean', 'https://www.mavi.com/erkek/jean/c/2', 4),
    ('outer', 'https://www.mavi.com/erkek/dis+giyim/c/2?query=%3Arelevance%3AcategoryValue%3AD%C4%B1%C5%9F%20Giyim', 5),
]
AVVA_SEEDS = [
    ('overshirt', 'https://www.avva.com.tr/erkek-gomlek/gomlek-ceket', 6),
    ('bottom', 'https://www.avva.com.tr/erkek-pantolon', 6),
    ('knit', 'https://www.avva.com.tr/erkek-kazak', 6),
    ('outer', 'https://www.avva.com.tr/erkek-mont', 4),
    ('blazer', 'https://www.avva.com.tr/erkek-ceket', 3),
]
COLORS = ['koyu kahverengi','acik kahverengi','koyu mavi','acik mavi','lacivert','kahverengi','antrasit','bordo','siyah','beyaz','ekru','vizon','haki','yesil','mavi','bej','gri','kahve','tas','kirmizi','sari','pembe','mor']

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def normalize(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s).lower().replace('ı','i')) if not unicodedata.combining(c))

def clean(s):
    s = re.sub(r'<style[^>]*>.*?</style>', '', str(s), flags=re.S|re.I)
    s = re.sub(r'[.#][A-Za-z_][\w.,:# >+~\-\[\]=\'"()]*\{[^{}]*\}', '', s)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

def absolute(u, base):
    return urllib.parse.urljoin(base, u or '')

def fetch(u):
    cachefile=CACHE_DIR/(hashlib.sha256(u.encode()).hexdigest()+'.json') if CACHE_DIR else None
    if cachefile and cachefile.exists():
        cached=json.loads(cachefile.read_text())
        return cached['body'],cached['url'],cached['observedAt'],cached['bodyHash']
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 (compatible; KendinceCatalog/1.0)', 'Accept-Language': 'tr-TR,tr;q=0.9'})
    with urllib.request.urlopen(req, timeout=50) as r:
        b = r.read()
        if r.status != 200:
            raise ValueError('HTTP ' + str(r.status))
        if len(b) < 5000:
            raise ValueError('page too short for verified product data')
        result=(b.decode('utf-8', errors='replace'), r.geturl(), now(), hashlib.sha256(b).hexdigest())
        if cachefile:
            cachefile.write_text(json.dumps(dict(zip(['body','url','observedAt','bodyHash'],result))))
        return result

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(); self.cur=None; self.buf=[]; self.values=[]
    def handle_starttag(self, tag, attrs):
        if tag == 'script': self.cur=dict(attrs); self.buf=[]
    def handle_endtag(self, tag):
        if tag == 'script' and self.cur is not None:
            self.values.append((self.cur, ''.join(self.buf))); self.cur=None
    def handle_data(self, data):
        if self.cur is not None: self.buf.append(data)

def script_json(body, script_id):
    p=Scripts(); p.feed(body)
    for a,v in p.values:
        if a.get('id') == script_id: return json.loads(v)
    raise ValueError('missing public script '+script_id)

def ld_products(body):
    p=Scripts(); p.feed(body); found=[]
    def walk(x):
        if isinstance(x,dict):
            if x.get('@type') in ['Product','ProductGroup']: found.append(x)
            for v in x.values(): walk(v)
        elif isinstance(x,list):
            for v in x: walk(v)
    for a,v in p.values:
        if a.get('type','').endswith('application/ld+json'):
            try: walk(json.loads(v))
            except (json.JSONDecodeError,TypeError): pass
    return found

def family(color):
    t=normalize(color)
    return next((v for k,v in [('siyah','black'),('lacivert','navy'),('antrasit','gray'),('gri','gray'),('beyaz','cream'),('ekru','cream'),('tas','cream'),('bej','cream'),('vizon','brown'),('kahverengi','brown'),('kahve','brown'),('haki','olive'),('yesil','olive'),('mavi','blue'),('indigo','blue'),('bordo','red'),('kirmizi','red'),('mor','purple'),('pembe','red'),('sari','yellow') ] if k in t),'gray')

def classify(name, description='', material=''):
    # Garment identity comes from its title. Product descriptions can recommend
    # unrelated trousers or jackets and must not change this classification.
    t=normalize(name)
    if 'pantolon' in t or 'jean' in t and not any(k in t for k in ['ceket','gomlek','tisort','kazak']):
        kind=next((k for token,k in [('kargo','cargo'),('jogger','jogger'),('kadife','corduroy'),('jean','jean')] if token in t),'chino')
        return 'bottom',kind,2,1 if kind in ['jean','cargo','jogger'] else 2
    if 'hirka' in t: return 'layer','cardigan',2,2
    if any(x in t for x in ['gomlek ceket','overshirt']): return 'layer','overshirt',2,1
    if 'ceket' in t or 'mont' in t or 'kaban' in t:
        kind=next((k for token,k in [('blazer','blazer'),('kaban','coat'),('palto','coat'),('sisme','puffer'),('kaz tuyu','puffer'),('parka','parka'),('yagmurluk','raincoat')] if token in t),'jacket')
        return 'outer',kind,3 if kind in ['coat','puffer','parka'] else 2,3 if kind=='blazer' else 1
    if any(x in t for x in ['balikci','bogazli']): return 'top','turtleneck',2,2
    if any(x in t for x in ['triko','kazak']): return 'top','knit',1 if 'kisa kollu' in t else 2,2
    if 'gomlek' in t: return 'layer','shirt',1,2
    if 'sweat' in t: return ('layer','cardigan',2,1) if 'fermuarli' in t and not 'yari fermuarli' in t else ('top','hoodie' if 'kapuson' in t else 'sweat',2,1)
    return 'top','polo' if 'polo' in t else 'tee',1,1 if 'polo' in t else 0

def fit_code(label):
    t=normalize(label)
    return 'wide' if any(k in t for k in ['loose','oversize','relaxed','comfort fit','bol','genis']) else 'slim' if any(k in t for k in ['slim','skinny','fitted','dar']) else 'regular'

def observation(existing, price, at):
    history=list((existing or {}).get('priceHistory',[]))
    if not history and existing and isinstance(existing.get('price'),(int,float)):
        history.append({'date':existing.get('checkedAt'),'observedAt':existing.get('verifiedAt'),'price':existing['price'],'source':'previous_snapshot'})
    history.append({'date':at[:10],'observedAt':at,'price':price,'source':'product_page'})
    return history[-30:]

def finalize(p, existing, at, bodyhash, price_source, stock_source, facts_source, source_prices):
    price=p['price']; sizes=p['sizes']; known=[s for s in sizes if isinstance(s.get('available'),bool)]
    stock='available' if any(s['available'] for s in known) else 'out_of_stock' if known else 'unknown'
    p.update({'source':'Üreticinin ürün sayfası','checkedAt':at[:10],'verifiedAt':at,'priceStatus':'verified','sourceImage':p['image'],
      'priceHistory':observation(existing,price,at),
      'stock':{'status':stock,'checkedAt':at,'method':stock_source,'availableCount':sum(s['available'] for s in known),'totalCount':len(known)},
      'verification':{'price':True,'stock':bool(known),'priceSource':price_source,'stockSource':stock_source,'factsSource':facts_source,'sourcePrices':source_prices,'reason':None,'bodyHash':bodyhash}})
    if len(p.get('sourceImages',[]))>1: p['alternateImage']=p['sourceImages'][1]
    return p

def mavi_product(url, existing=None):
    body,final,at,bodyhash=fetch(url); state=script_json(body,'ng-state')
    raw=state.get('spa-pdp-document-product')
    if not isinstance(raw,dict) or 'code' not in raw: raise ValueError('missing matching Mavi product state')
    if raw.get('gender',{}).get('name') != 'Erkek': raise ValueError('not an adult menswear product')
    code=raw['code']
    if code not in urllib.parse.unquote(final): raise ValueError('product code does not match final URL')
    ld=next((x for x in ld_products(body) if x.get('offers') and (x.get('sku')==code or code in x.get('url','') or code in x['offers'].get('url',''))),None)
    if not ld: raise ValueError('no matching Mavi JSON-LD offer')
    offer=ld['offers']; price=float(offer['price'])
    if offer.get('priceCurrency','').upper() != 'TRY': raise ValueError('non-TRY price')
    stateprice=float((raw.get('storeSalePrice') or raw.get('salePrice') or raw['price'])['value'])
    if abs(price-stateprice)>0.02: raise ValueError('Mavi structured price mismatch')
    name=raw['name']; title=raw.get('productTitle','')
    if title and title.lower() not in name.lower(): name=title.title()+' '+name
    material=clean(raw.get('materialContent') or raw.get('fabricDefinition') or 'Belirtilmedi')
    description=clean(raw.get('description','')); cat,kind,warmth,formality=classify(name,description,material)
    color=raw.get('colour',{}).get('name','Belirtilmedi'); fit=raw.get('fit',{}).get('name','Regular / düz')
    sizes=[{'size':str(s['size']),'available':s.get('stockLevelStatus') in ['inStock','lowStock'],'variantId':str(s.get('id',''))} for s in raw.get('allSizeVariants',[]) if s.get('stockLevelStatus') in ['inStock','lowStock','outOfStock']]
    images=[absolute(s.get('main') or s.get('large'),'https://www.mavi.com') for s in raw.get('galleryImages',[]) if s.get('main') or s.get('large')]
    if not images: raise ValueError('no source image')
    facts={k:v for k,v in {'Cinsiyet':'Erkek','Kalıp':fit,'Kumaş':material,'Yaka':raw.get('neck',{}).get('name'),'Kol Boyu':raw.get('sleeve',{}).get('name'),'Ürün grubu':', '.join(x['name'] for x in raw.get('mainCategories',[])),'Model':raw.get('productTitle')}.items() if v}
    p=dict(existing or {}); p.update({'id':(existing or {}).get('id',code),'sku':code,'modelId':'mavi:'+raw.get('baseProduct',code.split('-')[0]).removesuffix('-o'),'name':name,'brand':'Mavi','retailer':'Mavi','seller':'Mavi','category':cat,'kind':kind,'price':price,'originalPrice':max(price,float(raw['price']['value'])),'url':absolute(raw.get('url'),final),'color':color,'family':family(color),'fit':fit_code(fit),'fitLabel':fit,'material':material,'description':description,'sourceFacts':facts,'patterned':bool(re.search(r'cizgili|ekose|desenli|jakar|baski|baskili',normalize(name))),'warmth':warmth,'formality':formality,'sizes':sizes,'image':images[0],'sourceImages':images})
    return finalize(p,existing,at,bodyhash,'JSON-LD offers.price + ng-state storeSalePrice.value','ng-state allSizeVariants.stockLevelStatus','ng-state product materialContent/fit/colour/mainCategories',[price,stateprice])

def avva_product(url, existing=None):
    body,final,at,bodyhash=fetch(url)
    match=re.search(r'var\s+productDetailModel\s*=\s*',body)
    if not match: raise ValueError('missing AVVA productDetailModel')
    raw,_=json.JSONDecoder().raw_decode(body[match.end():]); code=raw['stockCode']; pid=str(raw['productId'])
    if not final.rstrip('/').endswith('-'+pid): raise ValueError('AVVA product id does not match URL')
    group=next((x for x in ld_products(body) if x.get('@type')=='ProductGroup' and str(x.get('productGroupID'))==pid),None)
    if not group: raise ValueError('missing matching AVVA ProductGroup')
    offers=[x['offers'] for x in group.get('hasVariant',[]) if x.get('offers')]
    prices=sorted(set(float(x['price']) for x in offers if x.get('priceCurrency','').upper()=='TRY'))
    price=round(float(raw['productPriceKDVIncluded']),2)
    if not prices or any(abs(x-price)>0.02 for x in prices): raise ValueError('AVVA price mismatch or no TRY offer')
    variants={x['id']:x for x in raw.get('products',[])}
    sizeinfo={x['urunID']:x for x in raw.get('productVariantData',[]) if x.get('ekSecenekTipiTanim')=='Beden'}
    sizes=[]
    for variant_id,size in sizeinfo.items():
        v=variants.get(variant_id)
        if not v or not isinstance(v.get('stokAdedi'),(int,float)): continue
        sizes.append({'size':str(size['tanim']),'available':bool(v.get('aktif') and v['stokAdedi']>0),'quantity':v['stokAdedi'],'variantId':str(variant_id),'price':round(float(v['indirimliFiyati'])+float(v['indirimliKDV']),2)})
    if any(abs(s['price']-price)>0.02 for s in sizes if s['available']): raise ValueError('AVVA available variants have conflicting prices')
    color=next((x['tanim'] for x in raw.get('productVariantData',[]) if x.get('ekSecenekTipiTanim')=='Renk'),'Belirtilmedi')
    name=raw['productName']; description=clean(group.get('description',''))
    fitmatch=re.search(r'(?:Super Slim|Slim|Regular|Relaxed|Comfort|Oversize)\s*Fit',description,re.I)
    fit=fitmatch.group(0) if fitmatch else 'Belirtilmedi'
    materialmatch=re.search(r'Ürün İçeriği\s*(.*?)(?:Makine Yıkama|Elde Yıkama|Sadece Kuru|Çamaşır|Normal Isı|\Z)',description)
    material=materialmatch.group(1).strip()[:250] if materialmatch else 'Belirtilmedi'
    cat,kind,warmth,formality=classify(name,description,material)
    if '/erkek-ceket' in ' '.join(x.get('urlKod','') for x in raw.get('breadCrumb',[])) and kind=='jacket':kind='blazer';formality=3
    images=[x['bigImagePath'] for x in raw.get('productImages',[]) if x.get('active') and x.get('bigImagePath')]
    if not images: raise ValueError('no AVVA source image')
    orig=round(float(raw['product']['satisFiyati'])+float(raw['product']['satisKDV']),2)
    p={'id':'avva-'+pid,'sku':code,'modelId':'avva:'+code.rsplit('-',1)[0],'name':name,'brand':'AVVA','retailer':'AVVA','seller':'AVVA','category':cat,'kind':kind,'price':price,'originalPrice':max(orig,price),'url':group['url'],'color':color,'family':family(color),'fit':fit_code(fit),'fitLabel':fit,'material':material,'description':description[:1600],'sourceFacts':{'Cinsiyet':'Erkek','Kalıp':fit,'Kumaş':material,'Ürün grubu':', '.join(x['tanim'] for x in raw.get('breadCrumb',[]))},'patterned':bool(re.search(r'cizgili|ekose|desenli|jakar|baski|kazayagi|armur',normalize(name))),'warmth':warmth,'formality':formality,'sizes':sizes,'image':images[0],'sourceImages':images}
    return finalize(p,existing,at,bodyhash,'JSON-LD hasVariant offers.price + productDetailModel.productPriceKDVIncluded','productDetailModel products.stokAdedi joined to productVariantData Beden by urunID','ProductGroup description + productDetailModel productVariantData/breadCrumb',prices+[price])

def discover_mavi(seed, existing_models):
    group,url,count=seed; body,final,at,bodyhash=fetch(url); state=script_json(body,'ng-state'); products=[]
    for v in state.values():
        if isinstance(v,dict) and isinstance(v.get('b'),dict) and isinstance(v['b'].get('products'),list): products=v['b']['products'];break
    selected=[]; seen=set(existing_models)
    for p in products:
        base='mavi:'+p.get('baseProduct',p['code'].split('-')[0]).removesuffix('-o')
        cat,kind,_,_=classify(p.get('name',''),p.get('description',''))
        if group=='outer' and cat!='outer': continue
        if base in seen: continue
        seen.add(base);selected.append(absolute(p['url'],'https://www.mavi.com'))
        if len(selected)>=count:break
    return selected,{'retailer':'Mavi','url':url,'checkedAt':at,'status':'ok','method':'anonymous category SSR ng-state products; model deduplication','discovered':len(products),'selected':len(selected),'bodyHash':bodyhash}

def discover_avva(seed):
    group,url,count=seed; body,final,at,bodyhash=fetch(url)
    links=re.findall(r'class="productName[^>]*>\s*<a[^>]+href=[\'\"]([^\'\"]+)[\'\"][^>]*>(.*?)</a>',body,re.S)
    selected=[]; seen=set()
    for path,name in links:
        title=normalize(clean(name))
        # Prevent category listings from being padded by repeated colourways.
        signature=title
        for color in COLORS: signature=re.sub(r'\b'+re.escape(color)+r'\b','',signature)
        signature=re.sub(r'\s+',' ',signature).strip()
        if signature in seen:continue
        if group=='knit' and any(x in title for x in ['keten','kisa kollu']):continue
        seen.add(signature);selected.append(absolute(path,'https://www.avva.com.tr'))
        if len(selected)>=count:break
    return selected,{'retailer':'AVVA','url':url,'checkedAt':at,'status':'ok','method':'anonymous category productName links; identical colourway titles collapsed','discovered':len(links),'selected':len(selected),'bodyHash':bodyhash}

def main():
    global CACHE_DIR
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=DEFAULT_OUTPUT)
    parser.add_argument('--limit',type=int,default=80,help='Maximum total candidate products, including existing Mavi refreshes')
    parser.add_argument('--workers',type=int,default=6)
    parser.add_argument('--cache-dir',type=Path,help='Optional reproducible run cache; original observation timestamps are retained. Omit for live refresh.')
    args=parser.parse_args()
    CACHE_DIR=args.cache_dir
    if CACHE_DIR: CACHE_DIR.mkdir(parents=True,exist_ok=True)
    if args.limit<1: parser.error('--limit must be positive')
    catalog=json.loads((ROOT/'public/kendince/catalog.json').read_text())
    existing=[p for p in catalog['products'] if 'mavi.com/' in p.get('url','')]
    existing_by_url={p['url']:p for p in catalog['products']}
    existing_models={'mavi:'+p['id'].split('-')[0] for p in existing}
    tasks=[('Mavi',p['url']) for p in existing]; sources=[]; errors=[]
    started=now()
    def discovery(task):
        retailer,seed=task
        try:
            urls,source=discover_mavi(seed,existing_models) if retailer=='Mavi' else discover_avva(seed)
            return retailer,urls,source,None
        except Exception as e: return retailer,[],None,{'retailer':retailer,'url':seed[1],'error':str(e),'checkedAt':now(),'stage':'discovery'}
    seeds=[('Mavi',s) for s in MAVI_SEEDS]+[('AVVA',s) for s in AVVA_SEEDS]
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        for retailer,urls,source,error in pool.map(discovery,seeds):
            if source:sources.append(source)
            if error:errors.append(error)
            tasks += [(retailer,u) for u in urls]
    seen=set(); tasks=[(r,u) for r,u in tasks if not (u in seen or seen.add(u))][:args.limit]
    def verify(task):
        retailer,url=task
        try:
            p=(mavi_product if retailer=='Mavi' else avva_product)(url,existing_by_url.get(url))
            return p,None
        except Exception as e:return None,{'retailer':retailer,'url':url,'error':str(e),'checkedAt':now(),'stage':'product'}
    products=[]
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        for p,error in pool.map(verify,tasks):
            if p:products.append(p)
            if error:errors.append(error)
    # Product-level model IDs are authoritative; new colourways are dropped.
    oldids={p['id'] for p in existing}; kept=[]; models=set()
    for p in products:
        if p['modelId'] in models and p['id'] not in oldids:continue
        kept.append(p);models.add(p['modelId'])
    products=kept
    stats={'attempted':len(tasks),'total':len(products),'modelCount':len(models),'priceVerified':sum(p['priceStatus']=='verified' for p in products),'stockAvailable':sum(p['stock']['status']=='available' for p in products),'stockOut':sum(p['stock']['status']=='out_of_stock' for p in products),'stockUnknown':sum(p['stock']['status']=='unknown' for p in products),'failed':len(errors),'existingMaviRefreshed':sum(p['id'] in oldids for p in products),'retailers':{r:sum(p['retailer']==r for p in products) for r in ['Mavi','AVVA']},'startedAt':started,'completedAt':now()}
    result={'products':products,'sources':sources,'errors':errors,'stats':stats}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(stats,ensure_ascii=False));print('Candidate feed:',args.output)
    for error in errors:print(json.dumps(error,ensure_ascii=False),file=sys.stderr)

if __name__=='__main__':main()
