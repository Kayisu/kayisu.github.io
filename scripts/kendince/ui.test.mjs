import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as engine from '../../public/kendince/engine.js';
import {renderMannequin,setTextures} from '../../public/kendince/mannequin.js';

const source=await readFile(new URL('../../public/kendince/app.js',import.meta.url),'utf8');
const catalog=JSON.parse(await readFile(new URL('../../public/kendince/catalog.json',import.meta.url),'utf8'));
// Exercise the actual page renderers and registered UI handlers with catalog data.
// The host has no browser; this checks state transitions and generated markup, not pixels.
function harness(){
 const elements=new Map(),listeners=new Map(),storage=new Map();
 const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',className:'',value:'',open:false,classList:{toggle(){}},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(key);};
 const sandbox={...engine,renderMannequin,setTextures,console,Intl,Map,Set,WeakMap,Date,Number,String,Object,Array,Math,JSON,FormData,URL,Blob,crypto:globalThis.crypto,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:element,querySelectorAll:()=>[],addEventListener:(kind,fn)=>listeners.set(kind,fn)},window:{addEventListener(){},scrollTo(){}},location:{hash:''},setTimeout:()=>0,clearTimeout(){},fixture:catalog};
 vm.createContext(sandbox);
 const body=source.replace(/^import .*;\n/gm,'').slice(0,source.replace(/^import .*;\n/gm,'').indexOf("try{const r=await fetch('catalog.json"));
 vm.runInContext(body+`\nproducts=fixture.products;page='prices';catalogVerifiedAt=fixture.verifiedAt;catalogStats=fixture.stats;for(const p of products){const key=modelKey(p);if(!modelGroups.has(key))modelGroups.set(key,[]);modelGroups.get(key).push(p);}globalThis.ui={state:()=>state,filters:()=>catalogFilters,products:()=>products,list:catalogList,renderPrices,climateControls,stockSummary,productModal,renderAtelier,rebuild,catalogResults,outfits:()=>outfits,renderCompass,renderWardrobe};`,sandbox);
 const action=(action,value,id)=>listeners.get('click')({target:{closest:s=>s==='[data-action]'?{dataset:{action,value,id}}:null}});
 const change=(id,value,extra={})=>listeners.get('change')({target:{id,value,dataset:{},...extra}});
 const input=(id,value)=>listeners.get('input')({target:{id,value,dataset:{}}});
 return {ui:sandbox.ui,element,action,change,input};
}

test('catalog exposes every storefront, valid filters and image-first model browsing',()=>{
 const h=harness(),html=h.ui.renderPrices(),stores=new Set(catalog.products.map(engine.storeKey));
 assert.match(html,/<h1>Parça keşfi<\/h1>/);
 for(const store of stores)assert.ok(html.includes(`data-value="${store}"`),`Missing store ${store}`);
 assert.match(html,/id="catalog-texture"/);
 assert.match(html,/class="catalog-grid"/);
 assert.ok((html.match(/class="catalog-card"/g)||[]).length<=24);
 const expected=new Set(catalog.products.filter(p=>p.priceStatus==='verified'&&engine.stockInfo(p).status==='available').map(engine.modelKey));
 assert.equal(h.ui.list().length,expected.size);
});

test('catalog store, text, texture and size filters work together and can recover from an empty selection',()=>{
 const h=harness(),p=catalog.products.find(p=>p.category==='top'&&p.sizes?.some(v=>v.available)&&p.priceStatus==='verified'&&engine.stockInfo(p).status==='available');
 h.action('catalog-store',engine.storeKey(p));
 assert.ok(h.ui.list().every(q=>engine.storeKey(q)===engine.storeKey(p)));
 h.change('catalog-kind',engine.garmentFacts(p).kind);
 h.change('catalog-texture',engine.garmentFacts(p).texture);
 h.input('catalog-search',p.name);
 assert.ok(h.ui.list().length);
 assert.ok(h.ui.list().every(q=>engine.garmentFacts(q).kind===engine.garmentFacts(p).kind));
 h.ui.state().profile.size=p.sizes.find(v=>v.available).size;
 h.change('catalog-my-size','',{checked:true});
 assert.ok(h.ui.list().every(q=>engine.sizeMatches(q,h.ui.state().profile)));
 assert.ok(h.ui.list().length);
 h.input('catalog-search','thisdoesnotexist-f1f48c3f');
 assert.equal(h.ui.list().length,0);
 assert.match(h.ui.catalogResults([]),/data-action="catalog-reset"/);
 h.action('catalog-reset');
 assert.equal(h.ui.filters().store,'all');
 assert.ok(h.ui.list().length>0);
});

test('temperature controls accept zero and negative degrees, reject invalid values, and clear numeric override in season mode',()=>{
 const h=harness();
 h.ui.state().filters.budget=10000;
 h.action('climate-mode','temperature');
 assert.equal(h.ui.state().filters.temperature,15);
 assert.match(h.ui.climateControls(),/id="temperature"/);
 h.change('temperature','0');
 assert.equal(h.ui.state().filters.temperature,0);
 assert.match(h.ui.renderAtelier(),/0°C/);
 h.change('temperature','-3');
 assert.equal(h.ui.state().filters.temperature,-3);
 h.change('temperature','80');
 assert.equal(h.ui.state().filters.temperature,-3);
 h.action('temperature-preset','21');
 assert.equal(h.ui.state().filters.temperature,21);
 h.change('season','summer');
 assert.equal(h.ui.state().filters.temperature,null);
 assert.equal(h.ui.state().filters.season,'summer');
 assert.doesNotMatch(h.ui.climateControls(),/id="temperature"/);
});

test('store selection persists into outfit generation and alternative selection through state filters',()=>{
 const h=harness(),store=engine.storeKey(catalog.products.find(p=>p.priceStatus==='verified'&&engine.stockInfo(p).status==='available'));
 h.ui.state().filters.temperature=21;h.ui.state().filters.budget=10000;
 h.change('', '',{dataset:{store},checked:true});
 assert.deepEqual(Array.from(h.ui.state().filters.stores),[store]);
 for(const o of h.ui.outfits())for(const p of o.items)assert.equal(engine.storeKey(p),store);
 h.action('all-stores');
 assert.equal(h.ui.state().filters.stores.length,0);
});

test('pagination limits loaded product cards and list view; storefront stock never implies a verified size',()=>{
 const h=harness(),list=h.ui.list();
 assert.ok(list.length>24);
 assert.equal((h.ui.catalogResults(list).match(/class="catalog-card"/g)||[]).length,24);
 h.action('catalog-more');
 assert.equal((h.ui.catalogResults(list).match(/class="catalog-card"/g)||[]).length,Math.min(48,list.length));
 h.action('catalog-view','table');
 assert.match(h.ui.catalogResults(list),/class="price-table"/);
 const p={...list[0],sizes:[],stock:{status:'available'}};
 assert.match(h.ui.stockSummary(p),/beden bilgisi yok/);
 assert.doesNotMatch(h.ui.stockSummary(p),/^Beden:/);
});

test('all primary views and product details render with the expanded catalog',()=>{
 const h=harness();h.ui.rebuild();
 for(const render of [h.ui.renderAtelier,h.ui.renderPrices,h.ui.renderCompass,h.ui.renderWardrobe])assert.ok(render().length>100);
 const p=h.ui.products().find(p=>p.priceStatus==='verified');
 h.ui.productModal(p);
 assert.match(h.element('#modal-content').innerHTML,/Kaynak ürün sayfası/);
 assert.equal(h.element('#modal').open,true);
});


test('conditional campaign pricing is disclosed and escaped without lowering the budget price',()=>{
 const h=harness(),p={...h.ui.products().find(p=>p.priceStatus==='verified'),price:2000,sizes:[],conditionalPrice:{price:1500,condition:'Sepette %25 <özel> & üyelik',campaignId:'sample',source:'product snapshot'}};
 const base=engine.unitPrice(p,h.ui.state());
 h.ui.productModal(p);
 const html=h.element('#modal-content').innerHTML;
 assert.match(html,/koşullu fiyat/);
 assert.match(html,/kampanyasız fiyat/);
 assert.match(html,/kampanya koşullarını mağazada kontrol et/);
 assert.match(html,/&lt;özel&gt; &amp; üyelik/);
 assert.doesNotMatch(html,/<özel>/);
 assert.equal(engine.unitPrice(p,h.ui.state()),base);
 assert.equal(base,2000);
});
