import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../public/mathworld/',import.meta.url).pathname;
const context=vm.createContext({Math,structuredClone}),modules=new Map();
async function module(path){path=path.split('?')[0];if(modules.has(path))return modules.get(path);const m=new vm.SourceTextModule(await fs.readFile(path,'utf8'),{context,identifier:path});modules.set(path,m);await m.link((spec,owner)=>module(new URL(spec,'file://'+owner.identifier).pathname));return m;}
const art=await module(root+'visuals-v4.js');await art.evaluate();const {layoutLabels,enemyProfile}=art.namespace;
const engine=await module(root+'engine.js');await engine.evaluate();const {createEnemy,applyOperation,armorLayers}=engine.namespace;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

// Three labels compete at the same point, including the screen edges and a body.
for(const w of [510,760,1180])for(const y of [-100,90,280,700]){
 const obstacle={x:w/2-40,y:140,w:80,h:90},bounds={x:0,y:0,w,h:360,obstacles:[obstacle]};
 const packed=layoutLabels([0,1,2].map(id=>({id,x:w/2,y,w:Math.min(300,w/2),h:47,selected:id===1})),bounds);
 assert.equal(packed[0].id,1);
 for(let i=0;i<packed.length;i++){const a=packed[i];assert(a.x>=0&&a.y>=0&&a.x+a.w<=w&&a.y+a.h<=360);assert(!overlap(a,obstacle),JSON.stringify({w,y,packed,obstacle}));for(let j=i+1;j<packed.length;j++)assert(!overlap(a,packed[j]));}
}
// A valid equivalence may add armor; a later inverse must restore its art state.
for(const kind of ['subtraction','chain','surplus','scaled','fraction','compound']){
 const e=createEnemy(kind,0,0,1),before=enemyProfile(e,armorLayers(e)),original=JSON.stringify(e.algebra);
 assert(applyOperation(e,'mul',2).ok);const changed=enemyProfile(e,armorLayers(e));assert.equal(changed.coefficient,before.coefficient*2);
 assert(applyOperation(e,'div',2).ok);assert.equal(JSON.stringify(e.algebra),original);assert.equal(JSON.stringify(enemyProfile(e,armorLayers(e))),JSON.stringify(before));
}
const e=createEnemy('scaled',0,0,1);assert.equal(armorLayers(e),1);applyOperation(e,'add',2);assert.equal(enemyProfile(e,armorLayers(e)).layers,2);
const polynomial=createEnemy('polynomial',0,0,2);assert.equal(enemyProfile(polynomial,armorLayers(polynomial)).degree,3);applyOperation(polynomial,'der',1);assert.equal(enemyProfile(polynomial,armorLayers(polynomial)).degree,2);
console.log('PASS V1 art: crowded labels avoid each other, bodies and screen edges; exact equivalent forms restore visual state; added terms and derivatives change the body.');
