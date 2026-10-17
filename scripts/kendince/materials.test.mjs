import test from 'node:test';
import assert from 'node:assert/strict';
import {materialInfo} from '../../public/kendince/materials.js';
import {canUse} from '../../public/kendince/engine.js';

test('mixed material identifies small synthetic fractions and separate lining declarations',()=>{
 for(const material of ['%97 Pamuk, %3 Elastan','99% Cotton, 1% Elastane','100% wool; Lining: 100% Polyester','57% Wool 22% Polyamide, 16% Polyester, 5% Other Fibers','Akrilik 100%','Suni Deri'])assert.equal(materialInfo({material}).status,'synthetic',material);
 assert.deepEqual(materialInfo({material:'99% cotton, 1% elastane'}).synthetics,['Elastan']);
});
test('qualitative names and unknown composition never become synthetic-free claims',()=>{
 for(const material of ['Kumaş belirtilmedi','Yünlü','Triko','Kumaş bileşimi kaynakta doğrulanamadı','Kendi parçan','100% Other fibers'])assert.equal(materialInfo({material}).status,'unknown',material);
 assert.equal(materialInfo({material:'100% Cotton'}).status,'natural');
 assert.equal(materialInfo({material:'100% Viscose'}).status,'cellulose');
 assert.equal(materialInfo({material:'100% cotton; lining: 100% viscose'}).status,'cellulose');
});
test('material declarations do not eliminate otherwise eligible synthetic products',()=>{
 const p={id:'poly',category:'top',material:'100% polyester',retailer:'Test',priceStatus:'verified',stock:{status:'available'},sizes:[]};
 assert.equal(materialInfo(p).status,'synthetic');
 assert.equal(canUse(p,{owned:[],profile:{}},{availableOnly:true}),true);
});
