import {createEnemy, applyOperation, currentStep, armorLayers, OPS} from '../mathworld/engine.js?v=3';
export {OPS};
const clone=x=>structuredClone(x);
const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a)||1;
export function F(n,d=1){if(!d)throw new Error('Sıfıra bölme');const g=gcd(n,d);return {n:n/g*Math.sign(d),d:Math.abs(d/g)};}
const add=(a,b)=>F(a.n*b.d+b.n*a.d,a.d*b.d), mul=(a,b)=>F(a.n*b.n,a.d*b.d), neg=a=>F(-a.n,a.d);
export const textF=a=>a.d===1?`${a.n}`:`${a.n}/${a.d}`;
const z=()=>F(0), scalar=n=>[F(n)], trim=p=>{while(p.length>1&&!p.at(-1).n)p.pop();return p;};
const plus=(a,b)=>trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>add(a[i]||z(),b[i]||z())));
const scale=(p,f)=>trim(p.map(a=>mul(a,f)));
const derivative=p=>trim(p.length<2?[z()]:p.slice(1).map((a,i)=>mul(a,F(i+1))));
const integral=p=>[z(),...p.map((a,i)=>mul(a,F(1,i+1)))];
export function polynomial(p){let s='';for(let i=p.length-1;i>=0;i--){const a=p[i];if(!a.n)continue;const abs=F(Math.abs(a.n),a.d),coef=i&&abs.n===abs.d?'':(abs.d>1&&i?`(${textF(abs)})`:textF(abs)),pow=i===0?'':i===1?'x':i===2?'x²':i===3?'x³':`x^${i}`;s+=(s?(a.n<0?' − ':' + '):a.n<0?'−':'')+coef+pow;}return s||'0';}
export function discriminant(p){const a=p[2]||z(),b=p[1]||z(),c=p[0]||z();return add(mul(b,b),neg(mul(F(4),mul(a,c))));}
export function roots(p){p=trim(clone(p));if(p.length===1)return p[0].n?'∅':'ℝ';if(p.length===2)return `{${textF(mul(neg(p[0]),F(p[1].d,p[1].n)))}}`;const a=p[2],b=p[1],d=discriminant(p);if(d.n<0)return '∅';const sn=Math.sqrt(d.n),sd=Math.sqrt(d.d),den=mul(F(2),a);if(Number.isInteger(sn)&&Number.isInteger(sd)){const r=F(sn,sd),l=mul(add(neg(b),neg(r)),F(den.d,den.n)),h=mul(add(neg(b),r),F(den.d,den.n));return l.n===h.n&&l.d===h.d?`{${textF(l)}}`:`{${textF(l)}, ${textF(h)}}`;}return `{(−(${textF(b)}) ± √(${textF(d)})) / (${textF(den)})}`;}
export function makeBody(){return {p:scalar(5),mode:'value',form:'5',freeC:false,factored:false,scars:[],dead:false,reason:''};}
export function domain(body){if(body.dead)return body.reason;if(body.mode==='equation'||body.mode==='roots'){if(body.freeC)return 'C ∈ ℝ · parametrik';if(body.p.length===3)return `Δ = ${textF(discriminant(body.p))} · reel kök`;return 'Reel çözüm korunuyor';}if(body.freeC)return 'C ∈ ℝ · sabit belirlenmedi';return body.p.length===1?'Reel sayı · tanımlı':'x ∈ ℝ · tanımlı';}
function check(body){trim(body.p);if(!body.freeC&&(body.mode==='equation'||body.mode==='roots')){const noRoot=body.p.length===1&&body.p[0].n!==0||body.p.length===3&&discriminant(body.p).n<0;if(noRoot){body.dead=true;body.reason=body.p.length===3?`Δ = ${textF(discriminant(body.p))} < 0 · reel kök kalmadı`:'Çelişki · reel çözüm kalmadı';}}return body;}
const snapshot=b=>{const {scars,...s}=b;return clone(s);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const damageName=d=>d.label||`${{add:'+',sub:'−',mul:'×',div:'÷',der:'d/dx',int:'∫',seal:'= 0',factor:'Çarpanlara ayır',balance:'Çöz',forge:'+ (x² + 5x − 1)'}[d.op]||d.op}${['add','sub','mul','div'].includes(d.op)?d.term?`${d.value===1?'':d.value}${d.term}`:d.value:''}`;
function invert(d){if(d.op==='forge')return {op:'rebuild',value:0,label:'−(x² + 5x − 1)'};if(d.op==='seal')return {op:'balance',value:0,label:'Reel kökleri çöz'};return {...d,op:{add:'sub',sub:'add',mul:'div',div:'mul',der:'int',int:'der'}[d.op],label:null};}
export function repairHint(b){const s=b.scars.at(-1);return s?{...s.inverse,label:s.inverse.label||damageName(s.inverse),source:s.source}:null;}
function monomial(d){const p=scalar(d.value||1);if(d.term==='x')return [z(),F(d.value||1)];if(d.term==='x²')return [z(),z(),F(d.value||1)];return p;}
export function damage(body,d,source='Düşman'){const before=snapshot(body),form=body.form;body.factored=false;
 if(d.op==='div'&&!d.value){body.dead=true;body.reason='Sıfıra bölme · tanımsız beden';body.form=`(${form}) / 0`;return body;}
 if(d.op==='add'||d.op==='sub'){const p=monomial(d);body.p=plus(body.p,d.op==='sub'?scale(p,F(-1)):p);body.form=body.mode==='equation'||body.mode==='roots'?`${polynomial(body.p)} = 0`:`(${form}) ${d.op==='add'?'+':'−'} ${d.term?`${d.value===1?'':d.value}${d.term}`:d.value}`;}
 if(d.op==='mul'||d.op==='div'){body.p=scale(body.p,d.op==='mul'?F(d.value):F(1,d.value));body.form=body.mode==='equation'||body.mode==='roots'?`${polynomial(body.p)} = 0`:`(${form}) ${d.op==='mul'?'×':'/'} ${d.value}`;}
 if(d.op==='der'){body.p=derivative(body.p);body.freeC=false;body.form=polynomial(body.p);body.mode='value';}
 if(d.op==='int'){body.p=integral(body.p);body.freeC=true;body.form=`${polynomial(body.p)} + C`;body.mode='value';}
 if(d.op==='forge'){body.p=plus(body.p,[F(-1),F(5),F(1)]);body.form=polynomial(body.p);if(body.mode==='roots')body.mode='equation';if(body.mode==='equation')body.form+=' = 0';}
 if(d.op==='seal'){if(body.freeC)return damage(body,{op:'add',value:2},source);body.mode='equation';body.form=`${polynomial(body.p)} = 0`;}
 if(body.mode==='roots'&&['add','sub','mul','div'].includes(d.op))body.mode='equation';
 if(body.p.some(a=>!Number.isSafeInteger(a.n)||!Number.isSafeInteger(a.d)||Math.abs(a.n)>1e9||a.d>1e9)){Object.assign(body,before);return body;}
 const inverse=invert(d);if(d.op==='der')inverse.label=`∫ · f(0) = ${textF(before.p[0])}${before.freeC?' + C':''}`;
 body.scars.push({source,attack:clone(d),inverse,before});return check(body);
}
export function selfOperation(body,op,value=1,term=''){const last=body.scars.at(-1);if(last&&op===last.inverse.op&&(op==='rebuild'||op==='balance'||op==='int'||op==='der'||value===last.inverse.value&&(term||'')===(last.inverse.term||''))){
 if(op==='balance'){if(body.p.length>3||body.freeC)return {ok:false,note:'Bu formun köklerini bu bölümde çözemiyoruz.'};body.mode='roots';body.form=`x ∈ ${roots(body.p)}`;body.scars.pop();return {ok:true,repaired:true,note:`Reel çözüm kümesi korundu: ${body.form}.`};}
 const scars=body.scars.slice(0,-1);Object.assign(body,clone(last.before),{scars});return {ok:true,repaired:true,note:`${last.source} yarası geri alındı. Bedenin: ${body.form}.`};}
 if(op==='balance'&&(body.mode==='equation'||body.mode==='roots')&&body.p.length<=3&&!body.freeC){body.mode='roots';body.form=`x ∈ ${roots(body.p)}`;return {ok:true,repaired:true,note:'Tüm reel kökler korundu.'};}
 if(op==='factor'&&body.p.length===3){const d=discriminant(body.p);if(d.n<0)return {ok:false,note:'Reel çarpan yok.'};body.form=`${polynomial(body.p)}${body.mode==='equation'?' = 0':''} · kökler ${roots(body.p)}`;body.factored=true;return {ok:true,note:'Kökler görünür; Çöz ile çözüm kümesine geç.'};}
 if(!['add','sub','mul','div','der','int'].includes(op))return {ok:false,note:'Bu işlem bedenine uygulanamıyor.'};
 if((op==='mul'||op==='div')&&(value===1||term))return {ok:false,note:term?'Bu prototipte çarpma ve bölme sabit sayıyla yapılır.':'1 ile işlem yarayı onarmaz.'};
 damage(body,{op,value,term},'Kendi dönüşümün');return {ok:true,repaired:false,note:'Beden dönüştü. Yarayı onarmak için son işlemin tersini kullan.'};
}
const a=(form,ops,name,intents,type='stalker')=>({form,ops,name,intents,type,color:'#edb87d'});
const hit=(op,value,term='')=>({op,value,term});
const stages=[
 {name:'Sayı Ormanı',subtitle:'Ortaokul · ters işlemler',region:'forest',story:'Sen 5’sin. Burada can barı yok: bedenin, üzerindeki ifade. Bir yara aldığında kendi hamlende ters işlemi seç. Zaman yalnızca vuruş ve savunma sırasında akar.',enemies:[a('5 + 3',[hit('sub',3)],'Fazlalık',[hit('add',3)]),a('5 × 2',[hit('div',2)],'Katlayıcı',[hit('mul',2)])]},
 {name:'Kesir Geçidi',subtitle:'Ortaokul · işlem sırası',region:'forest',story:'Hasar burada kalıcı. Dıştaki işlemi önce sök: 2 × (5 + 2) için önce ÷2, sonra −2. Bölücü uzun savaşlarda ÷0 hazırlar; önceden görünen bu hamleyi durdur veya korun.',enemies:[a('2 × (5 + 2)',[hit('div',2),hit('sub',2)],'Katmanlı',[hit('add',2),hit('mul',2)]),a('5 / 2',[hit('mul',2)],'Bölücü',[hit('div',2)]),a('5 − 4',[hit('add',4)],'Eksiltici',[hit('sub',4)])]},
 {name:'Bilinmeyen Bahçesi',subtitle:'Lise kapısı · iki taraflı denge',region:'ruins',story:'Düşmana uyguladığın işlem denklemin iki tarafını değiştirir. Kendine uyguladığın işlem ise beden onarımıdır. Bilinmeyen +x ekler; Mühürcü ifadenin sıfıra eşit olmasını dayatır. Önce hangi niyeti durduracağını seç.',enemies:[{kind:'surplus',name:'Bilinmeyen',intents:[hit('add',1,'x')]},{kind:'fraction',name:'Mühürcü',intents:[{op:'seal'}]},{kind:'compound',name:'Çarpıcı',intents:[hit('mul',2)]}]},
 {name:'Kök Harabeleri',subtitle:'Lise · diskriminant ve ortak saldırılar',region:'ruins',story:'Derececi + (x² + 5x − 1) gönderir. Bedenin 5 ise x² + 5x + 4 olursun. Mühürcü =0 yaparsa iki reel kökün var. Ama sonraki sabit saldırısı Δ’yı negatife düşürebilir. İrrasyonel kökler hâlâ reeldir.',enemies:[{kind:'quadratic',name:'Derececi',intents:[{op:'forge'}]},{kind:'scaled',name:'Mühürcü',intents:[{op:'seal'}]},{kind:'subtraction',name:'Sabitçi',intents:[hit('add',4)]}]},
 {name:'Değişim Atölyesi',subtitle:'Üniversiteye bakış · türev ve integral',region:'forge',story:'Türev sabiti siler: onarım için hasar öncesindeki f(0) izi tutulur. İntegral ise serbest C üretir; C’yi yok saymıyoruz. Beden onarımının ipucunda hangi başlangıç değerinin kullanılacağı yazıyor.',enemies:[{kind:'polynomial',name:'Türevci',intents:[{op:'der'}]},{kind:'rational',name:'İntegralci',intents:[{op:'int'}]}]},
 {name:'Sıfırın Eşiği',subtitle:'Boss · diferansiyel denklem',region:'forge',story:'Bozuk Denklem, y′ + 2y = 6. İntegrasyon çarpanı e²ˣ ile başla; çarpım türevi, integral, bölme ve mühürleme. Genel çözümde C kalmalı. Boss her üçüncü turda ÷0 gönderir. Kalkan ve doğru zamanlama burada hayat kurtarır.',enemies:[{kind:'boss',name:'Bozuk Denklem',intents:[hit('add',2),{op:'int'}]},{kind:'surplus',name:'Sabitçi',intents:[hit('add',3)]}]}
];
export const STAGES=stages;
export function makeGame(seed=93411){return {version:2,seed,chapter:0,turn:1,ap:3,focus:2,ward:0,body:makeBody(),enemies:[],log:[],status:'intro',assist:false,checkpoint:null};}
function rng(g){g.seed=(g.seed*1664525+1013904223)>>>0;return g.seed/4294967296;}
export function log(g,message){g.log.unshift(message);g.log=g.log.slice(0,30);}
export function startEncounter(g){const stage=stages[g.chapter];g.turn=1;g.ap=3;g.ward=0;g.status='player';g.enemies=stage.enemies.map((e,i)=>{if(e.kind==='quadratic')return {...clone(e),id:i,form:'x² + 5x + 4 = 0',stage:0,resolved:false,type:'brute',color:'#caa6ef'};if(e.kind)return {...createEnemy(e.kind,0,0,i),...clone(e),resolved:false};return {...clone(e),id:i,stage:0,resolved:false};});g.checkpoint=clone(g.body);g.focus=Math.max(g.focus,2);plan(g);log(g,`${stage.name}: beden ${g.body.form}. Yaralar taşındı.`);}
export function enemyHint(e){if(e.kind==='quadratic')return e.stage===0?{op:'factor',value:0,label:'Çarpanlara ayır'}:{op:'balance',value:0,label:'İki kökü de çöz'};if(e.kind){const s=currentStep(e);return s?{...s,label:s.value===null?(e.kind==='boss'&&s.op==='mul'?'× e²ˣ':e.kind==='boss'&&s.op==='div'?'÷ e²ˣ':e.kind==='rational'&&s.op==='div'?'÷ (x − 2)':damageName(s)):null}:null;}return e.ops[e.stage]||null;}
export function layers(e){return e.resolved?0:e.kind==='quadratic'?2-e.stage:e.kind?armorLayers(e):(e.ops?.length??1)-(e.stage||0);}
export function plan(g){for(const e of g.enemies){if(e.resolved)continue;if(e.skip){e.intent={op:'rest',label:'Sendeledi · bu tur saldırmaz'};e.skip=false;continue;}let d=clone(e.intents[Math.floor(rng(g)*e.intents.length)]);if((e.name==='Bölücü'&&g.turn>=3||e.kind==='boss'&&g.turn%3===0||g.chapter===0&&g.turn>=5&&e.id===1))d={op:'div',value:0,label:'÷ 0 · tanımsızlık saldırısı'};if(d.op==='seal'&&g.body.freeC)d=hit('add',2);e.intent=d;e.cancelled=false;}}
export function forecast(g){const b=clone(g.body);return g.enemies.filter(e=>!e.resolved).map(e=>{if(!e.cancelled&&e.intent.op!=='rest')damage(b,e.intent,e.name);return {id:e.id,form:b.form,dead:b.dead,reason:b.reason};});}
export function attack(g,id,op,value=1,term='',quality='good'){if(g.status!=='player'||g.ap<1)return {ok:false,note:'Hamle hakkın kalmadı.'};const e=g.enemies.find(e=>e.id===id&&!e.resolved);if(!e)return {ok:false,note:'Bir düşman seç.'};let r;
 if(term)return {ok:false,note:'Düşman denklemlerine bu bölümde sabit sayılarla işlem uygula.'};
 if(e.kind==='quadratic'){const expected=enemyHint(e);if(expected.op!==op)r={ok:false,note:'Önce çarpanlara ayır; ardından iki kökü de çöz.'};else{e.stage++;e.form=e.stage===1?'(x + 4)(x + 1) = 0':'x ∈ {−4, −1}';r={ok:true,improved:true,complete:e.stage===2,note:e.stage===1?'Çarpanlar açığa çıktı.':'İki reel kök de korundu.'};}}
 else if(e.kind){r=applyOperation(e,op,value);r.note||=(r.reason==='too_large'?'Bu işlem fazla büyüdü.':'Bu form başka bir işlem istiyor.');}
 else{const expected=e.ops[e.stage];if(expected.op===op&&expected.value===value){e.stage++;e.form=e.stage===e.ops.length?'5':e.ops.length===2?'5 + 2':'5';r={ok:true,improved:true,complete:e.stage===e.ops.length,note:'Dış işlem söküldü.'};}else r={ok:false,note:'Katmanın ters işlemini ve sayısını seç.'};}
 g.ap--;if(r.complete){e.resolved=true;e.cancelled=true;g.focus=Math.min(5,g.focus+1);}else if(r.ok&&!r.unchanged&&r.improved!==false&&quality!=='miss'){e.cancelled=true;if(quality==='perfect')e.skip=true;}
 if(quality==='perfect'&&r.ok)g.focus=Math.min(5,g.focus+1);log(g,`${e.name} ← ${damageName({op,value})}: ${r.note}${e.cancelled&&!e.resolved?' Niyeti kesildi.':''}`);if(g.enemies.every(e=>e.resolved))g.status=g.chapter===stages.length-1?'victory':'clear';return r;
}
export function heal(g,op,value=1,term=''){if(g.status!=='player'||g.ap<1)return {ok:false,note:'Hamle hakkın kalmadı.'};const r=selfOperation(g.body,op,value,term);if(r.ok){g.ap--;log(g,r.note);if(g.body.dead)g.status='lost';}return r;}
export function guard(g){if(g.status!=='player'||g.ap<1||g.focus<1)return false;g.ap--;g.focus--;g.ward++;log(g,'Koruma: sıradaki bir saldırı bütünüyle engellenecek.');return true;}
export function receive(g,id,quality='miss'){const e=g.enemies.find(e=>e.id===id);if(!e||e.resolved||e.cancelled||e.intent.op==='rest')return 'skip';if(g.ward){g.ward--;log(g,`${e.name}: ${damageName(e.intent)} kalkanla engellendi.`);return 'ward';}if(quality==='perfect'||quality==='good'){if(quality==='perfect'){g.focus=Math.min(5,g.focus+1);e.skip=true;}log(g,`${e.name}: ${quality==='perfect'?'mükemmel savuşturma':'kaçınma'}.`);return 'blocked';}damage(g.body,e.intent,e.name);log(g,`${e.name} → ${damageName(e.intent)}. Beden: ${g.body.form}.`);if(g.body.dead){g.status='lost';log(g,g.body.reason);}return 'hit';}
export function nextTurn(g){if(g.body.dead)return;g.turn++;g.ap=3;g.status='player';plan(g);log(g,`Tur ${g.turn} · sıra sende.`);}
export function nextEncounter(g){if(g.status!=='clear')return false;g.chapter++;g.status='intro';return true;}
export function retry(g){g.body=clone(g.checkpoint);startEncounter(g);}
export function unlocked(g){return g.chapter<2?['add','sub','mul','div']:g.chapter<3?['add','sub','mul','div','balance']:g.chapter<4?['add','sub','mul','div','factor','balance']:OPS.map(o=>o.id);}
