import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {STYLE,styleRecipe,styleMatch,productStyles,generate,alternatives,cost,garmentFacts,seasonCompatibility,structureKey,modelKey} from '../../public/kendince/engine.js';

const product=(id,category,kind,extra={})=>({id,modelId:id,retailer:'Fixture',name:kind,category,kind,family:'navy',fit:'regular',formality:1,patterned:false,price:100,priceStatus:'verified',stock:{status:'available'},sizes:[],...extra});
const tee=product('tee','top','tee'),shirt=product('shirt','top','shirt'),knit=product('knit','top','knit'),hoodie=product('hoodie','top','hoodie'),blazer=product('blazer','layer','blazer'),jacket=product('jacket','outer','jacket',{name:'Denim işçi ceketi'}),chino=product('chino','bottom','chino'),jean=product('jean','bottom','jean'),cargo=product('cargo','bottom','cargo',{fit:'wide'}),sneaker=product('sneaker','shoe','sneaker'),derby=product('derby','shoe','derby'),boot=product('boot','shoe','boot'),crafted=product('crafted','top','shirt',{name:'Embroidered cotton shirt',patterned:true});
const state=(filters={})=>({profile:{fit:'any',size:'',shoe:null,bottomSize:''},owned:[],custom:[],hidden:[],feedback:{},priceNotes:{},seed:1,recentLooks:[],filters:{budget:300000,season:'autumn',weather:'auto',temperature:16,style:'all',occasion:'day',explore:65,availableOnly:true,stores:[],...filters}});

test('twelve styles describe different construction and expose honest catalog membership',()=>{
 assert.equal(Object.keys(STYLE).length,12);
 for(const style of Object.values(STYLE)){assert.ok(style.recipe&&style.subtitle&&style.family);assert.ok(style.pieces.length>=3);}
 assert.ok(productStyles(crafted).includes('artisan'));
 assert.ok(styleMatch(blazer,'tailoring'));assert.ok(styleMatch(boot,'heritage'));
 assert.equal(styleMatch(tee,'artisan'),false);assert.equal(styleMatch(tee,'bold'),false);assert.equal(styleMatch(tee,'missing'),false);
 assert.deepEqual(productStyles(crafted),Object.keys(STYLE).filter(k=>styleMatch(crafted,k)));
});

test('a plain tee and jeans cannot be relabeled as every style',()=>{
 const basic={items:[tee,jean,sneaker]};
 assert.ok(styleRecipe(basic,'clean'));
 for(const style of ['street','smart','bold','tailoring','heritage','artisan','preppy','workwear','outdoor'])assert.equal(styleRecipe(basic,style),false,style);
 assert.equal(styleRecipe({items:[{...tee,patterned:true},jean,sneaker]},'clean'),false);
 assert.ok(styleRecipe({items:[hoodie,cargo,sneaker]},'street'));
 assert.ok(styleRecipe({items:[crafted,chino,sneaker]},'artisan'));
 assert.ok(styleRecipe({items:[knit,jean,boot]},'heritage'));
 assert.ok(styleRecipe({items:[shirt,blazer,chino,derby]},'tailoring'));
 assert.equal(styleRecipe({items:[shirt,blazer,chino,sneaker]},'tailoring'),false);
 assert.equal(styleRecipe({items:[knit,jean,sneaker]},'heritage'),false);
});

test('tailoring minimum and replacements preserve the actual recipe',()=>{
 const pool=[tee,shirt,blazer,chino,jean,sneaker,derby],s=state({style:'tailoring',temperature:21,budget:399});
 const insufficient=generate(pool,s,s.filters);assert.equal(insufficient.outfits.length,0);assert.equal(insufficient.cheapest,400);
 s.filters.budget=400;const r=generate(pool,s,s.filters);assert.ok(r.outfits.length);
 for(const o of r.outfits){assert.ok(styleRecipe(o));assert.ok(cost(o,s)<=400);assert.ok(seasonCompatibility(o,s.filters).ok);for(const p of o.items)for(const a of alternatives(p,o,pool,s,400))assert.ok(styleRecipe(a.outfit,'tailoring'));}
 const look=r.outfits[0],shoe=look.items.find(p=>p.slot==='shoe');assert.equal(alternatives(shoe,look,pool,s,400).some(a=>a.product.id===sneaker.id),false);
});

const catalog=JSON.parse(await readFile(new URL('../../public/kendince/catalog.json',import.meta.url),'utf8')).products;
test('every atlas style has an available, budgeted real-catalog recipe at 16 degrees',()=>{
 const s=state();
 for(const style of Object.keys(STYLE)){
  const result=generate(catalog,s,{...s.filters,style});assert.ok(result.outfits.length,style+' has no supported catalog recipe');
  for(const o of result.outfits){assert.ok(styleRecipe(o,style));assert.ok(seasonCompatibility(o,s.filters).ok);assert.ok(cost(o,s)<=s.filters.budget);assert.equal(new Set(o.items.map(modelKey)).size,o.items.length);}
 }
});

test('all-style browsing changes style families and visible structures together',()=>{
 const s=state(),result=generate(catalog,s,s.filters);
 assert.equal(result.outfits.length,3);
 assert.equal(new Set(result.outfits.map(o=>STYLE[o.style].family)).size,3);
 assert.equal(new Set(result.outfits.map(structureKey)).size,3);
 const signatures=result.outfits.map(o=>o.items.map(p=>garmentFacts(p).kind).join('+'));
 assert.equal(new Set(signatures).size,3);
});
