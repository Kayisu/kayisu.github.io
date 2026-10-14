import {readFile,writeFile} from 'node:fs/promises';
import {generate} from '../../public/kendince/engine.js';
import {renderMannequin,setTextures} from '../../public/kendince/mannequin.js';
const catalog=JSON.parse(await readFile('public/kendince/catalog.json','utf8'));
setTextures(JSON.parse(await readFile('mannequin-review/textures.json','utf8')));
const state={profile:{fit:'any',size:'',bottomSize:'',shoe:null},owned:[],custom:[],hidden:[],feedback:{},priceNotes:{},seed:1,filters:{budget:3500,weather:'mild',style:'all',occasion:'day',explore:35,availableOnly:true}};
const outfits=generate(catalog.products,state,state.filters).outfits;
for(const [i,o] of outfits.entries()){const html=renderMannequin(o,{layerOpen:true});await writeFile('mannequin-review/look-'+i+'-open.svg',html.match(/<svg[\s\S]*<\/svg>/)[0]);}
await writeFile('mannequin-review/look-0-closed.svg',renderMannequin(outfits[0],{layerOpen:false}).match(/<svg[\s\S]*<\/svg>/)[0]);
