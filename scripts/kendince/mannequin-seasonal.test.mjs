import assert from 'node:assert/strict';
import {renderMannequin,setTextures} from '../../public/kendince/mannequin.js';

const product=(id,category,kind,extra={})=>({id,name:id,category,kind,family:'navy',fit:'regular',...extra});
const top=product('top','top','turtleneck',{family:'cream'}),bottom=product('bottom','bottom','chino'),shoe=product('shoe','shoe','boot',{family:'brown'});
const outfit=(...uppers)=>({id:'winter',items:[top,...uppers,bottom,shoe]});
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;}

const single=renderMannequin(outfit());
check(single.includes('data-garments="3"'),'single upper layer is supported');
check(single.includes('data-detail="turtleneck"'),'turtleneck has raised collar');
check(single.includes('data-detail="boot-shafts"'),'boots have a shaft');
check(single.includes('temsili renkler'),'missing textures are disclosed');
const mid=product('mid','top','cardigan',{slot:'layer',family:'olive'});
const two=renderMannequin(outfit(mid));
check(two.includes('data-garments="4"'),'two upper layers are included');
check(two.includes('data-garment="layer" data-kind="cardigan"'),'slot overrides source category');
check(two.indexOf('data-garment="top"')<two.indexOf('data-garment="layer"'),'middle layer sits above top');
const coat=product('coat','layer','coat',{slot:'outer',family:'brown'});
const three=renderMannequin(outfit(mid,coat));
check(three.includes('data-garments="5"'),'three upper layers are included');
check(three.indexOf('data-garment="layer"')<three.indexOf('data-garment="outer"'),'outer sits above middle layer');
check(three.includes('data-detail="lapels"'),'coat has lapels');
check(three.includes('378'),'coat extends past the hip');
const closed=renderMannequin(outfit(mid,coat),{layerOpen:true,outerOpen:false});
check(closed.includes('data-garment="layer" data-kind="cardigan" data-open="true"'),'middle opening remains independent');
check(closed.includes('data-garment="outer" data-kind="coat" data-open="false"'),'outer opening can be closed');
check(closed!==three,'closed outer produces different geometry');
for(const [kind,detail] of [['puffer','quilt'],['parka','hood'],['raincoat','shell-seams'],['blazer','lapels']]){
 const rendered=renderMannequin(outfit({...coat,kind}));
 check(rendered.includes(`data-detail="${detail}"`),`${kind} has a distinct construction`);
}
for(const [kind,detail] of [['hoodie','hood'],['knit','rib']])check(renderMannequin({...outfit(),items:[{...top,kind},bottom,shoe]}).includes(`data-detail="${detail}"`),`${kind} collar/hem is distinct`);
for(const [kind,detail] of [['loafer','loafer-vamp'],['derby','derby-laces']])check(renderMannequin({...outfit(),items:[top,bottom,{...shoe,kind}]}).includes(`data-detail="${detail}"`),`${kind} footwear is distinct`);
check(renderMannequin(outfit(product('old-layer','layer','shirt'))).includes('data-garment="layer"'),'old category-only saved layers remain supported');
check(renderMannequin({items:[top,bottom]})==='','incomplete look has no misleading mannequin');
const hostile=renderMannequin({id:'<bad" id>',items:[{...top,name:'<script>&"test"</script>'},bottom,shoe]});
check(!hostile.includes('<script>')&&hostile.includes('&lt;script&gt;&amp;&quot;test&quot;'),'names are XML escaped');
const ids=[...three.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
check(new Set(ids).size===ids.length,'each SVG definition ID is unique');
const nextIds=[...closed.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
check(!nextIds.some(id=>ids.includes(id)),'separate mannequins never collide');
for(const match of three.matchAll(/url\(#([^)]*)\)/g))check(ids.includes(match[1]),`reference ${match[1]} resolves`);
setTextures({products:{top:{color:'#eeeeee',texture:'data:image/jpeg;base64,YQ=='},coat:{color:'#778899',texture:'javascript:alert(1)'}}});
const textured=renderMannequin(outfit(mid,coat));
check(textured.includes('data-textured="1"')&&textured.includes('1/5 parça dokulu'),'coverage includes outerwear and footwear');
check(!textured.includes('javascript:'),'unsafe texture URLs are discarded');
setTextures({});
console.log(`Mannequin seasonal checks passed: ${checks}`);
