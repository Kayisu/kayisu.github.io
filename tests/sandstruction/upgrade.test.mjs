import test from 'node:test';
import assert from 'node:assert/strict';
import {Terrain,CELL} from '../../public/sandstruction/terrain.js';
import {stepVehicle} from '../../public/sandstruction/physics.js';
import {MACHINES,machineModel} from '../../public/sandstruction/models.js';
import {readFileSync,existsSync} from 'node:fs';
const mass=t=>t.h.reduce((s,h)=>s+h*CELL*CELL,0);
function flat(){const t=new Terrain();t.h.fill(0);t.mat.fill(0);return t;}
function vehicle(){return{id:'truck',x:0,z:0,speed:0,angle:0,max:6};}
test('blade pushes gravel without losing volume, including near the map edge',()=>{
 for(const z of[-2,-46]){const t=flat();t.deposit(0,z,1.5,7,2);const before=mass(t);assert.ok(t.push(0,z,0,0,.5)>0);assert.ok(Math.abs(mass(t)-before)<.0001);assert.equal(t.mat[t.nearest(0,Math.max(-47,z-1.65))],2);}
});
test('asphalt ribbon is wide and conserves volume',()=>{const t=flat(),before=mass(t);assert.equal(t.ribbon(0,0,0,3.1,1.2,1.2),1.2);assert.ok(Math.abs(mass(t)-before-1.2)<.0001);assert.equal(t.mat[t.nearest(1,0)],3);assert.equal(t.mat[t.nearest(0,2)],0);});
test('tracks persist and legacy terrain saves migrate',()=>{const t=flat();t.track(0,0,.7);assert.deepEqual(t.marks,Terrain.restore(t.serialize()).marks);const old=t.serialize();delete old.marks;assert.ok(Terrain.restore(old).marks.every(v=>v===0));const invalid=t.serialize();invalid.marks[0]=-1;assert.throws(()=>Terrain.restore(invalid));});
test('empty bucket cannot change material',()=>{const t=flat();t.deposit(0,0,2,2,1);const before=t.serialize();assert.equal(t.dig(0,0,2,0).volume,0);assert.deepEqual(t.serialize(),before);});
test('vehicles brake, collide with parked machines, and reverse away',()=>{const t=flat(),v=vehicle(),other={id:'loader',x:0,z:-5};for(let i=0;i<300;i++)stepVehicle(v,{forward:true},t,[v,other],1/60);assert.ok(v.z>=-2.11);assert.ok(Math.hypot(v.x-other.x,v.z-other.z)>=2.899);const stopped=v.z;for(let i=0;i<100;i++)stepVehicle(v,{backward:true},t,[v,other],1/60);assert.ok(v.z>stopped);v.speed=4;stepVehicle(v,{brake:true},t,[],.05);assert.ok(v.speed<2.5);});
test('compacted sand provides more traction',()=>{const a=flat(),b=flat();a.mat.fill(1);b.mat.fill(1);b.compact.fill(1);const va=vehicle(),vb=vehicle();for(let i=0;i<160;i++){stepVehicle(va,{forward:true},a,[],1/60);stepVehicle(vb,{forward:true},b,[],1/60);}assert.ok(vb.speed>va.speed);assert.ok(vb.z<va.z);});
test('six models have finite geometry and proper wheel pivots',()=>{for(const def of MACHINES){const m=machineModel(def.id);let count=0;m.group.traverse(o=>{if(o.isMesh){count++;assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));}});assert.ok(count>8);if(def.id==='truck')assert.ok(m.wheels.every(w=>w.userData.spin&&w.userData.radius>0));}});
test('DOM lookups and local module imports resolve',()=>{const html=readFileSync(new URL('../../public/sandstruction/index.html',import.meta.url),'utf8'),js=readFileSync(new URL('../../public/sandstruction/game.js',import.meta.url),'utf8');const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));for(const m of js.matchAll(/\$\("([^"]+)"\)/g))assert.ok(ids.has(m[1]),m[1]);for(const file of['game.js','physics.js','nature.js','models.js','terrain.js']){const source=readFileSync(new URL('../../public/sandstruction/'+file,import.meta.url),'utf8');for(const m of source.matchAll(/from ["'](\.\/[^"']+)["']/g))assert.ok(existsSync(new URL('../../public/sandstruction/'+m[1].split('?')[0],import.meta.url)),m[1]);}});
