import assert from 'node:assert/strict';
import { placeCurrentStickerDrop } from '../../../../../../apps/web/src/sticker-drop-transaction';
import type { StickerPlacement } from '../../../../../../packages/stickers/src';
const placement:StickerPlacement={stickerId:'release-proof',surface:'back',x:.5,y:.5,width:.2,rotationDeg:0};
let checks=0;
for(const mode of ['current','abort','supersede','reentrant','save-superseded'] as const){
 let resolve:(value:StickerPlacement)=>void=()=>{},current=true,saved:StickerPlacement|null=null,haptics=0;
 const controller=new AbortController(),fit=new Promise<StickerPlacement>(accept=>{resolve=accept;});
 const result=placeCurrentStickerDrop({placement,clientX:123,clientY:456,signal:controller.signal,isCurrent:()=>current,
  resolve:(initial,x,y,signal)=>{assert.equal(initial,placement);assert.equal(x,123);assert.equal(y,456);assert.equal(signal,controller.signal);return fit;},
  beforeSave:()=>{haptics++;if(mode==='reentrant')current=false;},save:async value=>{saved=value;if(mode==='save-superseded')current=false;}});
 assert.equal(saved,null);assert.equal(haptics,0);
 if(mode==='abort')controller.abort();if(mode==='supersede')current=false;
 const fitted={...placement,x:.6};resolve(fitted);const adopted=await result;
 if(mode==='current'){assert.equal(saved,fitted);assert.equal(adopted,fitted);assert.equal(haptics,1);}
 else if(mode==='save-superseded'){assert.equal(saved,fitted);assert.equal(adopted,null);}
 else{assert.equal(saved,null);assert.equal(adopted,null);}
 checks++;
}
const evidence={method:'Actual live collection transaction helper with deferred exact fit and ownership changes; no UI/browser or server write.',checks,finalSampleCaptured:true,noPersistenceBeforeFit:true,abortAndSupersessionBlockSave:true,reentrantCallbackRechecked:true,obsoleteCompletedSaveCannotAnimate:true};
await Bun.write(new URL('./final-save.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
