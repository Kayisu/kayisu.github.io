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
 const p=o.items.filter(x=>x.category!=='shoe'),n=p.length;
 return {minimal:100*(1-p.filter(x=>x.patterned).length/n),relaxed:100*p.filter(x=>x.fit==='wide').length/n,earthy:100*p.filter(x=>['brown','olive','cream'].includes(x.family)).length/n,smart:50*p.reduce((a,x)=>a+x.formality,0)/n,bold:Math.min(100,100*p.filter(x=>x.patterned||['red','purple','yellow'].includes(x.family)).length/n)};
}
export function preferences(state){
 const out=Object.fromEntries(AXES.map(([k])=>[k,50])); const votes=Object.values(state.feedback);
 for(const [key] of AXES){let sum=0,weight=0;for(const v of votes){let w=v.reason==='fit'?(key==='relaxed'?1:0):v.reason==='color'?(['earthy','bold'].includes(key)?1:0):v.reason==='pattern'?(key==='minimal'||key==='bold'?1:0):1;sum+=(v.features[key]-50)*v.value*w;weight+=w;} out[key]=weight?Math.round(Math.max(5,Math.min(95,50+sum/Math.max(2,weight)))):50;}
 return out;
}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
export function compatible(items){
 const top=items.find(p=>p.category==='top'),layer=items.find(p=>p.category==='layer');if(top?.kind==='sweat'&&layer?.kind==='shirt'&&layer.warmth<2)return false;
 const accents=items.filter(p=>['red','purple','yellow'].includes(p.family));if(accents.length>1&&new Set(accents.map(x=>x.family)).size>1)return false;
 const patterns=items.filter(p=>p.patterned);if(patterns.length>1)return false;
 const clothing=items.filter(p=>p.category!=='shoe');if(clothing.every(p=>p.family==='cream'))return false;
 return true;
}
export function generate(catalog,state,filters){
 const all=[...catalog,...state.custom].filter(p=>!state.hidden.includes(p.id)&&canUse(p,state,filters));
 const pools=Object.fromEntries(['top','bottom','shoe','layer'].map(cat=>[cat,all.filter(p=>p.category===cat)])),amount=p=>state.owned.includes(p.id)||p.custom?0:unitPrice(p,state),min=p=>p.length?Math.min(...p.map(amount)):Infinity;
 const cheapest=min(pools.top)+min(pools.bottom)+min(pools.shoe)+(filters.weather==='cool'?min(pools.layer):0),pref=preferences(state),rated=Object.keys(state.feedback).length>0,candidates=[];
 for(const style of filters.style==='all'?Object.keys(STYLE):[filters.style]){
  const t=STYLE[style];if(!t)continue;
  function ps(p){let s=(t.colors.includes(p.family)?12:0)+(p.fit===t.fit?7:0)-Math.abs(p.formality-t.formality)*4;if(state.profile.fit!=='any'&&p.fit===state.profile.fit)s+=7;if(style==='clean'&&p.patterned)s-=15;if(style==='bold'&&(p.patterned||['red','purple','yellow'].includes(p.family)))s+=16+filters.explore*.15;if(style==='earth'&&['brown','olive'].includes(p.family))s+=15;if(style==='street'&&p.category==='bottom'&&p.fit==='wide')s+=16;if(p.custom||state.owned.includes(p.id))s+=8;if(filters.weather==='mild'&&p.kind==='jacket')s-=20;return s+hash(p.id+style+state.seed)*15;}
  function shortlist(cat){const sorted=pools[cat].filter(p=>amount(p)<=filters.budget).sort((a,b)=>ps(b)-ps(a)),cheap=sorted.slice().sort((a,b)=>amount(a)-amount(b)).slice(0,2);return [...new Map([...sorted.slice(0,7),...cheap].map(p=>[p.id,p])).values()];}
  const tops=shortlist('top'),bottoms=shortlist('bottom'),shoes=shortlist('shoe'),layers=shortlist('layer').slice(0,6);
  for(const top of tops)for(const bottom of bottoms)for(const shoe of shoes){
   if(!compatible([top,bottom,shoe])||cost({items:[top,bottom,shoe]},state)>filters.budget)continue;
   for(const layer of filters.weather==='cool'?layers:[null,...layers]){
    if(top.kind==='sweat'&&layer?.kind==='shirt'&&layer.warmth<2)continue;
    const items=[top,...(layer?[layer]:[]),bottom,shoe];if(!compatible(items))continue;
    const spend=cost({items},state);if(spend>filters.budget)continue;
    const fp=fingerprint({items});if(state.feedback[fp]?.value<0)continue;
    const cloth=items.filter(p=>p.category!=='shoe');let score=items.reduce((n,p)=>n+ps(p),0);
    if(style==='smart'&&!layer)score-=18;
    if(style==='earth'&&!cloth.some(p=>['brown','olive'].includes(p.family)))score-=25;
    if(style==='bold'&&!cloth.some(p=>p.patterned||['red','purple','yellow'].includes(p.family)))score-=35;
    if(style==='street'&&bottom.fit!=='wide')score-=20;
    if(filters.occasion==='office')score+=(style==='smart'?18:0)-cloth.filter(p=>p.patterned).length*5;
    if(filters.occasion==='day')score+=style==='clean'?9:style==='street'?7:style==='smart'?-5:0;
    if(filters.occasion==='night')score+=style==='bold'||style==='smart'?14:0;
    if(filters.occasion==='weekend')score+=style==='street'||style==='earth'?12:0;
    if(filters.weather==='mild'&&layer)score-=28;
    if(filters.weather==='cool'&&layer?.warmth===2)score+=9;
    const f=features({items});let taste=0;for(const [k] of AXES)taste+=(pref[k]-50)*(f[k]-50)/500;if(rated)score+=taste*(1-filters.explore/100);
    score+=(style==='bold'?filters.explore*.18:0)+hash(fp+style+state.seed)*12;
    candidates.push({items,style,id:fp+'::'+style,fp,score,features:f,spend});
   }
  }
 }
 candidates.sort((a,b)=>b.score-a.score);const selected=[];
 while(selected.length<3&&candidates.length){const rank=x=>x.score-selected.reduce((v,s)=>v+(s.style===x.style&&filters.style==='all'?90:0)+(s.items[0].id===x.items[0].id?25:0)+(s.items.find(p=>p.category==='bottom').id===x.items.find(p=>p.category==='bottom').id?14:0),0),best=candidates.reduce((a,b)=>rank(b)>rank(a)?b:a);selected.push(best);for(let i=candidates.length-1;i>=0;i--)if(candidates[i].fp===best.fp)candidates.splice(i,1);}
 return{outfits:selected,cheapest:Number.isFinite(cheapest)?round(cheapest):null,eligible:all.length,missing:['top','bottom','shoe',...(filters.weather==='cool'?['layer']:[])].filter(c=>!pools[c].length)};
}
export function alternatives(product,outfit,catalog,state,budget){
 return [...catalog,...state.custom].filter(p=>p.category===product.category&&p.id!==product.id&&!state.hidden.includes(p.id)&&canUse(p,state,{availableOnly:state.filters?.availableOnly})).map(p=>{
  const updated={...outfit,items:outfit.items.map(x=>x.id===product.id?p:x)};
  return{product:p,outfit:updated,cost:cost(updated,state),delta:round(cost(outfit,state)-cost(updated,state)),compatible:compatible(updated.items)};
 }).filter(a=>a.compatible&&a.cost<=budget).sort((a,b)=>((b.product.family===product.family?5:0)+(b.product.fit===product.fit?3:0))-((a.product.family===product.family?5:0)+(a.product.fit===product.fit?3:0))||a.cost-b.cost);
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

export const KIND_LABELS={tee:'Tişört',polo:'Polo',knit:'Triko / kazak',sweat:'Sweatshirt',shirt:'Gömlek',jacket:'Ceket / mont',cardigan:'Hırka',jean:'Jean',chino:'Chino / kumaş',cargo:'Kargo',jogger:'Jogger',sneaker:'Sneaker',boot:'Bot',loafer:'Loafer'};
export function stockInfo(p){const status=p.custom?'owned':p.stock?.status||'unknown',available=(p.sizes||[]).filter(v=>v.available);return{status,label:status==='owned'?'Gardırobumda':status==='out_of_stock'?'Tükendi':status==='available'?(available.length<=2?'Sınırlı beden':'Stok görüldü'):'Stok doğrulanamadı',sizes:available.map(v=>v.size),checkedAt:p.stock?.checkedAt||p.verifiedAt||null};}
function sizeKey(s){return String(s??'').trim().toUpperCase().replace(/^W/,'').replace(/\s+/g,'').replace(/^2XL$/,'XXL').replace(/^3XL$/,'XXXL').replace(/^4XL$/,'XXXXL');}
export function wantedSize(p,profile){return p.category==='shoe'?profile.shoe:p.category==='bottom'?profile.bottomSize:profile.size;}
export function sizeMatches(p,profile){const w=sizeKey(wantedSize(p,profile));if(!w||p.custom||!p.sizes?.length)return true;return p.sizes.some(v=>(stockInfo(p).status==='unknown'||v.available)&&(sizeKey(v.size)===w||p.category==='bottom'&&sizeKey(v.size).split(/[\/-]/)[0]===w));}
export function unitPrice(p,state){if(p.custom)return 0;const manual=state.priceNotes?.[p.id]?.at(-1);if(manual)return Number(manual.price);const w=sizeKey(wantedSize(p,state.profile||{})),vs=(p.sizes||[]).filter(v=>v.available&&Number.isFinite(v.price)&&(!w||sizeKey(v.size)===w||p.category==='bottom'&&sizeKey(v.size).split(/[\/-]/)[0]===w));return vs.length?Math.max(...vs.map(v=>v.price)):Number(p.price);}
export function canUse(p,state,filters){if(p.custom||state.owned.includes(p.id))return true;if(stockInfo(p).status==='out_of_stock')return false;if(filters.availableOnly!==false&&(stockInfo(p).status!=='available'||p.priceStatus!=='verified'))return false;return sizeMatches(p,state.profile);}
export function priceBand(p,catalog,state){if(p.custom)return null;const base={...state,priceNotes:{}},peers=catalog.filter(q=>q.category===p.category&&q.kind===p.kind&&q.priceStatus==='verified'&&stockInfo(q).status==='available'&&sizeMatches(q,state.profile));if(peers.length<4)return null;const ps=peers.map(q=>unitPrice(q,base)).sort((a,b)=>a-b),q=t=>{const i=(ps.length-1)*t,a=Math.floor(i),b=Math.ceil(i);return ps[a]+(ps[b]-ps[a])*(i-a);},median=q(.5),value=unitPrice(p,state),position=value<=q(.25)?'low':value>=q(.75)?'high':'mid';return{count:peers.length,min:ps[0],max:ps.at(-1),median:round(median),value,position,difference:Math.round((value-median)/median*100),label:position==='low'?'Alt fiyat bandı':position==='high'?'Üst fiyat bandı':'Orta fiyat bandı',kind:KIND_LABELS[p.kind]||p.kind};}
export function sourcePriceChange(p){const h=p.priceHistory||[];if(h.length<2)return null;const a=h.at(-2).price,b=h.at(-1).price;return{previous:a,current:b,delta:round(b-a),percent:a?Math.round((b-a)/a*100):0};}
