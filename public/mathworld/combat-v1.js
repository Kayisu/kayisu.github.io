// V1's persistent body and advanced encounters. No dependency on the retired V2.
const clone=x=>structuredClone(x);
const symbols={add:'+',sub:'−',mul:'×',div:'÷'};
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1;}
const rational=(n,d=1)=>{const g=gcd(n,d);return {n:n/g*(d<0?-1:1),d:Math.abs(d/g)};};
const equal=(a,b)=>a.n===b.n&&a.d===b.d;
function arithmetic(a,op,v){return op==='add'?rational(a.n+v*a.d,a.d):op==='sub'?rational(a.n-v*a.d,a.d):op==='mul'?rational(a.n*v,a.d):rational(a.n,a.d*v);}
export function createBody(capacity=8){return {core:5,value:rational(5),form:'5',scars:[],capacity,charge:6,recharge:0,equation:null,denominator:null,domains:[],failure:null,serial:0};}
export function integrity(b){return Math.max(0,b.capacity-b.scars.length-(b.equation?2:0)-(b.denominator?1:0));}
export function bodyForm(b){return b.equation?equationText(b.equation):b.denominator?`(${b.form}) / d · d = ${b.denominator.value}`:b.form;}
export function discriminant(q){return q.b*q.b-4*q.a*(q.c-q.r);}
export function equationText(q){const sign=(n)=>`${n<0?'−':'+'} ${Math.abs(n)}`;return q.factored&&q.a===1&&q.b===5&&q.c-q.r===4?'(x + 4)(x + 1) = 0':`${q.a}x² ${sign(q.b)}x ${sign(q.c)} = ${q.r}`;}
export function checkBody(b){b.failure=null;if(b.denominator?.value===0)b.failure='Tanımsız: payda sıfır oldu.';else if(b.equation&&discriminant(b.equation)<0)b.failure='Reel çözüm kalmadı: Δ < 0.';else if(integrity(b)===0)b.failure='Bedenin bütün bozulma yuvaları doldu.';return b.failure;}
export function transformBody(b,op,v,{hostile=false,free=false}={}){
 if(!['add','sub','mul','div','factor','balance'].includes(op)||!Number.isInteger(v)||v<1||v>9)return {ok:false,note:'Bedende dört işlem, çarpan ve denge kullanılır.'};
 if(!hostile&&!free&&b.charge<1)return {ok:false,note:'Onarım odağı yenileniyor. Çekirdek topla veya köyde bekle.'};
 if(b.equation&&!hostile){const q=b.equation;
  if(op==='balance'){const x=-v;if(Math.abs(q.a*x*x+q.b*x+q.c-q.r)<1e-9){b.equation=null;if(!free)b.charge--;return {ok:true,healed:true,note:`x = ${x} eşitliği sağlıyor. Yabancı denklem çözüldü.`};}return {ok:false,note:`x = ${x}, bu eşitliğin kökü değil.`};}
  if(op==='factor'){q.factored=true;if(!free)b.charge--;return {ok:true,note:`Kökler −1 ve −4. =1 veya =4 ile bedeninden ayır. Δ = ${discriminant(q)}.`};}
  if(op==='add'||op==='sub'){const n=op==='add'?v:-v;q.c+=n;q.r+=n;q.factored=false;}else {const n=op==='mul'?v:1/v;q.a*=n;q.b*=n;q.c*=n;q.r*=n;q.factored=false;}
  if(!free)b.charge--;return {ok:true,note:'İşlem iki tarafa uygulandı; kökler değişmedi. = ile gerçek bir kökü seç.'};
 }
 if(b.denominator&&!hostile){if((op==='mul'&&v===b.denominator.value)||(op==='balance'&&v===b.denominator.value)){const d=b.denominator.value;b.domains.push(`d ≠ 0; d = ${d}`);b.denominator=null;if(!free)b.charge--;return {ok:true,healed:true,note:'Sıfır olmayan payda sadeleşti. d ≠ 0 koşulu korundu.'};}return {ok:false,note:`Payda d=${b.denominator.value}. ×${b.denominator.value} ile sadeleştir veya =${b.denominator.value} ile güvenli değeri mühürle.`};}
 if(!symbols[op])return {ok:false,note:'Sabit bedenin yarasını ters işlemle çöz.'};
 if((op==='mul'||op==='div')&&v===1)return {ok:false,note:'1 ile işlem bedeni değiştirmez.'};
 const next=arithmetic(b.value,op,v);if(!Number.isSafeInteger(next.n)||!Number.isSafeInteger(next.d)||Math.abs(next.n)>1000000||next.d>1000000||b.scars.length>=b.capacity&&!hostile)return {ok:false,note:'Form fazla büyüdü. Önce son yarayı geri çevir.'};
 const earlier=!hostile?b.scars.findIndex(s=>equal(s.value,next)):-1;
 if(earlier>=0){const s=b.scars[earlier];b.value=next;b.form=s.form;b.scars.splice(earlier);if(!free)b.charge--;return {ok:true,healed:true,note:'Ters işlem gerçek değeri geri getirdi. Yara çözüldü.'};}
 b.scars.push({value:clone(b.value),form:b.form,op,v});b.value=next;b.form=b.scars.length===1?`5 ${symbols[op]} ${v}`:`(${b.form}) ${symbols[op]} ${v}`;
 if(!hostile&&!free)b.charge--;checkBody(b);return {ok:true,healed:false,note:hostile?'Bedenine kalıcı bir işlem eklendi.':'İşlem doğru uygulandı ama yeni bir bozulma ekledi. Tersini kullanabilirsin.'};
}
export function repairHint(b){if(b.equation)return 'Reel kökü seç: =1 veya =4 (x = −katsayı). Çarpan aracı kökleri gösterir.';if(b.denominator)return `×${b.denominator.value} ya da =${b.denominator.value}: payda tuzağını çöz.`;const s=b.scars.at(-1);return s?`${({add:'−',sub:'+',mul:'÷',div:'×'})[s.op]}${s.v}: son yara için ters işlem.`:'Bedenin dengede: 5. Onarıma gerek yok.';}
export const ROLES={clutter:{name:'Yığmacı',color:'#ffbc72'},unreal:{name:'İrreelci',color:'#c6adff'},undefined:{name:'Tanımsızcı',color:'#ff92c0'}};
export function planIntent(role,b,id){
 if(role==='clutter')return Object.freeze({kind:'clutter',owner:id,op:b.scars.length%2?'mul':'add',value:b.scars.length%2?2:3,label:b.scars.length%2?'Bedenini ×2 katlayacak':'Bedenine +3 ekleyecek',lethal:integrity(b)<=1});
 if(role==='unreal')return b.equation?Object.freeze({kind:'erase-real',owner:id,target:b.equation.id,value:4,label:'Yalnız SOL sabite +4 · Δ: 9 → −7',lethal:true}):Object.freeze({kind:'forge-real',owner:id,label:'Bedenine x² + 5x + 4 = 0 bağlayacak',lethal:integrity(b)<=2});
 return b.denominator?Object.freeze({kind:'zero-denominator',owner:id,target:b.denominator.id,value:2,label:'Paydadan 2 çıkaracak · d: 2 → 0',lethal:true}):Object.freeze({kind:'forge-denominator',owner:id,label:'Bedenini d = 2 paydasına bağlayacak',lethal:integrity(b)<=1});
}
export function executeIntent(intent,b){
 if(intent.kind==='clutter')return transformBody(b,intent.op,intent.value,{hostile:true});
 if(intent.kind==='forge-real'){if(!b.equation)b.equation={a:1,b:5,c:4,r:0,id:++b.serial,factored:false};}
 else if(intent.kind==='erase-real'){if(b.equation?.id!==intent.target)return {ok:true,avoided:true,note:'Hedef denklem çözüldü. İlan edilen saldırı boşa düştü.'};b.equation.c+=intent.value;b.equation.factored=false;}
 else if(intent.kind==='forge-denominator'){if(!b.denominator)b.denominator={value:2,id:++b.serial};}
 else if(intent.kind==='zero-denominator'){if(b.denominator?.id!==intent.target)return {ok:true,avoided:true,note:'Hedef payda kaldırıldı. İlan edilen saldırı boşa düştü.'};b.denominator.value-=intent.value;}
 checkBody(b);return {ok:true,note:b.failure||'Yabancı yapı bedenine bağlandı. Sonraki saldırıdan önce çöz.'};
}
export function polynomialForm(p){const parts=[];for(let i=p.length-1;i>=0;i--){const n=p[i];if(!n)continue;parts.push(`${parts.length?(n<0?' − ':' + '):(n<0?'−':'')}${Math.abs(n)===1&&i?'':Math.abs(n)}${i===0?'':i===1?'x':`x${i===2?'²':'³'}`}`);}return parts.join('')||'0';}
export function polynomialAction(m,op,v){
 let p=[...m.p];if(op==='factor'){if(p.length===3&&p[2]===1&&p[1]===5&&p[0]===4){m.factored=true;m.form='(x + 4)(x + 1)';return {ok:true,note:'İki gerçek kök görünüyor. =1 veya =4 ile bir mührü çöz.'};}return {ok:false,note:'Bu form için türev yolunu kullan; her polinom bu çarpanlara ayrılmaz.'};}
 if(op==='balance'){const x=-v,root=p.reduce((s,n,i)=>s+n*x**i,0);if((m.factored&&Math.abs(root)<1e-9)||(!m.constant&&p.length===1&&p[0]>0&&Math.abs(p[0]-Math.round(p[0]))<1e-9))return {ok:true,complete:true,note:'Doğal çekirdek / doğrulanmış reel kök: mühür çözüldü.'};return {ok:false,note:'Önce çarpanla gerçek kökü aç veya türevle doğal çekirdeği çıkar.'};}
 if(op==='der')p=p.slice(1).map((n,i)=>n*(i+1));else if(op==='int'){if(p.length>=3)return {ok:false,note:'Bu arenada en çok ikinci derece integral taşınabilir.'};p=[0,...p.map((n,i)=>n/(i+1))];m.constant=true;}else if(op==='add')p[0]+=v;else if(op==='sub')p[0]-=v;else if(op==='mul')p=p.map(n=>n*v);else if(op==='div')p=p.map(n=>n/v);else return {ok:false,note:'Bu işlem burada kullanılamıyor.'};
 if(p.some(n=>!Number.isFinite(n)||Math.abs(n)>1000000))return {ok:false,note:'Katsayı sınırı aşıldı.'};if(op==='der')m.constant=false;while(p.length>1&&p.at(-1)===0)p.pop();if(!p.length)p=[0];m.p=p;m.factored=false;m.form=polynomialForm(p)+(m.constant?' + C':'');return {ok:true,note:op==='der'?'Türev gerçekten hesaplandı; sabitin türevi 0.':'Polinom gerçekten dönüştürüldü.'};
}
