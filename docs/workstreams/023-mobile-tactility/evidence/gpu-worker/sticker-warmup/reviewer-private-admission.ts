import assert from 'node:assert/strict';
import {acquirePrivateStickerTransaction,inspectStickerTransactions,releaseUnusedStickerTransactions} from '../../../../../../packages/device/src/sticker-transaction-broker';
import type {StickerDamageRequest} from '../../../../../../packages/device/src/sticker-transaction-data';
const input:StickerDamageRequest={kind:'damage',artworkKey:'pending-cap',stickerId:'pending-cap',mask:{width:256,height:256,pixels:new Uint8Array(256*256).fill(255)},surface:null};
const pending:Promise<unknown>[]=[],controllers:AbortController[]=[],ports:MessagePort[]=[];
let rejected=0;
for(let index=0;index<100;index++) {const channel=new MessageChannel(),controller=new AbortController();controllers.push(controller);ports.push(channel.port2);pending.push(acquirePrivateStickerTransaction('pending-cap',input,channel.port1,controller.signal,{purpose:'render-damage'}).then(lease=>lease.release(),()=>{rejected++;}));}
await Promise.resolve();const before=inspectStickerTransactions(),rejectedBeforeCancel=rejected;
for(const controller of controllers)controller.abort();await Promise.all(pending);for(const port of ports)port.close();await Bun.sleep(100);releaseUnusedStickerTransactions();
const result={requested:100,rejectedBeforeCancel,before,final:inspectStickerTransactions()};await Bun.write(new URL('./reviewer-private-admission.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
assert.ok(rejectedBeforeCancel>=68,'Private owner limit must include cold pending acquisitions');
