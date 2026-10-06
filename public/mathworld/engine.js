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
export function currentStep(e){return FORMS[e.kind]?.steps[e.stage]??null;}
export function applyOperation(e,op,value){
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
export function createEnemy(kind,x,y,id){const f=FORMS[kind];return {id,kind,x,y,stage:0,form:f.steps[0].form,radius:kind==='boss'?67:kind==='polynomial'?44:34,type:f.type,color:f.color,clock:0,phase:'approach',timer:0,cooldown:1+Math.random(),stun:0,resolved:false,invul:0,seed:Math.random()*10,trail:[]};}
