"""Create small fabric swatches from public retailer photos, without AI.
This prepares reviewable candidates only; the workflow never pushes repository changes.
"""
import base64,datetime,io,json,pathlib,urllib.request,concurrent.futures,subprocess,sys
from PIL import Image,ImageDraw,ImageStat,ImageFilter,ImageOps
import cairosvg
root=pathlib.Path(__file__).resolve().parents[2]
out=root/'mannequin-review';out.mkdir(exist_ok=True)
catalog=json.loads((root/'public/kendince/catalog.json').read_text())
existing=json.loads((root/'public/kendince/mannequin-textures.json').read_text()).get('products',{})
emit_log='--emit-log' in sys.argv
palette={'cream':'#ded7c6','black':'#292a29','navy':'#303946','blue':'#57758a','gray':'#797c7c','brown':'#76594a','olive':'#6a7052','red':'#773943','purple':'#685165','yellow':'#bca15b'}
def crop_box(p):
 u=p['image'];model='99-76' in u
 if p['category']=='bottom':return (0.34,0.57,0.46,0.75)
 if p['category']=='shoe':return (0.29,0.69,0.47,0.83) if u.endswith('_5.jpg') else (0.35,0.35,0.58,0.54)
 if '_5.jpg' in u:return (0.43,0.26,0.57,0.40)
 return (0.42,0.34,0.58,0.49) if model else (0.40,0.38,0.60,0.55)
def sample_patch(p,photo):
 w,h=photo.size
 corner=[photo.getpixel((x,y)) for x,y in [(4,4),(w-5,4),(4,h-5),(w-5,h-5)]]
 bg=tuple(sum(v[i] for v in corner)/len(corner) for i in range(3))
 if p['patterned'] and p['category']!='shoe':
  box=crop_box(p)
  patch=photo.crop(tuple(round(v*(w if i%2==0 else h)) for i,v in enumerate(box)))
 else:
  if p['category']=='bottom':xs=[.40,.44,.48,.52,.56,.60];ys=[.53,.61,.69,.77]
  elif p['category']=='shoe':xs=[.34,.43,.52,.61];ys=[.72,.78] if p['image'].endswith('_5.jpg') else [.40,.48,.56]
  else:xs=[.44,.48,.52,.56];ys=[.30,.35,.40,.45]
  candidates=[]
  for x in xs:
   for y in ys:
    pw=.055;ph=.075
    patch=photo.crop((round((x-pw/2)*w),round((y-ph/2)*h),round((x+pw/2)*w),round((y+ph/2)*h)))
    pix=list(patch.getdata())
    background=sum(sum((v[i]-bg[i])**2 for i in range(3))<22**2 for v in pix)/len(pix)
    skin=sum(v[0]>160 and v[0]>v[1]*1.17 and v[1]>v[2]*1.1 for v in pix)/len(pix)
    variance=sum(ImageStat.Stat(patch).stddev)/3
    position=abs(x-(.45 if p['category']=='bottom' else .50))*9
    score=background*120+skin*70+variance*.55+position
    candidates.append((score,patch))
  patch=min(candidates,key=lambda x:x[0])[1]
 patch=patch.resize((24,32),Image.Resampling.LANCZOS)
 # Mirror the sample at each edge so repeating it never creates hard crop seams.
 tile=Image.new('RGB',(48,64));tile.paste(patch,(0,0));tile.paste(ImageOps.mirror(patch),(24,0));tile.paste(ImageOps.flip(patch),(0,32));tile.paste(ImageOps.flip(ImageOps.mirror(patch)),(24,32))
 return tile.filter(ImageFilter.GaussianBlur(.35))
def fetch(p):
 old=existing.get(p['id'])
 if old and old.get('texture') and old.get('sourceImage') in p.get('sourceImages',[p.get('image')]):return p['id'],old
 try:
  if not p.get('image','').startswith(('https://img-lcwaikiki.mncdn.com/','https://cdn.mavi.com/')):raise ValueError('unsupported image source')
  req=urllib.request.Request(p['image'],headers={'User-Agent':'Mozilla/5.0'})
  data=urllib.request.urlopen(req,timeout=18).read()
  photo=Image.open(io.BytesIO(data)).convert('RGB');box=crop_box(p)
  patch=sample_patch(p,photo)
  pixels=list(patch.getdata())
  # Trim the brightest/darkest values for a stable representative fabric color.
  pixels=sorted(pixels,key=lambda v:sum(v));mid=pixels[len(pixels)//5:len(pixels)*4//5]
  rgb=tuple(round(sum(v[i] for v in mid)/len(mid)) for i in range(3))
  color='#'+''.join(format(v,'02x') for v in rgb)
  b=io.BytesIO();patch.save(b,format='JPEG',quality=86,optimize=True)
  return p['id'],{'color':color,'texture':'data:image/jpeg;base64,'+base64.b64encode(b.getvalue()).decode(),'sourceImage':p['image'],'crop':box,'method':'clean_photo_swatch'}
 except Exception as e:return p['id'],{'color':palette.get(p.get('family'),'#797c7c'),'texture':None,'method':'catalog_color_fallback','reason':str(e)}
results=dict(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(fetch,catalog['products']))
manifest={'version':1,'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Deterministic photo crops; no AI, no virtual fit estimation. Crops reproduce a fabric sample, not an exact garment render.','products':results}
(out/'textures.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
if emit_log:print('TEXTURES_RESULT '+json.dumps(manifest,ensure_ascii=False,separators=(',',':')),flush=True)
print('TEXTURE_COVERAGE '+str(sum(bool(p['texture']) for p in results.values()))+'/'+str(len(results)),flush=True)
subprocess.run(['node','scripts/kendince/render-mannequin-review.mjs'],check=True,cwd=root)
svgs=sorted(out.glob('look-*.svg'))
sheet=Image.new('RGB',(len(svgs)*320,680),'#efede5');draw=ImageDraw.Draw(sheet)
for i,path in enumerate(svgs):
 img=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=path.read_bytes(),output_width=320,output_height=620))).convert('RGBA')
 sheet.paste(img,(i*320,35),img)
 draw.text((i*320+14,12),path.stem,fill='#424f3e')
b=io.BytesIO();sheet.save(b,format='JPEG',quality=90)
(out/'review.jpg').write_bytes(b.getvalue())
if emit_log:print('MANNEQUIN_REVIEW '+base64.b64encode(b.getvalue()).decode(),flush=True)
print('Review image:',out/'review.jpg',flush=True)
