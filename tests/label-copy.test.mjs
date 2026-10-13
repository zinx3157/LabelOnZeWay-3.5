import test from 'node:test';
import assert from 'node:assert/strict';
import {printedLabelData,savedLabelData} from '../src/domain/label-copy.js';
import {labelEscPos,manifestEscPos} from '../src/domain/escpos.js';
import {labelPdfBytes} from '../src/domain/pdf.js';
const parcel={id:'p',pickId:'131026-1',customer:{name:'Test',address:'Test address'},qty:2,unitPrice:22800,collect:45600,deliveryCharge:5000,printZeroAmounts:true};
test('zero label amounts preserve the financial manifest record',()=>{
 const before=structuredClone(parcel),printed=printedLabelData(parcel);assert.equal(printed.collect,0);assert.equal(printed.unitPrice,0);assert.equal(printed.deliveryCharge,0);assert.deepEqual(parcel,before);
 const thermal=new TextDecoder().decode(labelEscPos(parcel));assert.ok(thermal.includes('0 Ar'));assert.ok(!thermal.includes('45 600'));assert.ok(!thermal.includes('5000'));
 const manifest=new TextDecoder().decode(manifestEscPos([parcel]));assert.match(manifest,/COLLECT 45600 AR/);
 const pdf=new TextDecoder().decode(labelPdfBytes(parcel));assert.match(pdf,/COLLECT 0 AR/);assert.match(pdf,/DELIVERY 0 AR/);assert.ok(!pdf.includes('45600'));
});
test('saved label snapshot remains unchanged when manifest amounts are edited',()=>{
 const stored={...parcel,labelCopy:{parcel:printedLabelData(parcel),escposBase64:'saved'}};stored.collect=99999;stored.customer={name:'Edited'};assert.equal(savedLabelData(stored).collect,0);assert.equal(savedLabelData(stored).customer.name,'Test');assert.ok(!('labelCopy' in printedLabelData(stored)));
});
test('ordinary labels retain actual amounts',()=>{const printed=printedLabelData({...parcel,printZeroAmounts:false});assert.equal(printed.collect,45600);assert.equal(printed.deliveryCharge,5000);});
