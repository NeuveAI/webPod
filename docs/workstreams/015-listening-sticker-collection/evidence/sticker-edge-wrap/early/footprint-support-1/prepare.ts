const root='/Users/vinicius/code/webPod/packages/device/src/',out=import.meta.dir+'/';
const absolute=(s:string)=>s.replace(/from 'three'/g,"from '/Users/vinicius/code/webPod/packages/device/node_modules/three'").replace(/from '\.\/([^']+)'/g,(_,p)=>`from '${root}${p}'`);
let cage=await Bun.file(root+'sticker-corner-cage.ts').text();
cage=cage.replace('  const { width, height: bodyHeight, cornerR } = DEVICE_LAYOUT.body;',`  const diagnostics={calls:0,minDepthResidual:Infinity,negativeDepthResiduals:0,maxEquationResidual:0,worstEquation:null as unknown,minReachedDot:Infinity,worstDirection:null as unknown};
  const { width, height: bodyHeight, cornerR } = DEVICE_LAYOUT.body;`);
cage=cage.replace('  const mapped = (depth: number, arc: number) => {',`  const recordDirection=(p:{nx:number;ny:number},depth:number,arc:number)=>{const dot=p.nx*nx+p.ny*ny;if(dot<diagnostics.minReachedDot){diagnostics.minReachedDot=dot;diagnostics.worstDirection={depth,arc,N:[nx,ny],normal:[p.nx,p.ny]};}};
  const mapped = (depth: number, arc: number) => {`);
cage=cage.replace('      const common = travel <= band ?', '      recordDirection(p,depth,arc);\n      const common = travel <= band ?');
cage=cage.replace('    if (depth < 0) { p.x += depth * nx;', '    if(depth>0)recordDirection(p,depth,arc);\n    if (depth < 0) { p.x += depth * nx;');
cage=cage.replace('    return mapped(distance, linearArc + residual * (q.arc - linearArc));',`    diagnostics.calls++;diagnostics.minDepthResidual=Math.min(diagnostics.minDepthResidual,nonlinearDepth);if(nonlinearDepth< -1e-7)diagnostics.negativeDepthResiduals++;
    const error=Math.abs(distance-origin-linearDepth-residual*nonlinearDepth);if(error>diagnostics.maxEquationResidual){diagnostics.maxEquationResidual=error;diagnostics.worstEquation={dx,dy,distance,origin,linearDepth,nonlinearDepth,residual};}
    return mapped(distance, linearArc + residual * (q.arc - linearArc));`);
cage=cage.replace('return { point: position, sample(', 'return { diagnostics, point: position, sample(');
await Bun.write(out+'instrumented-cage.ts',absolute(cage));
const wrap=absolute(await Bun.file(root+'sticker-wrap.ts').text()).replace(root+'sticker-corner-cage',out+'instrumented-cage');await Bun.write(out+'instrumented-wrap.ts',wrap);
await Bun.write(out+'source-hashes.json',JSON.stringify({cage:new Bun.CryptoHasher('sha256').update(await Bun.file(root+'sticker-corner-cage.ts').text()).digest('hex'),wrap:new Bun.CryptoHasher('sha256').update(await Bun.file(root+'sticker-wrap.ts').text()).digest('hex')},null,2));
