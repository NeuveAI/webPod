() => {
 const canvas=document.querySelector('canvas[data-wp-render-backend="worker-webgpu"]');
 if(!canvas) return {error:'worker canvas missing'};
 const host=canvas.firstElementChild;
 const result={phase:'stationary',counts:{},started:performance.now()};
 const bucket=()=>result.counts[result.phase]??=( {paints:0,unknown:0,styleMutations:0,elements:{}} );
 const listener=e=>{const b=bucket();b.paints++;if(!e.changedElements?.length)b.unknown++;for(const el of e.changedElements??[]){const identity=el===canvas?'canvas':el===host?'host':el===host.firstElementChild?'panel':host.contains(el)?'descendant':'outside';const key=identity+':'+el.tagName+':'+String(el.className).slice(0,150);b.elements[key]=(b.elements[key]??0)+1;}};
 const observer=new MutationObserver(records=>{bucket().styleMutations+=records.length});
 canvas.addEventListener('paint',listener);observer.observe(host,{attributes:true,attributeFilter:['style']});
 const stop=()=>{canvas.removeEventListener('paint',listener);observer.disconnect();clearTimeout(timer);result.stopped=performance.now();return result;};
 const timer=setTimeout(stop,55000);
 window.__wpPaintObservation={result,stop};return {installed:true,timeoutMs:55000};
}
