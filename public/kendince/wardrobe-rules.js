// Garment identity and seasonal rules. These describe construction, never local weather.
export const SEASONS={spring:{label:'İlkbahar',weather:'mild'},summer:{label:'Yaz',weather:'warm'},autumn:{label:'Sonbahar',weather:'cool'},winter:{label:'Kış',weather:'cold'}};
export const seasonForMonth=month=>[11,0,1].includes(Number(month))?'winter':[2,3,4].includes(Number(month))?'spring':[5,6,7].includes(Number(month))?'summer':'autumn';
export function effectiveClimate(filters={}){const season=SEASONS[filters.season]?filters.season:seasonForMonth(new Date().getMonth());return{season,weather:['warm','mild','cool','cold'].includes(filters.weather)?filters.weather:SEASONS[season].weather};}
const normalized=s=>String(s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const factsCache=new WeakMap();
const identityCache=new WeakMap();
export const slotOf=p=>p.slot||p.category;
export function modelKey(p){
 if(identityCache.has(p))return identityCache.get(p);
 const retailer=normalized(p.retailer||p.brand||'custom');
 const done=key=>{identityCache.set(p,key);return key;};
 if(p.modelId)return done(retailer+':'+String(p.modelId));
 const sku=String(p.sku||'').trim();
 if(/lcw|waikiki/.test(retailer)&&sku)return done(retailer+':'+sku.split('-')[0]);
 if(/mavi/.test(retailer)){const id=sku||String(p.id||'');if(/^\d{5,}-[a-z0-9]+$/i.test(id))return done(retailer+':'+id.split('-')[0]);}
 return done(retailer+':'+(sku||p.id));
}
export function garmentFacts(p){
 // Catalog records are immutable after loading. Cache by object, not ID (role clones are safe).
 if(factsCache.has(p))return factsCache.get(p);
 const source=p.sourceFacts||{},fact=(...names)=>normalized(names.map(key=>source[key]).filter(Boolean).join(' ')),thickness=fact('Kalınlık','Kalinlik'),sleeveFact=fact('Kol Boyu'),materialFact=fact('Kumaş','Kumas','Ana Kumaş','Ana Kumas');
 const text=normalized([p.name,p.description,p.material,p.kind,source['Ürün Tip'],source['Ürün Tipi'],materialFact].join(' ')),sourceKind=normalized(p.kind),has=re=>re.test(text);
 let kind=sourceKind||'unknown',warmth=1,sleeve='long',roles=[],breathable=false,insulated=false,mesh=false;
 // Specific construction cues refine broad source categories (e.g. "jacket" or "shirt").
 if(p.category==='shoe'||['sneaker','boot','loafer','derby'].includes(sourceKind)){
  kind=has(/\bbot\b|\bboot\b|postal/)?'boot':has(/derby|oxford/)?'derby':has(/loafer|mokasen/)?'loafer':sourceKind||'sneaker';
  mesh=has(/\bmesh\b|fileli|file kumas|orgu sayali|triko sayali|knit upper/);roles=['shoe'];sleeve=null;warmth=kind==='boot'?2:1;breathable=mesh;
 }else if(p.category==='bottom'||['jean','chino','cargo','jogger','corduroy','shorts'].includes(sourceKind)){
  kind=has(/kadife|corduroy/)?'corduroy':has(/kargo|cargo/)?'cargo':has(/\bsort\b|shorts|bermuda/)?'shorts':has(/jogger|esofman alti/)?'jogger':sourceKind||'chino';
  roles=['bottom'];sleeve=null;breathable=has(/keten|linen|ince kumas/);warmth=kind==='shorts'?0:kind==='corduroy'||has(/yunlu|wool|polar|ici tuylu/)?2:1;
 }else{
  const specific=['puffer','parka','coat','raincoat','overshirt','blazer','turtleneck','knit','hoodie','cardigan'];
  if(!specific.includes(sourceKind))kind=has(/sisme|puffer|dolgulu/)?'puffer':has(/parka/)?'parka':has(/kaban|palto|\bcoat\b/)?'coat':has(/yagmurluk|raincoat/)?'raincoat':has(/overshirt|oduncu|gomlek ceket/)?'overshirt':has(/blazer/)?'blazer':p.category==='outer'||sourceKind==='jacket'?'jacket':has(/balikci yaka|bogazli|turtleneck/)?'turtleneck':has(/hirka|cardigan/)?'cardigan':has(/fermuarli.*sweat|zip.*hood/)?'cardigan':has(/kapusonlu|hoodie/)?'hoodie':has(/triko|kazak|\bknit\b/)&&!has(/ceket|mont/)?'knit':has(/sweatshirt|\bsweat\b/)?'sweat':has(/gomlek|\bshirt\b/)?'shirt':has(/polo/)?'polo':has(/tisort|t-shirt|\btee\b/)?'tee':has(/mont|ceket|jacket|bomber/)?'jacket':kind;
  if(['puffer','parka','coat'].includes(kind)){roles=['outer'];warmth=3;insulated=true;}
  else if(kind==='blazer'){roles=['layer','outer'];warmth=2;}
  else if(['raincoat','jacket'].includes(kind)||p.category==='outer'){roles=['outer'];warmth=has(/dolgulu|kapitone|ici polar|yunlu|kalin|lined|astarli/)?3:2;insulated=warmth>=3;}
  else if(['cardigan','overshirt','blazer'].includes(kind)){roles=['layer'];warmth=kind==='overshirt'&&!has(/kalin|yun|polar|kadife/)?1:2;}
  else if(['knit','turtleneck','hoodie','sweat'].includes(kind)){roles=['top'];warmth=2;}
  else if(kind==='shirt'){roles=['top','layer'];warmth=1;}
  else if(['tee','polo'].includes(kind)){roles=['top'];sleeve=has(/uzun kol|long sleeve/)?'long':'short';warmth=sleeve==='long'?1:0;}
  else{roles=[p.category==='layer'?'layer':'top'];warmth=Math.max(0,Math.min(2,Number(p.warmth)||1));}
  if(has(/kisa kol|short sleeve/))sleeve='short';
  breathable=has(/keten|linen|ince kumas/);
 }
 // Retailer construction properties beat generic names and inherited legacy warmth.
 if(/ince/.test(thickness)){warmth=roles.includes('outer')?1:Math.min(warmth,1);insulated=false;}
 else if(/kalin/.test(thickness)&&!/orta/.test(thickness)){warmth=roles.includes('outer')?3:Math.max(warmth,2);if(roles.includes('outer')&&kind!=='raincoat')insulated=true;}
 else if(/orta/.test(thickness)&&roles.includes('outer')){warmth=2;insulated=['puffer','parka','coat'].includes(kind);}
 if(/kisa|short/.test(sleeveFact))sleeve='short';else if(/uzun|long/.test(sleeveFact))sleeve='long';else if(/kolsuz|sleeveless/.test(sleeveFact))sleeve=null;
 if(kind==='tee'&&sleeve==='long'){kind='longtee';warmth=Math.max(warmth,1);}
 if(kind==='blazer'){warmth=2;insulated=false;}
 const seasons=roles[0]==='outer'&&insulated?['autumn','winter']:kind==='shorts'?['spring','summer']:warmth>=2||kind==='boot'?['spring','autumn','winter']:['spring','summer','autumn','winter'];
 const result={roles,kind,warmth,sleeve,seasons,breathable,insulated,mesh};factsCache.set(p,result);return result;
}
export function structureKey(o){return ['top','layer','outer','bottom','shoe'].map(slot=>{const p=o.items.find(p=>slotOf(p)===slot);return p?slot+':'+garmentFacts(p).kind+':'+(garmentFacts(p).sleeve||'na')+':'+(p.fit||'regular'):slot+':none';}).join('|');}
export function seasonCompatibility(o,filters={}){
 const climate=effectiveClimate(filters),facts=Object.fromEntries(o.items.map(p=>[slotOf(p),garmentFacts(p)])),reasons=[];
 const top=facts.top,mid=facts.layer,outer=facts.outer,bottom=facts.bottom,shoe=facts.shoe;
 if(!top||!bottom||!shoe)reasons.push('Üst, alt ve ayakkabı gerekli.');
 if(climate.weather==='cold'){
  if(!outer?.insulated)reasons.push('Soğuk hava için dolgulu mont, parka veya kaban gerekli.');
  if(!top||!(top.sleeve==='long'&&top.warmth>=2)&&!(mid?.sleeve==='long'&&mid.warmth>=2))reasons.push('Soğuk hava için sıcak tutan uzun kollu üst veya ara katman gerekli.');
  if(shoe?.mesh||shoe?.kind==='loafer')reasons.push('Soğuk hava için fileli olmayan kapalı ayakkabı gerekli.');
  if(bottom?.kind==='shorts'||bottom?.breathable)reasons.push('Soğuk hava için uzun, ince keten olmayan pantolon gerekli.');
 }
 if(climate.weather==='cool'){
  if(!mid&&!outer)reasons.push('Serin hava için ara katman veya dış giyim gerekli.');
  if(top&&top.warmth+(mid?.warmth||0)+(outer?.warmth||0)<2)reasons.push('Serin hava için daha örtücü bir üst düzeni gerekli.');
  if(bottom?.kind==='shorts')reasons.push('Serin hava için uzun pantolon gerekli.');
 }
 if(climate.weather==='warm'){
  if(outer||mid&&mid.warmth>=2||top?.warmth>=2)reasons.push('Sıcak hava için ağır üst ve dış katman çıkarılmalı.');
  if(bottom?.warmth>=2||shoe?.kind==='boot')reasons.push('Sıcak hava için daha hafif alt ve ayakkabı gerekli.');
 }
 return{...climate,ok:reasons.length===0,reasons};
}
