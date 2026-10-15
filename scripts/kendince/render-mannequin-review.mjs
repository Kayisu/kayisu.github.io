import {readFile,writeFile} from 'node:fs/promises';
import {generate} from '../../public/kendince/engine.js';
import {renderMannequin,setTextures} from '../../public/kendince/mannequin.js';
const catalog=JSON.parse(await readFile('public/kendince/catalog.json','utf8'));
setTextures(JSON.parse(await readFile('mannequin-review/textures.json','utf8')));
for(const [season,weather,budget] of [['autumn','cool',4500],['winter','cold',6000],['summer','warm',3500]]){
 const state={profile:{fit:'any'},owned:[],custom:[],hidden:[],feedback:{},priceNotes:{},seed:1,filters:{budget,season,weather,style:'all',occasion:'day',explore:35,availableOnly:true}};
 const outfits=generate(catalog.products,state,state.filters).outfits;
 const selected=season==='winter'?outfits:outfits.slice(0,1);
 for(const [i,outfit] of selected.entries())await writeFile('mannequin-review/look-'+season+'-'+i+'.svg',renderMannequin(outfit,{layerOpen:true,outerOpen:true}).match(/<svg[\s\S]*<\/svg>/)[0]);
 if(season==='winter'&&outfits.length)await writeFile('mannequin-review/look-winter-closed.svg',renderMannequin(outfits[0],{layerOpen:false,outerOpen:false}).match(/<svg[\s\S]*<\/svg>/)[0]);
}
