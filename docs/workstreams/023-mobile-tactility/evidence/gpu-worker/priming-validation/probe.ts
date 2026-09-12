/** Offline expression generator only. The supervisor evaluates these through
 * its existing current-target connection; importing this file performs no I/O. */
export const installExpression = `(() => {
 const key='__webpodPrimingProbe';if(window[key])throw Error('Probe already installed');
 const state=()=>({phase:document.querySelector('[data-device-reveal]')?.getAttribute('data-device-reveal'),
 backend:document.querySelector('[data-renderer-effective]')?.getAttribute('data-renderer-effective'),
 failure:document.querySelector('[data-renderer-effective]')?.getAttribute('data-renderer-failure'),
 tier:document.querySelector('[data-composite-tier]')?.getAttribute('data-composite-tier'),
 stage:document.querySelector('[data-sticker-stage]')?.getAttribute('data-sticker-stage'),
 pack:!!document.querySelector('[data-sticker-collection]'),placed:document.querySelectorAll('[data-sticker-placed]').length,
 sticker:document.querySelector('[data-sticker-stage]')?Object.fromEntries([...document.querySelector('[data-sticker-stage]').attributes].filter(a=>a.name.startsWith('data-sticker-')).map(a=>[a.name,a.value])):null});
 const result={origin:performance.timeOrigin,start:performance.now(),end:null,firstRAF:null,frames:[],states:[],inputs:[],events:[],longTasks:[],longFrames:[],support:{},truncated:{},markers:[]};
 let raf=0,previous=null,last='',done=false;const observers=[];
 const push=(name,value,cap)=>{if(result[name].length<cap)result[name].push(value);else result.truncated[name]=true;};
 const record=()=>{const value=state(),serialized=JSON.stringify(value);if(serialized!==last){last=serialized;push('states',{t:performance.now(),...value},200);}};
 const frame=t=>{if(done)return;if(result.firstRAF===null)result.firstRAF=t;if(previous!==null)push('frames',t-previous,1800);previous=t;record();raf=requestAnimationFrame(frame);};
 const input=e=>{push('inputs',{type:e.type,t:performance.now(),stamp:e.timeStamp,id:e.pointerId,x:e.clientX,y:e.clientY,primary:e.isPrimary,trusted:e.isTrusted,target:e.target?.tagName,slot:e.target instanceof Element?e.target.closest('[data-sticker-slot]')?.getAttribute('data-sticker-slot'):null},400);};
 const kinds=['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'];for(const kind of kinds)document.addEventListener(kind,input,true);
 const take=(type,entries)=>{for(const e of entries){if(type==='event')push('events',{name:e.name,start:e.startTime,duration:e.duration,processingStart:e.processingStart,processingEnd:e.processingEnd,interactionId:e.interactionId},400);else if(type==='longtask')push('longTasks',{start:e.startTime,duration:e.duration},200);else push('longFrames',{start:e.startTime,duration:e.duration,blocking:e.blockingDuration,renderStart:e.renderStart,scripts:e.scripts?.map(s=>({duration:s.duration,executionStart:s.executionStart,invoker:s.invoker,sourceURL:s.sourceURL,sourceFunctionName:s.sourceFunctionName,forcedStyleAndLayoutDuration:s.forcedStyleAndLayoutDuration}))},200);}};
 for(const type of ['event','longtask','long-animation-frame']){try{const o=new PerformanceObserver(list=>take(type,list.getEntries()));o.observe(type==='event'?{type,durationThreshold:16}:{type});observers.push({type,o});result.support[type]=true;}catch{result.support[type]=false;}}
 const stop=()=>{if(!done){done=true;cancelAnimationFrame(raf);clearTimeout(timer);for(const {type,o}of observers){take(type,o.takeRecords());o.disconnect();}for(const kind of kinds)document.removeEventListener(kind,input,true);record();result.end=performance.now();}return result;};
 const timer=setTimeout(stop,25000);window[key]={stop,mark:label=>{if(!done)push('markers',{label:String(label).slice(0,80),t:performance.now(),...state()},30);}};record();raf=requestAnimationFrame(frame);return {start:result.start,origin:result.origin,state:state()};
})()`;
export const stopExpression = `(() => {const p=window.__webpodPrimingProbe;if(!p)return null;try{return p.stop();}finally{delete window.__webpodPrimingProbe;}})()`;
export const markerExpression = (label: 'before-open' | 'sheet-usable' | 'before-first-peel' | 'drop-confirmed') =>
  `window.__webpodPrimingProbe?.mark(${JSON.stringify(label)})`;
