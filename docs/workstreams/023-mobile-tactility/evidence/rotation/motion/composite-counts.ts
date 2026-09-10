// Real source and Three math, fake renderer/DOM sizing; operation counts only.
import { GlobalRegistrator } from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import { Mesh, PlaneGeometry, MeshBasicMaterial, PerspectiveCamera, Scene } from '../../../../../../packages/composite/node_modules/three';
import { createScreenMeshHandle, type ScreenTransform } from '../../../../../../packages/device/src/screen-mesh';
import { HtmlInCanvasPixelSource } from '../../../../../../packages/composite/src/html-in-canvas';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
GlobalRegistrator.register();
const frames = new Map<number, FrameRequestCallback>(); let nextFrame = 0;
Reflect.set(globalThis, 'requestAnimationFrame', (callback: FrameRequestCallback) => {frames.set(++nextFrame,callback);return nextFrame;}); Reflect.set(globalThis, 'cancelAnimationFrame', (id:number) => frames.delete(id));
const resize: (()=>void)[]=[];
class Resize { constructor(callback:()=>void){resize.push(callback);} observe() {} disconnect() {} }
class Observer { observe() {} disconnect() {} }
Reflect.set(globalThis, 'ResizeObserver', Resize); Reflect.set(globalThis, 'MutationObserver', Observer);
const canvas = document.createElement('canvas'), panel = document.createElement('div'), content = document.createElement('div'); panel.append(content); document.body.append(canvas);
Object.defineProperties(content,{scrollWidth:{value:272},scrollHeight:{value:204}});
Reflect.set(canvas, 'requestPaint', () => {});
let layoutReads = 0, viewReads = 0, syncCalls = 0, viewportWidth = 440;
Object.defineProperties(canvas, { clientWidth: { get: () => { layoutReads++; return viewportWidth; } }, clientHeight: { get: () => { layoutReads++; return 956; } } });
Object.defineProperties(panel, { offsetWidth: { get: () => { layoutReads++; return 272; } }, offsetHeight: { get: () => { layoutReads++; return 204; } } });
const geometry = new PlaneGeometry(272,204), material = new MeshBasicMaterial(), mesh = new Mesh(geometry,material), scene = new Scene(); scene.add(mesh);
const camera = new PerspectiveCamera(30,440/956,.1,5000);camera.position.z=1000;camera.updateMatrixWorld();
const screen = createScreenMeshHandle({ mesh, panel: {width:320,height:240,scale:.85}, size:{width:272,height:204}, defaultMaterial:material, invalidate:()=>{}, view:()=>{viewReads++;return {camera,width:viewportWidth,height:956};} });
const source = new HtmlInCanvasPixelSource('dark');
const signatures:string[]=[];const original=source.syncGeometry.bind(source);
source.syncGeometry=(transform:ScreenTransform)=>{syncCalls++;signatures.push(JSON.stringify({matrix:transform.worldMatrix.elements,viewport:transform.viewport}));original(transform);};
const renderer={domElement:canvas,getPixelRatio:()=>1};
Reflect.apply(source.attach,source,[{kind:'webgl',renderer,camera,scene,panelElement:panel,screen}]);
layoutReads=0;viewReads=0;syncCalls=0;signatures.length=0;
for(let i=1;i<=60;i++) {
 mesh.rotation.y=i*Math.PI/180;
 // No per-commit resync: the screen callback owns the rendered projection.
 // Three updates scene matrices and then invokes the screen's callback.
 scene.updateMatrixWorld();
 Reflect.apply(mesh.onBeforeRender,mesh,[renderer,scene,camera,geometry,material,null]);
}
assert.equal(syncCalls,60);assert.equal(viewReads,120);assert.equal(layoutReads,240);
const poseCounts={syncCalls,viewReads,layoutReads};
const render=()=>Reflect.apply(mesh.onBeforeRender,mesh,[renderer,scene,camera,geometry,material,null]);
render();assert.equal(syncCalls,60,'identical rendered frame skips transform work');
camera.fov=32;camera.updateProjectionMatrix();render();assert.equal(syncCalls,61,'camera projection refreshes same-frame');
camera.position.x=15;camera.updateMatrixWorld();render();assert.equal(syncCalls,62,'camera pose refreshes same-frame');
viewportWidth=460;render();assert.equal(syncCalls,63,'viewport refreshes same-frame');
const previousTransform=panel.style.transform;
resize[1]?.();assert.equal(syncCalls,64,'canvas resize refreshes immediately');
Object.defineProperty(window,'devicePixelRatio',{configurable:true,value:2});
resize[0]?.();for(const callback of frames.values())callback(0);frames.clear();
assert.equal(canvas.dataset.wpRasterDensity,'2','DPR/content observer retains raster update');
assert.equal(panel.style.transform,previousTransform,'DPR leaves CSS hit transform unchanged');
assert(!readFileSync(new URL('../../../../../../packages/composite/src/CompositeDevice.tsx',import.meta.url),'utf8').includes('coordinator.resyncGeometry()'),'React bridge no longer repeats render sync');
const result={scenario:'60 changed pose renders after removing layout resync',...poseCounts,identicalFrameSkipped:true,cameraProjectionSameFrame:true,cameraPoseSameFrame:true,viewportSameFrame:true,resizeImmediate:true,DPRRasterAndHitParity:true,note:'Real source/Three operation counts with fake DOM sizing; not a browser trace or elapsed-time measurement.'};
console.log(JSON.stringify(result,null,2));
source.detach();geometry.dispose();material.dispose();await GlobalRegistrator.unregister();
