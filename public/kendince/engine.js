import {modelKey,slotOf,garmentFacts,SEASONS,seasonForMonth,effectiveClimate,structureKey,seasonCompatibility} from './wardrobe-rules.js?v=4';
export {modelKey,slotOf,garmentFacts,SEASONS,seasonForMonth,effectiveClimate,structureKey,seasonCompatibility};
export const STYLE = {
 clean:{name:'Sade, ama sıradan değil',short:'Sade casual',subtitle:'Az parça. Temiz bir denge.',colors:['cream','navy','gray','black'],fit:'regular',formality:1},
 earth:{name:'Biraz toprak, biraz şehir',short:'Toprak tonları',subtitle:'Sıcak tonlar, rahat bir silüet.',colors:['brown','olive','cream'],fit:'regular',formality:1},
 street:{name:'Rahatına bak',short:'Rahat sokak',subtitle:'Bol kesimler, hareket alanı.',colors:['gray','navy','cream','black','blue'],fit:'wide',formality:0},
 smart:{name:'Günün devamı var',short:'Smart casual',subtitle:'Ofisten akşama kolayca.',colors:['navy','cream','brown','black','gray'],fit:'regular',formality:2},
 bold:{name:'Bir küçük ters köşe',short:'Biraz farklı',subtitle:'Tek bir vurgu yeter.',colors:['red','purple','olive','cream','black'],fit:'wide',formality:0}
};
export const AXES=[['minimal','Sade'],['relaxed','Rahat kesim'],['earthy','Toprak tonları'],['smart','Özenli'],['bold','Deneysel']];
export const round = x=>Math.round(x*100)/100;
export function fingerprint(o){return o.items.map(p=>p.id).sort().join('|');}
export function cost(o,state){return round(o.items.reduce((n,p)=>n+(state.owned.includes(p.id)||p.custom?0:unitPrice(p,state)),0));}
export function fullCost(o,state){return round(o.items.reduce((n,p)=>n+unitPrice(p,state),0));}
export function features(o){
 const p=o.items.filter(x=>slotOf(x)!=='shoe'),n=p.length||1;
 return {minimal:100*(1-p.filter(x=>x.patterned).length/n),relaxed:100*p.filter(x=>x.fit==='wide').length/n,earthy:100*p.filter(x=>['brown','olive','cream'].includes(x.family)).length/n,smart:50*p.reduce((a,x)=>a+(Number(x.formality)||0),0)/n,bold:Math.min(100,100*p.filter(x=>x.patterned||['red','purple','yellow'].includes(x.family)).length/n)};
}
export function preferences(state){
 const out=Object.fromEntries(AXES.map(([k])=>[k,50])); const votes=Object.values(state.feedback);
 for(const [key] of AXES){let sum=0,weight=0;for(const v of votes){let w=v.reason==='fit'?(key==='relaxed'?1:0):v.reason==='color'?(['earthy','bold'].includes(key)?1:0):v.reason==='pattern'?(key==='minimal'||key==='bold'?1:0):1;sum+=(v.features[key]-50)*v.value*w;weight+=w;} out[key]=weight?Math.round(Math.max(5,Math.min(95,50+sum/Math.max(2,weight)))):50;}
 return out;
}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
export function compatible(items){
 const seen=new Set();for(const p of items){const role=slotOf(p);if(seen.has(role)||!garmentFacts(p).roles.includes(role))return false;seen.add(role);}
 const top=items.find(p=>slotOf(p)==='top'),layer=items.find(p=>slotOf(p)==='layer');
 if(top&&layer&&garmentFacts(top).warmth>=2&&garmentFacts(layer).kind==='shirt')return false;
 const accents=items.filter(p=>['red','purple','yellow'].includes(p.family));if(accents.length>1&&new Set(accents.map(x=>x.family)).size>1)return false;
 if(items.filter(p=>p.patterned).length>1)return false;
 const clothing=items.filter(p=>slotOf(p)!=='shoe');if(clothing.length&&clothing.every(p=>p.family==='cream'))return false;
 return new Set(items.map(modelKey)).size===items.length;
}
const TEMPLATES=[
 {key:'single',label:'Tek üst · sade silüet',slots:['top','bottom','shoe']},
 {key:'open-shirt',label:'Açık gömlek · hafif katman',slots:['top','layer','bottom','shoe'],top:f=>['tee','longtee','polo'].includes(f.kind),layer:f=>f.kind==='shirt'},
 {key:'overshirt',label:'Overshirt · rahat katman',slots:['top','layer','bottom','shoe'],top:f=>['tee','longtee','polo','knit','turtleneck'].includes(f.kind),layer:f=>f.kind==='overshirt'},
 {key:'cardigan',label:'Hırka · yumuşak katman',slots:['top','layer','bottom','shoe'],top:f=>['tee','longtee','polo','shirt','turtleneck'].includes(f.kind),layer:f=>f.kind==='cardigan'},
 {key:'blazer',label:'Blazer · özenli katman',slots:['top','layer','bottom','shoe'],top:f=>['tee','longtee','shirt','knit','turtleneck'].includes(f.kind),layer:f=>f.kind==='blazer'},
 {key:'outer',label:'Dış giyim · sıcak üst',slots:['top','outer','bottom','shoe']},
 {key:'three-layer',label:'Üç katman · üst, ara kat ve dış giyim',slots:['top','layer','outer','bottom','shoe'],top:f=>['tee','longtee','polo','shirt','turtleneck'].includes(f.kind),layer:f=>f.warmth>=2}
];
const modelSet=o=>o.items.map(modelKey).sort().join('|');
// The outermost visible garment defines the first impression of a look.
const dominant=o=>o.items.find(p=>slotOf(p)==='outer')||o.items.find(p=>slotOf(p)==='layer')||o.items.find(p=>slotOf(p)==='top');
const dominantFamily=o=>{const p=dominant(o),kind=garmentFacts(p).kind;return kind==='shirt'&&slotOf(p)==='top'?'closed-shirt':kind;};
function climateAllows(p,role,weather){
 const f=garmentFacts(p);
 if(weather==='cold')return role==='outer'?f.insulated:role==='shoe'?!f.mesh&&f.kind!=='loafer':role==='bottom'?f.kind!=='shorts'&&!f.breathable:true;
 if(weather==='cool'&&role==='bottom')return f.kind!=='shorts';
 if(weather==='warm')return role==='outer'?false:role==='top'||role==='layer'||role==='bottom'?f.warmth<2:role==='shoe'?f.kind!=='boot':true;
 return true;
}
function partialCompatible(items){
 if(items.filter(p=>p.patterned).length>1)return false;
 const accents=items.filter(p=>['red','purple','yellow'].includes(p.family));return new Set(accents.map(p=>p.family)).size<=1;
}
function applicableTemplates(weather){return TEMPLATES.filter(t=>weather==='cold'?t.slots.includes('outer'):weather==='cool'?t.slots.includes('layer')||t.slots.includes('outer'):weather==='warm'?!t.slots.includes('outer'):true);}
function templateAllows(p,role,template,weather){const f=garmentFacts(p);return(!template[role]||template[role](f))&&(weather!=='cold'||role!=='top'||template.slots.includes('layer')||f.warmth>=2&&f.sleeve==='long');}
function matchesTemplate(o,template){return !template||template.slots.every(role=>{const p=o.items.find(p=>slotOf(p)===role);return p&&(!template[role]||template[role](garmentFacts(p)));})&&o.items.length===template.slots.length;}
function productScore(p,style,state,filters){
 const t=STYLE[style],f=garmentFacts(p);let score=(t.colors.includes(p.family)?12:0)+(p.fit===t.fit?7:0)-Math.abs((p.formality||0)-t.formality)*4;
 if(state.profile.fit!=='any'&&p.fit===state.profile.fit)score+=7;
 if(style==='clean'&&p.patterned)score-=15;
 if(style==='bold'&&(p.patterned||['red','purple','yellow'].includes(p.family)))score+=16+filters.explore*.15;
 if(style==='earth'&&['brown','olive'].includes(p.family))score+=15;
 if(style==='street'&&slotOf(p)==='bottom'&&p.fit==='wide')score+=16;
 if(p.custom||state.owned.includes(p.id))score+=8;
 if(filters.weather==='mild'&&f.insulated)score-=20;
 return score+hash(p.id+style+state.seed)*18;
}
// One representative per true model first; then reserve room for different cuts/kinds.
function shortlist(pool,style,state,filters,limit){
 const amount=p=>state.owned.includes(p.id)||p.custom?0:unitPrice(p,state),score=p=>productScore(p,style,state,filters),models=new Map();
 for(const p of pool.filter(p=>amount(p)<=filters.budget).sort((a,b)=>score(b)-score(a)))if(!models.has(modelKey(p)))models.set(modelKey(p),p);
 const sorted=[...models.values()],chosen=[],signatures=new Set();
 for(const p of sorted){const sig=garmentFacts(p).kind+':'+p.fit;if(!signatures.has(sig)){chosen.push(p);signatures.add(sig);}if(chosen.length>=limit-1)break;}
 const cheapest=sorted.slice().sort((a,b)=>amount(a)-amount(b))[0];if(cheapest&&!chosen.includes(cheapest))chosen.push(cheapest);
 for(const p of sorted){if(chosen.length>=limit)break;if(!chosen.includes(p))chosen.push(p);}
 return chosen;
}
export function generate(catalog,state,filters={}){
 filters={budget:3500,style:'all',occasion:'day',explore:35,availableOnly:true,...filters,...effectiveClimate(filters)};
 const all=[...catalog,...state.custom].filter(p=>!state.hidden.includes(p.id)&&canUse(p,state,filters)),facts=new Map(all.map(p=>[p.id,garmentFacts(p)]));
 const roles=['top','layer','outer','bottom','shoe'],pools=Object.fromEntries(roles.map(role=>[role,all.filter(p=>facts.get(p.id).roles.includes(role)&&climateAllows(p,role,filters.weather)).map(p=>({...p,slot:role}))]));
 const pref=preferences(state),rated=Object.keys(state.feedback).length>0,candidates=new Map(),byId=new Map([...catalog,...state.custom].map(p=>[p.id,p])),rejectedModels=new Set();
 for(const [fp,v] of Object.entries(state.feedback))if(v.value<0){const items=fp.split('|').map(id=>byId.get(id)).filter(Boolean);if(items.length>=3)rejectedModels.add(modelSet({items}));}
 const recent=(state.recentLooks||[]).slice(-12),amount=p=>state.owned.includes(p.id)||p.custom?0:unitPrice(p,state);
 let cheapest=Infinity,seasonalCandidates=0;
 // Find the cheapest valid seasonal arrangement independently of the user's budget.
 // Branch-and-bound uses actual available variant prices and owned items cost zero.
 for(const template of applicableTemplates(filters.weather)){
  const choices=template.slots.map(role=>pools[role].filter(p=>templateAllows(p,role,template,filters.weather)).sort((a,b)=>amount(a)-amount(b)));
  if(choices.some(list=>!list.length))continue;
  const lower=new Array(choices.length+1).fill(0);for(let i=choices.length-1;i>=0;i--)lower[i]=lower[i+1]+amount(choices[i][0]);
  const minimum=(index,items,spend)=>{
   if(spend+lower[index]>=cheapest)return;
   if(index===choices.length){if(compatible(items)&&seasonCompatibility({items},filters).ok)cheapest=spend;return;}
   for(const p of choices[index]){const next=spend+amount(p);if(next+lower[index+1]>=cheapest)break;if(items.some(q=>modelKey(q)===modelKey(p)))continue;const nextItems=[...items,p];if(partialCompatible(nextItems))minimum(index+1,nextItems,next);}
  };minimum(0,[],0);
 }
 for(const style of filters.style==='all'?Object.keys(STYLE):[filters.style]){
  if(!STYLE[style])continue;
  for(const template of applicableTemplates(filters.weather)){
   const options=template.slots.map(role=>shortlist(pools[role].filter(p=>templateAllows(p,role,template,filters.weather)),style,state,filters,{top:7,layer:5,outer:5,bottom:6,shoe:5}[role]));
   if(options.some(p=>!p.length))continue;
   // Prune partial budgets before expanding a slot; no unbounded cross-product of the catalog.
   const visit=(index,items,spend)=>{
    if(index<options.length){for(const p of options[index]){const next=spend+amount(p);if(next>filters.budget)continue;if(items.some(q=>modelKey(q)===modelKey(p)))continue;const nextItems=[...items,p];if(partialCompatible(nextItems))visit(index+1,nextItems,next);}return;}
    if(!compatible(items))return;
    const o={items,style},seasonal=seasonCompatibility(o,filters);if(!seasonal.ok)return;
    seasonalCandidates++;cheapest=Math.min(cheapest,spend);
    const fp=fingerprint(o),models=modelSet(o);if(state.feedback[fp]?.value<0||rejectedModels.has(models))return;
    const structure=structureKey(o),cloth=items.filter(p=>slotOf(p)!=='shoe');let score=items.reduce((n,p)=>n+productScore(p,style,state,filters),0)/items.length*3;
    if(style==='earth'&&!cloth.some(p=>['brown','olive'].includes(p.family)))score-=25;
    if(style==='bold'&&!cloth.some(p=>p.patterned||['red','purple','yellow'].includes(p.family)))score-=35;
    if(style==='street'&&items.find(p=>slotOf(p)==='bottom').fit!=='wide')score-=20;
    if(filters.occasion==='office')score+=(style==='smart'?18:0)-cloth.filter(p=>p.patterned).length*5;
    if(filters.occasion==='day')score+=style==='clean'?9:style==='street'?7:style==='smart'?-5:0;
    if(filters.occasion==='night')score+=style==='bold'||style==='smart'?14:0;
    if(filters.occasion==='weekend')score+=style==='street'||style==='earth'?12:0;
    if(filters.weather==='mild')score-=items.some(p=>slotOf(p)==='outer')?13:items.some(p=>slotOf(p)==='layer')?3:0;
    if(filters.weather==='cool'&&items.length===5)score-=8;
    const featuresValue=features(o);let taste=0;for(const [key]of AXES)taste+=(pref[key]-50)*(featuresValue[key]-50)/500;if(rated)score+=taste*(1-filters.explore/100);
    const upper=modelKey(items.find(p=>slotOf(p)==='top')),anchor=modelKey(dominant(o));
    for(let i=0;i<recent.length;i++){const look=recent[i],weight=(i+1)/recent.length;if(look.structure===structure)score-=weight*12;if(look.models?.includes(upper))score-=weight*10;if(look.models?.includes(anchor))score-=weight*20;if(look.models?.slice().sort().join('|')===models)score-=weight*25;}
    score+=(style==='bold'?filters.explore*.18:0)+hash(fp+style+state.seed)*14;
    const candidate={items,style,id:fp+'::'+style,fp,score,features:featuresValue,spend:round(spend),structure,template:template.key,archetype:template.label,reasons:[filters.weather==='cold'?'Sıcak üst veya ara katman + yalıtımlı dış giyim':filters.weather==='cool'?'Serin hava için katmanlı düzen':filters.weather==='warm'?'Sıcak hava için hafif düzen':'Ilıman hava için dengeli katman',...(items.some(p=>state.owned.includes(p.id)||p.custom)?['Gardırobundaki parça kullanılıyor']:[])]};
    if(!candidates.has(models)||candidates.get(models).score<score)candidates.set(models,candidate);
   };
   visit(0,[],0);
  }
 }
 let remaining=[...candidates.values()].sort((a,b)=>b.score-a.score),selected=[];
 while(selected.length<3&&remaining.length){
  const upper=o=>modelKey(o.items.find(p=>slotOf(p)==='top')),novelStructure=remaining.filter(o=>selected.every(s=>s.structure!==o.structure));if(!novelStructure.length)break;
  // Keep explicit style choices meaningful; diversity is chosen among competitive looks.
  const bestScore=novelStructure[0].score,quality=novelStructure.filter(o=>o.score>=bestScore-(filters.style==='all'?45:24));
  const novelAnchor=quality.filter(o=>selected.every(s=>modelKey(dominant(s))!==modelKey(dominant(o))));let options=novelAnchor.length?novelAnchor:quality;
  const familyFitsStyle=o=>filters.style!=='street'||(dominant(o).formality||0)<2||dominant(o).fit==='wide'||state.owned.includes(dominant(o).id)||dominant(o).custom;
  const novelFamily=options.filter(o=>familyFitsStyle(o)&&selected.every(s=>dominantFamily(s)!==dominantFamily(o)));if(novelFamily.length)options=novelFamily;
  const novelCut=options.filter(o=>selected.every(s=>dominantFamily(s)!==dominantFamily(o)||dominant(s).fit!==dominant(o).fit));if(novelCut.length)options=novelCut;
  // A useful basic may repeat below a genuinely different visible construction.
  const novelUpper=options.filter(o=>selected.every(s=>upper(s)!==upper(o)));if(novelUpper.length)options=novelUpper;
  const rank=o=>o.score-selected.reduce((n,s)=>n+(s.style===o.style&&filters.style==='all'?12:0)+s.items.filter(p=>o.items.some(q=>modelKey(q)===modelKey(p))).length*5,0);
  const best=options.reduce((a,b)=>rank(b)>rank(a)?b:a);selected.push(best);remaining=remaining.filter(o=>modelSet(o)!==modelSet(best));
 }
 const missing=['top','bottom','shoe',...(filters.weather==='cold'?['outer']:[])].filter(role=>!pools[role].length),reasons=[];
 if(filters.weather==='cold'&&!pools.outer.some(p=>facts.get(p.id).insulated))reasons.push('Bu beden ve stokta doğrulanmış yalıtımlı dış giyim yok.');
 if(!selected.length&&!missing.length)reasons.push(seasonalCandidates?'Beğenmediklerin ve model tekrarları sonrası yeni düzen kalmadı.':'Bütçe, beden ve mevsim koşullarını birlikte sağlayan kombin yok.');
 if(selected.length<3&&selected.length)reasons.push('Model ve silüet tekrarlarını yeni kombin saymadan '+selected.length+' farklı düzen bulundu.');
 if(missing.length)reasons.push('Eksik parça türü: '+missing.join(', ')+'.');
 return{outfits:selected,cheapest:Number.isFinite(cheapest)?round(cheapest):null,eligible:all.length,missing,modelCount:new Set(all.map(modelKey)).size,distinctStructures:new Set(selected.map(o=>o.structure)).size,limited:selected.length<3,reasons,season:filters.season,weather:filters.weather};
}
export function alternatives(product,outfit,catalog,state,budget,options={}){
 const filters={...state.filters,...options.filters},role=slotOf(product),sameModel=options.sameModel===true;
 return [...catalog,...state.custom].filter(p=>p.id!==product.id&&!state.hidden.includes(p.id)&&garmentFacts(p).roles.includes(role)&&canUse(p,state,filters)&&(sameModel?modelKey(p)===modelKey(product):modelKey(p)!==modelKey(product))).map(p=>{
  const replacement={...p,slot:role},updated={...outfit,items:outfit.items.map(x=>x.id===product.id?replacement:x)};updated.structure=structureKey(updated);
  return{product:replacement,outfit:updated,cost:cost(updated,state),delta:round(cost(outfit,state)-cost(updated,state)),compatible:compatible(updated.items)&&matchesTemplate(updated,TEMPLATES.find(t=>t.key===outfit.template))&&seasonCompatibility(updated,filters).ok};
 }).filter(a=>a.compatible&&a.cost<=budget&&!(state.feedback[fingerprint(a.outfit)]?.value<0)).sort((a,b)=>((b.product.family===product.family?5:0)+(b.product.fit===product.fit?3:0))-((a.product.family===product.family?5:0)+(a.product.fit===product.fit?3:0))||a.cost-b.cost);
}
export function fitAdvice(profile){
 const tips=[];
 if(profile.height&&profile.weight){const base=profile.height*0.42;const delta=profile.weight-base;
  const range=delta<-9?'S–M':delta<8?'M–L':delta<25?'L–XL':'XL–XXL';
  tips.push('Çok kaba üst beden başlangıcı: '+range+'. Boy ve kilo tek başına beden seçtirmez; göğüs ölçüsü ve markanın tablosuyla doğrula.');
 }
 if(profile.height)tips.push(profile.height<172?'Üst boyu ve paça uzunluğunu ayrıca kontrol et; fazla kumaşın birikmesi kalıbın görünümünü değiştirebilir.':profile.height>185?'Üstün gövde boyunu ve pantolonun iç bacak ölçüsünü kontrol et; aynı beden farklı uzunluklarda olabilir.':'Düz paça ve regular kalıp, farklı silüetleri karşılaştırmak için iyi bir başlangıç olabilir.');
 if(profile.chest)tips.push('Göğüs çevren '+profile.chest+' cm. Ürün tablosunun vücut ölçüsü mü, giysi ölçüsü mü olduğunu kontrol et.');
 if(profile.waist)tips.push('Bel çevren '+profile.waist+' cm; yaklaşık '+Math.round(profile.waist/2.54)+' inç. Marka tablosu ve esneme payıyla doğrula.');
 if(profile.shoe)tips.push('Ayakkabı başlangıç numaran '+profile.shoe+'. Kalıp ve ayak uzunluğu tablosuyla kontrol et.');
 return tips.length?tips:['Boyunu ve ölçülerini ekle; kalıp ve uzunluk için başlangıç noktaları çıkaralım.'];
}

export const KIND_LABELS={tee:'Tişört',longtee:'Uzun kollu tişört',polo:'Polo',knit:'Triko / kazak',sweat:'Sweatshirt',shirt:'Gömlek',jacket:'Ceket / mont',cardigan:'Hırka',turtleneck:'Balıkçı yaka',hoodie:'Kapüşonlu sweatshirt',overshirt:'Overshirt / gömlek ceket',blazer:'Blazer',coat:'Kaban / palto',puffer:'Şişme mont',parka:'Parka',raincoat:'Yağmurluk',corduroy:'Kadife pantolon',derby:'Derby / bağcıklı klasik',shorts:'Şort',jean:'Jean',chino:'Chino / kumaş',cargo:'Kargo',jogger:'Jogger',sneaker:'Sneaker',boot:'Bot',loafer:'Loafer'};
export function stockInfo(p){const status=p.custom?'owned':p.stock?.status||'unknown',available=(p.sizes||[]).filter(v=>v.available);return{status,label:status==='owned'?'Gardırobumda':status==='out_of_stock'?'Tükendi':status==='available'?(available.length<=2?'Sınırlı beden':'Stok görüldü'):'Stok doğrulanamadı',sizes:available.map(v=>v.size),checkedAt:p.stock?.checkedAt||p.verifiedAt||null};}
function sizeKey(s){return String(s??'').trim().toUpperCase().replace(/^W/,'').replace(/\s+/g,'').replace(/^2XL$/,'XXL').replace(/^3XL$/,'XXXL').replace(/^4XL$/,'XXXXL');}
export function wantedSize(p,profile){return p.category==='shoe'?profile.shoe:p.category==='bottom'?profile.bottomSize:profile.size;}
export function sizeMatches(p,profile){const w=sizeKey(wantedSize(p,profile));if(!w||p.custom||!p.sizes?.length)return true;return p.sizes.some(v=>(stockInfo(p).status==='unknown'||v.available)&&(sizeKey(v.size)===w||p.category==='bottom'&&sizeKey(v.size).split(/[\/-]/)[0]===w));}
export function unitPrice(p,state){if(p.custom)return 0;const manual=state.priceNotes?.[p.id]?.at(-1);if(manual)return Number(manual.price);const w=sizeKey(wantedSize(p,state.profile||{})),vs=(p.sizes||[]).filter(v=>v.available&&Number.isFinite(v.price)&&(!w||sizeKey(v.size)===w||p.category==='bottom'&&sizeKey(v.size).split(/[\/-]/)[0]===w));return vs.length?Math.max(...vs.map(v=>v.price)):Number(p.price);}
export function canUse(p,state,filters){if(p.custom||state.owned.includes(p.id))return true;if(stockInfo(p).status==='out_of_stock')return false;if(filters.availableOnly!==false&&(stockInfo(p).status!=='available'||p.priceStatus!=='verified'))return false;return sizeMatches(p,state.profile);}
export function priceBand(p,catalog,state){
 if(p.custom)return null;
 const base={...state,priceNotes:{}},kind=garmentFacts(p).kind,peers=catalog.filter(q=>q.category===p.category&&garmentFacts(q).kind===kind&&q.priceStatus==='verified'&&stockInfo(q).status==='available'&&sizeMatches(q,state.profile)),models=new Map();
 const quantile=(values,t)=>{const i=(values.length-1)*t,a=Math.floor(i),b=Math.ceil(i);return values[a]+(values[b]-values[a])*(i-a);};
 for(const q of peers){const key=modelKey(q);if(!models.has(key))models.set(key,[]);const price=unitPrice(q,base);if(Number.isFinite(price)&&price>0)models.get(key).push(price);}
 const ps=[...models.values()].filter(values=>values.length).map(values=>quantile(values.sort((a,b)=>a-b),.5)).sort((a,b)=>a-b);if(ps.length<4)return null;
 const median=quantile(ps,.5),value=unitPrice(p,state),position=value<=quantile(ps,.25)?'low':value>=quantile(ps,.75)?'high':'mid';
 return{count:ps.length,variantCount:peers.length,min:ps[0],max:ps.at(-1),median:round(median),value,position,difference:Math.round((value-median)/median*100),label:position==='low'?'Alt fiyat bandı':position==='high'?'Üst fiyat bandı':'Orta fiyat bandı',kind:KIND_LABELS[kind]||kind};
}
export function sourcePriceChange(p){const h=p.priceHistory||[];if(h.length<2)return null;const a=h.at(-2).price,b=h.at(-1).price;return{previous:a,current:b,delta:round(b-a),percent:a?Math.round((b-a)/a*100):0};}
