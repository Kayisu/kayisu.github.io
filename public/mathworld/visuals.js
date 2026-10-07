// Canvas art is independent of the equation engine and collision geometry.
const TAU=Math.PI*2;
const THEMES={
 classroom:{floor:'#203436',tile:'#293d3c',edge:'#152627',light:'#cfcb9c',accent:'#8bbaaa'},
 hub:{floor:'#293f30',tile:'#2d4433',edge:'#142b25',light:'#ead5a0',accent:'#9fb880'},
 forest:{floor:'#203b2b',tile:'#23402e',edge:'#10291f',light:'#b9d2a1',accent:'#79b88d'},
 ruins:{floor:'#2c3840',tile:'#303d46',edge:'#19262f',light:'#c6d3cb',accent:'#91b4bf'},
 forge:{floor:'#302435',tile:'#35283a',edge:'#1c1726',light:'#e7bcba',accent:'#ca89ad'}
};
export function createVisuals(ctx){
 const layers=new Map();
 let c=ctx;
 const noise=(n)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
 function poly(points,fill,stroke,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 function box(x,y,w,h,fill){c.fillStyle=fill;c.fillRect(x,y,w,h);}
 function line(x,y,u,v,color,width=1){c.beginPath();c.moveTo(x,y);c.lineTo(u,v);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 function ellipse(x,y,rx,ry,fill,stroke,width=1){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 function label(s,x,y,size,color){c.font=`${size}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(s,x,y);}
 function glow(x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color.slice(0,7)+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 function grass(x,y,s,color){for(let i=0;i<3;i++)line(x+(i-1)*s*.2,y,x+(i-1)*s*.6,y-s*(.6+noise(x+i)*.4),color,1.5);}
 function stone(x,y,s,color){ellipse(x+3,y+4,s,s*.46,'#07101644');poly([[x-s,y],[x-s*.6,y-s*.65],[x+s*.5,y-s*.6],[x+s,y],[x+s*.4,y+s*.3],[x-s*.7,y+s*.35]],color);line(x-s*.55,y-s*.5,x+s*.4,y-s*.5,'#cdd9c31c');}
 function lamp(x,y,color='#edd29a'){glow(x,y,70,color+'22');line(x,y+6,x,y+34,'#273e34',4);box(x-9,y-12,18,23,'#172e29');box(x-6,y-9,12,17,color);poly([[x-14,y-12],[x,y-22],[x+14,y-12]],'#475b42');line(x,y-9,x,y+8,'#836f47',2);}
 function ground(region,room){const t=THEMES[region];box(-70,-70,room.w+140,room.h+140,t.edge);box(48,100,room.w-96,room.h-165,t.floor);
  for(let y=105;y<room.h-65;y+=68)for(let x=52;x<room.w-50;x+=86){const n=noise(x+y*9);if(region==='forest'||region==='hub'){ellipse(x+42,y+30,34+n*25,22+n*13,n>.57?t.tile:t.floor);}else{box(x+2,y+2,82,64,n>.57?t.tile:t.floor);line(x+5,y+2,x+76,y+2,'#cfdbc00b');}if(n>.73)line(x+18,y+46,x+39,y+50,'#04191125');}
  if(region==='forest'){ellipse(700,570,230,185,'#5172410c');for(let i=0;i<14;i++){const x=140+noise(i+47)*(room.w-280),y=170+noise(i+102)*(room.h-270);ellipse(x,y,50+noise(i)*45,26+noise(i+6)*20,'#73915b09');}}
  // A low stone rim and clear floor edges keep the arena easy to read.
  for(let x=45;x<room.w-45;x+=62){box(x,91,59,14,'#48635c');box(x,105,59,12,'#10251e');box(x,room.h-68,59,15,'#48635c');line(x+3,94,x+54,94,'#a7b6a345');}
  for(let y=112;y<room.h-68;y+=61){box(42,y,14,58,'#364f45');box(room.w-56,y,14,58,'#364f45');}
  if(region==='forest'||region==='hub')for(let i=0;i<160;i++){const x=68+noise(i+5)*(room.w-136),y=128+noise(i+371)*(room.h-216);grass(x,y,5+noise(i)*7,t.accent+'42');if(i%8===0)stone(x,y,5+noise(i)*4,'#52694b');}
  if(region==='hub'){c.lineCap='round';c.strokeStyle='#68745b';c.lineWidth=70;c.beginPath();c.moveTo(350,650);c.quadraticCurveTo(750,770,1200,650);c.moveTo(750,690);c.quadraticCurveTo(745,450,790,280);c.stroke();c.lineCap='butt';for(let i=0;i<35;i++){const x=360+i*24,y=685+Math.sin(i*.11)*28;stone(x,y,8,'#829174');}}
  if(region==='classroom')for(let x=70;x<room.w-65;x+=70)line(x,120,x,room.h-80,'#a9c3a308');
  if(region==='forge'){for(let i=0;i<18;i++){const x=90+noise(i+27)*(room.w-180),y=130+noise(i+91)*(room.h-220);line(x,y,x+35,y+13,'#d393aa18');line(x+35,y+13,x+50,y-1,'#d393aa18');}}
  if(region==='ruins')for(let i=0;i<30;i++){const x=100+noise(i+31)*(room.w-200),y=140+noise(i+75)*(room.h-250);line(x,y,x+22,y+10,'#10192260');line(x+22,y+10,x+37,y+6,'#10192260');}
 }
 function classroom(){
  box(202,116,496,126,'#071b19');box(195,109,510,9,'#899379');box(195,109,9,139,'#69745c');box(696,109,9,139,'#4c5846');box(202,239,496,12,'#98a08a');
  box(213,129,474,100,'#1d3931');label('lim ?    ∫ ?    0 / 0',450,172,31,'#bed0b687');line(260,200,485,200,'#cbd4b12c',2);label('x → ?',593,208,17,'#cbd4b164');box(524,236,16,4,'#e7dabc');box(553,236,38,4,'#c3c8ad');
  for(const x of [108,716]){box(x-8,133,88,66,'#142722');box(x,140,72,49,'#728f88');box(x+5,145,27,36,'#c8cda97a');box(x+39,145,28,36,'#b7c6a560');line(x+36,141,x+36,189,'#475d50',5);line(x,163,x+72,163,'#475d50',4);poly([[x+5,200],[x+66,200],[x+135,510],[x+48,540]],'#d0d4a00a');}
  label('SINIF 0',450,646,15,'#bdc6a46b');for(let i=0;i<20;i++){const x=225+noise(i)*450,y=250+noise(i+80)*280;box(x,y,7+noise(i+41)*9,2,'#d4ddbd16');}
 }
 function tree(b){const {x,y,w,h}=b;ellipse(x+w*.57,y+h+12,w*.64,h*.3,'#05160f66');box(x+w*.32,y+h*.4,w*.3,h*.6,'#514d33');line(x+w*.46,y+h*.48,x+w*.46,y+h-4,'#92815a',4);poly([[x+w*.36,y+h*.5],[x+5,y+h*.65],[x+w*.3,y+h*.72]],'#534e32');
  const crowns=[[.2,.36,.36,'#244b35'],[.67,.32,.4,'#2b593a'],[.48,.03,.43,'#376846'],[.35,.27,.39,'#3d7047'],[.72,.16,.25,'#42764b']];for(const [a,d,r,color] of crowns){ellipse(x+w*a,y+h*d,w*r,h*r*.78,color);}
  for(let i=0;i<11;i++){const u=x+w*(.15+noise(i+x)*.68),v=y+h*(-.1+noise(i+y)*.57);line(u,v,u+10,v-3,'#8cad6633',2);}label('√',x+w*.49,y+h*.32,25,'#b7cc8780');grass(x+7,y+h+4,12,'#80975a');grass(x+w-3,y+h+1,10,'#80975a');
 }
 function house(b){const {x,y,w,h}=b;ellipse(x+w*.58,y+h+10,w*.64,h*.3,'#091a1466');box(x+5,y+24,w-10,h-24,'#a5a786');box(x+w*.75,y+22,w*.2,h-22,'#7b866a');box(x+9,y+h-12,w-18,12,'#68775b');
  poly([[x-7,y+35],[x+w*.5,y-20],[x+w+7,y+35]],'#526b55');poly([[x+w*.5,y-20],[x+w+7,y+35],[x+w*.66,y+35]],'#334f40');line(x-7,y+35,x+w+7,y+35,'#a6b391',3);for(let i=1;i<5;i++)line(x+w*.5,y-20+i*10,x+w-i*8,y+30,'#8ba27c35');
  box(x+w*.43,y+h-51,w*.23,51,'#263b2d');poly([[x+w*.43,y+h-51],[x+w*.54,y+h-62],[x+w*.66,y+h-51]],'#263b2d');box(x+w*.47,y+h-43,w*.15,43,'#557054');ellipse(x+w*.59,y+h-20,2,2,'#edce93');
  for(const a of [.13,.74]){box(x+w*a,y+50,w*.14,24,'#344a36');box(x+w*a+3,y+53,w*.14-6,18,'#d6c595');line(x+w*a+w*.07,y+53,x+w*a+w*.07,y+71,'#8a815c',2);}box(x+w*.78,y-4,15,31,'#53644d');grass(x,y+h,11,'#adc38b');
 }
 function column(b){const {x,y,w,h}=b;ellipse(x+w*.6,y+h+10,w*.68,h*.3,'#07141d77');box(x-5,y+h-12,w+10,17,'#556570');box(x+8,y+12,w-16,h-20,'#526471');box(x+8,y+12,w*.24,h-20,'#70818a');box(x+w*.65,y+12,w*.22,h-20,'#354854');box(x-3,y-8,w+6,25,'#78878a');line(x+3,y-5,x+w-3,y-5,'#b9c6b3',2);for(let i=1;i<4;i++)line(x+w*i/4,y+21,x+w*i/4,y+h-19,'#abc1bd33',2);poly([[x+w*.5,y-8],[x+w*.57,y+12],[x+w*.4,y+24],[x+w*.55,y+37]],null,'#273d49',2);label('∑',x+w*.5,y+h*.5,27,'#d2dfc78c');grass(x-5,y+h,11,'#879a75');
 }
 function desk(b){const {x,y,w,h}=b;ellipse(x+w*.6,y+h+9,w*.63,13,'#07171566');box(x+6,y+8,8,h+7,'#384839');box(x+w-15,y+8,8,h+7,'#384839');box(x,y-6,w,h,'#7b8063');box(x,y+h-10,w,10,'#515d48');line(x+3,y-4,x+w-3,y-4,'#bec2a1',2);box(x+15,y+3,28,19,'#dadbc0');line(x+19,y+8,x+37,y+8,'#657b6677');line(x+19,y+12,x+33,y+12,'#657b6677');box(x+w-35,y+7,20,6,'#315b50');box(x+w-32,y+11,23,6,'#a8ad7f');}
 function scenery(region,room){
  if(region==='classroom'){classroom();return;}
  const t=THEMES[region];for(const x of [88,room.w-88])for(const y of [155,room.h-105])lamp(x,y,region==='forge'?'#dca1be':t.light);
  if(region==='hub'){for(const [x,y] of [[750,755],[800,360],[425,658],[1115,678]])lamp(x,y);for(let i=0;i<25;i++){const x=120+noise(i+31)*(room.w-240),y=150+noise(i+18)*(room.h-280);if(x<170||x>1300)tree({x,y,w:55,h:70});}return;}
  const r=region==='forge'?355:290;ellipse(700,550,r,r,null,t.accent+'30',2);ellipse(700,550,r-23,r-23,null,t.accent+'17',1);
  for(let i=0;i<16;i++){const a=TAU*i/16,u=700+Math.cos(a)*r,v=550+Math.sin(a)*r;line(u,v,700+Math.cos(a)*(r-10),550+Math.sin(a)*(r-10),t.accent+'75',2);label(region==='forge'?['∫','C','y′','eˣ'][i%4]:['x','+','2','−'][i%4],700+Math.cos(a)*(r+25),550+Math.sin(a)*(r+25),19,t.accent+'45');}
  if(region==='forest'){for(let i=0;i<13;i++){tree({x:70+(i%2)*(room.w-180),y:210+Math.floor(i/2)*125,w:72,h:90});}label('SAYI ORMANI',700,181,23,'#bdcaa081');}
  if(region==='ruins'){for(const x of [125,1205])for(const y of [200,500,850])column({x,y,w:68,h:88});line(170,160,1230,160,'#81928f55',7);label('ÇARPAN HARABELERİ',700,192,23,'#cbd6c18c');}
  if(region==='forge'){glow(700,440,390,'#c778a01e');label('y′ + 2y = 6',700,186,52,'#e7b8ce77');label('B O Z U K   D E N K L E M',700,245,16,'#d3a9c281');for(let i=0;i<8;i++){const a=i*TAU/8;const x=700+Math.cos(a)*420,y=550+Math.sin(a)*400;stone(x,y,23,'#635064');ellipse(x,y-12,6,10,'#d79fba');glow(x,y-12,50,'#d98eaf25');}}
  box(640,1005,120,58,'#233f35');box(636,1000,128,6,'#89a28b');line(650,1057,750,1057,'#899d82',2);label('↓  KÖY',700,1031,17,'#c4d6b9');
 }
 function floor(region,room,blocks){const key=region+':'+room.w+':'+room.h;if(!layers.has(key)){
   const layer=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(room.w+140,room.h+140):document.createElement('canvas');layer.width=room.w+140;layer.height=room.h+140;
   c=layer.getContext('2d');c.translate(70,70);ground(region,room);scenery(region,room);for(const b of blocks)(region==='forest'?tree:region==='hub'?house:region==='classroom'?desk:column)(b);c=ctx;layers.set(key,layer);
  }ctx.drawImage(layers.get(key),-70,-70);
 }
 function atmosphere(region,room,now){const t=THEMES[region];c=ctx;const n=region==='classroom'?16:28;for(let i=0;i<n;i++){const x=70+((noise(i+7)*(room.w-140)+now*(region==='forge'?9:4))%(room.w-140)),y=140+noise(i+90)*(room.h-240)+Math.sin(now*.7+i)*14;const a=.13+(Math.sin(now*1.2+i)+1)*.14;ellipse(x,y,region==='forge'?1.4:1.8,region==='forge'?3:1.8,t.light+Math.round(a*255).toString(16).padStart(2,'0'));}
  if(region==='classroom')for(let i=0;i<4;i++){const x=300+i*115,y=265+Math.sin(now*.5+i)*16;label(['?','0','∞','/'][i],x,y,22,'#df93a442');}
 }
 function hero(p,op,now){c=ctx;const step=Math.sin(p.walk),bob=p.dash>0?0:step*1.4;ellipse(p.x,p.y+24,25,10,'#07151cc0');
  if(p.dash>0){for(let i=3;i>0;i--){const x=p.x-p.vx*i*13,y=p.y-p.vy*i*13;poly([[x-14,y-5],[x-23,y+20],[x+21,y+20],[x+13,y-6]],'#a8dfc3'+(30-i*6).toString(16).padStart(2,'0'));}}
  c.save();c.translate(p.x,p.y+bob);if(p.invul>0&&Math.floor(now*18)%2===0)c.globalAlpha=.75;
  const wx=Math.cos(p.face)*31,wy=Math.sin(p.face)*27,lookingBack=Math.sin(p.face)<-.25;
  if(lookingBack){line(wx*.5,wy*.5,wx,wy,op.color+'a0',4);label(op.symbol,wx,wy-9,op.id==='der'?17:28,op.color);}
  box(-11,15+step*2,8,12,'#263e35');box(4,15-step*2,8,12,'#263e35');box(-13,24+step*2,11,5,'#aeaa86');box(3,24-step*2,11,5,'#aeaa86');
  poly([[-12,-7],[-21,18],[-12,26],[0,22],[15,27],[21,18],[12,-7]],'#42695a','#9dbe9830');poly([[-11,-7],[-13,16],[0,20],[13,16],[11,-7]],'#e1dfbd');poly([[-12,-2],[-16,12],[-2,8],[7,-3]],'#7fa08c');line(-15,17,-7,20,'#c4cc9a',2);line(8,20,16,22,'#c4cc9a',2);box(-8,11,16,3,'#798363');ellipse(2,12,3,3,'#e9cd8b');
  line(-14,-2,-19,9,'#c5d0b4',6);line(14,-2,wx*.64,wy*.64+4,'#d3d4b6',6);ellipse(0,-14,16,17,'#425e51','#9eba9b',1);ellipse(0,-12,10,10,'#efd3a1');poly([[-16,-15],[-10,-29],[7,-31],[16,-18],[11,-9],[8,-19],[-8,-20],[-11,-9]],'#5b7b64');line(-8,-26,6,-28,'#a8ba91',2);if(!lookingBack){ellipse(-4,-13,1.3,1.7,'#304032');ellipse(4,-13,1.3,1.7,'#304032');line(-2,-7,2,-7,'#b79570');}box(-11,0,24,5,'#c4b37b');poly([[6,3],[16,5],[21,14],[11,10]],'#d7c48c');
  if(!lookingBack){line(wx*.5,wy*.5+4,wx,wy,op.color+'b0',4);ellipse(wx,wy-6,14,14,'#102922aa');label(op.symbol,wx,wy-6,op.id==='der'?17:29,op.color);}c.restore();
 }
 function companion(p,now){c=ctx;const y=p.y+Math.sin(now*3)*3;ellipse(p.x,p.y+20,18,7,'#08150e8c');line(p.x-6,y+10,p.x-10,y+20,'#bda46e',3);line(p.x+6,y+10,p.x+11,y+20,'#bda46e',3);ellipse(p.x,y,19,22,'#4d5840','#c4c18e',1.5);ellipse(p.x-4,y-5,12,14,'#7b8960');label('2',p.x,y-1,33,'#f2e0a3');ellipse(p.x+15,y-6,3,2,'#d9c8a0');if(p.pulse>0)ellipse(p.x,y,28,29,null,'#eedb9877',2);
 }
 function enemyBody(e,selected,layers=1){c=ctx;const r=e.radius,ink=e.stun>0?'#e9eee0':e.color;
  ellipse(0,r*.7,r*.9,r*.33,'#061117a6');glow(0,0,r*2,ink+'12');const n=Math.max(1,Math.min(7,layers));
  if(e.type==='brute'){poly([[-r*.95,-r*.55],[-r*.75,-r],[r*.67,-r],[r*.96,-r*.45],[r*.76,r*.75],[-r*.7,r*.75]],'#425466',ink+'bd',2);poly([[-r*.95,-r*.55],[-r*.75,-r],[-r*.27,-r*.85],[-r*.4,r*.64],[-r*.7,r*.75]],ink+'31');for(const side of [-1,1]){poly([[side*r*.7,-r*.25],[side*r*1.2,-r*.12],[side*r*1.3,r*.45],[side*r*.8,r*.58]],'#354954',ink+'8c',2);box(side*r*.53-6,r*.66,13,15,'#425668');}line(-r*.5,-r*.55,r*.2,-r*.43,ink+'66');}
  else if(e.type==='shooter'){ellipse(0,-3,r*.77,r*.92,'#384859',ink+'b8',2);for(const side of [-1,1]){poly([[side*r*.55,-r*.5],[side*r*1.25,-r*.17],[side*r*.97,r*.4],[side*r*.6,r*.6]],'#344957',ink+'8c',2);ellipse(side*r*.95,1,5,7,ink+'9c');}ellipse(-r*.16,-r*.25,r*.45,r*.5,ink+'26');}
  else if(e.type==='boss'){ellipse(0,0,r*.8,r*.82,'#4e354d',ink+'bb',2);for(let i=0;i<8;i++){const a=e.clock*.17+i*TAU/8,u=Math.cos(a)*r*1.1,v=Math.sin(a)*r*.75;poly([[u,v-8],[u+8,v],[u,v+8],[u-8,v]],i%2?'#786078':'#ba84a2',ink+'a0');}ellipse(0,0,r*1.25,r*.86,null,ink+'65',2);label('∂',0,2,r*.78,ink+'98');}
  else{poly([[0,-r*1.08],[r*.79,-r*.44],[r*.7,r*.45],[r*.28,r*.78],[0,r*.56],[-r*.32,r*.86],[-r*.78,r*.47],[-r*.72,-r*.49]],'#2d5650',ink+'c0',2);poly([[0,-r*1.08],[-r*.72,-r*.49],[-r*.78,r*.47],[-r*.32,r*.86],[-r*.22,-r*.43]],ink+'2a');}
  if(e.type!=='boss'){ellipse(-r*.22,-r*.12,4,2,ink);ellipse(r*.22,-r*.12,4,2,ink);label(e.algebra?'x':e.kind==='polynomial'?'∂':e.kind==='rational'?'÷':'x',0,r*.33,r*.5,ink+'9c');}
  for(let i=0;i<n;i++){const a=-Math.PI*.85+i*Math.PI*.27,u=Math.cos(a)*(r+11),v=Math.sin(a)*(r+9);poly([[u-3,v-2],[u+4,v-3],[u+3,v+3],[u-4,v+2]],ink+'75');}
  if(selected)ellipse(0,r*.78,r+15,(r+15)*.32,null,'#e6ddb263',1.5);
 }
 function rune(x,y,value,now){c=ctx;const b=Math.sin(now*3)*4;ellipse(x,y+15,24,8,'#07151499');glow(x,y,55,'#d6d58d23');poly([[x,y-28+b],[x+24,y-4+b],[x,y+20+b],[x-24,y-4+b]],'#cad6a322','#d9e0a28c',1.5);poly([[x,y-19+b],[x+16,y-4+b],[x,y+12+b],[x-16,y-4+b]],'#93b89140');label(String(value),x,y-3+b,28,'#eef0ba');}
 function projectile(x,y,r,color,vx,vy){c=ctx;const a=Math.atan2(vy,vx);poly([[x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(a+1.6)*r*.65,y+Math.sin(a+1.6)*r*.65],[x-Math.cos(a)*r*2.1,y-Math.sin(a)*r*2.1],[x+Math.cos(a-1.6)*r*.65,y+Math.sin(a-1.6)*r*.65]],color+'84');ellipse(x,y,r*.7,r*.7,color);ellipse(x-r*.15,y-r*.15,r*.28,r*.28,'#fff4d5');}
 function title(w,h,now){c=ctx;box(0,0,w,h,'#142d27');const x=w*.76,y=h*.47,r=Math.min(w*.25,h*.29);glow(x,y,r*1.6,'#a3c2a026');
  for(let i=0;i<4;i++)ellipse(x,y,r*(1+i*.2),r*(1+i*.2)*.75,null,i===0?'#a9c69a4c':'#a9c69a17',1.5);
  for(let i=0;i<16;i++){const a=i*TAU/16+now*.012;const u=x+Math.cos(a)*r*1.35,v=y+Math.sin(a)*r*1.02;label(['x','∫','∞','0','+','∂','2','C'][i%8],u,v,18+i%3*3,'#b9cba351');}
  for(let i=0;i<8;i++){const a=TAU*i/8+now*.025;line(x+Math.cos(a)*r*.35,y+Math.sin(a)*r*.35,x+Math.cos(a)*r*.8,y+Math.sin(a)*r*.7,'#cf9d9f62',2);}
  label('0 / 0',x,y-8,r*.62,'#e5b5ad');label('T A N I M S I Z',x,y+r*.35,13,'#d5bcb0a8');
  const t={x:x-r*.7,y:y+r*.93,walk:0,face:-.75,dash:0,invul:0};c.save();c.translate(t.x,t.y);c.scale(1.5,1.5);hero({...t,x:0,y:0},{symbol:'+',id:'add',color:'#b6d9ba'},now);c.restore();
  for(let i=0;i<30;i++){const u=w*.48+noise(i+12)*w*.5,v=noise(i+81)*h;ellipse(u,v+Math.sin(now+i)*4,1.5,1.5,'#dad4a044');}
 }
 return {floor,atmosphere,hero,companion,enemyBody,rune,projectile,title};
}
