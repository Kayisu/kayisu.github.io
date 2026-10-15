import assert from 'node:assert/strict';
import {modelKey,slotOf,garmentFacts,seasonForMonth,effectiveClimate,seasonCompatibility,structureKey,generate,alternatives,cost,fingerprint,features,sizeMatches,priceBand} from '../../public/kendince/engine.js';

const product=(id,category,kind,extra={})=>({id,sku:id+'-001',retailer:'LCW',name:kind,category,kind,price:100,priceStatus:'verified',stock:{status:'available'},sizes:[{size:category==='shoe'?'42':category==='bottom'?'32':'M',available:true,price:100}],family:'navy',fit:'regular',formality:1,patterned:false,...extra});
const state=(filters={})=>({profile:{fit:'any',size:'',shoe:null,bottomSize:''},owned:[],custom:[],hidden:[],feedback:{},priceNotes:{},seed:1,recentLooks:[],filters:{season:'autumn',weather:'auto',budget:2000,style:'all',occasion:'day',explore:35,availableOnly:true,...filters}});
const top=product('KNIT','top','knit'),shirt=product('SHIRT','layer','shirt'),tee=product('TEE','top','tee'),hoodie=product('HOOD','top','hoodie'),cardigan=product('CARD','layer','cardigan'),overshirt=product('OVER','layer','overshirt'),blazer=product('BLAZER','layer','blazer'),coat=product('COAT','outer','coat'),puffer=product('PUFFER','outer','puffer'),thinCoat=product('THIN','outer','puffer',{sourceFacts:{'Kalınlık':'İnce'}}),bottom=product('JEAN','bottom','jean'),cargo=product('CARGO','bottom','cargo',{fit:'wide'}),boot=product('BOOT','shoe','boot'),derby=product('DERBY','shoe','derby'),shoe=product('SNEAKER','shoe','sneaker'),mesh=product('MESH','shoe','sneaker',{name:'Fileli erkek spor ayakkabı'});
const items=[top,shirt,tee,hoodie,cardigan,overshirt,blazer,coat,puffer,thinCoat,bottom,cargo,boot,derby,shoe,mesh];
let tests=0;const test=(name,fn)=>{fn();tests++;console.log('✓',name);};

test('true model identities group LCW/Mavi color SKUs, never generic names',()=>{
 assert.equal(modelKey({...tee,sku:'W62222Z8-CVL'}),modelKey({...tee,id:'other',sku:'W62222Z8-RFH'}));
 assert.notEqual(modelKey({...tee,sku:'W61111Z8-CVL'}),modelKey({...tee,sku:'W62222Z8-CVL'}));
 assert.equal(modelKey({id:'0613680-70219',brand:'Mavi'}),modelKey({id:'0613680-85173',brand:'Mavi'}));
 assert.notEqual(modelKey({id:'a',name:'Regular tişört',brand:'Indie'}),modelKey({id:'b',name:'Regular tişört',brand:'Indie'}));
 assert.equal(modelKey({...tee,id:'different',modelId:'official-model'}),modelKey({...tee,modelId:'official-model'}));
});
test('source construction beats generic kind and inherited warmth',()=>{
 assert.equal(garmentFacts(thinCoat).insulated,false);
 assert.equal(garmentFacts({...coat,sourceFacts:{'Kalınlık':'Kalın'}}).warmth,3);
 assert.equal(garmentFacts({...tee,sourceFacts:{'Kol Boyu':'Uzun Kol'}}).sleeve,'long');
 assert.equal(garmentFacts({...tee,sourceFacts:{'Kol Boyu':'Uzun Kol'}}).kind,'longtee');
 assert.equal(garmentFacts(product('JACKET','outer','jacket',{name:'Kapüşonlu İnce Mont',sourceFacts:{'Kalınlık':'İnce'}})).kind,'jacket');
 assert.equal(garmentFacts({...top,name:'Balıkçı Yaka Triko Kazak',kind:'sweat'}).kind,'turtleneck');
 assert.deepEqual(garmentFacts(shirt).roles,['top','layer']);
 assert.deepEqual(garmentFacts(overshirt).roles,['layer']);
 assert.deepEqual(garmentFacts({...blazer,category:'outer'}).roles,['layer','outer']);
 assert.equal(garmentFacts({...bottom,name:'Kadife pantolon'}).kind,'corduroy');
});
test('auto season uses calendar, explicit weather survives',()=>{
 assert.equal(seasonForMonth(0),'winter');assert.equal(seasonForMonth(6),'summer');assert.equal(seasonForMonth(9),'autumn');
 assert.deepEqual(effectiveClimate({season:'winter',weather:'auto'}),{season:'winter',weather:'cold'});
 assert.deepEqual(effectiveClimate({season:'winter',weather:'mild'}),{season:'winter',weather:'mild'});
});
test('30 colors of one tee produce one primary model, no fake third suggestion',()=>{
 const colors=Array.from({length:30},(_,i)=>({...tee,id:'color'+i,sku:'SAME-'+i,family:i%2?'gray':'navy'})),s=state({season:'summer'}),r=generate([...colors,bottom,shoe],s,s.filters);
 assert.equal(r.modelCount,3);assert.equal(r.outfits.length,1);assert.equal(r.limited,true);assert.ok(r.reasons.length);
});
test('different SKUs with one silhouette still produce one honest card',()=>{
 const s=state({season:'summer'}),r=generate([tee,{...tee,id:'TEE2',sku:'ANOTHER-1'},{...tee,id:'TEE3',sku:'THIRD-1'},bottom,shoe],s,s.filters);
 assert.equal(r.outfits.length,1);assert.equal(r.distinctStructures,1);assert.equal(r.limited,true);
});
test('source price medians count independent models rather than color records',()=>{
 const s=state(),colors=Array.from({length:21},(_,i)=>({...tee,id:'tee-color'+i,sku:'TEE-'+i,price:100,sizes:[]}));
 assert.equal(priceBand(tee,colors,s),null);
 const peers=[...colors,...[200,300,400].map((price,i)=>({...tee,id:'peer'+i,sku:'MODEL'+i+'-001',price,sizes:[]}))];
 const band=priceBand(tee,peers,s);assert.equal(band.count,4);assert.equal(band.variantCount,24);assert.equal(band.median,250);
 s.priceNotes[tee.id]=[{price:999}];assert.equal(priceBand(tee,peers,s).median,250);assert.equal(priceBand(tee,peers,s).value,999);
});
test('cold winter requires true insulation, warm long upper and closed nonmesh shoes',()=>{
 const s=state({season:'winter'}),r=generate(items,s,s.filters);assert.ok(r.outfits.length>=2);
 for(const o of r.outfits){assert.ok(seasonCompatibility(o,s.filters).ok);assert.ok(o.items.some(p=>slotOf(p)==='outer'&&garmentFacts(p).insulated));assert.ok(!o.items.some(p=>p.id==='MESH'||p.id==='THIN'));}
 assert.equal(generate(items.filter(p=>!['COAT','PUFFER'].includes(p.id)),s,s.filters).outfits.length,0);
 const noWarm=[tee,shirt,coat,bottom,shoe];assert.equal(generate(noWarm,s,s.filters).outfits.length,0);
 const midWarm=[tee,cardigan,coat,bottom,shoe];assert.equal(generate(midWarm,s,s.filters).outfits.length,1);
});
test('summer rejects heavy garments and permits source shirts as closed tops',()=>{
 const s=state({season:'summer'}),r=generate(items,s,s.filters);assert.ok(r.outfits.length);
 for(const o of r.outfits){assert.ok(!o.items.some(p=>slotOf(p)==='outer'||garmentFacts(p).warmth>=2));assert.ok(seasonCompatibility(o,s.filters).ok);}
 assert.ok(r.outfits.some(o=>o.items.some(p=>p.id==='SHIRT'&&p.slot==='top'&&p.category==='layer')));
});
test('cool autumn creates genuinely different layered structures',()=>{
 const s=state(),r=generate(items,s,s.filters);assert.equal(r.outfits.length,3);assert.equal(r.distinctStructures,3);
 assert.equal(new Set(r.outfits.map(o=>modelKey(o.items.find(p=>p.slot==='top')))).size,3);
 for(const o of r.outfits)assert.ok(o.items.some(p=>['layer','outer'].includes(slotOf(p))));
});
test('visible coat and puffer families precede same-puffer inner variations',()=>{
 const s=state({season:'winter'}),puffers=[puffer,{...puffer,id:'PUFFER2',sku:'PUFFER2-1'},{...puffer,id:'PUFFER3',sku:'PUFFER3-1'}],c=[top,hoodie,shirt,cardigan,coat,...puffers,bottom,cargo,shoe,boot],r=generate(c,s,s.filters);
 const anchor=o=>o.items.find(p=>p.slot==='outer')||o.items.find(p=>p.slot==='layer')||o.items.find(p=>p.slot==='top'),anchors=r.outfits.map(anchor);
 assert.equal(r.outfits.length,3);assert.ok(anchors.some(p=>garmentFacts(p).kind==='coat'));assert.ok(anchors.some(p=>garmentFacts(p).kind==='puffer'));
 assert.equal(new Set(anchors.map(modelKey)).size,3);
});
test('sizes, real budget and cheapest seasonal minimum stay strict',()=>{
 const s=state({season:'winter',budget:399});s.profile={fit:'any',size:'M',bottomSize:'32',shoe:42};const r=generate(items,s,s.filters);
 assert.equal(r.outfits.length,0);assert.equal(r.cheapest,400);
 s.filters.budget=500;const good=generate(items,s,s.filters);assert.ok(good.outfits.length);for(const o of good.outfits){assert.ok(cost(o,s)<=500);assert.ok(o.items.every(p=>sizeMatches(p,s.profile)));}
 s.profile.shoe=43;assert.equal(generate(items,s,s.filters).outfits.length,0);
});
test('owned unavailable basics remain usable at zero purchase cost',()=>{
 const s=state({season:'winter',budget:200}),ownedBottom={...bottom,stock:{status:'out_of_stock'},sizes:[]},ownedShoe={...shoe,stock:{status:'unknown'},priceStatus:'unverified'};s.owned=[bottom.id,shoe.id];
 const r=generate([top,coat,ownedBottom,ownedShoe],s,s.filters);assert.equal(r.outfits.length,1);assert.equal(cost(r.outfits[0],s),200);
});
test('one wardrobe basic can support genuinely different outer structures',()=>{
 const s=state();s.owned=[tee.id];const r=generate([tee,shirt,cardigan,overshirt,blazer,coat,bottom,shoe],s,s.filters);
 assert.equal(r.outfits.length,3);assert.equal(r.distinctStructures,3);
});
test('rejected outfit also rejects exact model set in sibling colors',()=>{
 const s=state({season:'summer'}),c=[tee,{...tee,id:'TEEblue',sku:'TEE-002'},shirt,bottom,shoe],o=generate(c,s,s.filters).outfits[0];
 s.feedback[fingerprint(o)]={value:-1,features:features(o),reason:'overall'};
 const rejected=o.items.map(modelKey).sort().join('|');for(const next of generate(c,s,s.filters).outfits)assert.notEqual(next.items.map(modelKey).sort().join('|'),rejected);
});
test('alternatives preserve role, template, season and default model distinction',()=>{
 const s=state({season:'winter'}),o=generate(items,s,s.filters).outfits[0],outer=o.items.find(p=>p.slot==='outer'),color={...outer,id:'coat-color',sku:outer.sku.split('-')[0]+'-222'},c=[...items,color];
 const alts=alternatives(outer,o,c,s,2000);for(const a of alts){assert.notEqual(modelKey(a.product),modelKey(outer));assert.equal(a.product.slot,'outer');assert.ok(garmentFacts(a.product).insulated);assert.ok(seasonCompatibility(a.outfit,s.filters).ok);assert.ok(cost(a.outfit,s)<=2000);}
 const colors=alternatives(outer,o,c,s,2000,{sameModel:true});assert.equal(colors.length,1);assert.equal(colors[0].product.id,color.id);
 const midLook=generate([tee,cardigan,coat,bottom,shoe],s,s.filters).outfits[0];assert.equal(alternatives(midLook.items.find(p=>p.slot==='layer'),midLook,[...items,product('THINSHIRT','layer','shirt')],s,2000).some(a=>a.product.id==='THINSHIRT'),false);
});
test('bounded recent history varies results deterministically without excluding core shoes',()=>{
 const s=state(),first=generate(items,s,s.filters),repeat=generate(items,s,s.filters);assert.deepEqual(first.outfits.map(fingerprint),repeat.outfits.map(fingerprint));
 s.recentLooks=first.outfits.map(o=>({models:o.items.map(modelKey),structure:structureKey(o)}));s.seed=2;
 const next=generate(items,s,s.filters);assert.ok(next.outfits.length);assert.notDeepEqual(first.outfits.map(fingerprint),next.outfits.map(fingerprint));
 const single=state({season:'summer'});single.recentLooks=[{models:[modelKey(tee),modelKey(bottom),modelKey(shoe)],structure:''}];assert.equal(generate([tee,bottom,shoe],single,single.filters).outfits.length,1);
});
console.log('Seasonal recommendation scenarios:',tests);
