"""Create small fabric swatches from public retailer photos, without AI.
This prepares reviewable candidates only; the workflow never pushes repository changes.
"""
import base64,datetime,io,json,pathlib,urllib.request,concurrent.futures,subprocess
from PIL import Image,ImageDraw,ImageStat
import cairosvg
root=pathlib.Path(__file__).resolve().parents[2]
out=root/'mannequin-review';out.mkdir(exist_ok=True)
catalog=json.loads((root/'public/kendince/catalog.json').read_text())
palette={'cream':'#ded7c6','black':'#292a29','navy':'#303946','blue':'#57758a','gray':'#797c7c','brown':'#76594a','olive':'#6a7052','red':'#773943','purple':'#685165','yellow':'#bca15b'}
def crop_box(p):
 u=p['image'];model='99-76' in u
 if p['category']=='bottom':return (0.34,0.57,0.46,0.75)
 if p['category']=='shoe':return (0.29,0.69,0.47,0.83) if u.endswith('_5.jpg') else (0.35,0.35,0.58,0.54)
 if '_5.jpg' in u:return (0.43,0.26,0.57,0.40)
 return (0.42,0.34,0.58,0.49) if model else (0.40,0.38,0.60,0.55)
def fetch(p):
 try:
  if not p.get('image','').startswith(('https://img-lcwaikiki.mncdn.com/','https://cdn.mavi.com/')):raise ValueError('unsupported image source')
  req=urllib.request.Request(p['image'],headers={'User-Agent':'Mozilla/5.0'})
  data=urllib.request.urlopen(req,timeout=18).read()
  photo=Image.open(io.BytesIO(data)).convert('RGB');box=crop_box(p)
  patch=photo.crop(tuple(round(v*(photo.width if i%2==0 else photo.height)) for i,v in enumerate(box)))
  patch=patch.resize((48,64),Image.Resampling.LANCZOS)
  pixels=list(patch.getdata())
  # Trim the brightest/darkest values for a stable representative fabric color.
  pixels=sorted(pixels,key=lambda v:sum(v));mid=pixels[len(pixels)//5:len(pixels)*4//5]
  rgb=tuple(round(sum(v[i] for v in mid)/len(mid)) for i in range(3))
  color='#'+''.join(format(v,'02x') for v in rgb)
  b=io.BytesIO();patch.save(b,format='JPEG',quality=86,optimize=True)
  return p['id'],{'color':color,'texture':'data:image/jpeg;base64,'+base64.b64encode(b.getvalue()).decode(),'sourceImage':p['image'],'crop':box,'method':'fixed_photo_crop'}
 except Exception as e:return p['id'],{'color':palette.get(p.get('family'),'#797c7c'),'texture':None,'method':'catalog_color_fallback','reason':str(e)}
results=dict(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(fetch,catalog['products']))
manifest={'version':1,'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Deterministic photo crops; no AI, no virtual fit estimation. Crops reproduce a fabric sample, not an exact garment render.','products':results}
(out/'textures.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
print('TEXTURES_RESULT '+json.dumps(manifest,ensure_ascii=False,separators=(',',':')),flush=True)
print('TEXTURE_COVERAGE '+str(sum(bool(p['texture']) for p in results.values()))+'/'+str(len(results)),flush=True)
subprocess.run(['node','scripts/kendince/render-mannequin-review.mjs'],check=True,cwd=root)
svgs=sorted(out.glob('look-*.svg'))
sheet=Image.new('RGB',(len(svgs)*320,680),'#efede5');draw=ImageDraw.Draw(sheet)
for i,path in enumerate(svgs):
 img=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=path.read_bytes(),output_width=320,output_height=620))).convert('RGBA')
 sheet.paste(img,(i*320,35),img)
 draw.text((i*320+14,12),path.stem,fill='#424f3e')
b=io.BytesIO();sheet.save(b,format='JPEG',quality=90)
print('MANNEQUIN_REVIEW '+base64.b64encode(b.getvalue()).decode(),flush=True)
