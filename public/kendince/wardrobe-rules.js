// Garment identity and seasonal rules. These describe construction, never local weather.
export const SEASONS={spring:{label:'İlkbahar',weather:'mild'},summer:{label:'Yaz',weather:'warm'},autumn:{label:'Sonbahar',weather:'cool'},winter:{label:'Kış',weather:'cold'}};
export const seasonForMonth=month=>[11,0,1].includes(Number(month))?'winter':[2,3,4].includes(Number(month))?'spring':[5,6,7].includes(Number(month))?'summer':'autumn';
// Manual feels-like temperature takes priority over the calendar and legacy presets.
// These broad clothing heuristics never imply a garment has a tested thermal rating.
export const TEMPERATURE_BANDS=[
 {key:'freezing',label:'Çok soğuk',min:-50,max:4,weather:'freezing'},
 {key:'cold',label:'Soğuk',min:5,max:11,weather:'cold'},
 {key:'cool',label:'Serin',min:12,max:17,weather:'cool'},
 {key:'mild',label:'Ilık',min:18,max:23,weather:'mild'},
 {key:'warm',label:'Sıcak',min:24,max:55,weather:'warm'}
];
function numericTemperature(value){if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=-50&&n<=55?n:null;}
export function temperatureBand(value){const n=numericTemperature(value);return n===null?null:TEMPERATURE_BANDS[n<=4?0:n<12?1:n<18?2:n<24?3:4];}
export function effectiveClimate(filters={}){
 const season=SEASONS[filters.season]?filters.season:seasonForMonth(new Date().getMonth()),temperature=numericTemperature(filters.temperature),band=temperatureBand(temperature);
 return band?{season,weather:band.weather,temperature,temperatureBand:band.key,temperatureLabel:band.label}:{season,weather:['warm','mild','cool','cold','freezing'].includes(filters.weather)?filters.weather:SEASONS[season].weather};
}
export const storeKey=p=>String(p.store||p.retailer||p.brand||'Diğer');
export function climateAdvice(filters={}){
 const c=effectiveClimate(filters);
 if(c.temperature!==undefined&&c.temperature<=-15)return 'Bu derecede termal içlik ve test edilmiş yalıtım bilgisi gerekir; mevcut parça bilgileriyle tam kombin doğrulanamaz.';
 if(c.weather==='freezing')return 'Uzun kollu üst + sıcak ara kat + yalıtımlı dış giyim. 0°C ve altında kalın pantolon ve bot aranır.';
 if(c.weather==='cold')return 'Sıcak uzun kollu üst veya ara kat, yalıtımlı dış giyim ve kapalı ayakkabı.';
 if(c.weather==='cool')return 'Çıkarılabilen bir ara kat veya hafif dış giyim; uzun pantolon.';
 if(c.weather==='mild')return 'Tek üst veya hafif, çıkarılabilir katman; kalın dış giyim elenir.';
 return c.temperature>=30?'Kısa kollu tek üst ve hafif alt; üst üste katman önerilmez.':'Hafif üst ve alt; kalın triko, bot ve dış giyim elenir.';
}
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
 const source=p.sourceFacts||{},fact=(...names)=>normalized(names.map(key=>source[key]).filter(Boolean).join(' ')),thickness=normalized(Object.entries(source).filter(([key])=>/kalinli|thickness/.test(normalized(key))).map(([,value])=>value).join(' ')),sleeveFact=fact('Kol Boyu'),materialFact=fact('Kumaş','Kumas','Ana Kumaş','Ana Kumas');
 const text=normalized([p.name,p.description,p.material,p.kind,source['Ürün Tip'],source['Ürün Tipi'],materialFact].join(' ')),sourceKind=normalized(p.kind),has=re=>re.test(text);
 let kind=sourceKind||'unknown',warmth=1,sleeve='long',roles=[],breathable=false,insulated=false,mesh=false;
 // Specific construction cues refine broad source categories (e.g. "jacket" or "shirt").
 if(p.category==='shoe'||['sneaker','boot','loafer','derby'].includes(sourceKind)){
  const shoeName=normalized(p.name);kind=/\bbot(?:u|lar|lari)?\b|\bboots?\b|postal/.test(shoeName)?'boot':/derby|oxford/.test(shoeName)?'derby':/loafer|mokasen/.test(shoeName)?'loafer':sourceKind||'sneaker';
  mesh=has(/\bmesh\b|fileli|file kumas|orgu sayali|triko sayali|knit upper/);roles=['shoe'];sleeve=null;warmth=kind==='boot'?2:1;breathable=mesh;
 }else if(p.category==='bottom'||['jean','chino','cargo','jogger','corduroy','shorts','technical'].includes(sourceKind)){
  kind=sourceKind==='shorts'||/\bsort\b|\bshorts\b|bermuda/.test(normalized(p.name))?'shorts':has(/kadife|corduroy/)?'corduroy':has(/kargo|cargo/)?'cargo':has(/jogger|esofman alti/)?'jogger':sourceKind||'chino';
  roles=['bottom'];sleeve=null;breathable=has(/keten|linen|ince kumas/);warmth=kind==='shorts'?0:kind==='corduroy'||has(/yunlu|wool|polar|ici tuylu/)?2:1;
 }else{
  const specific=['puffer','parka','coat','raincoat','overshirt','blazer','turtleneck','knit','hoodie','cardigan','vest'];
  if(!specific.includes(sourceKind))kind=has(/sisme|puffer|dolgulu/)?'puffer':has(/parka/)?'parka':has(/kaban|palto|\bcoat\b/)?'coat':has(/yagmurluk|raincoat/)?'raincoat':has(/overshirt|oduncu|gomlek ceket/)?'overshirt':has(/blazer/)?'blazer':p.category==='outer'||sourceKind==='jacket'?'jacket':has(/balikci yaka|bogazli|turtleneck/)?'turtleneck':has(/yelek|suveter|sleeveless sweater|sweater vest/)?'vest':has(/hirka|cardigan/)?'cardigan':has(/fermuarli.*sweat|zip.*hood/)?'cardigan':has(/kapusonlu|hoodie/)?'hoodie':has(/triko|kazak|\bknit\b/)&&!has(/ceket|mont/)?'knit':has(/sweatshirt|\bsweat\b/)?'sweat':has(/tisort|t[ -]?shirt|\btee\b/)?'tee':has(/polo/)?'polo':has(/gomlek|\bshirt\b/)?'shirt':has(/mont|ceket|jacket|bomber/)?'jacket':kind;
  if(['puffer','parka','coat'].includes(kind)){roles=['outer'];warmth=3;insulated=true;}
  else if(kind==='blazer'){roles=['layer','outer'];warmth=2;}
  else if(['raincoat','jacket'].includes(kind)||p.category==='outer'){roles=['outer'];warmth=has(/dolgulu|kapitone|ici polar|yunlu/)?3:2;insulated=warmth>=3;}
  else if(kind==='vest'){roles=['layer'];warmth=2;sleeve=null;}
  else if(['cardigan','overshirt','blazer'].includes(kind)){roles=['layer'];warmth=kind==='overshirt'&&!has(/yun|polar|kadife/)?1:2;}
  else if(['knit','turtleneck','hoodie','sweat'].includes(kind)){roles=['top'];warmth=2;}
  else if(kind==='shirt'){roles=['top','layer'];warmth=1;}
  else if(['tee','polo'].includes(kind)){roles=['top'];sleeve=has(/uzun kol|long sleeve/)?'long':'short';warmth=sleeve==='long'?1:0;}
  else{roles=[p.category==='layer'?'layer':'top'];warmth=Math.max(0,Math.min(2,Number(p.warmth)||1));}
  if(has(/kisa kol|short sleeve/))sleeve='short';
  breathable=has(/keten|linen|ince kumas/);
 }
 // Retailer construction properties beat generic names and inherited legacy warmth.
 if(/ince/.test(thickness)&&/(^|\W)kalin($|\W)/.test(thickness)){if(roles.includes('outer'))warmth=Math.min(warmth,2);insulated=false;}
 else if(/ince/.test(thickness)){warmth=roles.includes('outer')?1:Math.min(warmth,1);insulated=false;}
 else if(/(^|\W)kalin($|\W)/.test(thickness)&&!/orta/.test(thickness)){warmth=roles.includes('outer')?3:Math.max(warmth,2);if(roles.includes('outer')&&kind!=='raincoat')insulated=true;}
 else if(/orta/.test(thickness)&&roles.includes('outer')){warmth=2;insulated=['puffer','parka','coat'].includes(kind);}
 if(/kisa|short/.test(sleeveFact))sleeve='short';else if(/uzun|long/.test(sleeveFact))sleeve='long';else if(/kolsuz|sleeveless/.test(sleeveFact))sleeve=null;
 if(kind==='tee'&&sleeve==='long'){kind='longtee';warmth=Math.max(warmth,1);}
 const insulationEvidence=fact('Isı yalıtımı','Isı Yalıtımı','Isi yalitimi');
 // A waterproof/windproof shell alone supplies no thermal evidence. Explicit
 // fill or a subzero source rating can refine an actual outerwear construction.
 if(roles.includes('outer')&&!/ince/.test(thickness)&&/dolg|elyaf|kaz tuyu|astar.{0,12}polar|[-−]\s*\d+\s*°/.test(insulationEvidence)){warmth=3;insulated=true;}
 if(kind==='blazer'){warmth=2;insulated=false;}
 const seasons=roles[0]==='outer'&&insulated?['autumn','winter']:kind==='shorts'?['spring','summer']:warmth>=2||kind==='boot'?['spring','autumn','winter']:['spring','summer','autumn','winter'];
 // Texture describes visible construction, independent of color and retailer.
 const texture=has(/kadife|corduroy/)?'corduroy':has(/süet|suet|suede/)?'suede':has(/kapitone|quilt|sisme|puffer/)?'quilted':has(/polar|fleece|sherpa/)?'fleece':has(/orgu|triko|kazak|knit|sac orgu/)?'knit':has(/kase|yun|wool|tweed/)?'woolly':has(/denim|\bjean\b/)?'denim':has(/keten|linen/)?'linen':has(/deri|leather/)?'leather':has(/file|mesh/)?'mesh':'plain';
 const materialFamily=has(/keten|linen/)?'linen':has(/yun|wool/)?'wool':has(/deri|leather|suet|suede/)?'leather':has(/pamuk|cotton/)?'cotton':has(/viskoz|viscose|lyocell|tencel/)?'cellulose':has(/poliester|polyester|naylon|nylon|akrilik|acrylic/)?'synthetic':'unknown';
 const result={roles,kind,warmth,sleeve,seasons,breathable,insulated,mesh,texture,materialFamily,insulationEvidence:insulationEvidence||null};factsCache.set(p,result);return result;
}
export function structureKey(o){return ['top','layer','outer','bottom','shoe'].map(slot=>{const p=o.items.find(p=>slotOf(p)===slot);return p?slot+':'+garmentFacts(p).kind+':'+(garmentFacts(p).sleeve||'na')+':'+(p.fit||'regular')+':'+garmentFacts(p).texture:slot+':none';}).join('|');}
export function seasonCompatibility(o,filters={}){
 const climate=effectiveClimate(filters),facts=Object.fromEntries(o.items.map(p=>[slotOf(p),garmentFacts(p)])),reasons=[];
 const top=facts.top,mid=facts.layer,outer=facts.outer,bottom=facts.bottom,shoe=facts.shoe,upperWarmth=(top?.warmth||0)+(mid?.warmth||0)+(outer?.warmth||0),veryCold=climate.weather==='freezing',cold=veryCold||climate.weather==='cold';
 if(!top||!bottom||!shoe)reasons.push('Üst, alt ve ayakkabı gerekli.');
 if(climate.temperature!==undefined&&climate.temperature<=-15)reasons.push('−15°C ve altında termal içlik ve test edilmiş yalıtım verisi olmadan tam kombin doğrulanamaz.');
 if(cold){
  if(!outer?.insulated)reasons.push('Soğuk hava için dolgulu mont, parka veya kaban gerekli.');
  if(!top||!(top.sleeve==='long'&&top.warmth>=2)&&!(mid?.sleeve==='long'&&mid.warmth>=2))reasons.push('Soğuk hava için sıcak tutan uzun kollu üst veya ara katman gerekli.');
  if(shoe?.mesh||shoe?.kind==='loafer')reasons.push('Soğuk hava için fileli olmayan kapalı ayakkabı gerekli.');
  if(bottom?.kind==='shorts'||bottom?.breathable)reasons.push('Soğuk hava için uzun, ince keten olmayan pantolon gerekli.');
  if(veryCold){
   if(!mid||top?.sleeve!=='long'||mid.sleeve!=='long'||mid.warmth<2||upperWarmth<6)reasons.push('Çok soğuk hava için uzun kollu üst, sıcak ara kat ve yalıtımlı dış giyim birlikte gerekli.');
   if(climate.temperature<=0&&(bottom?.warmth<2||shoe?.kind!=='boot'))reasons.push('0°C ve altında kalın pantolon ve bot gerekli.');
  }
 }
 if(climate.weather==='cool'){
  if(!mid&&!outer)reasons.push('Serin hava için ara katman veya dış giyim gerekli.');
  if(top&&upperWarmth<2)reasons.push('Serin hava için daha örtücü bir üst düzeni gerekli.');
  if(bottom?.kind==='shorts')reasons.push('Serin hava için uzun pantolon gerekli.');
  if(climate.temperature!==undefined&&upperWarmth>5)reasons.push('Bu derecede üst katmanlar gereğinden ağır.');
 }
 if(climate.weather==='mild'){
  if(outer?.insulated||upperWarmth>3)reasons.push('Ilık hava için yalıtımlı veya çok ağır üst katman çıkarılmalı.');
 }
 if(climate.weather==='warm'){
  if(outer||mid&&mid.warmth>=2||top?.warmth>=2||upperWarmth>2)reasons.push('Sıcak hava için ağır üst ve dış katman çıkarılmalı.');
  if(bottom?.warmth>=2||shoe?.kind==='boot')reasons.push('Sıcak hava için daha hafif alt ve ayakkabı gerekli.');
  if(climate.temperature>=30&&(mid||top?.sleeve!=='short'))reasons.push('30°C ve üzerinde kısa kollu, tek üst düzeni gerekli.');
 }
 return{...climate,ok:reasons.length===0,reasons,upperWarmth};
}
