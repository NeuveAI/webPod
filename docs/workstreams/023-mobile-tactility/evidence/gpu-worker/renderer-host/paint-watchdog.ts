import assert from 'node:assert/strict';
import {GlobalRegistrator} from '../../../../../../packages/device/node_modules/@happy-dom/global-registrator';
import {createNativeScreenTransport} from '../../../../../../packages/composite/src/native-screen-transport';
import type {NativeElementImage} from '../../../../../../packages/device/src/native-element-image';
import type {NativePaintStamp} from '../../../../../../packages/device/src/device-render-protocol';
GlobalRegistrator.register();
const generation={epoch:1,rasterRevision:1,layoutRevision:1,visibilityRevision:1,width:960,height:720};
function fixture(){
 const canvas=document.createElement('canvas'),panel=document.createElement('div');canvas.append(panel);
 let captures=0,failures=0,closed=0;
 let sent:{stamp:NativePaintStamp;image:NativeElementImage}|null=null;
 Object.defineProperties(canvas,{transferControlToOffscreen:{value(){}},requestPaint:{value(){}},captureElementImage:{value(){captures++;return {width:640,height:480,close(){closed++;}};}}});
 const transport=createNativeScreenTransport({canvas,panel,generation,send(stamp,image){sent={stamp,image};},fail(){failures++;sent?.image.close();}});
 const paint=()=>canvas.dispatchEvent(new Event('paint'));
 paint();assert(sent);
 return {transport,paint,read:()=>({captures,failures,closed}),ack(){if(!sent)throw Error('No transferred image');sent.image.close();return transport.acknowledge(sent.stamp);},lateAck(){if(!sent)throw Error('No transferred image');return transport.acknowledge(sent.stamp);}};
}
try{
 const missing=fixture(),hidden=fixture(),disposed=fixture(),slow=fixture();
 hidden.transport.update({...generation,visibilityRevision:2},false);
 disposed.transport.dispose();disposed.ack();
 await new Promise<void>(resolve=>setTimeout(resolve,10000));
 assert.equal(slow.read().failures,0);assert(slow.ack());slow.transport.dispose();
 assert.equal(missing.read().captures,1);assert.equal(missing.read().failures,0);
 await new Promise<void>(resolve=>setTimeout(resolve,5500));
 assert.deepEqual(missing.read(),{captures:1,failures:1,closed:1});
 assert.deepEqual(hidden.read(),{captures:1,failures:1,closed:1});
 assert.equal(missing.lateAck(),false);missing.paint();assert.equal(missing.read().captures,1);
 assert.equal(disposed.read().failures,0);assert.equal(slow.read().failures,0);
 const evidence={method:'Actual15s transport watchdog with controlled native capture/worker retirement callbacks; no GPU timing claim.',checks:{missingAckRetires:true,lateAckCannotRevive:true,hiddenOutstandingImageBounded:true,disposeCancelsTimer:true,tenSecondUploadAccepted:true,noOverlappingRecoveryCapture:true}};
 await Bun.write(new URL('./paint-watchdog.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
}finally{GlobalRegistrator.unregister();}
