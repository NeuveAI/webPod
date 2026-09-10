(async () => {
 const panel = document.querySelector('[role="application"]')
 if (!panel?.querySelector('[role="listbox"]')) throw new Error('Expected list view')
 const results = []
 for (const [speed, delay, delta] of [['slow',120,30],['medium',40,60],['fast',8,120]]) {
  let running = true, last = performance.now()
  const gaps = [], positions = new Set(), tasks = []
  const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e=>e.duration)))
  observer.observe({type:'longtask'})
  const frame = time => { if(!running)return;gaps.push(time-last);last=time;requestAnimationFrame(frame) }
  requestAnimationFrame(frame)
  performance.mark('scroll-'+speed+'-start')
  for(let i=0;i<36;i++) {
   if (!panel.querySelector('[role="listbox"]')) throw new Error('List changed during profile')
   panel.dispatchEvent(new WheelEvent('wheel',{deltaY:i<18?delta:-delta,bubbles:true,cancelable:true}))
   await new Promise(resolve=>setTimeout(resolve,delay))
   positions.add(panel.querySelector('[aria-selected="true"]')?.id)
  }
  await new Promise(resolve=>setTimeout(resolve,250))
  running=false;observer.disconnect();performance.mark('scroll-'+speed+'-end')
  gaps.sort((a,b)=>a-b)
  results.push({speed,selectedPositions:positions.size,frames:gaps.length,p95:gaps[Math.floor(gaps.length*.95)],max:gaps.at(-1),longTasks:tasks})
 }
 return results
})()
