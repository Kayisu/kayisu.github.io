import assert from 'node:assert/strict';
import {STYLE,TEMPERATURE_BANDS,temperatureBand,effectiveClimate,climateAdvice,garmentFacts,generate,alternatives,cost,fingerprint,modelKey,slotOf,structureKey,seasonCompatibility,styleRecipe,sizeMatches,stockInfo,storeKey} from '../../public/kendince/engine.js';

const product=(id,category,kind,extra={})=>({id,modelId:id,retailer:'A',name:kind,category,kind,price:100,priceStatus:'verified',stock:{status:'available'},sizes:[{size:category==='shoe'?'42':category==='bottom'?'32':'M',available:true,price:100}],family:'navy',fit:'regular',formality:1,patterned:false,...extra});
const state=(filters={})=>({profile:{fit:'any',size:'',shoe:null,bottomSize:''},owned:[],custom:[],hidden:[],feedback:{},priceNotes:{},seed:1,recentLooks:[],filters:{budget:2500,season:'autumn',weather:'auto',temperature:null,style:'all',occasion:'day',explore:50,availableOnly:true,stores:[],...filters}});
const tee=product('tee','top','tee'),longtee=product('long','top','longtee'),knit=product('knit','top','knit',{retailer:'B'}),shirt=product('shirt','top','shirt',{retailer:'C'}),polo=product('polo','top','polo'),hoodie=product('hood','top','hoodie',{fit:'wide'}),fleece=product('fleece','top','sweat',{name:'Polar sweatshirt',retailer:'B'}),cardigan=product('card','layer','cardigan'),overshirt=product('over','layer','overshirt',{name:'Kalın kadife overshirt',retailer:'B',fit:'wide'}),blazer=product('blazer','layer','blazer',{retailer:'C'}),coat=product('coat','outer','coat',{name:'Yün kaban',retailer:'C'}),puffer=product('puff','outer','puffer',{retailer:'B'}),parka=product('parka','outer','parka',{family:'olive'}),shell=product('shell','outer','raincoat',{name:'İnce yağmurluk',sourceFacts:{'Kalınlık':'İnce'}}),jacket=product('jacket','outer','jacket',{name:'Denim ceket',retailer:'C'}),jean=product('jean','bottom','jean'),cargo=product('cargo','bottom','cargo',{family:'olive',fit:'wide',retailer:'B'}),cord=product('cord','bottom','corduroy',{name:'Kadife pantolon',retailer:'C'}),chino=product('chino','bottom','chino'),jogger=product('jogger','bottom','jogger',{fit:'wide'}),shorts=product('shorts','bottom','shorts'),linen=product('linen','bottom','chino',{material:'%100 keten'}),shoe=product('shoe','shoe','sneaker'),boot=product('boot','shoe','boot',{retailer:'B'}),loafer=product('loafer','shoe','loafer',{retailer:'C'}),mesh=product('mesh','shoe','sneaker',{name:'Fileli sneaker'});
const catalog=[tee,longtee,knit,shirt,polo,hoodie,fleece,cardigan,overshirt,blazer,coat,puffer,parka,shell,jacket,jean,cargo,cord,chino,jogger,shorts,linen,shoe,boot,loafer,mesh];
let count=0;const test=(label,fn)=>{fn();count++;console.log('✓',label);};

test('feels-like numeric bands include decimals, zero, negatives and exact boundaries',()=>{
 for(const [n,key] of [[-50,'freezing'],[0,'freezing'],[4,'freezing'],[4.1,'cold'],[5,'cold'],[11.9,'cold'],[12,'cool'],[17.9,'cool'],[18,'mild'],[23.9,'mild'],[24,'warm'],[55,'warm']])assert.equal(temperatureBand(n).key,key);
 assert.equal(TEMPERATURE_BANDS.length,5);assert.equal(temperatureBand('9').weather,'cold');
 for(const bad of [null,undefined,'',false,NaN,Infinity,-51,56,'bogus'])assert.equal(temperatureBand(bad),null);
});
test('numeric temperature overrides calendar and preset without breaking legacy state shape',()=>{
 assert.deepEqual(effectiveClimate({season:'winter',weather:'auto'}),{season:'winter',weather:'cold'});
 assert.equal(effectiveClimate({season:'winter',weather:'cold',temperature:28}).weather,'warm');
 assert.equal(effectiveClimate({season:'summer',weather:'warm',temperature:0}).weather,'freezing');
 assert.equal(effectiveClimate({season:'summer',weather:'warm',temperature:''}).weather,'warm');
 assert.match(climateAdvice({temperature:3}),/ara kat/);assert.match(climateAdvice({temperature:-20}),/termal/);
});
test('very cold requires three layers, conservative warmth, and below-zero pants and boots',()=>{
 for(const temperature of [-5,0,3,4]){const s=state({temperature}),r=generate(catalog,s,s.filters);assert.ok(r.outfits.length,temperature+' yielded no fixture outfit');
  for(const o of r.outfits){assert.equal(o.template,'three-layer');assert.ok(seasonCompatibility(o,s.filters).ok);assert.ok(seasonCompatibility(o,s.filters).upperWarmth>=6);assert.equal(garmentFacts(o.items.find(p=>p.slot==='top')).sleeve,'long');if(temperature<=0){assert.equal(garmentFacts(o.items.find(p=>p.slot==='shoe')).kind,'boot');assert.ok(garmentFacts(o.items.find(p=>p.slot==='bottom')).warmth>=2);}}
 }
 const s=state({temperature:0});assert.equal(generate(catalog.filter(p=>p.id!=='boot'),s,s.filters).outfits.length,0);
 const noMid=catalog.filter(p=>!garmentFacts(p).roles.includes('layer')||garmentFacts(p).warmth<2);assert.equal(generate(noMid,s,s.filters).outfits.length,0);
});
test('very cold minimum price is exact and budget is never relaxed',()=>{
 const s=state({temperature:3,budget:499}),pool=[longtee,cardigan,coat,jean,shoe],r=generate(pool,s,s.filters);assert.equal(r.outfits.length,0);assert.equal(r.cheapest,500);
 s.filters.budget=500;assert.equal(generate(pool,s,s.filters).outfits.length,1);s.owned=[shoe.id];s.filters.budget=400;assert.equal(cost(generate(pool,s,s.filters).outfits[0],s),400);
});
test('extreme cold returns an honest unsupported result instead of thermal guarantees',()=>{
 for(const temperature of [-15,-30,-50]){const s=state({temperature}),r=generate(catalog,s,s.filters);assert.equal(r.outfits.length,0);assert.equal(r.cheapest,null);assert.ok(r.reasons.some(x=>x.includes('termal')));}
});
test('cold, cool, mild and hot temperatures constrain actual construction',()=>{
 for(const temperature of [5,11,12,17,18,23,24,29,30,38,55]){const s=state({temperature}),r=generate(catalog,s,s.filters);assert.ok(r.outfits.length);for(const o of r.outfits){assert.ok(seasonCompatibility(o,s.filters).ok,temperature+' invalid');assert.ok(cost(o,s)<=s.filters.budget);if(temperature>=18&&temperature<24)assert.ok(!o.items.some(p=>slotOf(p)==='outer'&&garmentFacts(p).insulated));if(temperature>=30){assert.equal(o.items.length,3);assert.equal(garmentFacts(o.items.find(p=>slotOf(p)==='top')).sleeve,'short');}}}
});
test('swaps preserve very cold layers, footwear, budget and numeric temperature',()=>{
 const s=state({temperature:0}),o=generate(catalog,s,s.filters).outfits[0],oldBoot=o.items.find(p=>p.slot==='shoe');
 assert.equal(alternatives(oldBoot,o,catalog,s,2500).length,0);
 const mid=o.items.find(p=>p.slot==='layer');for(const a of alternatives(mid,o,catalog,s,2500)){assert.ok(seasonCompatibility(a.outfit,s.filters).ok);assert.ok(cost(a.outfit,s)<=2500);assert.equal(a.product.slot,'layer');}
});
test('new styles require recognizable recipes, including after replacement',()=>{
 for(const style of ['workwear','preppy','outdoor','monochrome']){assert.ok(STYLE[style]);const s=state({temperature:15,style}),r=generate(catalog,s,s.filters);assert.ok(r.outfits.length,style+' lacks fixture results');for(const o of r.outfits){assert.equal(o.style,style);assert.ok(styleRecipe(o));for(const a of alternatives(o.items.find(p=>p.slot==='top'),o,catalog,s,2500))assert.ok(styleRecipe(a.outfit));}}
 const basic={style:'workwear',items:[tee,jean,shoe]};assert.equal(styleRecipe(basic),false);assert.equal(styleRecipe({...basic,style:'outdoor'}),false);assert.equal(styleRecipe({...basic,style:'preppy'}),false);
 assert.equal(styleRecipe({style:'monochrome',items:[tee,{...jean,family:'red'},shoe]}),false);
});
test('empty style recipes produce fewer honest cards rather than relabeled basics',()=>{
 for(const style of ['workwear','preppy','outdoor']){const s=state({style,temperature:28});assert.equal(generate([tee,jean,shoe],s,s.filters).outfits.length,0);}
});
test('colors and unrelated fiber percentages never count as construction diversity',()=>{
 const s=state({temperature:28}),colors=Array.from({length:40},(_,i)=>({...tee,id:'color'+i,modelId:'same-tee',family:i%2?'gray':'navy'})),fibers=[{...tee,id:'fiber1',modelId:'fiber1',material:'%100 Pamuk'},{...tee,id:'fiber2',modelId:'fiber2',material:'%65 Poliester %35 Pamuk'}],r=generate([...colors,...fibers,jean,shoe],s,s.filters);
 assert.equal(r.outfits.length,1);assert.equal(r.distinctStructures,1);assert.equal(garmentFacts(fibers[0]).texture,garmentFacts(fibers[1]).texture);
});
test('visible texture changes construction while store identity alone does not',()=>{
 assert.equal(garmentFacts(jean).texture,'denim');assert.equal(garmentFacts(cord).texture,'corduroy');assert.equal(garmentFacts(fleece).texture,'fleece');assert.equal(garmentFacts(coat).texture,'woolly');
 const original={items:[tee,jacket,jean,shoe]},texture={items:[tee,{...jacket,material:'Süet Görünümlü'},jean,shoe]},otherStore={items:[tee,{...jacket,retailer:'Other'},jean,shoe]};assert.notEqual(structureKey(original),structureKey(texture));assert.equal(structureKey(original),structureKey(otherStore));
});
test('store filter is strict for purchases and alternatives, wardrobe remains useful',()=>{
 const s=state({temperature:15,stores:['A']}),r=generate(catalog,s,s.filters);assert.ok(r.outfits.length);for(const o of r.outfits){assert.ok(o.items.every(p=>storeKey(p)==='A'));for(const a of alternatives(o.items.find(p=>p.slot==='top'),o,catalog,s,2500))assert.equal(storeKey(a.product),'A');}
 s.owned=[overshirt.id,boot.id];const owned=generate(catalog,s,s.filters);assert.ok(owned.outfits.some(o=>o.items.some(p=>s.owned.includes(p.id))));for(const o of owned.outfits)assert.ok(o.items.every(p=>storeKey(p)==='A'||s.owned.includes(p.id)));
});
test('unknown-size products cannot claim chosen-size availability',()=>{
 const unknown={...shoe,id:'unknown',sizes:[]};assert.equal(sizeMatches(unknown,{shoe:42}),false);assert.equal(sizeMatches(unknown,{shoe:null}),true);assert.equal(stockInfo(unknown).label,'Ürün stoğu görüldü');
 const s=state({temperature:28});s.profile.shoe=42;assert.equal(generate([tee,jean,unknown],s,s.filters).outfits.length,0);s.owned=[unknown.id];assert.equal(generate([tee,jean,unknown],s,s.filters).outfits.length,1);
});
test('seeded refresh explores real constructions and stores without sibling inflation',()=>{
 const s=state({temperature:15}),seen=new Set(),anchorStores=new Set();let previous;
 for(let seed=1;seed<=8;seed++){s.seed=seed;const r=generate(catalog,s,s.filters);assert.equal(r.outfits.length,3);assert.equal(new Set(r.outfits.map(structureKey)).size,3);assert.deepEqual(r.outfits.map(fingerprint),generate(catalog,s,s.filters).outfits.map(fingerprint));if(previous)assert.notDeepEqual(r.outfits.map(fingerprint),previous);previous=r.outfits.map(fingerprint);for(const o of r.outfits){const anchor=o.items.find(p=>p.slot==='outer')||o.items.find(p=>p.slot==='layer')||o.items.find(p=>p.slot==='top');seen.add(garmentFacts(anchor).kind);anchorStores.add(storeKey(anchor));}s.recentLooks=[...s.recentLooks,...r.outfits.map(o=>({models:o.items.map(modelKey),structure:o.structure}))].slice(-12);}
 assert.ok(seen.size>=5,'insufficient visible construction exploration');assert.ok(anchorStores.size>=3,'fixture stores never explored');
});
test('style-aware minimum never advertises a cheaper unrelated recipe',()=>{
 const costlyPolo={...polo,id:'costly-polo',modelId:'costly-polo',price:500,sizes:[]},costlyChino={...chino,id:'costly-chino',modelId:'costly-chino',price:500,sizes:[]},pool=[tee,jean,shoe,costlyPolo,costlyChino],s=state({temperature:28,style:'preppy',budget:300});
 let r=generate(pool,s,s.filters);assert.equal(r.outfits.length,0);assert.equal(r.cheapest,1100);s.filters.budget=1100;r=generate(pool,s,s.filters);assert.ok(r.outfits.length);assert.ok(r.outfits.every(o=>styleRecipe(o,'preppy')));
});
test('a costlier preferred sibling never erases an affordable valid model',()=>{
 const red={...tee,id:'red-tee',modelId:'shared-tee',price:100,family:'red',sizes:[]},navy={...tee,id:'navy-tee',modelId:'shared-tee',price:500,sizes:[]},s=state({temperature:28,style:'clean'}),pool=[red,navy,jean,shoe];
 for(const budget of [300,400,500,600,699,700,900]){s.filters.budget=budget;const r=generate(pool,s,s.filters);assert.equal(r.cheapest,300);assert.equal(r.outfits.length,1,'budget '+budget+' lost its affordable sibling');assert.ok(cost(r.outfits[0],s)<=budget);}
});
test('alternatives revalidate every retained purchase against current shop, size, stock and hiding',()=>{
 const otherJeans={...jean,id:'B-jean',retailer:'B'},o={items:[tee,otherJeans,shoe],style:'clean',template:'single'},s=state({temperature:28,style:'clean',stores:['A']});
 assert.equal(alternatives(tee,o,[...catalog,otherJeans],s,2500).length,0);s.owned=[otherJeans.id];assert.ok(alternatives(tee,o,[...catalog,otherJeans],s,2500).length);
 s.hidden=[otherJeans.id];assert.equal(alternatives(tee,o,[...catalog,otherJeans],s,2500).length,0);s.hidden=[];s.owned=[];s.filters.stores=[];s.profile.bottomSize='34';assert.equal(alternatives(tee,o,[...catalog,otherJeans],s,2500).length,0);
 const out={...o,items:[tee,{...otherJeans,stock:{status:'out_of_stock'}},shoe]};s.profile.bottomSize='';assert.equal(alternatives(tee,out,[...catalog,otherJeans],s,2500).length,0);
});
test('model-level dislikes survive sibling replacement and exact minimum search',()=>{
 const red={...tee,id:'red',family:'red'},s=state({temperature:28,style:'clean'}),rejected={items:[tee,jean,shoe]},current={items:[polo,jean,shoe],style:'clean',template:'single'},pool=[tee,red,polo,jean,shoe];
 s.feedback[fingerprint(rejected)]={value:-1,reason:'overall',features:{}};
 assert.equal(alternatives(polo,current,pool,s,2500).some(a=>modelKey(a.product)===modelKey(tee)),false);
 assert.equal(generate([tee,red,jean,shoe],s,s.filters).cheapest,null);
});
test('vests, technical trousers and source insulation preserve actual construction',()=>{
 const vest=product('vest','layer','vest',{name:'Triko Süveter'}),technical=product('trek','bottom','technical'),conflict=product('ambiguous','outer','coat',{sourceFacts:{'Triko Kalınlığı':'İnce Kalınlık','Kumaş Kalınlık Bilgisi':'Kalın'}}),waterproof={...shell,sourceFacts:{'Su geçirmez':'10000mm','Rüzgar geçirmez':'Evet'}},rated={...jacket,sourceFacts:{'Isı yalıtımı':'−10°C sıcak tutan dolgulu mont'}};
 assert.equal(garmentFacts(vest).sleeve,null);assert.deepEqual(garmentFacts(vest).roles,['layer']);assert.equal(seasonCompatibility({items:[longtee,vest,coat,cord,boot].map(p=>({...p,slot:p.category}))},{temperature:0}).ok,false);
 assert.equal(garmentFacts(technical).kind,'technical');assert.equal(styleRecipe({style:'outdoor',items:[fleece,technical,shoe]}),true);assert.equal(styleRecipe({style:'preppy',items:[polo,technical,loafer]}),false);
 assert.equal(garmentFacts(conflict).insulated,false);assert.equal(garmentFacts(waterproof).insulated,false);assert.equal(garmentFacts(rated).insulated,true);assert.equal(garmentFacts(product('b','shoe','sneaker',{name:'Erkek yürüyüş botları'})).kind,'boot');
});
test('cool-air minimum prunes impossible light layers before expanding pants and shoes',()=>{
 const tees=Array.from({length:150},(_,i)=>product('light-top'+i,'top','tee')),shirts=Array.from({length:100},(_,i)=>product('light-shirt'+i,'layer','shirt')),bottoms=Array.from({length:30},(_,i)=>product('plain-bottom'+i,'bottom','jean')),shoes=Array.from({length:30},(_,i)=>product('plain-shoe'+i,'shoe','sneaker')),warmEnough={...longtee,id:'warm-enough',modelId:'warm-enough',price:300,sizes:[]},s=state({temperature:15,budget:600});
 const start=performance.now(),r=generate([...tees,...shirts,...bottoms,...shoes,warmEnough],s,s.filters);assert.ok(r.outfits.length);assert.equal(r.cheapest,600);assert.ok(performance.now()-start<3000,'minimum expanded impossible low-warmth combinations');
 const linedShell=product('lined-shell','outer','raincoat',{name:'İç astarlı su geçirmez trençkot'});assert.equal(garmentFacts(linedShell).insulated,false);assert.equal(garmentFacts(linedShell).warmth,2);const shellMarketing={...linedShell,name:'Raincut yağmurluk',description:'Doğa yürüyüşlerinizde kuru kalın! Hafif su geçirmez, rüzgar geçirmez.'};assert.equal(garmentFacts(shellMarketing).insulated,false);assert.equal(garmentFacts(shellMarketing).warmth,2);
});
console.log('Temperature and diversity scenarios:',count);
