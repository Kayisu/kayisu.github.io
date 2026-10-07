export const OPS = [
  {id:'add',symbol:'+',name:'Birleştir',color:'#70efd4',key:'1'},
  {id:'sub',symbol:'−',name:'Sök',color:'#ffbc72',key:'2'},
  {id:'mul',symbol:'×',name:'Katla',color:'#c6adff',key:'3'},
  {id:'div',symbol:'÷',name:'Böl',color:'#78caff',key:'4'},
  {id:'der',symbol:'d/dx',name:'Türev',color:'#f3e897',key:'5'},
  {id:'int',symbol:'∫',name:'İntegral',color:'#ff92c0',key:'6'},
  {id:'factor',symbol:'( )',name:'Çarpan',color:'#b5f487',key:'7'},
  {id:'balance',symbol:'=',name:'Dengele',color:'#ffffff',key:'8'}
];
const step=(form,op,value,next,note)=>({form,op,value,next,note});
export const FORMS={
  subtraction:{name:'Eksik',type:'stalker',color:'#67e9c9',core:10,steps:[step('x − 4 = 6','add',4,'x = 10','+4, denklemin iki tarafına işlendi.')],final:'x = 10'},
  chain:{name:'Katmanlı',type:'stalker',color:'#67e9c9',core:10,steps:[step('x − 2 − 3 − 4 = 1','add',4,'x − 2 − 3 = 5','−4 katmanı koptu.'),step('x − 2 − 3 = 5','add',3,'x − 2 = 8','−3 katmanı koptu.'),step('x − 2 = 8','add',2,'x = 10','Son katman dağıldı.')],final:'x = 10'},
  surplus:{name:'Fazlalık',type:'shooter',color:'#ffb46e',core:6,steps:[step('x + 3 = 9','sub',3,'x = 6','Her iki taraftan 3 çıkarıldı.')],final:'x = 6'},
  fraction:{name:'Yarım',type:'shooter',color:'#bdabff',core:8,steps:[step('x / 2 = 4','mul',2,'x = 8','İki taraf da 2 ile çarpıldı.')],final:'x = 8'},
  scaled:{name:'Kat',type:'brute',color:'#77caff',core:4,steps:[step('3x = 12','div',3,'x = 4','İki taraf da 3’e bölündü.')],final:'x = 4'},
  compound:{name:'Bileşik',type:'brute',color:'#bdabff',core:4,steps:[step('2(x + 3) = 14','div',2,'x + 3 = 7','Dış kabuk ikiye ayrıldı.'),step('x + 3 = 7','sub',3,'x = 4','İki taraftan 3 çıkarıldı.')],final:'x = 4'},
  polynomial:{name:'Polinom',type:'brute',color:'#f3e897',core:24,steps:[step('4x³ + 6x² − 12x + 9','der',null,'12x² + 12x − 12','Sabit terim buharlaştı.'),step('12x² + 12x − 12','der',null,'24x + 12','Bir derece daha küçüldü.'),step('24x + 12','der',null,'24','Doğal sayı çekirdeği açığa çıktı.')],final:'24'},
  rational:{name:'Kırık',type:'shooter',color:'#b5f487',core:1,steps:[step('(x² − 4) / (x − 2)','factor',null,'(x − 2)(x + 2) / (x − 2)','Farkın çarpanları ayrıldı. x ≠ 2.'),step('(x − 2)(x + 2) / (x − 2)','div',null,'x + 2','Ortak çarpan sadeleşti. x ≠ 2.'),step('x + 2','der',null,'1','Türev, doğal sayı çekirdeğini bıraktı.')],final:'1',domain:'x ≠ 2'},
  square:{name:'İkinci Derece',type:'stalker',color:'#f3e897',core:2,steps:[step('x² + 5x + 6','der',null,'2x + 5','İkinci derece zırhı kırıldı.'),step('2x + 5','der',null,'2','İkinci türev: 2.')],final:'2'},
  boss:{name:'Bozuk Denklem',type:'boss',color:'#ff92c0',core:3,steps:[step('y′ + 2y = 6','mul',null,'e²ˣy′ + 2e²ˣy = 6e²ˣ','İntegrasyon çarpanı e²ˣ, iki tarafa işlendi.'),step('e²ˣy′ + 2e²ˣy = 6e²ˣ','factor',null,'(e²ˣy)′ = 6e²ˣ','Çarpımın türevi, tek gövdede birleşti.'),step('(e²ˣy)′ = 6e²ˣ','int',null,'e²ˣy = 3e²ˣ + C','İntegral tamamlandı. Ama sabit hâlâ burada.'),step('e²ˣy = 3e²ˣ + C','div',null,'y = 3 + Ce⁻²ˣ','İki taraf e²ˣ’e bölündü. Genel çözüm korundu.'),step('y = 3 + Ce⁻²ˣ','balance',null,'y = 3 + Ce⁻²ˣ','Çözüm mühürlendi. C silinmedi; serbest sabit olarak kaldı.')],final:'y = 3 + Ce⁻²ˣ'}
};
export function currentStep(e){
 if(e.algebra){const {a,terms}=e.algebra;const term=terms.find(t=>t.n!==0),denominator=[a,...terms].find(t=>t.d>1);if(denominator)return {form:e.form,op:'mul',value:smallFactor(denominator.d)};if(term)return {form:e.form,op:term.n<0?'add':'sub',value:Math.min(9,Math.abs(term.n))};if(a.n!==a.d)return {form:e.form,op:'div',value:smallFactor(a.n)};return null;}
 return FORMS[e.kind]?.steps[e.stage]??null;
}
export function applyOperation(e,op,value){
 if(e.algebra)return transformEquation(e,op,value);
 const s=currentStep(e);if(!s)return {ok:false,reason:'resolved'};
 if(s.op!==op||(s.value!==null&&s.value!==value))return {ok:false,reason:'resisted',expected:s.op,operand:s.value};
 e.stage++;e.form=s.next;const complete=e.stage>=FORMS[e.kind].steps.length;
 return {ok:true,complete,form:e.form,note:s.note,spawnConstant:e.kind==='boss'&&op==='int'};
}
export const WAVES={
 forest:[['subtraction','surplus'],['chain','fraction','scaled'],['compound','chain','surplus']],
 ruins:[['square','scaled'],['polynomial','rational'],['polynomial','rational','compound']],
 forge:[['boss']]
};
export function createEnemy(kind,x,y,id){const f=FORMS[kind];const e={id,kind,x,y,stage:0,form:f.steps[0].form,radius:kind==='boss'?67:kind==='polynomial'?44:34,type:f.type,color:f.color,clock:0,phase:'approach',timer:0,cooldown:1+Math.random(),stun:0,resolved:false,invul:0,seed:Math.random()*10,trail:[]};
 const initial={subtraction:[1,[-4],6],chain:[1,[-2,-3,-4],1],surplus:[1,[3],9],fraction:[.5,[],4],scaled:[3,[],12],compound:[2,[6],14]}[kind];
 if(initial)e.algebra={a:initial[0]===.5?fraction(1,2):fraction(initial[0]),terms:initial[1].map(n=>fraction(n)),r:fraction(initial[2])};
 return e;
}

// Exact rational arithmetic keeps every alternative route equivalent.
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a||1;}
function smallFactor(n){for(let i=9;i>=2;i--)if(n%i===0)return i;return Math.min(9,Math.abs(n));}
export function fraction(n,d=1){const g=gcd(n,d);return {n:n/g*(d<0?-1:1),d:Math.abs(d/g)};}
const plus=(a,b)=>fraction(a.n*b.d+b.n*a.d,a.d*b.d);
const times=(a,b)=>fraction(a.n*b.n,a.d*b.d);
const str=a=>a.d===1?String(a.n):`${a.n}/${a.d}`;
const total=terms=>terms.reduce(plus,fraction(0));
export function equationForm(m){let s=m.a.n===m.a.d?'x':m.a.d===1?`${m.a.n}x`:`(${str(m.a)})x`;for(const t of m.terms){if(t.n)s+=` ${t.n<0?'−':'+'} ${str(fraction(Math.abs(t.n),t.d))}`;}return `${s} = ${str(m.r)}`;}
export function equationSolution(e){if(!e.algebra)return null;const m=e.algebra,b=total(m.terms);return times(plus(m.r,fraction(-b.n,b.d)),fraction(m.a.d,m.a.n));}
export function armorLayers(e){if(!e.algebra)return Math.max(0,(FORMS[e.kind]?.steps.length??1)-(e.stage??0));return e.algebra.terms.filter(t=>t.n).length+(e.algebra.a.n!==e.algebra.a.d?1:0);}
function transformEquation(e,op,value){
 if(!['add','sub','mul','div'].includes(op))return {ok:false,reason:'resisted'};
 if(!Number.isInteger(value)||value<1||value>9)return {ok:false,reason:'operand'};
 if((op==='mul'||op==='div')&&value===1)return {ok:true,unchanged:true,form:e.form,note:'1 ile işlem formu değiştirmez; zırh çözülmedi.'};
 const before=armorLayers(e),m=structuredClone(e.algebra);
 if(op==='add'||op==='sub'){
  const n=op==='add'?value:-value,t=fraction(n);const match=m.terms.findIndex(b=>b.n===-n*b.d);
  if(match>=0)m.terms.splice(match,1);else if(m.terms.length)m.terms=[plus(total(m.terms),t)].filter(b=>b.n);else m.terms=[t];m.r=plus(m.r,t);
 }else{const scale=op==='mul'?fraction(value):fraction(1,value);m.a=times(m.a,scale);m.terms=m.terms.map(t=>times(t,scale));m.r=times(m.r,scale);}
 // Reject excessive expression growth without corrupting the last valid form.
 if([m.a,m.r,...m.terms].some(t=>!Number.isSafeInteger(t.n)||!Number.isSafeInteger(t.d)||Math.abs(t.n)>1000000||t.d>1000000))return {ok:false,reason:'too_large'};
 e.algebra=m;e.form=equationForm(m);e.stage++;
 const complete=m.a.n===m.a.d&&total(m.terms).n===0&&m.r.d===1&&m.r.n>=0;
 if(complete)e.core=m.r.n;
 const improved=armorLayers(e)<before;
 return {ok:true,complete,improved,form:e.form,note:`${op==='add'?'+':op==='sub'?'−':op==='mul'?'×':'÷'}${value}, iki tarafa uygulandı. ${improved?'Bir zırh katmanı çözüldü.':'Denklem eşdeğer bir forma geçti.'}`,spawnConstant:false};
}

// A manual lock takes precedence. Free aim selects only bodies near the cursor;
// keyboard/controller users aim inside a forward cone with target hysteresis.
export function chooseTarget(enemies,player,{lockedId=null,previousId=null,aim=null,range=760}={}){
 const alive=enemies.filter(e=>!e.resolved&&Math.hypot(e.x-player.x,e.y-player.y)<=range);
 if(lockedId!==null)return alive.find(e=>e.id===lockedId)??null;
 if(aim){const ranked=alive.map(e=>({e,d:Math.hypot(e.x-aim.x,e.y-aim.y)})).filter(x=>x.d<=Math.max(60,x.e.radius+32)).sort((a,b)=>a.d-b.d);return ranked[0]?.e??null;}
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const ranked=alive.map(e=>({e,d:Math.hypot(e.x-player.x,e.y-player.y),a:Math.abs(wrap(Math.atan2(e.y-player.y,e.x-player.x)-player.face))})).filter(x=>x.a<1.15).map(x=>({...x,score:x.d+x.a*140-(x.e.id===previousId?55:0)})).sort((a,b)=>a.score-b.score);
 return ranked[0]?.e??null;
}
