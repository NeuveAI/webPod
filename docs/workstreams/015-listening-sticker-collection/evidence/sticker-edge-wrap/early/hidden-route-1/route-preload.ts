// Evidence-only bounded pointer routing diagnostic; no product/source/build edits.
import { chromium } from '/Users/vinicius/code/webPod/apps/web/node_modules/@playwright/test'
const evidence = '/Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/hidden-route-1'
const witness = (await Bun.file('/Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/wrapped-witness-4/manifest.json').json())[0]
const launch = chromium.launch.bind(chromium)
chromium.launch = async options => {
  const browser = await launch(options)
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async options => {
    const context = await newContext(options)
    const newPage = context.newPage.bind(context)
    context.newPage = async () => {
      const page = await newPage()
      await page.addInitScript(() => {
        const records: unknown[] = []
        const label = (target: EventTarget | null) => target instanceof Element ? {tag:target.tagName,id:target.id,class:target.getAttribute('class')} : target === document ? 'document' : target === window ? 'window' : null
        const append = (value: unknown) => { records.push(value); if(records.length>600) records.shift() }
        const summarize = (e: PointerEvent) => ({type:e.type,x:e.clientX,y:e.clientY,id:e.pointerId,button:e.button,buttons:e.buttons,isPrimary:e.isPrimary,pointerType:e.pointerType,target:label(e.target),current:label(e.currentTarget),path:e.composedPath().map(label),prevented:e.defaultPrevented,cancelBubble:e.cancelBubble,offsetX:e.offsetX,offsetY:e.offsetY,phase:e.eventPhase,stage:document.querySelector('.webpod-device-preview__stage')?.getAttribute('data-orientation-grab'),carry:document.querySelector('[data-sticker-stage]')?.getAttribute('data-sticker-stage')})
        for(const name of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture']) for(const capture of [true,false]) document.addEventListener(name,e=>append({event:summarize(e as PointerEvent),capture}),capture)
        for(const name of ['stopPropagation','stopImmediatePropagation','preventDefault'] as const){const original=Event.prototype[name]; Event.prototype[name]=function(){if(this instanceof PointerEvent) append({method:name,event:summarize(this),stack:new Error().stack}); return original.call(this)}}
        for(const name of ['setPointerCapture','releasePointerCapture'] as const){const original=Element.prototype[name];Element.prototype[name]=function(id){append({method:name,id,target:label(this),stack:new Error().stack}); return original.call(this,id)}}
        Object.defineProperty(window,'__wrappedRouteDiagnostic',{value:{records,reset(){records.length=0},snapshot(x:number,y:number){return {records:records.slice(),elements:document.elementsFromPoint(x,y).map(label),active:label(document.activeElement),canvas:Array.from(document.querySelectorAll('canvas')).map(c=>({rect:c.getBoundingClientRect().toJSON(),hasCapture:c.hasPointerCapture(1)})),stage:document.querySelector('.webpod-device-preview__stage')?.outerHTML.slice(0,500)}}}})
      })
      let point={x:0,y:0}, diagnostic=false
      const move=page.mouse.move.bind(page.mouse),down=page.mouse.down.bind(page.mouse)
      page.mouse.down=async options=>{
        if(Math.hypot(point.x-witness.occluded.x,point.y-witness.occluded.y)<.01){diagnostic=true;await page.evaluate(()=> (window as any).__wrappedRouteDiagnostic.reset());await page.screenshot({path:evidence+'/before-hidden.png'})}
        await down(options)
      }
      page.mouse.move=async(x,y,options)=>{
        point={x,y}; await move(x,y,options)
        if(diagnostic && Math.hypot(x-witness.flickEnd.x,y-witness.flickEnd.y)<.01){
          const route=await page.evaluate(({x,y})=>(window as any).__wrappedRouteDiagnostic.snapshot(x,y),witness.occluded)
          await Bun.write(evidence+'/pointer-route.json',JSON.stringify({witness,route,scope:'Exact existing hidden sequence; stop after its final native movement, no product mutation or extra gesture'},null,2))
          await page.screenshot({path:evidence+'/after-hidden.png'})
          throw new Error('BOUNDED_ROUTE_CAPTURE_COMPLETE: stopped before full-suite hidden assertion')
        }
      }
      return page
    }
    return context
  }
  return browser
}
