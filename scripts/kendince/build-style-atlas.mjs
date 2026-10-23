import {readFile,writeFile} from 'node:fs/promises';
import {STYLE,generate,styleRecipe,seasonCompatibility,modelKey,slotOf,garmentFacts} from '../../public/kendince/engine.js';
const catalog=JSON.parse(await readFile(new URL('../../public/kendince/catalog.json',import.meta.url),'utf8'));
const base={version:1,profile:{fit:'any',size:'',bottomSize:'',shoe:null},owned:[],custom:[],saved:[],feedback:{},hidden:[],priceNotes:{},seed:7,recentLooks:[]};
const looks=[],seen=new Set();
for(const style of Object.keys(STYLE)){
 const filters={budget:300000,temperature:16,season:'autumn',weather:'auto',stores:[],occasion:'day',style,explore:80,availableOnly:true};
 const editorialPool=catalog.products.filter(p=>{
  if(!p.discovery||p.catalogExcluded)return false;
  const k=garmentFacts(p).kind,role=slotOf(p);
  if(style==='street')return role==='shoe'?k==='sneaker':role==='bottom'?['jean','cargo','jogger'].includes(k):['tee','longtee','hoodie','sweat','overshirt','jacket'].includes(k);
  if(style==='tailoring')return role==='top'?['shirt','polo','turtleneck','knit'].includes(k):role==='bottom'?!/elastic|track|sweat|jogger/i.test(p.name):true;
  if(style==='workwear'&&role==='outer')return /work|chore|fatigue|painter|labura|utility|canvas|military/i.test([p.name,p.description].join(' '));
  if(style==='outdoor')return role==='shoe'?k==='boot':true;
  return true;
 });
 let options=generate(editorialPool,base,filters).outfits;
 if(!options.length)options=generate(catalog.products,base,filters).outfits;
 options.sort((a,b)=>b.items.filter(p=>!seen.has(modelKey(p))).length-a.items.filter(p=>!seen.has(modelKey(p))).length);
 const o=options[0];
 if(!o||!styleRecipe(o)||!seasonCompatibility(o,filters).ok)throw Error('No valid source reference for '+style);
 o.items.forEach(p=>seen.add(modelKey(p)));
 looks.push({style,temperature:16,items:o.items.map(p=>p.id),slots:o.items.map(slotOf),template:o.template});
 console.log(style+': '+o.items.map(p=>p.name).join(' / '));
}
await writeFile(new URL('../../public/kendince/style-atlas.json',import.meta.url),JSON.stringify({schemaVersion:1,preparedAt:new Date().toISOString(),note:'Real catalog references independent of personal filters; illustrative, not virtual fitting.',looks},null,2)+'\n');
