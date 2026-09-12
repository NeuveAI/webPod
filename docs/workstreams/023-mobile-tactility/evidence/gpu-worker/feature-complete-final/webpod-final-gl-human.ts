async function c(method,params={}){const r=await fetch('http://127.0.0.1:9348',{method:'POST',body:JSON.stringify({method,params})}).then(r=>r.json());if(r.error||r.result.exceptionDetails)throw Error(JSON.stringify(r));return r.result}
async function snap(){const r=await c('Runtime.evaluate',{expression:`(async()=>{const ts=await document.modelContext.getTools();const s=JSON.parse(await document.modelContext.executeTool(ts.find(t=>t.name==='webpod_device_state'),'{}'));return JSON.stringify({fiber:(() => {
 const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
 if (!hook?.getFiberRoots || !hook.renderers) return {available:false};
 const found=[]; let visited=0;
 const summary = geometry => geometry?.attributes?.position ? {uuid:geometry.uuid,count:geometry.attributes.position.count,first:Array.from(geometry.attributes.position.array.slice(0,3))} : null;
 for(const id of hook.renderers.keys()) for(const root of hook.getFiberRoots(id)) {
  const stack=[root.current];
  while(stack.length && visited++<25000) {
   const node=stack.pop();if(!node)continue;if(node.child)stack.push(node.child);if(node.sibling)stack.push(node.sibling);
   const p=node.memoizedProps;if(!p||typeof p!=='object')continue;
   if(p.art?.id==='PW-A01'||p.name==='sticker-PW-A01') {
    const object=node.stateNode?.object??node.stateNode;
    found.push({renderer:id,name:p.name??null,component:node.type?.name??null,rotation:p.placement?.rotationDeg??null,wear:p.wear??null,propGeometry:summary(p.geometry),mountedGeometry:summary(object?.geometry)});
   }
  }
 }
 return {available:true,visited,found};
})(),placed:s.stickers.placed.map(x=>x.placement),held:s.stickers.held,pending:s.stickers.pendingSaves,angle:document.querySelector('[data-contour-corner="1"] g[transform]')?.getAttribute('transform'),path:document.querySelector('[data-sticker-contour] path')?.getAttribute('d'),root:!!document.querySelector('[data-sticker-editor]'),alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent),inert:document.querySelector('[data-sticker-editor]')?.inert})})()`,awaitPromise:true,returnByValue:true});return JSON.parse(r.result.value)}
await c("Page.reload",{ignoreCache:true});await Bun.sleep(1000);for(let i=0;i<60;i++){const r=await c("Runtime.evaluate",{expression:"document.querySelector(\"[data-device-reveal]\")?.getAttribute(\"data-device-reveal\")===\"complete\"",returnByValue:true});if(r.result.value===true)break;await Bun.sleep(250)}await c("Runtime.evaluate",{expression:"(async()=>{const t=await document.modelContext.getTools();await document.modelContext.executeTool(t.find(x=>x.name===\"webpod_flick_ipod\"),JSON.stringify({face:\"back\"}))})()",awaitPromise:true});await Bun.sleep(1000);await c("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:116,y:318,id:1}]});await c("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await Bun.sleep(600);const before=await snap();if(!before.root)throw Error("editor not open");let moved;try{await c('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:251,y:223,id:1}]});for(let i=1;i<=6;i++){await c('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:251+i*3,y:223+i*4,id:1}]});await Bun.sleep(30)}await Bun.sleep(2000);moved=await snap()}finally{await c('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]})}await Bun.sleep(600);const after=await snap();const result={before:{root:before.root,inert:before.inert,angle:before.angle},movedAlerts:moved.alerts,movedAngle:moved.angle,beforeFiber:before.fiber,movedFiber:moved.fiber,movedContour:before.path!==moved.path,cancelRestoredContour:before.path===after.path,placementEqual:JSON.stringify(before.placed)===JSON.stringify(after.placed),held:after.held,pending:after.pending,after:{root:after.root,inert:after.inert}};await Bun.write('/tmp/webpod-final-gl-human.json',JSON.stringify(result,null,2));console.log(result);
