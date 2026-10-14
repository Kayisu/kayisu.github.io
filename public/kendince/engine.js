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
export function cost(o,state){return round(o.items.reduce((n,p)=>n+(state.owned.includes(p.id)||p.custom?0:Number(state.priceNotes?.[p.id]?.at(-1)?.price ?? p.price)),0));}
export function fullCost(o,state){return round(o.items.reduce((n,p)=>n+Number(state.priceNotes?.[p.id]?.at(-1)?.price ?? p.price),0));}
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
 const accents=items.filter(p=>['red','purple','yellow'].includes(p.family));if(accents.length>1&&new Set(accents.map(x=>x.family)).size>1)return false;
 const patterns=items.filter(p=>p.patterned);if(patterns.length>1)return false;
 const clothing=items.filter(p=>p.category!=='shoe');if(clothing.every(p=>p.family==='cream'))return false;
 return true;
}
export function generate(catalog,state,filters){
 const products=[...catalog,...state.custom];
 const pool=cat=>products.filter(p=>p.category===cat&&!state.hidden.includes(p.id)&&(!filters.brand||p.brand===filters.brand||p.custom)&&!(p.sizes?.length&&!p.sizes.some(s=>s.available))&&(!state.profile.size||!['top','layer'].includes(cat)||!p.sizes?.length||p.sizes.some(s=>s.size===state.profile.size&&s.available)));
 const tops=pool('top'),bottoms=pool('bottom'),shoes=pool('shoe'),layers=pool('layer');
 const styles=filters.style==='all'?Object.keys(STYLE):[filters.style];
 const pref=preferences(state), rated=Object.values(state.feedback).length>0;
 const candidates=[];let cheapest=Infinity;
 for(const top of tops)for(const bottom of bottoms)for(const shoe of shoes){
   const ls=filters.weather==='cool'?layers:[null,...layers];
   for(const layer of ls){
    const items=[top,...(layer?[layer]:[]),bottom,shoe];if(!compatible(items))continue;
    const o={items};const spend=cost(o,state);cheapest=Math.min(cheapest,spend);if(spend>filters.budget)continue;
    const fp=fingerprint(o);if(state.feedback[fp]?.value<0)continue;
    for(const style of styles){
      const t=STYLE[style],cloth=items.filter(p=>p.category!=='shoe');let score=0;
      score+=cloth.filter(p=>t.colors.includes(p.family)).length*12;
      score+=cloth.filter(p=>p.fit===t.fit).length*7;
      score-=cloth.reduce((s,p)=>s+Math.abs(t.formality-p.formality)*4,0);
      if(style==='smart'&&!layer)score-=25;
      if(style==='earth'&&!cloth.some(p=>['brown','olive'].includes(p.family)))score-=28;
      if(style==='bold'&&!cloth.some(p=>p.patterned||['red','purple','yellow'].includes(p.family)))score-=38;
      if(style==='clean'&&cloth.some(p=>p.patterned))score-=15;
      if(style==='street'&&bottom.fit!=='wide')score-=22;
      if(filters.occasion==='office'){score+=style==='smart'?18:0;score-=cloth.filter(p=>p.patterned).length*5;}
      if(filters.occasion==='day'){score+=style==='clean'?9:style==='street'?7:style==='smart'?-5:0;}
      if(filters.occasion==='night'){score+=style==='bold'||style==='smart'?14:0;}
      if(filters.occasion==='weekend'){score+=style==='street'||style==='earth'?12:0;}
      if(filters.weather==='cool'&&layer?.warmth===2)score+=9;
      if(filters.weather==='mild'&&layer)score-=8;
      if(state.profile.fit!=='any')score+=cloth.filter(p=>p.fit===state.profile.fit).length*7;
      const f=features(o);let taste=0;for(const [k] of AXES)taste+=(pref[k]-50)*(f[k]-50)/500;
      if(rated)score+=taste*(1-filters.explore/100);
      score+=(style==='bold'?filters.explore*0.22:0)+hash(fp+style+state.seed)*18;
      score+=Math.min(6,state.owned.filter(id=>items.some(p=>p.id===id)).length*3);
      candidates.push({...o,style,id:fp+'::'+style,fp,score,features:f,spend});
    }
   }
 }
 candidates.sort((a,b)=>b.score-a.score);const selected=[];
 while(selected.length<3&&candidates.length){
  const best=candidates.reduce((a,b)=>{
   const rank=x=>x.score-selected.reduce((v,s)=>v+(s.style===x.style?30:0)+(s.items[0].id===x.items[0].id?22:0)+(s.items.find(p=>p.category==='bottom').id===x.items.find(p=>p.category==='bottom').id?12:0),0);
   return rank(b)>rank(a)?b:a;
  });selected.push(best);
  for(let i=candidates.length-1;i>=0;i--)if(candidates[i].fp===best.fp)candidates.splice(i,1);
 }
 return {outfits:selected,cheapest:Number.isFinite(cheapest)?round(cheapest):null};
}
export function alternatives(product,outfit,catalog,state,budget){
 return [...catalog,...state.custom].filter(p=>p.category===product.category&&p.id!==product.id&&!state.hidden.includes(p.id)).map(p=>{
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
