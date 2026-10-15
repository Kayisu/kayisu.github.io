"""Prepare a dated first-party catalog candidate; no login, AI, or repository writes.
Run with --write only after reviewing the report. Default output is kendince-audit/.
"""
import argparse, concurrent.futures, csv, datetime, hashlib, html, json, pathlib, re, subprocess, unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[2]
TARGET=ROOT/'public/kendince/catalog.json'
UTC=datetime.timezone.utc
DAY=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).date().isoformat()
OLD=json.loads(TARGET.read_text());OLD_BY_ID={p['id']:p for p in OLD['products']}
CACHE=pathlib.Path('/tmp/kendince-v4-http');CACHE.mkdir(exist_ok=True)
errors=[];sources=[]
PLAN=[
 ('/erkek-kazak-t-199','top',22,r'kazak|triko'),
 ('/erkek-hirka-t-159','layer',16,r'hirka|polar|fermuarli'),
 ('/erkek-kase-kaban-t-1112','outer',14,r'kaban'),
 ('/erkek-sisme-mont-t-3055','outer',14,r'mont'),
 ('/erkek-mont-t-3459','outer',10,r'mont'),
 ('/erkek-gomlek-ceket-t-677','layer',12,r'ceket'),
 ('/erkek-bot-t-111','shoe',18,r'bot'),
 ('/erkek-kargo-pantolon-t-6850','bottom',14,r'pantolon'),
 ('/erkek-yagmurluk-t-2037','outer',10,r'yagmurluk|trenckot'),
]
def now():return datetime.datetime.now(UTC).isoformat()
def norm(s):return ''.join(c for c in unicodedata.normalize('NFKD',str(s).lower().replace('ı','i')) if not unicodedata.combining(c))
def fetch(url):
 if not url.startswith('https://www.lcw.com/'):raise ValueError('Unsupported source host')
 cache=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
 if cache.exists() and datetime.datetime.now().timestamp()-cache.stat().st_mtime<900:return cache.read_text()
 p=subprocess.run(['curl','-L','--max-time','25','--connect-timeout','10','--fail','-sS',url],capture_output=True)
 if p.returncode:raise ValueError('Source fetch failed (curl '+str(p.returncode)+')')
 raw=p.stdout.decode('utf-8','replace');cache.write_text(raw);return raw

def meta(raw,key):
 m=re.search(r'<meta[^>]*(?:property|name)=["\']'+re.escape(key)+r'["\'][^>]*content=["\']([^"\']+)',raw,re.I)
 return html.unescape(m.group(1)) if m else ''
def number(s):
 if isinstance(s,(int,float)):return float(s)
 s=str(s).replace('TL','').replace('TRY','').strip()
 if ',' in s:s=s.replace('.','').replace(',','.')
 return float(s)
def ld_product(raw):
 for blob in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',raw,re.S):
  try:
   obj=json.loads(blob)
   for x in obj if isinstance(obj,list) else [obj]:
    if x.get('@type')=='Product':return x
  except (ValueError,AttributeError):pass
 return {}
def strip(raw):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',raw))).strip()
def family(color):
 c=norm(color)
 for keys,result in [(['siyah','black'],'black'),(['antrasit','gri','grey','gray'],'gray'),(['lacivert','navy'],'navy'),(['mavi','indigo','blue'],'blue'),(['bej','ekru','beyaz','krem','tas','ecru','white'],'cream'),(['kahve','brown','camel','deve','taba'],'brown'),(['yesil','haki','green','olive'],'olive'),(['bordo','kirmizi','red'],'red'),(['mor','purple'],'purple'),(['sari','yellow'],'yellow')]:
  if any(k in c for k in keys):return result
 return 'gray'
def classify(name,hint,facts):
 n=norm(name+' '+facts.get('Ürün Tip',''))
 if hint=='shoe':return 'shoe','boot' if re.search(r'\bbot\b|trekking bot|chelsea',n) else 'loafer' if 'loafer' in n else 'derby' if 'klasik' in n or 'derby' in n else 'sneaker'
 if hint=='bottom':return 'bottom','cargo' if 'kargo' in n else 'corduroy' if 'kadife' in n else 'jean' if re.search(r'jean|denim|\bkot\b',n) else 'jogger' if re.search('jogger|esofman',n) else 'chino'
 if re.search('kaban',n):return 'outer','coat'
 if re.search('parka',n):return 'outer','parka'
 if re.search('yagmurluk|trenckot',n):return 'outer','raincoat'
 if 'sisme' in n:return 'outer','puffer'
 if re.search(r'\bmont\b',n):return 'outer','jacket'
 if 'blazer' in n:return 'outer','blazer'
 if 'hirka' in n:return 'layer','cardigan'
 if 'fermuarli' in n and ('sweat' in n or 'polar' in n):return 'layer','cardigan'
 if 'kazak' in n or 'triko' in n:return 'top','turtleneck' if re.search('balikci|dik yaka',n) else 'knit'
 if hint=='layer' and 'ceket' in n:return 'layer','overshirt'
 if 'gomlek' in n:return 'layer','shirt'
 if 'sweat' in n:return 'top','hoodie' if 'kapuson' in n else 'sweat'
 if hint=='outer':return 'outer','jacket'
 return 'top','polo' if 'polo' in n else 'longtee' if 'uzun kollu' in n else 'tee'
def lcw(url,hint):
 raw=fetch(url);stamp=now();pid=url.rsplit('-o-',1)[-1];old=OLD_BY_ID.get('lcw-'+pid);ld=ld_product(raw)
 match=re.search(r'(?:var\s+)?GA4ViewItemEvent\s*=\s*JSON.parse\(\s*("(?:\\.|[^"\\])*")\s*\)',raw,re.S);item={}
 if match:
  event=json.loads(json.loads(match.group(1)));item=event.get('ecommerce',{}).get('items',[{}])[0]
 title=meta(raw,'og:title');pm=re.search(r'([\d.]+,\d{2})\s*TL',title)
 if not pm:raise ValueError('Missing price')
 price=number(pm.group(1));values=[price]
 if item.get('price') is not None:values.append(number(item['price']))
 offers=ld.get('offers',{});offers=offers[0] if isinstance(offers,list) and offers else offers
 if isinstance(offers,dict) and offers.get('price') is not None:values.append(number(offers['price']))
 price_ok=len(values)>=2 and max(values)-min(values)<.021
 facts={v['name']:str(v.get('value','')) for v in ld.get('additionalProperty',[]) if isinstance(v,dict) and v.get('name')}
 color=ld.get('color') or (old or {}).get('color') or 'Belirtilmedi'
 name=ld.get('name') or html.unescape(item.get('item_name') or title.split(' - ')[0])
 if name.startswith(color+' '):name=name[len(color)+1:]
 category,kind=classify(name,hint,facts)
 brand=ld.get('brand',{});brand=brand.get('name') if isinstance(brand,dict) else brand
 brand=brand or item.get('item_brand') or 'LCW'
 sku=str(item.get('dimension1') or ld.get('sku') or '')
 model=str(ld.get('sku') or sku.split('-')[0] or pid).upper()
 variants=[]
 for m in re.finditer(r'new\s+SingleSizeProduct\(([^)]*)\)',raw):
  args=next(csv.reader([m.group(1)],quotechar="'",skipinitialspace=True))
  if len(args)<10 or args[0].strip()!=pid:continue
  try:
   qty=int(float(args[5]));variants.append({'size':args[3].strip(),'available':qty>0,'quantity':qty,'price':number(args[6])})
  except (ValueError,IndexError):continue
 variants=list({v['size']:v for v in variants}.values());available=[v for v in variants if v['available']]
 status='available' if available else 'out_of_stock' if variants else 'unknown'
 fitlabel=facts.get('Kalıp','');fittext=norm(fitlabel+' '+name)
 fit='wide' if re.search('loose|oversize|relax|baggy|rahat|bol kesim',fittext) else 'slim' if re.search('slim|skinny|dar kesim',fittext) else 'regular'
 desc=meta(raw,'og:description').split('size özel')[0].strip();body=strip(raw)
 material=''
 mm=re.search(r'Ana Kumaş\s*:\s*(.{0,150}?)(?:Menşei|Satıcı|Marka|Cinsiyet|Astar|Kumaş)',body)
 if mm:material=mm.group(1).strip()
 material=material or ', '.join(ld.get('material',[])) if isinstance(ld.get('material',[]),list) else material or str(ld.get('material',''))
 image=meta(raw,'og:image')
 if not image.startswith('https://'):raise ValueError('Missing image')
 oldhistory=list(old.get('priceHistory',[])) if old else []
 if old and not oldhistory:oldhistory=[{'date':old.get('checkedAt'),'observedAt':old.get('verifiedAt'),'price':old['price'],'source':'previous_snapshot'}]
 history=(oldhistory+[{'date':DAY,'observedAt':stamp,'price':price,'source':'product_page'}])[-12:]
 thick=norm(facts.get('Kalınlık',''));warmth=3 if thick=='kalin' else 1 if thick=='ince' else 2 if thick else 2 if kind in ['knit','turtleneck','hoodie','sweat','cardigan','coat','puffer','parka'] else 1
 formal=2 if kind in ['chino','loafer','derby','coat','blazer','turtleneck'] else 0 if fit=='wide' or kind in ['cargo','hoodie','sweat','jogger'] else 1
 pattern=norm(facts.get('Desen','')+' '+name)
 p={'id':'lcw-'+pid,'sku':sku,'modelId':'lcw:'+model,'name':name,'brand':brand,'retailer':'LCW','seller':facts.get('Satıcı') or item.get('affiliation') or offers.get('seller',{}).get('name','Mağaza sayfasında'),'category':category,'kind':kind,'price':price,'originalPrice':price,'url':url,'source':'Ürünün mağaza sayfası','checkedAt':DAY,'verifiedAt':stamp,'priceStatus':'verified' if price_ok else 'unverified','color':color,'family':family(color),'fit':fit,'fitLabel':fitlabel or {'wide':'Rahat / bol','slim':'Dar / slim','regular':'Regular / düz'}[fit],'material':material or 'Belirtilmedi','description':desc[:260],'sourceFacts':facts,'patterned':any(x in pattern for x in ['baskili','desen','ekose','cizgili','nakis','lisansli']),'warmth':warmth,'formality':formal,'sizes':variants,'image':image,'sourceImages':[image],'stock':{'status':status,'checkedAt':stamp,'method':'product_page_variant_quantity' if variants else 'unavailable_variant_data','availableCount':len(available),'totalCount':len(variants)},'verification':{'price':price_ok,'stock':bool(variants),'priceSource':'og:title + view_item + JSON-LD' if len(values)==3 else 'og:title + structured price','stockSource':'SingleSizeProduct variant quantities','factsSource':'JSON-LD additionalProperty','sourcePrices':values,'reason':None if price_ok else 'price_sources_disagree','bodyHash':hashlib.sha256(raw.encode()).hexdigest()},'priceHistory':history}
 images=ld.get('image',[]);images=[images] if isinstance(images,str) else images
 if images:p['alternateImage']=next((v for v in images if v!=image),images[0]);p['sourceImages']=list(dict.fromkeys([image,*images[:3]]))
 if available:p['variantPriceRange']={'min':min(v['price'] for v in available),'max':max(v['price'] for v in available)}
 return p

def discover():
 jobs={}
 for old in OLD['products']:
  if old['url'].startswith('https://www.lcw.com/'):jobs[old['url']]=(old['url'],old['category'])
 for path,role,quota,allow in PLAN:
  url='https://www.lcw.com'+path
  try:
   raw=fetch(url);stamp=now();cards=re.split(r'<div class="product-card product-card--full"',raw)[1:];seen={};selected=[]
   for card in cards:
    match=re.search(r'href=["\']([^"\']+-o-\d+)["\']',card)
    if not match:continue
    link=html.unescape(match.group(1))
    if not re.search(allow,norm(link)):continue
    sku=re.search(r'/l_\d+-([a-z0-9]+)-',card,re.I);model=sku.group(1).upper() if sku else link
    if seen.get(model,0)>=2:continue
    seen[model]=seen.get(model,0)+1;selected.append(link)
    jobs['https://www.lcw.com'+link]=('https://www.lcw.com'+link,role)
    if len(selected)>=quota:break
   sources.append({'url':url,'retrievedAt':stamp,'found':len(cards),'used':len(selected),'role':role,'maxColorsPerModel':2})
   print('CATEGORY',path,len(selected),flush=True)
  except Exception as exc:errors.append({'url':url,'error':str(exc)})
 return list(jobs.values())
def one(job):
 try:
  p=lcw(*job);print('VERIFIED',p['id'],p['kind'],p['stock']['status'],flush=True);return p
 except Exception as exc:errors.append({'url':job[0],'error':str(exc)});return None

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');parser.add_argument('--output-dir',default=str(ROOT/'kendince-audit'));args=parser.parse_args()
 out=pathlib.Path(args.output_dir);out.mkdir(parents=True,exist_ok=True)
 started=now();jobs=discover()
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:products=[p for p in pool.map(one,jobs) if p]
 byid={p['id']:p for p in products};unverified=[]
 for old in OLD['products']:
  if old['id'] in byid:continue
  p=dict(old);p['stock']={'status':'unknown','checkedAt':None,'method':'source_not_reverified','availableCount':0,'totalCount':0};p['verifiedAt']=None;p['verification']={'price':False,'stock':False,'reason':'source_not_reverified'};p['priceStatus']='unverified';byid[p['id']]=p
  unverified.append({'id':p['id'],'url':p['url'],'reason':'Bu turda kaynak yeniden doğrulanamadı; önceki fiyat tarihi korundu ve stok belirsiz bırakıldı.'})
 products=list(byid.values());end=now()
 stats={'attempted':len(jobs),'total':len(products),'priceVerified':sum(p['priceStatus']=='verified' for p in products),'stockAvailable':sum(p['stock']['status']=='available' for p in products),'stockOut':sum(p['stock']['status']=='out_of_stock' for p in products),'stockUnknown':sum(p['stock']['status']=='unknown' for p in products),'failed':len(errors),'notReverified':len(unverified),'priceConflicts':sum(p.get('verification',{}).get('reason')=='price_sources_disagree' for p in products),'modelCount':len(set(p.get('modelId') or p.get('sku','').split('-')[0] or p['id'].split('-')[0] for p in products))}
 report={'verifiedAt':end,'verificationWindow':{'start':started,'end':end},'stats':stats,'sources':sources,'errors':errors,'notReverified':unverified,'method':'Anonymous first-party product pages; price cross-check with GA4/JSON-LD; exact color variant quantities; source textile/thickness attributes; model grouping by SKU, never generic product title.'}
 result={'schemaVersion':3,'checkedAt':DAY,'verifiedAt':end,'verificationWindow':report['verificationWindow'],'live':False,'stats':stats,'products':products,'sources':sources}
 (out/'catalog.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('SUMMARY',json.dumps(stats),flush=True)
 if stats['priceVerified']<45:raise SystemExit('Insufficient coverage; candidate not published.')
 if args.write:TARGET.write_text(json.dumps(result,ensure_ascii=False,indent=2));(ROOT/'public/kendince/catalog-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('CATALOG_RESULT '+json.dumps(result,ensure_ascii=False,separators=(',',':')),flush=True);print('REPORT_RESULT '+json.dumps(report,ensure_ascii=False,separators=(',',':')),flush=True)
if __name__=='__main__':main()
