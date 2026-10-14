import json,re,pathlib,subprocess,html
out=pathlib.Path('kendince-audit');out.mkdir(exist_ok=True)
urls={
 'lcw-bottom':'https://www.lcw.com/regular-fit-gabardin-erkek-chino-pantolon-bej-o-4372801',
 'lcw-shoe':'https://www.lcw.com/bagcikli-erkek-spor-ayakkabi-beyaz-o-5176616',
 'lcw-shoes':'https://www.lcw.com/erkek-spor-ayakkabi-t-290',
 'mavi-top':'https://www.mavi.com/erkek/tisort/c/2',
 'mavi-triko':'https://www.mavi.com/erkek/triko/c/2',
 'mavi-product':'https://www.mavi.com/etiket-detayli-siyah-basic-tisort/p/0611824-900',
 'mavi-api':'https://p1-api.mavi.com/maviwebservices/v2/mavi/products/basic/0611824-900?fields=FULL'
}
for label,url in urls.items():
 r=subprocess.run(['curl','-L','--max-time','35','--fail','-sS',url],capture_output=True)
 raw=r.stdout.decode('utf-8','replace');(out/(label+'.html')).write_text(raw)
 print('SOURCE',label,r.returncode,len(raw),flush=True)
 if not raw:continue
 print('HTML-TERMS',label,[(key,[raw[max(0,m.start()-60):m.start()+260] for m in list(re.finditer(re.escape(key),raw))[:2]]) for key in ['StockQuantity','stock','Sizes','SizeId','ProductName','ProductDetail','productDetail','OptionSize','Sepete Ekle','TÜKENDİ']],flush=True)
 for m in list(re.finditer(r'JSON.parse\(',raw))[-12:]:print('JSON-PARSE',label,raw[m.start()-80:m.start()+250],flush=True)
 m=re.search(r'<script id="ng-state"[^>]*>(.*?)</script>',raw)
 if m:
  state=json.loads(m.group(1))
  for key,v in state.items():
   if isinstance(v,dict) and isinstance(v.get('b'),dict):
    b=v['b']
    if b.get('products'):print('MAVI-LIST',label,len(b['products']),json.dumps(b['products'][0],ensure_ascii=False)[:900],flush=True)
    if b.get('allSizeVariants') is not None:print('MAVI-STOCK',label,json.dumps({k:b.get(k) for k in ['name','code','price','salePrice','allSizeVariants']},ensure_ascii=False),flush=True)
 if label=='mavi-api':print('API-CONTENT',raw[:7000],flush=True)
 m=re.search(r'<script[^>]*id="productDetailData"[^>]*>(.*?)</script>',raw,re.S)
 if m:print('LCW-DATA',label,m.group(1)[:14000],flush=True)
 for m in list(re.finditer('modelManager.addModel',raw))[-2:]:print('LCW-MODEL',label,raw[max(0,m.start()-800):m.start()+30],flush=True)
 print('SCRIPTS',label,re.findall(r'<script[^>]*id="([^"]+)"',raw)[-10:],flush=True)
print('AUDIT-DONE',flush=True)
