import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {modelKey,canUse,unitPrice,storeKey} from '../../public/kendince/engine.js';

const catalog=JSON.parse(await readFile(new URL('../../public/kendince/catalog.json',import.meta.url),'utf8'));
const products=catalog.products,stats=catalog.stats;
const state={profile:{},owned:[],priceNotes:{}};
assert.equal(new Set(products.map(p=>p.id)).size,products.length,'IDs must remain unique');
assert.equal(stats.total,products.length);
assert.equal(stats.modelCount,new Set(products.map(modelKey)).size,'model count must use the runtime identity');
assert.equal(stats.storeCount,new Set(products.map(storeKey)).size);
const eligible=products.filter(p=>canUse(p,state,{availableOnly:true}));
assert.equal(stats.eligible,eligible.length);
assert.equal(stats.eligibleStores,new Set(eligible.map(storeKey)).size);

let stockChecks=0,campaignChecks=0;
for(const p of products){
 assert.ok(Number.isFinite(p.price)&&p.price>0,`${p.id}: invalid source price`);
 assert.equal(new URL(p.url).protocol,'https:');
 assert.equal(new URL(p.image).protocol,'https:');
 assert.ok(p.retailer&&p.modelId,`${p.id}: missing storefront/model provenance`);
 if(p.priceStatus==='verified'){
  assert.ok(p.verifiedAt&&p.verification.price,`${p.id}: verified price lacks evidence`);
  assert.equal(p.priceHistory.at(-1).price,p.price,`${p.id}: history/current mismatch`);
  const prices=p.verification.sourcePrices||[];
  assert.ok(prices.length&&prices.every(x=>Number.isFinite(x)&&Math.abs(x-p.price)<.03),`${p.id}: conflicting verified price`);
 }
 if(p.stock.status==='available'){
  stockChecks++;
  assert.ok(p.stock.checkedAt&&p.stock.method&&p.verification.stock,`${p.id}: available stock lacks evidence`);
  if(p.sizes.length)assert.ok(p.sizes.some(v=>v.available),`${p.id}: available product has no available variant`);
  for(const size of p.sizes){
   if(size.quantity!==undefined)assert.equal(size.available,size.quantity>0,`${p.id}: quantity/availability mismatch`);
   if(size.available&&size.price!==undefined)assert.ok(size.price>0,`${p.id}: invalid size price`);
  }
 }
 if(p.conditionalPrice){
  campaignChecks++;
  assert.ok(p.conditionalPrice.condition&&p.conditionalPrice.source,`${p.id}: missing promotion condition`);
  assert.ok(p.conditionalPrice.price<p.price,`${p.id}: promotion should differ from regular source price`);
  assert.ok(unitPrice(p,state)>=p.price-.01,`${p.id}: budget silently applied a conditional discount`);
 }
}
console.log(`Catalog evidence: ${products.length} records / ${stats.modelCount} models / ${stats.storeCount} storefronts; ${stockChecks} stock records and ${campaignChecks} conditional prices validated.`);
