"""Candidate-only first-party expansion: Mango, Decathlon and Boyner.

Anonymous storefront HTML, no login. Prices come from source JSON state/JSON-LD,
never search snippets. Writes only --output (default /tmp/kendince-retailers-b.json).
Raw first-party responses are cached 30 min for resumability; evidence hashes and
exact parser/stock methods travel with every record. No inferred inventory sizes.
"""
import argparse, concurrent.futures, datetime, hashlib, html, json, pathlib, re, subprocess, unicodedata
from urllib.parse import urljoin, urlparse, quote, parse_qs
UTC = datetime.timezone.utc
CACHE = pathlib.Path('/tmp/kendince-retailers-b-http'); CACHE.mkdir(exist_ok=True)
SOURCES=[]; ERRORS=[]
DAY=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).date().isoformat()
DEC='https://www.decathlon.com.tr'; MAN='https://shop.mango.com'; BOY='https://www.boyner.com.tr'
# Category quotas favor different construction/cuts over color multiplication.
PLAN=[
 (MAN,'/tr/tr/c/erkek/pantolon/b126cc9c','bottom',8),
 (MAN,'/tr/tr/c/erkek/jean/2402cc2c','bottom',5),
 (MAN,'/tr/tr/c/erkek/gomlek-ceketler/41a897fb','layer',5),
 (MAN,'/tr/tr/c/erkek/ceket/b5a3a3f6','outer',6),
 (MAN,'/tr/tr/c/erkek/palto/3a5ade78','outer',5),
 (MAN,'/tr/tr/c/erkek/gabardin-trenckotlar/6337428e','outer',3),
 (MAN,'/tr/tr/c/erkek/ayakkabı/474b3a4f','shoe',7),
 (MAN,'/tr/tr/c/erkek/hırka-ve-kazak/89e09112','layer',6),
 (DEC,'/erkek/polarlar?size=40','layer',8),
 (DEC,'/erkek/su-gecirmez-kiyafetler?size=40','outer',8),
 (DEC,'/erkek/montlar-ve-yagmurluklar?size=40','outer',10),
 (DEC,'/erkek/pantolonlar?size=40','bottom',6),
 (DEC,'/erkek/botlar?size=40','shoe',6),
 (BOY,'/erkek-loafer-x-g3730-c2754','shoe',8),
 (BOY,'/erkek-bot-x-g3730-c23896692','shoe',8),
 (BOY,'/erkek-klasik-ayakkabi-x-g3730-c2753','shoe',6),
 (BOY,'/erkek-sneaker-x-g3730-c2756','shoe',10),
]
def now():return datetime.datetime.now(UTC).isoformat()
def norm(s):return ''.join(c for c in unicodedata.normalize('NFKD',str(s).lower().replace('ı','i')) if not unicodedata.combining(c))
def fetch(url):
 if urlparse(url).hostname not in {'www.decathlon.com.tr','shop.mango.com','www.boyner.com.tr'}:raise ValueError('Unsupported first-party hostname')
 path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
 if path.exists() and datetime.datetime.now().timestamp()-path.stat().st_mtime<1800:return path.read_text()
 safe=quote(url,safe=':/?&=%_-+.,#')
 p=subprocess.run(['curl','-L','-sS','--fail','--connect-timeout','10','--max-time','35',safe],capture_output=True)
 if p.returncode:raise ValueError('HTTP fetch failed (curl '+str(p.returncode)+')')
 raw=p.stdout.decode('utf-8','replace')
 if 'Checking your browser' in raw or len(raw)<1500:raise ValueError('Storefront did not provide product HTML')
 path.write_text(raw);return raw

def walk(x):
 if isinstance(x,dict):
  yield x
  for v in x.values():yield from walk(v)
 elif isinstance(x,list):
  for v in x:yield from walk(v)
def ld_products(raw):
 out=[]
 for b in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',raw,re.S):
  try:out += [x for x in walk(json.loads(b)) if x.get('@type')=='Product']
  except (ValueError,AttributeError):pass
 return out

def dkt(raw):
 m=re.search(r'__DKT\s*=\s*',raw)
 if not m:raise ValueError('Missing __DKT source state')
 return json.JSONDecoder().raw_decode(raw[m.end():])[0]
def boy_state(raw):
 m=re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',raw,re.S)
 if not m:raise ValueError('Missing Boyner source state')
 return json.loads(m[1])['props']['pageProps']['initialState']
def mango_state(raw):
 chunks=[]
 for b in re.findall(r'self\.__next_f\.push\((.*?)\)</script>',raw,re.S):
  try:
   a=json.loads(b)
   if len(a)>1 and isinstance(a[1],str):chunks.append(a[1])
  except (ValueError,IndexError):pass
 return ''.join(chunks)
def source_product_mango(raw):
 s=mango_state(raw)
 for m in re.finditer(r'"product"\s*:\s*(?=\{)',s):
  try:
   x=json.JSONDecoder().raw_decode(s[m.end():])[0]
   if x.get('colors') and 'available' in str(x.get('colors')):return x
  except (ValueError,AttributeError):pass
 raise ValueError('Missing Mango product color inventory state')
def family(s):
 s=norm(s)
 for keys,value in [(['siyah','black'],'black'),(['antrasit','gri','grey','gray','gumus'],'gray'),(['lacivert','navy'],'navy'),(['mavi','indigo','blue'],'blue'),(['bej','ekru','beyaz','krem','tas','ecru','white'],'cream'),(['kahve','brown','camel','deve','taba','cikolata','vizon','kahverengi'],'brown'),(['yesil','haki','green','olive'],'olive'),(['bordo','kirmizi','red'],'red'),(['mor','purple'],'purple'),(['sari','yellow'],'yellow')]:
  if any(k in s for k in keys):return value
 return 'gray'
def classify(name,hint,facts):
 n=norm(name)
 if hint=='shoe':return 'shoe','boot' if re.search(r'\bbot(?:u|lar|lari)?\b|boot|chelsea',n) else 'loafer' if re.search('loafer|mokasen|makosen|tekne ayakkabi',n) else 'derby' if re.search('derby|oxford|klasik',n) else 'sneaker'
 if re.search('pantolon|jean|esofman alti',n):return 'bottom','corduroy' if re.search('kadife|corduroy',n) else 'cargo' if re.search('kargo|cargo|cok cepli',n) else 'jean' if re.search('jean|denim',n) else 'jogger' if re.search('jogger|esofman',n) else 'chino'
 if re.search('gomlek ceket|overshirt',n):return 'layer','overshirt'
 if re.search('hirka|polar',n):return 'layer','cardigan'
 if re.search('kazak|triko',n):return 'top','turtleneck' if re.search('balikci|dik yaka',n) else 'knit'
 if re.search('blazer',n):return 'outer','blazer'
 if re.search('kaban|palto',n):return 'outer','coat'
 if re.search('parka',n):return 'outer','parka'
 if re.search('sisme|dolgulu|kaz tuyu',n):return 'outer','puffer'
 if re.search('yagmurluk|trenckot',n):return 'outer','raincoat'
 if re.search('mont|ceket|softshell',n):return 'outer','jacket'
 if re.search('su gecirmez',n):return 'outer','raincoat'
 if re.search('gomlek',n):return 'layer','shirt'
 if re.search('sweat',n):return 'top','hoodie' if 'kapuson' in n else 'sweat'
 return hint,{'outer':'jacket','layer':'shirt','top':'tee','bottom':'chino','shoe':'sneaker'}.get(hint,'tee')
def fit(name,facts):
 label=facts.get('Kalıp') or facts.get('Kalıp Bilgisi') or ''
 s=norm(label+' '+name)
 return ('wide' if re.search('loose|oversize|relax|baggy|rahat|bol kesim|wide|genis',s) else 'slim' if re.search('slim|skinny|dar kesim',s) else 'regular'),label

def base(raw,url,retailer,pid,name,color,price,brand,hint,facts,material,description,images,sizes,method,sourceprices,seller,model=None,offerstatus=None):
 if not price or price<50 or price>100000:raise ValueError('Implausible or missing source price')
 images=[x for x in images if isinstance(x,str) and x.startswith('https://')]
 if not images:raise ValueError('Missing source image')
 stamp=now();category,kind=classify(name,hint,facts);f,fl=fit(name,facts)
 available=[v for v in sizes if v['available']]
 status='available' if available else 'out_of_stock' if sizes else offerstatus or 'unknown'
 okay=bool(sourceprices) and max(sourceprices)-min(sourceprices)<.021
 text=norm(name+' '+description+' '+str(facts))
 warmth=3 if kind in ['coat','puffer','parka'] or (category=='outer' and re.search('isi yalitimi|sicak tutan|kislik|dolgulu',text)) else 2 if kind in ['knit','turtleneck','cardigan','hoodie','sweat','corduroy','boot'] else 1
 return {'id':retailer.lower()+'-'+str(pid),'sku':str(pid),'modelId':retailer.lower()+':'+str(model or pid),'name':name,'brand':brand,'retailer':retailer,'seller':seller,'category':category,'kind':kind,'price':price,'originalPrice':price,'url':url,'source':'Ürünün mağaza sayfası','checkedAt':DAY,'verifiedAt':stamp,'priceStatus':'verified' if okay else 'unverified','color':color or 'Belirtilmedi','family':family(color),'fit':f,'fitLabel':fl or {'wide':'Rahat / bol','slim':'Dar / slim','regular':'Regular / düz'}[f],'material':material or 'Belirtilmedi','description':description[:600],'sourceFacts':facts,'patterned':bool(re.search('ekose|kareli|cizgili|desenli|baskili|nakisli',text)),'warmth':warmth,'formality':2 if kind in ['coat','blazer','derby','loafer','turtleneck','chino'] else 0 if kind in ['cargo','jogger','hoodie'] else 1,'sizes':sizes,'image':images[0],'alternateImage':images[1] if len(images)>1 else images[0],'sourceImages':list(dict.fromkeys(images[:4])),'stock':{'status':status,'checkedAt':stamp,'method':method,'availableCount':len(available),'totalCount':len(sizes)},'verification':{'price':okay,'stock':status!='unknown','priceSource':method+' price','stockSource':method,'factsSource':method+' construction/composition','sourcePrices':sourceprices,'reason':None if okay else 'price_sources_disagree','bodyHash':hashlib.sha256(raw.encode()).hexdigest()},'priceHistory':[{'date':DAY,'observedAt':stamp,'price':price,'source':'product_page'}]}

def mango(url,hint):
 raw=fetch(url);s=source_product_mango(raw);parts=urlparse(url).path.rstrip('/').split('/');cid=parts[-2]
 c=next((x for x in s['colors'] if x['id']==cid),None)
 if not c:raise ValueError('Requested Mango color not in source state')
 pinfo=c.get('prices',{}).get('default',{});price=float(pinfo.get('price') or 0)
 if pinfo.get('currency')!='TRY':raise ValueError('Mango price is not TRY')
 description='; '.join(c.get('description',{}).get('bullets',[]));material='; '.join(c.get('compositions',[]))
 images=[]
 for look in c.get('looks',{}).values():
  gallery=look.get('gallery',[])
  for v in gallery:
   if isinstance(v,dict) and v.get('type')!='VIDEO' and v.get('src'):images.append(v['src'])
  for v in look.get('images',{}).values():
   if v.get('img'):images.append(s['assetsDomain']+v['img'])
 # Source gallery keys can have different layout; inspect recursively for exact images.
 if not images:
  for v in walk(c.get('looks',{})):
   if v.get('src','').startswith('https://media.mango.com/'):images.append(v['src'])
   elif v.get('img','').startswith('/is/image/'):images.append(s['assetsDomain']+v['img'])
 # The exact source asset is served in the user's selected color.
 images=[im+('?wid=560&qlt=85' if '?' not in im else '') for im in images]
 sizes=[{'size':v['label'],'available':v['available'],'price':price} for v in c.get('sizes',[]) if isinstance(v.get('available'),bool)]
 facts={'Kumaş':material,'Ürün özellikleri':description,'Koleksiyon':s.get('collection',''),'Model':s.get('model','')}
 for bullet in c.get('description',{}).get('bullets',[]):
  if re.search('fit|kesim',norm(bullet)):facts['Kalıp']=bullet;break
 p=base(raw,url,'Mango',s['reference']+'-'+cid,s['name'],c['label'],price,'Mango',hint,facts,material,description,images,sizes,'Mango_RSC_product_color_sizes_prices',[price],'Mango',s['reference'])
 p['originalPrice']=float(pinfo.get('originalPrice') or pinfo.get('crossedOutPrice') or price)
 return p

def decathlon(url,hint):
 raw=fetch(url);state=dkt(raw);parts=state['_ctx']['data'];s=next(x['data'] for x in parts if x['type']=='Supermodel');ld=next((p for p in ld_products(raw) if str(p.get('productID'))==str(s['supermodelId'])),{})
 if not ld:raise ValueError('Missing Decathlon JSON-LD product')
 query=parse_qs(urlparse(url).query);mid=query.get('mc',[None])[0];model=next((x for x in s['models'] if x['modelId']==mid),s['models'][0]);mid=model['modelId'];url=urljoin(DEC,model['url']);price=float(model['price'])
 offers=[x for x in walk(ld.get('offers',[])) if x.get('@type')=='Offer' and parse_qs(urlparse(x.get('url','')).query).get('mc',[None])[0]==mid];offerby={str(x['sku']):x for x in offers}
 if not offers:raise ValueError('No exact Decathlon color offers')
 sizes=[]
 for v in model.get('skus',[]):
  offer=offerby.get(str(v['skuId']))
  if offer and v.get('size'):sizes.append({'size':v['size'],'available':offer.get('availability','').endswith('/InStock'),'price':float(offer['price'])})
 facts={}
 for v in s.get('structurationValues',[]):
  if v.get('typeLabel') and v.get('label'):
   key=v['typeLabel'];facts[key]=facts[key]+'; '+v['label'] if key in facts else v['label']
 if facts.get('Kesim'):facts['Kalıp']=facts['Kesim']
 if facts.get('Kol boyu'):facts['Kol Boyu']=facts['Kol boyu']
 for part in parts:
  if part['type']=='ProductBenefits':
   for v in (part.get('data') or {}).get('benefits',[]):facts[v['label']]=v['value']
 facts['Kumaş']=model.get('composition','');facts['Ürün Tipi']=s.get('natureLabel','')
 color=' / '.join(dict.fromkeys(v['label'] for v in model.get('colors',[])))
 ims=[v.get('url') for v in model.get('images',{}).get('product',[])]
 if not ims:ims=[model.get('image',{}).get('url') or ld.get('image')]
 desc=' '.join(str(x or '') for x in [s.get('designedFor'),s.get('description'),s.get('catchline')])
 p=base(raw,url,'Decathlon',mid,model['webLabel'],color,price,s.get('brand',{}).get('label','Decathlon'),hint,facts,model.get('composition',''),desc,ims,sizes,'Decathlon_DKT_model_SKU_plus_JSONLD_offer',[price,*[float(o['price']) for o in offers]],offers[0].get('seller',{}).get('name') or 'Belirtilmedi',s['supermodelId'])
 p['verification']['priceSource']='__DKT selected model price + JSON-LD exact color SKU offers'
 if p['kind']=='cardigan' and 'polar' in norm(p['name']) and 'yarim fermuar' in norm(facts.get('Fermuar türü','')):
  p['category']='top';p['kind']='sweat';p['warmth']=2
 if p['category']=='bottom' and p['kind']=='chino' and re.search('outdoor|trekking',norm(p['name'])):
  p['kind']='technical';p['formality']=0
 return p

def number(s):
 s=str(s).strip().replace('₺','').replace('TL','').replace(' ','')
 if ',' in s:return float(s.replace('.','').replace(',','.'))
 # Boyner PriceInfo uses Turkish thousands, e.g. 2.399 or 2.399,99.
 if re.fullmatch(r'\d{1,3}(?:\.\d{3})+',s):s=s.replace('.','')
 return float(s)
def boyner(url,hint):
 raw=fetch(url);state=boy_state(raw);queries=state.get('dsListingDetailService',{}).get('queries',{});data=next((v['data'] for k,v in queries.items() if k.startswith('getProductDetail(') and v.get('data')),None)
 if not data:raise ValueError('Missing Boyner exact product detail')
 if data.get('Gender') not in ['Erkek','Unisex']:raise ValueError('Not menswear')
 ld=next((v for v in ld_products(raw) if str(v.get('sku'))==str(data['ProductId']) and v.get('offers')), {})
 offer=ld.get('offers',{});price=float(offer.get('price') or 0)
 if offer.get('priceCurrency')!='TRY':raise ValueError('Missing TRY JSON-LD offer')
 info=data.get('PriceInfo',{});shown=number(info.get('Price',0));other=shown;conditional=None
 # BestOffer can be coupon/basket pricing; keep the corroborated pre-campaign
 # amount for outfit budgets and retain the exact lower conditional offer.
 if abs(shown-price)>.021 and info.get('CampaignId'):
  old=number(info.get('OldPrice') or 0)
  campaign=next((v for v in data.get('Campaigns',[]) if str(v.get('Id'))==str(info['CampaignId'])),None)
  if campaign and abs(old-price)<.021:
   other=old;conditional={'price':shown,'condition':campaign.get('Title') or info.get('CampaignInfo'),'campaignId':info['CampaignId'],'source':'Boyner product PriceInfo + matching Campaigns'}
 facts={v['Name']:v['Value'] for v in data.get('InfoAttributes',[])};facts['Ürün Tipi']=data.get('CategoryName','')
 sizes=[{'size':v['Name'],'available':v.get('StockCount',0)>0,'quantity':v['StockCount'],'price':price} for v in data.get('Variants',[]) if 'StockCount' in v]
 ims=[v['CoverUrl'] for v in data.get('Medias',[]) if v.get('MediaType')=='Image'];material=facts.get('Dış Materyal') or facts.get('Materyal') or facts.get('Kumaş Tipi') or ''
 color=facts.get('Renk') or ld.get('color','');brand=data.get('Brand',{}).get('Name','');pid=data['ProductId'];model=data.get('EventData',{}).get('Dimension54') or pid
 # OtherProducts explicitly groups color alternatives: canonical minimum ID identifies the family.
 ids=[str(v.get('ProductId')) for v in data.get('OtherProducts',[]) if v.get('ProductId')]
 if ids:model=min(ids,key=lambda x:int(x) if x.isdigit() else 10**20)
 desc=re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',data.get('Description','')))).strip()
 p=base(raw,url,'Boyner',pid,data['DisplayName'],color,price,brand,hint,facts,material,desc,ims,sizes,'Boyner_NEXT_DATA_variants_StockCount_plus_JSONLD',[price,other],data.get('MerchantInfo',{}).get('Name') or 'Belirtilmedi',model)
 p['originalPrice']=float(offer.get('priceSpecification',{}).get('price') or price)
 p['verification']['priceSource']='JSON-LD offer + __NEXT_DATA__ exact product PriceInfo'
 if conditional:
  p['conditionalPrice']=conditional;p['sourceFacts']['Kampanya']=conditional['condition'];p['verification']['priceSource']='JSON-LD offer + __NEXT_DATA__ PriceInfo.OldPrice; conditional lower campaign excluded from budget'
 return p

def discover_one(plan):
 host,path,hint,quota=plan;url=host+path
 try:
  raw=fetch(url);found=[]
  if host==MAN:
   links=[html.unescape(x) for x in re.findall(r'href=["\']([^"\']*/tr/tr/p/erkek/[^"\']+)["\']',raw)]
   for x in links:
    m=re.search(r'/(\d{8})/([^/]+)/[^/]+$',x)
    if m:found.append((m[1],urljoin(host,x),hint))
  elif host==DEC:
   links=[html.unescape(x) for x in re.findall(r'href=["\']([^"\']*/p/[^"\']*/_/R-p-\d+(?:\?[^"\']*)?)["\']',raw)]
   for x in links:
    if '#' in x:continue
    n=norm(x)
    if 'erkek' not in n and not re.search('avcilik|doga-gozlemi',n):continue
    if re.search('cocuk|kadin|neopren|dalis|kayak|sisme-bot|neopren|ust-pantolon',n):continue
    # Preserve intended garment role on mixed waterproof category pages.
    if hint=='outer' and not re.search('mont|yagmurluk|softshell|ceket',n):continue
    if hint=='bottom' and 'pantolon' not in n:continue
    if hint=='shoe' and not re.search('bot|ayakkabi',n):continue
    model=re.search(r'R-p-(\d+)',x)[1];found.append((model,urljoin(host,x),hint))
  else:
   state=boy_state(raw)
   listings=[]
   for q in state.get('dsListingSearchService',{}).get('queries',{}).values():
    listings += q.get('data',{}).get('Products',[])
   # Prefer accessible budgets but preserve actual listed prices, never basket estimates.
   listings.sort(key=lambda x:number(x.get('PriceInfo',{}).get('Price',999999)))
   for p in listings:
    if p.get('Gender') not in ['Erkek','Unisex']:continue
    group=sorted([x.get('Url','') for x in p.get('Colors',[]) if x.get('Url')])
    model=group[0] if group else p['Id'];found.append((model,urljoin(host,p['Url']),hint))
  selected=[];seen=set()
  for model,link,role in found:
   if model in seen:continue
   seen.add(model);selected.append((link,role))
   if len(selected)>=quota:break
  source={'url':url,'retailer':{'shop.mango.com':'Mango','www.boyner.com.tr':'Boyner','www.decathlon.com.tr':'Decathlon'}[urlparse(host).hostname],'retrievedAt':now(),'found':len(set(x[0] for x in found)),'used':len(selected),'role':hint,'bodyHash':hashlib.sha256(raw.encode()).hexdigest(),'maxColorsPerModel':1}
  print('CATEGORY',source['retailer'],path,len(selected),flush=True)
  return selected,source,None
 except Exception as exc:return [],None,{'url':url,'error':str(exc)}
def one(job):
 url,hint=job
 try:
  p=(mango if url.startswith(MAN) else decathlon if url.startswith(DEC) else boyner)(url,hint)
  print('VERIFIED',p['id'],p['kind'],p['stock']['status'],p['priceStatus'],flush=True);return p,None
 except Exception as exc:return None,{'url':url,'error':str(exc)}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',default='/tmp/kendince-retailers-b.json');ap.add_argument('--limit',type=int,default=0);ap.add_argument('--workers',type=int,default=5);args=ap.parse_args();started=now()
 jobs=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for selected,source,error in pool.map(discover_one,PLAN):
   jobs+=selected
   if source:SOURCES.append(source)
   if error:ERRORS.append(error)
 jobs=list(dict.fromkeys(jobs))
 if args.limit:jobs=jobs[:args.limit]
 products=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
  for product,error in pool.map(one,jobs):
   if product:products.append(product)
   if error:ERRORS.append(error)
 # One color per first-party model (cross-category links can overlap).
 models=set();unique=[]
 for p in products:
  if p['modelId'] in models:continue
  models.add(p['modelId']);unique.append(p)
 products=unique
 stats={'attempted':len(jobs),'total':len(products),'modelCount':len(models),'priceVerified':sum(p['priceStatus']=='verified' for p in products),'stockAvailable':sum(p['stock']['status']=='available' for p in products),'stockOut':sum(p['stock']['status']=='out_of_stock' for p in products),'stockUnknown':sum(p['stock']['status']=='unknown' for p in products),'failed':len(ERRORS),'byRetailer':{r:sum(p['retailer']==r for p in products) for r in ['Mango','Decathlon','Boyner']},'byKind':{k:sum(p['kind']==k for p in products) for k in sorted({p['kind'] for p in products})}}
 result={'schemaVersion':3,'checkedAt':DAY,'verifiedAt':now(),'verificationWindow':{'start':started,'end':now()},'method':'Anonymous first-party storefront HTML: Mango RSC selected-color inventory/price; Decathlon __DKT composition/features cross-checked with JSON-LD exact-color SKU offers; Boyner Next state product/merchant/variant quantity cross-checked with JSON-LD offer. One color per model. No search snippet prices.','products':products,'sources':SOURCES,'errors':ERRORS,'stats':stats}
 pathlib.Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2));print('SUMMARY',json.dumps(stats),flush=True)
if __name__=='__main__':main()
