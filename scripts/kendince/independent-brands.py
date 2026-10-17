"""Prepare a reviewed discovery feed from first-party Shopify storefronts.

Prices retain original currency and an explicit dated TCMB conversion. A live
product page must respond successfully; draft/deleted feed entries are skipped.
No material filtering: missing composition stays unknown. --write accepts locally.
"""
import argparse, collections, concurrent.futures, datetime, hashlib, html, json, pathlib, re, urllib.request, xml.etree.ElementTree as ET
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[2]
STOREFRONTS={'Percival':'https://www.percivalclo.com','Universal Works':'https://universalworks.com',"Drake’s":'https://www.drakes.com','Wax London':'https://waxlondon.com','Portuguese Flannel':'https://www.portugueseflannel.com','Norse Projects':'https://www.norseprojects.com','Stan Ray':'https://www.stanray.com','Studio Nicholson':'https://www.studionicholson.com','Story mfg.':'https://www.storymfg.com','mfpen':'https://mfpen.com','Les Benjamins':'https://lesbenjamins.com','A Kind of Guise':'https://akindofguise.com'}
FIBER=r'cotton|wool|cashmere|linen|hemp|silk|leather|suede|polyester|polyamide|nylon|acrylic|elastane|elastan|viscose|lyocell|modal|cupro|polyurethane|rayon|recycled|pamuk|yun|yün|keten|akrilik|poliamid|poliester|deri|tencel|acetate|spandex|eva|rubber|other fib'
class Visible(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.parts=[]
 def handle_starttag(self,t,a):
  if t in ('script','style','noscript','svg'):self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style','noscript','svg'):self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip:
   d=re.sub(r'\s+',' ',d).strip()
   if d:self.parts.append(d)
def visible(raw):
 p=Visible();p.feed(raw);return p.parts
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (Kendince catalog snapshot)'})
 return urllib.request.urlopen(req,timeout=18).read()
def classify(p):
 title=p['title'].lower(); typ=p.get('product_type','').lower();tags=' '.join(p.get('tags',[])).lower();t=title+' '+typ+' '+tags
 if re.search(r"women|woman|womens|waitress|skirt|dress\b",title+' '+typ) and 'unisex' not in t:return
 if re.search(r'(^|[ ,])(?:women|womens|woman|x-women)($|[ ,])',tags) and not re.search(r'(^|[ ,])(?:men|mens|unisex)($|[ ,])',tags):return
 if re.search(r'^(?:W\d)',str(p.get('variants',[{}])[0].get('sku',''))) and p.get('vendor','').lower()=='mfpen':return
 if re.search(r'\b(?:hat|cap|scarf|scarves|tie|sock|belt|boxer|pyjama|pajama|bag|beanie|bandana|tote|pocket square|voucher|gift|keyring|perfume|fragrance|washbag|overalls|dungaree)\b',title):return
 if re.search(r'boot|chukka',title):return 'shoe','boot'
 if re.search(r'loafer|moccasin|boat shoe',title):return 'shoe','loafer'
 if re.search(r'derby|oxford|michael|montana',title):return 'shoe','derby'
 if re.search(r'sneaker|trainer',title):return 'shoe','sneaker'
 if re.search(r'footwear',typ):return
 if re.search(r'\bshorts?\b',title) and not re.search(r'short.sleeve|short jacket|short coat',title):return 'bottom','shorts'
 if re.search(r'pant|trouser|jean|painter|fatigue',title+' '+typ):
  k='jean' if re.search(r'jean|denim',title) else 'corduroy' if 'cord' in title else 'cargo' if re.search(r'cargo|fatigue|painter',title) else 'jogger' if re.search(r'jogger|sweatpant|trackpant',title) else 'chino'
  return 'bottom',k
 if re.search(r'overshirt|workshirt',title+' '+typ):return 'layer','overshirt'
 if re.search(r'blazer|sartorial|shale jacket',title+' '+typ):return 'outer','blazer'
 if re.search(r'cardigan',title+' '+typ):return 'layer','cardigan'
 if re.search(r'\bvest\b|waistcoat|gilet|sleeveless',title+' '+typ):return 'layer','vest'
 if re.search(r'coat|parka|puffer',title+' '+typ):return 'outer','parka' if 'parka' in title else 'puffer' if 'puffer' in title else 'raincoat' if re.search(r'trench|raincoat',title) else 'coat'
 if re.search(r'jacket|bomber|harrington|blouson|outerwear',title+' '+typ):return 'outer','jacket'
 if re.search(r'hood',title+' '+typ):return 'top','hoodie'
 if re.search(r'sweat|sweats',title+' '+typ):return 'top','sweat'
 if re.search(r'roll.?neck|turtle.?neck',title):return 'top','turtleneck'
 if re.search(r'knit|jumper|sweater|pullover|lambswool',title+' '+typ):return 'top','knit'
 if re.search(r'polo|rugby',title+' '+typ):return 'top','polo'
 if re.search(r't-shirt|tee\b|t-shirts',title+' '+typ):return 'top','longtee' if re.search(r'long sleeve|ls tee',title) else 'tee'
 if re.search(r'shirt|shirting',title+' '+typ) or 'shirts' in p.get('tags',[]):return 'top','shirt'
 if re.search(r'jackets',tags):return 'outer','jacket'
 return None
def family(text):
 t=text.lower()
 for k,pat in [('black',r'black|noir|raven|anthracite'),('navy',r'navy|ink|dark blue'),('cream',r'ecru|cream|natural|ivory|white|sand|beige|off.white|almond|oat|stone'),('gray',r'gr[ae]y|charcoal|silver'),('brown',r'brown|coffee|tobacco|chocolate|bark|tan|camel|umber|beeswax'),('olive',r'green|olive|sage|khaki|forest|moss'),('red',r'burgundy|red|rust|orange|pink|maroon'),('purple',r'purple|lilac|violet'),('yellow',r'yellow|mustard'),('blue',r'blue|indigo|denim|cobalt')]:
  if re.search(pat,t):return k
 return None
def material_lines(raw,body):
 lines=visible(raw); bodylines=visible(body)
 def evidence(line):return len(line)<=420 and re.search(FIBER,line,re.I) and re.search(r'(?:\d[\d.,]*\s*%|%\s*\d)',line)
 matches=[]
 for line in bodylines+lines:
  if evidence(line) and line not in matches:matches.append(line)
 if matches:return '; '.join(matches[:10])
 # Qualitative composition still carries a warning that percentages are absent.
 for line in bodylines:
  if re.search(FIBER,line,re.I) and len(line)<300:return line
 return 'Kumaş bileşimi kaynakta doğrulanamadı'
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--cache',type=pathlib.Path,required=True);ap.add_argument('--per-store',type=int,default=32);ap.add_argument('--write',action='store_true');ap.add_argument('--cached',action='store_true',help='Use already captured source responses without refreshing them');args=ap.parse_args()
 cache=args.cache;cache.mkdir(parents=True,exist_ok=True)
 if not args.cached:
  for name,base in STOREFRONTS.items():
   raw=get(base+'/products.json?limit=250');cart=json.loads(get(base+'/cart.js'));
   (cache/(name+'.json')).write_bytes(raw);(cache/(name+'-meta.json')).write_text(json.dumps({'base':base,'currency':cart.get('currency')}))
  (cache/'fx.xml').write_bytes(get('https://www.tcmb.gov.tr/kurlar/today.xml'))
  for oldpage in cache.glob('page-*.html'):oldpage.unlink()
 outdir=ROOT/'kendince-audit';outdir.mkdir(exist_ok=True)
 fxraw=(cache/'fx.xml').read_bytes();fx=ET.fromstring(fxraw);rates={c.attrib['Kod']:float(c.findtext('ForexSelling'))/int(c.findtext('Unit')) for c in fx if c.findtext('ForexSelling')};rates['TRY']=1
 fxdate=datetime.datetime.strptime(fx.attrib['Date'],'%m/%d/%Y').date().isoformat();fxurl='https://www.tcmb.gov.tr/kurlar/'+fxdate[:4]+fxdate[5:7]+'/'+fxdate[8:10]+fxdate[5:7]+fxdate[:4]+'.xml'
 tasks=[];sources=[]
 for metapath in sorted(cache.glob('*-meta.json')):
  name=metapath.name[:-10];meta=json.loads(metapath.read_text());currency=meta.get('currency')
  if currency not in rates:continue
  ps=json.loads((cache/(name+'.json')).read_text())['products'];groups=collections.defaultdict(list);seen=set()
  for p in ps:
   kind=classify(p)
   if not kind or not p.get('images') or not any(v.get('available') and float(v.get('price') or 0)>0 for v in p.get('variants',[])):continue
   # Select varied designs instead of filling the feed with sibling colors.
   title=p['title'].split('|')[0].split(' - ')[0];signature=re.sub(r'\([^)]*\)|\b(?:black|navy|white|brown|green|grey|blue|olive|cream|red)\b','',title,flags=re.I).strip().lower()
   if signature in seen:continue
   seen.add(signature);groups[kind].append(p)
  selected=[]
  while groups and len(selected)<args.per_store+12:
   for kind in list(groups):
    if groups[kind]:selected.append((groups[kind].pop(0),kind))
    if not groups[kind]:del groups[kind]
    if len(selected)>=args.per_store+12:break
  meta['observedAt']=datetime.datetime.fromtimestamp((cache/(name+'.json')).stat().st_mtime,datetime.timezone.utc).isoformat()
  tasks.extend((name,meta,currency,p,kind) for p,kind in selected)
  sources.append({'retailer':name,'url':meta['base']+'/products.json?limit=250','method':'First-party product feed, variant availability, successful product page and shop /cart.js currency','responseSha256':hashlib.sha256((cache/(name+'.json')).read_bytes()).hexdigest()})
 def prepare(task):
  name,meta,currency,p,(cat,kind)=task;url=meta['base']+'/products/'+p['handle'];stamp=meta['observedAt']
  try:
   pagepath=cache/('page-'+str(p['id'])+'.html')
   if pagepath.exists():raw=pagepath.read_bytes()
   else:raw=get(url);pagepath.write_bytes(raw)
   page=raw.decode('utf-8');
   if str(p['id']) not in page:raise ValueError('Product identity missing in successful page response')
   rate=rates[currency];variants=p['variants'];opts=p.get('options',[]);sizeIndex=next((i for i,o in enumerate(opts) if re.search('size|beden',o['name'],re.I)),None);colorIndex=next((i for i,o in enumerate(opts) if re.search('colou?r|renk',o['name'],re.I)),None)
   # Keep one actual color with its own variant evidence.
   color=str(variants[0].get('option'+str(colorIndex+1)) or '') if colorIndex is not None else p['title'].split('|')[-1].strip()
   if colorIndex is not None:variants=[v for v in variants if v.get('option'+str(colorIndex+1))==color]
   av=[v for v in variants if v['available'] and float(v['price'])>0]
   if not av:return None
   fam=family(color+' '+p['title']+' '+p['handle']+' '+' '.join(p.get('tags',[])))
   if not fam:return None
   original=max(float(v['price']) for v in av);price=round(original*rate,2)
   body=p.get('body_html') or '';material=material_lines(page,body);desc=' '.join(visible(body))
   # Quantitative body tables are not garment descriptions.
   desc=re.split(r'Sizing \(|Size guide|SIZE GUIDE',desc)[0][:900]
   fit='wide' if re.search(r'oversized|boxy|wide.leg|relaxed.fit|loose.fit|generous.fit',desc+' '+p['title']+' '+' '.join(p.get('tags',[])),re.I) else 'slim' if re.search(r'\bslim fit\b',desc,re.I) else 'regular'
   sizes=[]
   if sizeIndex is not None:
    for v in variants:
     size=str(v.get('option'+str(sizeIndex+1)) or '')
     size={'Extra Small':'XS','Small':'S','Medium':'M','Large':'L','Extra Large':'XL','Extra Extra Large':'XXL'}.get(size,size).replace('EU','').strip()
     sizes.append({'size':size,'available':v['available'],'price':round(float(v['price'])*rate,2),'sourcePrice':float(v['price']),'sourceCurrency':currency,'variantId':str(v['id'])})
   slug=re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-');uid=slug+'-'+str(p['id']);image=p['images'][0]['src'];image+=('&' if '?' in image else '?')+'width=700'
   brand=name
   if p['title'].startswith('Clarks Originals'):brand='Clarks Originals'
   if p['title'].startswith('Paraboot'):brand='Paraboot'
   return {'id':uid,'sku':av[0].get('sku',''),'modelId':slug+':'+str(p['id']),'name':p['title'],'brand':brand,'retailer':name,'seller':name,'category':cat,'kind':kind,'price':price,'originalPrice':price,'url':url,'image':image,'alternateImage':p['images'][1]['src'] if len(p['images'])>1 else image,'source':'Markanın kendi ürün sayfası ve varyant kaydı','checkedAt':stamp[:10],'verifiedAt':stamp,'priceStatus':'verified','color':color,'family':fam,'fit':fit,'fitLabel':{'wide':'Rahat / bol','slim':'Dar / slim','regular':'Regular / düz'}[fit],'material':material,'description':desc,'sourceFacts':{'Kumaş':material,'Kaynak ürün türü':p.get('product_type',''),'Kaynak beden sistemi':'Mağazanın özgün beden etiketi; dönüşüm yapılmadı'},'sizes':sizes,'stock':{'status':'available','checkedAt':stamp,'method':'First-party Shopify variants.available, selected color only'},'verification':{'price':True,'stock':True,'sourcePrices':[price],'responseSha256':hashlib.sha256(raw).hexdigest(),'pageCheckedAt':datetime.datetime.fromtimestamp(pagepath.stat().st_mtime,datetime.timezone.utc).isoformat(),'sourceUrl':url,'feedUrl':meta['base']+'/products.json?limit=250'},'priceHistory':[{'date':stamp[:10],'observedAt':stamp,'price':price,'source':'product_page','currency':currency,'sourcePrice':original}],'discovery':True,'priceOrigin':{'currency':currency,'amount':original,'tlEstimate':currency!='TRY','rate':rate,'rateDate':fxdate,'rateSource':fxurl,'note':'Kargo, gümrük, vergiler ve Türkiye teslimatı doğrulanmadı; özgün mağaza fiyatının kur karşılığı.' if currency!='TRY' else 'Markanın TL mağaza fiyatı.'},'patterned':bool(re.search(r'check|stripe|patchwork|embroid|jacquard|print|floral',p['title'],re.I)),'warmth':2 if kind in ('knit','cardigan','coat','jacket') else 1,'formality':2 if kind in ('blazer','loafer','derby') else 0 if kind in ('cargo','hoodie','jogger') else 1}
  except Exception as e:return {'error':str(e),'retailer':name,'url':url}
 products=[];errors=[];counts=collections.Counter()
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
  for result in pool.map(prepare,tasks):
   if result and result.get('error'):errors.append(result)
   elif result and counts[result['retailer']]<args.per_store:products.append(result);counts[result['retailer']]+=1
 print(json.dumps({'stores':dict(counts),'total':len(products),'errors':len(errors)},ensure_ascii=False),flush=True)
 report={'products':products,'sources':sources,'stats':{'byStore':dict(counts),'total':len(products)},'errors':errors,'fx':{'date':fxdate,'source':fxurl,'rates':rates}}
 target=outdir/'independent-feed.json';target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 if args.write:
  import subprocess
  subprocess.run(['python',str(ROOT/'scripts/kendince/merge-catalog.py'),str(target),'--write'],check=True)
if __name__=='__main__':main()
