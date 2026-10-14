import base64,io,json,pathlib,urllib.request,concurrent.futures
from PIL import Image,ImageDraw
root=pathlib.Path(__file__).resolve().parents[2]
catalog=json.loads((root/'public/kendince/catalog.json').read_text())
ids=['lcw-5383969','lcw-5486181','lcw-5496008','lcw-5421157','lcw-5415773','lcw-5271565','lcw-5457136','lcw-5176616','lcw-5600542','lcw-5337993','lcw-5539921','0612731-90892']
products=[p for p in catalog['products'] if p['id'] in ids]
sheet=Image.new('RGB',(4*240,3*350),'#f4f2eb');draw=ImageDraw.Draw(sheet)
def fetch(p):
 try:
  req=urllib.request.Request(p['image'],headers={'User-Agent':'Mozilla/5.0'})
  data=urllib.request.urlopen(req,timeout=25).read()
  return p,Image.open(io.BytesIO(data)).convert('RGB')
 except Exception as e:return p,str(e)
for i,(p,img) in enumerate(concurrent.futures.ThreadPoolExecutor(max_workers=4).map(fetch,products)):
 x=i%4*240;y=i//4*350
 if isinstance(img,Image.Image):
  img.thumbnail((230,307));sheet.paste(img,(x+(240-img.width)//2,y));draw.text((x+6,y+314),p['id'],fill='#222222');draw.text((x+6,y+333),p['category']+' / '+p['kind'],fill='#222222')
 else:draw.text((x+8,y+140),p['id']+' failed',fill='#222222')
out=io.BytesIO();sheet.save(out,format='JPEG',quality=85)
print('PHOTO_INSPECT '+base64.b64encode(out.getvalue()).decode(),flush=True)
