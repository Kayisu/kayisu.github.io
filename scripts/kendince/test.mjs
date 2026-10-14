import {readFile} from 'node:fs/promises';
import * as engine from '../../public/kendince/engine.js';
import * as preview from '../../public/kendince/mannequin.js';
const catalog=JSON.parse(await readFile(new URL('../../public/kendince/catalog.json',import.meta.url),'utf8'));
const appSource=await readFile(new URL('../../public/kendince/app.js',import.meta.url),'utf8');
async function runKendinceTests(engine,catalog,appSource,preview){
 let assertions=0,scenarios=0;const check=(condition,message)=>{assertions++;if(!condition)throw Error(message);},clone=v=>JSON.parse(JSON.stringify(v));
 const initial=()=>({version:1,profile:{age:22,height:null,weight:null,fit:'any',chest:null,waist:null,shoe:null,size:'',bottomSize:''},owned:[],custom:[],saved:[],feedback:{},hidden:[],priceNotes:{},seed:1,filters:{budget:3500,weather:'mild',occasion:'day',style:'all',explore:35,availableOnly:true}});
 check(catalog.products.length===new Set(catalog.products.map(p=>p.id)).size,"duplicate catalog IDs");
 const verified=catalog.products.filter(p=>p.priceStatus==='verified'),available=verified.filter(p=>p.stock?.status==='available');
 check(verified.length===catalog.stats.priceVerified,"verified count");
 check(available.length===catalog.stats.stockAvailable,"available count");
 check(catalog.products.filter(p=>p.stock?.status==='out_of_stock').length===catalog.stats.stockOut,"out count");
 check(catalog.products.filter(p=>p.stock?.status==='unknown').length===catalog.stats.stockUnknown,"unknown count");
 for(const p of verified){check(p.price>0&&Number.isFinite(p.price),"invalid price "+p.id);check(p.verifiedAt&&p.verification.price,"missing price evidence "+p.id);check(p.priceHistory?.at(-1).price===p.price,"history/current discrepancy "+p.id);if(p.stock.status==='available')check(p.sizes.some(v=>v.available&&v.quantity>0),"false available stock "+p.id);if(p.stock.status==='out_of_stock')check(p.sizes.length&&p.sizes.every(v=>!v.available&&v.quantity===0),"false out stock "+p.id);}
 for(const budget of [0,1200,2500,3500,6000,10000])for(const weather of ['mild','cool'])for(const style of ['all','clean','earth','street','smart','bold']){
  const s=initial();s.filters={...s.filters,budget,weather,style};const r=engine.generate(catalog.products,s,s.filters);scenarios++;
  check(r.outfits.length<=3,"too many outfits");check(new Set(r.outfits.map(engine.fingerprint)).size===r.outfits.length,"duplicate outfit");
  for(const o of r.outfits){check(engine.cost(o,s)<=budget+.005,"over budget");check(engine.compatible(o.items),"incompatible");check(['top','bottom','shoe'].every(k=>o.items.some(p=>p.category===k)),"missing category");check(weather!=='cool'||o.items.some(p=>p.category==='layer'),"missing cool layer");check(o.items.every(p=>p.priceStatus==='verified'&&p.stock.status==='available'),"unverified purchase");check(style==='all'||o.style===style,"wrong style");}
 }
 for(const profile of [{size:'M',bottomSize:'32',shoe:42},{size:'XXL',bottomSize:'36/32',shoe:40},{size:'S',bottomSize:'M',shoe:43}]){
 const s=initial();s.profile={...s.profile,...profile};const r=engine.generate(catalog.products,s,s.filters);scenarios++;for(const o of r.outfits)for(const p of o.items)check(engine.sizeMatches(p,s.profile),"wrong available size "+p.id);
 }
 const s=initial(),baseOutfit=engine.generate(catalog.products,s,s.filters).outfits[0];check(baseOutfit,"default no outfit");
 const old=clone(s);old.owned=[baseOutfit.items[0].id];check(engine.cost(baseOutfit,old)===engine.round(engine.fullCost(baseOutfit,old)-engine.unitPrice(baseOutfit.items[0],old)),"owned spending");
 old.feedback[engine.fingerprint(baseOutfit)]={value:-1,features:engine.features(baseOutfit),reason:'overall'};
 check(!engine.generate(catalog.products,old,old.filters).outfits.some(o=>engine.fingerprint(o)===engine.fingerprint(baseOutfit)),"rejected outfit returns");
 const out=catalog.products.find(p=>p.stock.status==='out_of_stock'),unknown=catalog.products.find(p=>p.priceStatus==='unverified');
 const limited=catalog.products.find(p=>p.id==="lcw-5176616");check(limited?.stock.status==="available"&&engine.sizeMatches(limited,{shoe:40})&&!engine.sizeMatches(limited,{shoe:41}),"limited shoe stock");check(!engine.canUse(out,s,s.filters),"sold out usable");check(!engine.canUse(out,s,{availableOnly:false}),"sold out relaxed usable");check(!engine.canUse(unknown,s,s.filters),"unknown default usable");old.owned.push(out.id);check(engine.canUse(out,old,old.filters),"owned stock exception");
 const fake={id:'test',category:'top',kind:'tee',price:100,sizes:[{size:'M',available:true,price:140},{size:'L',available:true,price:180},{size:'2XL',available:true,price:200}],stock:{status:'available'},priceStatus:'verified'};
 check(engine.unitPrice(fake,s)===200,"conservative variant price");s.profile.size='M';check(engine.unitPrice(fake,s)===140,"selected size price");s.profile.size='XXL';check(engine.sizeMatches(fake,s.profile)&&engine.unitPrice(fake,s)===200,"XXL alias");s.priceNotes.test=[{price:111}];check(engine.unitPrice(fake,s)===111,"manual price");
 const bottom={...fake,category:'bottom',sizes:[{size:'32/32',available:true,price:350},{size:'32/34',available:true,price:400},{size:'34/32',available:false,price:300}]};s.profile.bottomSize='32';check(engine.sizeMatches(bottom,s.profile)&&engine.unitPrice(bottom,{...s,priceNotes:{}})===400,"waist variants");s.profile.bottomSize='34';check(!engine.sizeMatches(bottom,s.profile),"unavailable waist matches");
 const peer=catalog.products.find(p=>engine.priceBand(p,catalog.products,initial()));const normal=engine.priceBand(peer,catalog.products,initial()),noted=initial();noted.priceNotes[peer.id]=[{price:1}];check(engine.priceBand(peer,catalog.products,noted).median===normal.median,"manual contaminated source median");
 check(engine.sourcePriceChange({priceHistory:[{price:100}]})===null,"invented history");check(engine.sourcePriceChange({priceHistory:[{price:100},{price:80}]}).delta===-20,"price delta");
 const alts=engine.alternatives(baseOutfit.items[0],baseOutfit,catalog.products,initial(),3500);for(const a of alts){check(a.cost<=3500&&engine.compatible(a.outfit.items),"invalid alternative");check(a.product.stock.status==='available'&&a.product.priceStatus==='verified',"invalid alternative stock");}
 const elements=new Map(),events={},errors=[],storage=new Map();
 const makeElement=()=>({innerHTML:'',textContent:'',value:'',dataset:{},open:false,className:'',classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;},addEventListener(){},getBoundingClientRect(){return{left:0,right:100,top:0,bottom:100};}});
 const document={querySelector(selector){if(!elements.has(selector))elements.set(selector,makeElement());return elements.get(selector);},querySelectorAll(){return[];},addEventListener(name,handler){events[name]=handler;}};
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const location={hash:'',reload(){}},window={scrollTo(){},addEventListener(){}};
 class MockFormData{constructor(form){this.values=form.values;}get(key){return this.values[key]??null;}}
 const AF=Object.getPrototypeOf(async function(){}).constructor;
 const source=appSource.replace(/^import\s*\{([^}]+)\}[^\n]*\n/,'const {$1}=engine;\n').replace(/^import[^\n]+mannequin[^\n]*\n/m,'const {renderMannequin,setTextures}=preview;\n');
 const app=await new AF('engine','preview','document','localStorage','location','window','fetch','FormData','crypto','console','setTimeout','clearTimeout',source+';return {getState:()=>state,getOutfits:()=>outfits,getFilters:()=>catalogFilters,navigate,productModal,detailModal,find,catalogList,latestPrice,rebuild,render};')(engine,preview,document,localStorage,location,window,async()=>({ok:true,json:async()=>catalog}),MockFormData,{randomUUID:()=> 'test-custom'},{error:e=>errors.push(String(e))},()=>0,()=>{});
 const html=selector=>document.querySelector(selector).innerHTML,click=(action,id,value)=>events.click({target:{closest:selector=>selector==='[data-action]'?{dataset:{action,id,value}}:null}}),change=(id,value,checked)=>events.change({target:{id,value,checked,dataset:{}}}),submit=(id,values,dataset={})=>events.submit({preventDefault(){},target:{id,values,dataset}});
 check(errors.length===0,"app boot: "+errors);check(html('#app').includes('Kombin atölyesi'),"no atelier");check(app.getOutfits().length===3,"no default3");
 check(html('#app').includes('class="mannequin-svg"'),"default mannequin missing");
 const before=app.getOutfits().map(engine.fingerprint).join(';');
 click('preview-mode',null,'pieces');check(!html('#app').includes('class="mannequin-svg"')&&html('#app').includes('class="top-img"'),"pieces view");
 click('preview-mode',null,'mannequin');check(html('#app').includes('class="mannequin-svg"'),"mannequin view");
 check(app.getOutfits().map(engine.fingerprint).join(';')===before,"view changed outfits");
 const modelLook=app.getOutfits()[0];click('mannequin',modelLook.id);check(html('#modal-content').includes('mannequin-modal')&&html('#modal-content').includes('Gerçek fotoğraf'),"model modal");
 click('save',modelLook.id);check(html('#modal-content').includes('mannequin-modal')&&app.getState().saved.length===1,"save left mannequin view");click('save',modelLook.id);
 const openMarkup=html('#modal-content');click('preview-layer');check(html('#modal-content')!==openMarkup&&app.getState().preview.layerOpen===false,"layer view");
 events.change({target:{dataset:{previewBuild:''},value:'broad'}});check(app.getState().preview.build==='broad'&&html('#modal-content').includes('scale(1.12 1)'),"build view");click('close');
 const incomplete={items:[]};check(preview.renderMannequin(incomplete)==='',"incomplete preview");
 const marked={...modelLook,items:modelLook.items.map(p=>({...p,name:'<script>bad</script>'}))};
 check(!preview.renderMannequin(marked).includes('<script>')&&preview.renderMannequin(marked).includes('&lt;script&gt;'),"SVG escape");
 const first=preview.renderMannequin(modelLook),second=preview.renderMannequin(modelLook),ids=[...first.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);
 check(ids.length===new Set(ids).size,"duplicate SVG ids");check(!second.includes('id="'+ids[0]+'"'),"SVG ids reused between cards");
 for(const ref of first.matchAll(/url\(#([^)]*)\)/g))check(ids.includes(ref[1]),"missing SVG definition "+ref[1]);

 app.navigate('prices');check(html('#app').includes('175 ürün')&&html('#app').includes('127 ürün'),"price counts missing");check(app.catalogList().length===127,"stock default");change('catalog-stock','all');check(app.catalogList().length===204,"all filter");change('catalog-stock','unverified');check(app.catalogList().length===29,"old filter");change('catalog-stock','out_of_stock');check(app.catalogList().length===6,"out filter");change('catalog-stock','available');
 change('catalog-kind','sneaker');check(app.catalogList().every(p=>p.kind==='sneaker'),"kind filter");change('catalog-kind','all');change('catalog-max','500');check(app.catalogList().every(p=>app.latestPrice(p)<=500),"max filter");change('catalog-max','');
 const o=app.getOutfits()[0],p=o.items[0];click('detail',o.id);check(html('#modal-content').includes('Parçayı değiştir')&&html('#modal-content').includes('Stok görüldü'),"detail");click('save',o.id);check(app.getState().saved.length===1,"save");click('like',o.id);check(Object.values(app.getState().feedback).length===1,"like");click('like',o.id);check(Object.values(app.getState().feedback).length===0,"like toggle");
 click('alternatives',p.id);check(html('#modal-content').includes('Bir parçayı değiştir'),"alternatives modal");
 const swapId=html('#modal-content').match(/data-action="swap" data-id="([^"]+)"/)?.[1];check(swapId,"missing swap");click('swap',swapId);
 const swapped=app.getOutfits().find(look=>look.items.some(item=>item.id===swapId));check(swapped,"swap did not change outfit");click('mannequin',swapped.id);check(html('#modal-content').includes(app.find(swapId).name),"mannequin not updated after swap");
 app.productModal(unknown);check(html('#modal-content').includes('Yeniden doğrulanmamış')&&!html('#modal-content').includes('class="size-chip '),"unknown false stock chips");app.productModal(out);check(html('#modal-content').includes('Tükendi'),"out modal");
 click('price-note',p.id);submit('price-note-form',{price:'321.50'},{id:p.id});check(app.latestPrice(p)===321.5,"manual note");check(html('#modal-content').includes('Senin notun'),"note label");click('clear-price',p.id);check(!app.getState().priceNotes[p.id],"note reset");
 submit('profile-form',{age:'25',height:'178',weight:'75',fit:'any',chest:'',waist:'',shoe:'42',size:'M',bottomSize:'32'});check(app.getState().profile.bottomSize==='32'&&app.getState().profile.shoe===42,"profile save");check(html('#modal-content').includes('Pantolon bedenim'),"profile field");
 change('catalog-my-size','',true);check(app.catalogList().every(p=>engine.sizeMatches(p,app.getState().profile)),"catalog size filter");
 app.navigate('atelier');change('available-only','',false);check(app.getState().filters.availableOnly===false,"stock toggle");
 submit('custom-form',{name:'<img src=x onerror=evil()>',category:'top',family:'navy',fit:'regular',pattern:'plain',warmth:'1',formality:'1'});check(app.getState().custom.length===1,"custom save");app.navigate('wardrobe');check(html('#app').includes('&lt;img')&&!html('#app').includes('<img src=x'),"custom escaping");
 const persisted=JSON.parse(storage.get('kendince-v1'));check(persisted.saved.length===1&&persisted.custom.length===1&&persisted.profile.bottomSize==='32'&&persisted.preview.mode==='mannequin'&&persisted.preview.build==='broad',"state persisted");
 preview.setTextures(null);
 await new AF('engine','preview','document','localStorage','location','window','fetch','FormData','crypto','console','setTimeout','clearTimeout',source)(engine,preview,document,localStorage,location,window,async url=>{if(url.includes('textures'))throw Error('offline texture');return{ok:true,json:async()=>catalog};},MockFormData,{randomUUID:()=> 'test-custom'},{error:e=>errors.push(String(e))},()=>0,()=>{});
 check(!html('#app').includes('Atölyeyi açamadık')&&html('#app').includes('class="mannequin-svg"'),"texture failure broke catalog");
 return{assertions,scenarios,defaultSpend:engine.cost(baseOutfit,initial()),catalog:catalog.products.length,flows:'pass'};
}
console.log('Kendince verification:',await runKendinceTests(engine,catalog,appSource,preview));

const textureManifest=JSON.parse(await readFile(new URL('../../public/kendince/mannequin-textures.json',import.meta.url),'utf8'));
preview.setTextures(textureManifest);
let swatches=0;
for(const [id,swatch] of Object.entries(textureManifest.products)){
 const product=catalog.products.find(p=>p.id===id);
 if(!product||!/^#[a-f0-9]{6}$/i.test(swatch.color))throw Error('Invalid swatch '+id);
 if(swatch.texture){swatches++;if(swatch.sourceImage!==product.image||!/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(swatch.texture))throw Error('Invalid texture source '+id);}
}
if(swatches<catalog.stats.stockAvailable)throw Error('Insufficient texture coverage');
console.log('Mannequin source swatches:',swatches);
