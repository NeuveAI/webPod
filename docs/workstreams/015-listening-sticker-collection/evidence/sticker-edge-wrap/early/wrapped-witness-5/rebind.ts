const root='/Users/vinicius/code/webPod/',base=root+'docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/';
const hash=(s:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(s).digest('hex');
const old=await Bun.file(base+'wrapped-witness-4/candidates.json').json();
const previous=await Bun.file(base+'cold-inverse-matrix-1/build-provenance.json').json(), current=await Bun.file(base+'canvas-ray-matrix-1/build-provenance.json').json();
const changes=Object.keys({...previous.sourceAfter,...current.sourceAfter}).filter(k=>previous.sourceAfter[k]!==current.sourceAfter[k]);
const allowed=['packages/device/src/DeviceCanvas.tsx','packages/device/src/canvas-events.ts','packages/device/src/canvas-events.test.ts'];
if(changes.some(k=>!allowed.includes(k)))throw Error('Unexpected source change: '+changes);
for(const r of old.results){
 const prior=await Bun.file(r.capturePath).json();
 const path=base+`canvas-ray-matrix-1/matrix-${r.viewport.width}-${r.face}.json`, capture=await Bun.file(path).json();
 const matches=capture.submitted.candidates.filter(c=>c.rawBuffers.every(b=>old.bufferHashes[b.role]===b.sha256));
 if(matches.length!==2)throw Error('Source buffer mismatch');
 for(const c of matches)for(const b of c.rawBuffers)if(hash(new Uint8Array(b.bytes))!==b.sha256)throw Error('Actual raw buffer hash mismatch');
 if(JSON.stringify(matches[0].draw.matrices)!==JSON.stringify(prior.submitted.candidates[0].draw.matrices))throw Error('Camera/model/projection changed');
 if(JSON.stringify(matches[0].draw.canvasRect)!==JSON.stringify(r.rect))throw Error('Canvas rectangle changed');
 if(JSON.stringify(capture.seed)!==JSON.stringify(prior.seed)||JSON.stringify(capture.pose)!==JSON.stringify(r.pose))throw Error('Seed/pose changed');
 r.capturePath=path;r.captureSha256=hash(await Bun.file(path).text());r.build=capture.build;r.drawIds=matches.map(c=>c.draw.id);
 r.shellDrawCorrelation=r.shellDrawCorrelation.map(f=>({...f,draws:capture.submitted.recentDraws.filter(d=>d.bindings.position?.fnv1a===f.position.fnv1a&&d.bindings.position?.byteLength===f.position.byteLength).map(d=>({id:d.id,pass:d.pass,modelMatrix:d.matrices.modelMatrix,modelViewMatrix:d.matrices.modelViewMatrix,position:d.bindings.position}))}));
}
old.rebind={from:'wrapped-witness-4',changedSourcePaths:changes,scope:'Exact unchanged source geometry, actual submitted bytes, matrices, canvas rectangle, seed and pose. Pickup/partial/release/hidden/attached UV and admitted trajectory retained without point search. Prior trajectory timings are historical offline measurements, not new timing claims.'};
await Bun.write(base+'wrapped-witness-5/candidates.json',JSON.stringify(old,null,2));
