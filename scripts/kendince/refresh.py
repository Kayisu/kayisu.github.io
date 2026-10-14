"""First-party price and variant-stock snapshot for Kendince.
No login, cookies, user records, or AI services. A manual/push-triggered audit.
"""
import csv,datetime,hashlib,html,json,pathlib,re,subprocess,time,concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[2]
TARGET=ROOT/'public/kendince/catalog.json'
OUT=ROOT/'kendince-audit';OUT.mkdir(exist_ok=True)
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
DAY=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).date().isoformat()
OLD=json.loads(TARGET.read_text()); OLD_BY_URL={p['url']:p for p in OLD['products']}
errors=[];sources=[]

def fetch(url):
    if not url.startswith(('https://www.lcw.com/','https://www.mavi.com/','https://p1-api.mavi.com/')):
        raise ValueError('Unsupported source host')
    p=subprocess.run(['curl','-L','--max-time','30','--connect-timeout','12','--fail','-sS',url],capture_output=True)
    if p.returncode:raise ValueError('HTTP source fetch failed (curl '+str(p.returncode)+')')
    return p.stdout.decode('utf-8','replace')

def meta(raw,key):
    m=re.search(r'<meta[^>]*(?:property|name)=["\']'+re.escape(key)+r'["\'][^>]*content=["\']([^"\']+)',raw,re.I)
    return html.unescape(m.group(1)) if m else ''

def number(s):
    if isinstance(s,(int,float)):return float(s)
    s=str(s).replace('TL','').replace('TRY','').strip()
    if ',' in s:s=s.replace('.','').replace(',','.')
    return float(s)

def text(raw):
    return html.unescape(re.sub(r'<[^>]+>',' ',raw))

def family(color):
    c=color.casefold().replace('ı','i')
    for ks,f in [(['siyah','black'],'black'),(['antrasit','gri','grey','gray'],'gray'),(['lacivert','navy'],'navy'),(['mavi','indigo','blue'],'blue'),(['bej','ekru','beyaz','krem','taş','tas','ecru','white'],'cream'),(['kahve','brown','camel'],'brown'),(['yeşil','yesil','haki','green','olive'],'olive'),(['bordo','kırmızı','kirmizi','red'],'red'),(['mor','purple'],'purple'),(['sarı','sari','yellow'],'yellow')]:
        if any(k in c for k in ks):return f
    return 'gray'

def history(old,price):
    h=list(old.get('priceHistory',[])) if old else []
    if old and not h:h.append({'date':old.get('checkedAt'),'observedAt':old.get('verifiedAt'),'price':old['price'],'source':'previous_snapshot'})
    h.append({'date':DAY,'observedAt':NOW,'price':price,'source':'product_page'})
    return h[-12:]

def classify(name,hint):
    n=name.casefold()
    if hint=='shoe':return 'shoe','boot' if any(x in n for x in ['bot','trekking']) else 'loafer' if 'loafer' in n else 'sneaker'
    if hint=='bottom':return 'bottom','jean' if any(x in n for x in ['jean','denim','kot ']) else 'cargo' if 'kargo' in n else 'jogger' if any(x in n for x in ['jogger','eşofman']) else 'chino'
    if hint=='layer':return 'layer','jacket' if any(x in n for x in ['ceket','mont','kaban']) else 'cardigan' if any(x in n for x in ['hırka','fermuarlı']) else 'shirt'
    return 'top','sweat' if 'sweat' in n else 'knit' if any(x in n for x in ['kazak','triko']) else 'polo' if 'polo' in n else 'tee'

BRANDS=['LCWAIKIKI Classic','LCWAIKIKI Basic','LCW STEPS','LCW Vision','LCW OUTDOOR','SOUTHBLUE','XSIDE','SLAZENGER','TONNY BLACK','GRIMELANGE','ALTINYILDIZ','AC&Co','DeFacto','Defacto','Hummel','US Polo','U.S. POLO','adidas','Puma','Koton','Mavi']
def lcw(url,hint):
    raw=fetch(url); pid=url.rsplit('-o-',1)[-1];old=OLD_BY_URL.get(url)
    match=re.search(r'(?:var\s+)?GA4ViewItemEvent\s*=\s*JSON.parse\(\s*("(?:\\.|[^"\\])*")\s*\)',raw,re.S)
    item={}
    if match:
        event=json.loads(json.loads(match.group(1)));item=event.get('ecommerce',{}).get('items',[{}])[0]
    title=meta(raw,'og:title'); pm=re.search(r'([\d.]+,\d{2})\s*TL',title)
    if not pm:raise ValueError('No source price')
    price=number(pm.group(1)); conflict=bool(item.get('price') is not None and abs(number(item['price'])-price)>0.02)
    desc=meta(raw,'og:description').split('size özel')[0].strip()
    name=html.unescape(item.get('item_name') or title.split(' - ')[0])
    brand=next((b for b in BRANDS if desc.casefold().startswith(b.casefold()) or title.casefold().startswith(b.casefold())),item.get('item_brand') or 'LCW')
    brand=brand.strip() or 'LCW'
    # Read the actual variant quantity, not the mere presence of a size button.
    variants=[]
    for m in re.finditer(r'new\s+SingleSizeProduct\(([^)]*)\)',raw):
        args=next(csv.reader([m.group(1)],quotechar="'",skipinitialspace=True))
        if len(args)<10 or args[0].strip()!=pid:continue
        try:
            qty=int(float(args[5]));vprice=number(args[6])
            variants.append({'size':args[3].strip(),'available':qty>0,'quantity':qty,'price':vprice})
        except (ValueError,IndexError):continue
    variants=list({v['size']:v for v in variants}.values())
    available=[v for v in variants if v['available']]
    status='available' if available else 'out_of_stock' if variants else 'unknown'
    colour=''
    # The description and URL identify this particular color option.
    cm=re.search(r'<meta[^>]*property=["\']og:description["\'][^>]*content=["\']([^"\']+)',raw,re.I)
    option_color=old.get('color','') if old else ''
    endname=html.unescape(cm.group(1)) if cm else desc
    for token in ['Lacivert','Antrasit','Kahverengi','Bordo','Kırmızı','Siyah','Beyaz','Ekru','Haki','Yeşil','Bej','Gri','Mavi','Mor','Sarı','Turkuaz','Taş']:
        if token.casefold() in endname.casefold():colour=token;break
    if not colour:
        for token in ['lacivert','antrasit','kahverengi','bordo','kirmizi','siyah','beyaz','ekru','haki','yesil','bej','gri','mavi','mor','sari','turkuaz','tas']:
            if '-'+token+'-' in url:colour=token.title();break
    colour=colour or option_color or 'Belirtilmedi'
    fit='wide' if any(x in desc.casefold()+name.casefold() for x in ['loose','oversize','relax','bol kesim','rahat kesim','baggy']) else 'slim' if any(x in desc.casefold()+name.casefold() for x in ['slim','skinny','dar kesim']) else 'regular'
    category,kind=classify(name,hint)
    material=''
    # Product facts occur near the detail section, rather than in the global menu.
    main=re.search(r'<main[^>]*aria-label=["\']ProductDetail["\'][^>]*>(.*?)</main>',raw,re.S)
    body=text(main.group(1) if main else raw)
    mm=re.search(r'Ana Kumaş\s*:\s*(.{0,140}?)(?:Menşei|Satıcı|Marka|Cinsiyet)',body,re.S)
    if mm:material=re.sub(r'\s+',' ',mm.group(1)).strip()
    image=meta(raw,'og:image')
    if not image.startswith('https://'):raise ValueError('Missing source image')
    pics=list(dict.fromkeys(html.unescape(u) for u in re.findall(r'https://img-lcwaikiki\.mncdn\.com/[^"\'<>\s]+\.jpg',raw)))
    pics=[u for u in pics if '/pim/productimages/' in u]
    n=name.casefold();warmth=2 if any(x in n for x in ['kazak','kadife','polar','ceket','mont','sweat','hırka']) else 1
    formal=2 if kind in ['chino','loafer','polo'] or 'gömlek' in n and not any(x in n for x in ['ekose','denim','kot']) else 0 if fit=='wide' or kind in ['cargo','sweat','jogger'] else 1
    sizes=sorted(variants,key=lambda x:x['size'])
    p={'id':'lcw-'+pid,'sku':str(item.get('dimension1') or ''),'name':name,'brand':brand,'retailer':'LCW','seller':item.get('affiliation') or 'Mağaza sayfasında','category':category,'kind':kind,
       'price':price,'originalPrice':price,'url':url,'source':'Ürünün birinci taraf mağaza sayfası','checkedAt':DAY,'verifiedAt':NOW,'priceStatus':'unverified' if conflict else 'verified',
       'color':colour,'family':family(colour),'fit':fit,'fitLabel':{'wide':'Rahat / bol','slim':'Dar / slim','regular':'Regular / düz'}[fit],'material':material or 'Mağaza sayfasında',
       'description':desc[:220],'patterned':any(x in n for x in ['baskılı','desenli','ekose','çizgili','nakış','lisanslı']),'warmth':warmth,'formality':formal,'sizes':sizes,'image':image,
       'sourceImages':[image],'stock':{'status':status,'checkedAt':NOW,'method':'product_page_variant_quantity' if variants else 'unavailable_variant_data','availableCount':len(available),'totalCount':len(variants)},
       'verification':{'price':not conflict,'stock':bool(variants),'priceSource':'og:title + view_item' if item else 'og:title','stockSource':'SingleSizeProduct variant quantities','bodyHash':hashlib.sha256(raw.encode()).hexdigest()},
       'priceHistory':history(old,price)}
    ap=next((u for u in pics if u!=image),None)
    if ap:p['alternateImage']=ap;p['sourceImages'].append(ap)
    if available:
        pp=[v['price'] for v in available];p['variantPriceRange']={'min':min(pp),'max':max(pp)}
    return p

def category_urls():
    # Discover the exact current category URLs from the retailer's own navigation.
    page=fetch('https://www.lcw.com/erkek-spor-ayakkabi-t-290')
    hrefs=list(dict.fromkeys(html.unescape(u) for u in re.findall(r'href=["\']([^"\']+)["\']',page)))
    candidates={
      'top':[u for u in hrefs if re.search(r'/erkek-(tisort|kazak|sweatshirt)-t-\d+',u)],
      'layer':[u for u in hrefs if re.search(r'/erkek-(gomlek|ceket|hirka)-t-\d+',u)],
      'bottom':[u for u in hrefs if re.search(r'/erkek-(pantolon|jean)-t-\d+',u)],
      'shoe':['/erkek-spor-ayakkabi-t-290']
    }
    candidates['top']+=['/erkek-tisort-t-345','/erkek-sweatshirt-t-300']
    candidates['bottom']+=['/erkek-pantolon-t-260']
    return {k:list(dict.fromkeys(v))[:4] for k,v in candidates.items()}

def discover():
    jobs=[]
    cats=category_urls()
    for hint,paths in cats.items():
        print('CATEGORY',hint,paths,flush=True)
        for path in paths:
            url=path if path.startswith('https://') else 'https://www.lcw.com'+path
            try:
                raw=fetch(url);links=list(dict.fromkeys(html.unescape(x) for x in re.findall(r'href=["\']([^"\']+-o-\d+)[^"\']*["\']',raw)))
                # All product links are taken from this category; none are invented.
                for link in links[:28]:
                    jobs.append((link if link.startswith('https://') else 'https://www.lcw.com'+link,hint))
                sources.append({'url':url,'retrievedAt':NOW,'found':len(links),'used':min(28,len(links))})
            except Exception as e:errors.append({'url':url,'error':str(e)})
    # Recheck every existing LCW record, including sold-out products.
    for p in OLD['products']:
        if p.get('retailer',p['brand'])=='LCW' or p['url'].startswith('https://www.lcw.com/'):jobs.insert(0,(p['url'],p['category']))
    # Use the canonical category value for existing records.
    jobs=[(u,'top' if h=='top' else 'layer' if h=='layer' else 'bottom' if h=='bottom' else 'shoe') for u,h in jobs]
    unique=list({u:(u,h) for u,h in jobs}.values())
    return unique[:220]

def one(job):
    url,hint=job
    try:
        p=lcw(url,hint);print('VERIFIED',p['id'],p['price'],p['stock']['status'],p['stock']['availableCount'],flush=True);return p
    except Exception as e:errors.append({'url':url,'error':str(e)});return None

def main():
    jobs=discover()
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:products=[p for p in pool.map(one,jobs) if p]
    byid={p['id']:p for p in products}
    # Retain unavailable source records for saved outfits and history, but explicitly
    # remove their old stock certainty and do not advance their source-price date.
    for old in OLD['products']:
        if old['id'] not in byid:
            p=dict(old);p['stock']={'status':'unknown','checkedAt':NOW,'method':'source_not_reverified','availableCount':0,'totalCount':0};p['verification']={'price':False,'stock':False,'reason':'source_not_reverified'};p['priceStatus']='unverified'
            byid[p['id']]=p
    products=list(byid.values())
    stats={'attempted':len(jobs),'total':len(products),'priceVerified':sum(p['priceStatus']=='verified' for p in products),'stockAvailable':sum(p['stock']['status']=='available' for p in products),'stockOut':sum(p['stock']['status']=='out_of_stock' for p in products),'stockUnknown':sum(p['stock']['status']=='unknown' for p in products),'failed':len(errors)}
    report={'verifiedAt':NOW,'stats':stats,'sources':sources,'errors':errors,'method':'Anonymous first-party page retrieval; current price from page metadata cross-checked with view_item; size availability from variant quantities. No stock inference from size-button presence. Mavi sources not reverified are retained as unknown.'}
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('SUMMARY',json.dumps(stats),flush=True)
    verified=[p for p in products if p['priceStatus']=='verified' and p['stock']['status']=='available']
    counts={c:sum(p['category']==c for p in verified) for c in ['top','layer','bottom','shoe']}
    print('AVAILABLE-CATEGORIES',json.dumps(counts),flush=True)
    if stats['priceVerified']<45 or any(counts[c]<3 for c in ['top','bottom','shoe']):
        raise SystemExit('Insufficient verification coverage; existing catalog was not replaced.')
    result={'schemaVersion':2,'checkedAt':DAY,'verifiedAt':NOW,'live':False,'stats':stats,'products':products,'sources':sources}
    TARGET.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    (ROOT/'public/kendince/catalog-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('CATALOG-READY',len(products),flush=True)
    print('CATALOG_RESULT '+json.dumps(result,ensure_ascii=False,separators=(',',':')),flush=True)
    print('REPORT_RESULT '+json.dumps(report,ensure_ascii=False,separators=(',',':')),flush=True)

if __name__=='__main__':main()
