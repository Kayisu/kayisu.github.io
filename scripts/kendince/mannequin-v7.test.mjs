import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMannequin,setTextures} from '../../public/kendince/mannequin.js';

const piece=(category,kind,extra={})=>({id:category+'-'+kind,name:kind,category,kind,family:'navy',fit:'regular',...extra});
const look=(bottom=piece('bottom','chino'),top=piece('top','tee'),extras=[])=>({id:'figure-test',items:[top,...extras,bottom,piece('shoe','sneaker')]});
const bottomPath=html=>html.match(/data-garment="bottom"[^>]*>[\s\S]*?<clipPath[^>]*><path d="([^"]+)"/)[1];

test('shorts end above the knee while full trousers keep their full length',()=>{
 const shorts=renderMannequin(look(piece('bottom','shorts'))),trousers=renderMannequin(look());
 assert.match(shorts,/data-length="short"/);
 assert.match(trousers,/data-length="full"/);
 assert.notEqual(bottomPath(shorts),bottomPath(trousers));
 assert.ok(!bottomPath(shorts).includes('554'));
 assert.ok(bottomPath(shorts).includes('393'));
 assert.ok(bottomPath(trousers).includes('554'));
 assert.doesNotMatch(shorts,/data-detail="leg-creases"/);
});

test('the three cuts create distinct outlines rather than relabeling the same trousers',()=>{
 const paths=['slim','regular','wide'].map(fit=>bottomPath(renderMannequin(look(piece('bottom','chino',{fit})))));
 assert.equal(new Set(paths).size,3);
 const shirt=renderMannequin(look(undefined,piece('top','shirt',{fit:'slim'})));
 assert.match(shirt,/data-detail="shirt-collar"/);
 assert.match(shirt,/data-detail="shirt-yoke"/);
});

test('garment construction remains visible across materials and layers',()=>{
 assert.match(renderMannequin(look(piece('bottom','jean'))),/data-detail="denim-seams"/);
 assert.match(renderMannequin(look(piece('bottom','corduroy'))),/data-detail="corduroy-wales"/);
 assert.match(renderMannequin(look(piece('bottom','cargo'))),/data-detail="cargo-pockets"/);
 assert.match(renderMannequin(look(piece('bottom','jogger'))),/data-detail="jogger-cuffs"/);
 assert.match(renderMannequin(look(undefined,piece('top','knit'))),/data-detail="knit-stitches"/);
 assert.match(renderMannequin(look(undefined,undefined,[piece('outer','blazer')])),/data-detail="tailoring"/);
});

test('studio figure and build options preserve explicit illustration limits',()=>{
 const regular=renderMannequin(look()),slender=renderMannequin(look(),{build:'slender'}),broad=renderMannequin(look(),{build:'broad'});
 assert.match(regular,/data-figure="atelier-v7"/);
 assert.match(regular,/data-detail="hands"/);
 assert.match(regular,/data-detail="male-figure-head"/);
 assert.match(regular,/data-detail="studio-plinth"/);
 assert.match(slender,/scale\(0\.91 1\)/);
 assert.match(broad,/scale\(1\.12 1\)/);
 assert.match(regular,/beden uyumu veya kumaş dökümü göstermez/);
});

test('new details preserve valid unique definitions and reject unsafe values',()=>{
 setTextures({products:{'top-tee':{color:'red"/><script>',texture:'javascript:alert(1)'}}});
 const html=renderMannequin(look(piece('bottom','corduroy',{fit:'wide" onload="alert(1)'})));
 assert.doesNotMatch(html,/javascript:|<script>| onload="alert/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const ref of html.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(ref[1]),ref[1]);
 setTextures({});
});

test('source-described motifs have distinct representative SVG patterns without a captured texture',()=>{
 const names={stripe:'Breton striped shirt',check:'Ekose gömlek',embroidery:'Embroidered floral overshirt',jacquard:'Jacquard knit',patchwork:'Patchwork jacket'};
 for(const [motif,name] of Object.entries(names)){
  const html=renderMannequin(look(undefined,piece('top','shirt',{name,patterned:true})));
  assert.match(html,new RegExp('data-motif="'+motif+'"'));
  assert.match(html,/temsili motif/);
  assert.match(html,/gerçek baskı, desen yerleşimi ve renkleri birebir göstermez/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  for(const ref of html.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(ref[1]),ref[1]);
 }
 const plain=renderMannequin(look(undefined,piece('top','shirt',{name:'Plain cotton shirt',patterned:false})));
 assert.doesNotMatch(plain,/representative-motif|data-motif/);
});

test('validated source textures take precedence over representative motifs',()=>{
 setTextures({products:{'top-shirt':{color:'#eeeeee',texture:'data:image/jpeg;base64,YQ=='}}});
 const html=renderMannequin(look(undefined,piece('top','shirt',{name:'Patchwork embroidered shirt',patterned:true})));
 assert.match(html,/data-textured="1"/);
 assert.doesNotMatch(html,/representative-motif|data-motif|temsili motif/);
 setTextures({});
});
