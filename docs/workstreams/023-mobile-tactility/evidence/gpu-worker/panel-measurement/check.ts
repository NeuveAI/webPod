import assert from 'node:assert/strict'
import { Matrix4 } from '../../../../../../packages/composite/node_modules/three/build/three.module.js'
import { observeNativePanelDimensions } from '../../../../../../packages/composite/src/native-panel-measurement'
import { projectNativePanel } from '../../../../../../packages/composite/src/panel-projection'

const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),originalObserver=Object.getOwnPropertyDescriptor(globalThis,'ResizeObserver')
let hidden=false,width=321,height=239,widthReads=0,heightReads=0,callbacks=0,disconnected=0
const panel={get offsetWidth(){widthReads++;return width},get offsetHeight(){heightReads++;return height}} as HTMLElement
let delivered: ResizeObserverCallback|undefined,observedBox:ResizeObserverBoxOptions|undefined
class Observer {
 constructor(callback:ResizeObserverCallback){delivered=callback}
 observe(target:Element,options?:ResizeObserverOptions){assert.equal(target,panel);observedBox=options?.box}
 disconnect(){disconnected++}
}
Object.defineProperty(globalThis,'document',{configurable:true,value:{get hidden(){return hidden}}})
Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:Observer})
const fire=()=>delivered?.([{target:panel} as ResizeObserverEntry],{} as ResizeObserver)
const checks:string[]=[]
const check=(condition:boolean,label:string)=>{assert(condition,label);checks.push(label)}
let owner:ReturnType<typeof observeNativePanelDimensions>|null=null
let world=new Matrix4().makeRotationY(.2).toArray(),lastMatrix:readonly number[]|null=null
const projection={cameraProjection:new Matrix4().identity().toArray(),cameraWorld:new Matrix4().makeTranslation(0,0,300).toArray(),cssWidth:440,cssHeight:956,screenWidth:120,screenHeight:90,screenMaxZ:0}
const update=()=>{callbacks++;const size=owner?.read();if(size)lastMatrix=projectNativePanel({...projection,screenWorld:world,elementWidth:size.width,elementHeight:size.height}).toArray()}
try {
 owner=observeNativePanelDimensions(panel,update)
 check(widthReads===1&&heightReads===1&&observedBox==='border-box','initial actual integer offsets read once; border-box observation registered')
 for(let i=0;i<5000;i++)assert.deepEqual(owner.read(),{width:321,height:239})
 check(widthReads===1&&heightReads===1,'five thousand pose cache reads perform no measurements')
 fire();check(widthReads===2&&heightReads===2&&callbacks===0,'equal initial observer delivery refreshes without projecting')
 let comparisons=0
 for(const pair of [[320,240],[321,239],[327,247],[240,320],[1,1],[641,481]]){
  width=pair[0]??0;height=pair[1]??0;world=new Matrix4().makeRotationY(comparisons*.15).toArray();fire()
  const size=owner.read();assert(size)
  const expected=projectNativePanel({...projection,screenWorld:world,elementWidth:width,elementHeight:height}).toArray()
  assert.deepEqual(lastMatrix,expected);comparisons++
 }
 check(comparisons===6,'projection matrices exactly match prior integer-offset contract across six box/pose fixtures')
 const reads=widthReads,updates=callbacks;world=new Matrix4().makeRotationY(.7).toArray();owner.read()
 check(widthReads===reads&&callbacks===updates,'transform-only update has no measurement or observer-triggered projection')
 width=710;fire();check(callbacks===updates+1,'idle size change projects once with newest pose')
 width=0;fire();check(owner.read()===null,'zero/unboxed suspends projection')
 width=710;fire();check(owner.read()?.width===710&&callbacks===updates+2,'positive reentry restores same last dimensions and projects')
 hidden=true;owner.refresh();const beforeHidden=widthReads;fire();for(let i=0;i<100;i++)assert.equal(owner.read(),null)
 check(widthReads===beforeHidden,'hidden observations and pose traffic read no offsets')
 hidden=false;owner.refresh();check(widthReads===beforeHidden+1&&owner.read()?.width===710,'visible reentry reads once and restores availability')
 owner.dispose();const beforeDispose=widthReads;fire();owner.refresh();check(widthReads===beforeDispose&&owner.read()===null&&disconnected===1,'dispose disconnects and ignores stale delivered callbacks')
 width=0;owner=observeNativePanelDimensions(panel,update);const abort=new AbortController();let ready=false
 const waiting=owner.whenReady(abort.signal).then(()=>{ready=true});await Promise.resolve();check(!ready,'initial zero is not ready')
 width=320;fire();await waiting;check(ready,'first positive observer delivery releases readiness')
 owner.dispose();width=0;owner=observeNativePanelDimensions(panel,update);const cancelled=new AbortController();const rejected=owner.whenReady(cancelled.signal);cancelled.abort();await assert.rejects(rejected,{name:'AbortError'});checks.push('aborted first-box wait retires cleanly')
 const disposedWait=owner.whenReady(new AbortController().signal);owner.dispose();await assert.rejects(disposedWait,{name:'AbortError'});checks.push('disposed first-box wait rejects and releases listeners')
 const source=await Bun.file('packages/composite/src/device-render-host.ts').text()
 const adopt=source.slice(source.indexOf('  const adoptPose'),source.indexOf('  const dispose'))
 assert(!adopt.includes('offsetWidth')&&!adopt.includes('offsetHeight'));assert.equal((adopt.match(/stickers\?\.project\(\)/g)??[]).length,1)
 const transform=source.slice(source.indexOf('  const projectPanel'),source.indexOf('  const adoptPose'))
 assert(!transform.includes('applyPose')&&!transform.includes('stickers?.project')&&!transform.includes('carry?.project'));checks.push('host invalidation callback updates only transform; adoption preserves one downstream query/carry publication')
 const result={checks,widthReads,heightReads,matrixComparisons:comparisons,scope:'Counted offset getter and observer lifecycle fixtures; integer values are supplied, not browser CSS rounding measurements. Real route alignment/rounding remains lead runtime gate.'}
 await Bun.write(new URL('./check.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result)
} finally {
 owner?.dispose()
 if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document')
 if(originalObserver)Object.defineProperty(globalThis,'ResizeObserver',originalObserver);else Reflect.deleteProperty(globalThis,'ResizeObserver')
}
