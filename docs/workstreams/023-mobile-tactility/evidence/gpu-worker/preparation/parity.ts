import {mkdtempSync,writeFileSync,symlinkSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {prepareDeviceSteps,restorePreparedDevice,preparedDeviceBuffers,disposePreparedDevice} from '../../../../../../packages/device/src/device-preparation-data';
import {DEFAULT_DEVICE_FORM} from '../../../../../../packages/device/src/form';
import {drainSteps,yieldSteps} from '../../../../../../packages/device/src/sticker-computation-steps';
import {transferShell} from '../../../../../../packages/device/src/immutable-shell-transfer';
import type {BufferGeometry,DataTexture} from 'three';
const temporary=mkdtempSync(join(tmpdir(),'webpod-preparation-parity-'));
// Immutable pre-CPU-006 reference. Never use HEAD: post-commit verification
// must continue comparing against the old implementation and all its helpers.
const base='1e11d02b4b0a74f3e03a34d9c19aaf931fb77ec2';
const archive=execFileSync('git',['archive',base,'packages/device/src'],{maxBuffer:32*1024*1024});
execFileSync('tar',['-x','-C',temporary],{input:archive});
const source=join(temporary,'packages/device/src');
symlinkSync(resolve('packages/device/node_modules'),join(temporary,'packages/device/node_modules'));
const hash=(data:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
function geometry(geometry:BufferGeometry){geometry.computeBoundingBox();geometry.computeBoundingSphere();const value=transferShell(geometry);return {...value,attributes:Object.fromEntries(Object.entries(value.attributes).map(([key,value])=>[key,{...value,array:hash(value.array)}])),index:value.index?hash(value.index):null};}
const same=(label:string,a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`Mismatch ${label}`);};
// Evaluate the original dense pixel loop verbatim, without replacing browser glyph raster.
const oldBackplate=readFileSync(join(source,'backplate-finish.ts'),'utf8');
const loop=oldBackplate.slice(oldBackplate.indexOf('  const pixels = context.createImageData'),oldBackplate.indexOf('  context.putImageData'));
const reference=oldBackplate.slice(0,oldBackplate.indexOf('export function createBackplateFinishMaps'))+`\nexport function referencePixels(){const {width,height}=DEVICE_LAYOUT.body;const canvas={width:1024,height:2048};const context={createImageData:(width:number,height:number)=>({data:new Uint8ClampedArray(width*height*4)})};${loop}return pixels.data;}`;
writeFileSync(join(source,'backplate-reference.ts'),reference);
// Extract the prior Device useMemo bodies independently; the comparison must
// not use the newly moved factory as its own reference.
const originalDevice=execFileSync('git',['show',`${base}:packages/device/src/Device.tsx`],{encoding:'utf8'});
const between=(start:string,end:string)=>{const a=originalDevice.indexOf(start);if(a<0)throw Error(`Missing baseline ${start}`);const b=originalDevice.indexOf(end,a+start.length);if(b<0)throw Error(`Missing baseline ${end}`);return originalDevice.slice(a+start.length,b);};
const controlBody='    const controlForm'+between('  } = useMemo(() => {\n    const controlForm','\n  }, [\n    form.seamWidth');
const header=`import {ExtrudeGeometry,ShapeGeometry} from 'three';
import type {DeviceFormParams} from './form';
import {createFrontControlPatchGeometry,createWheelGapFloorGeometries} from './front-control-geometry';
import {SELECT_CONCAVITY,WHEEL_OUTER_SEAM_WIDTH} from './front-surface';
import {DEVICE_LAYOUT,SCREEN_CORNER_R} from './layout';
import {DEVICE_SURFACE_LAYOUT} from './surface-layout';
import {roundedRectShape,roundedRectFrameShape} from './shapes';
import {createScreenGeometry} from './screen-geometry';
const {wheel,screen}=DEVICE_LAYOUT;
const {glass,mask,displayWell}=DEVICE_SURFACE_LAYOUT.front;`;
let originalInsert=`${header}\nexport function createDeviceInsertGeometry(form:DeviceFormParams){const controls=(()=>{${controlBody}})();\n`;
for(const [name,end] of [['glassGeometry','  }, []);'],['displayMaskGeometry','  }, []);'],['displayWellGeometry','  }, [form.displayWellDepth, form.displayWellInset]);']]){originalInsert+=`const ${name}=(()=>{${between(`  const ${name} = useMemo(() => {`,end??'')}})();\n`;}
originalInsert+='const screenGeometry=createScreenGeometry(screen.width,screen.height,SCREEN_CORNER_R);return {...controls,glassGeometry,displayMaskGeometry,displayWellGeometry,screenGeometry};}';
writeFileSync(join(source,'device-insert-geometry.ts'),originalInsert);
const oldShells=await import(join(source,'immutable-shells.ts'));
const oldHardware=await import(join(source,'hardware-geometry.ts'));
const oldTextures=await import(join(source,'textures.ts'));
const oldInserts=await import(join(source,'device-insert-geometry.ts'));
const data=drainSteps(prepareDeviceSteps(DEFAULT_DEVICE_FORM));
const restored=restorePreparedDevice(data);
const shells=oldShells.createImmutableShells(DEFAULT_DEVICE_FORM);for(const key of ['front','back'] as const)same(key,geometry(restored[key]),geometry(shells[key]));
const inserts=oldInserts.createDeviceInsertGeometry(DEFAULT_DEVICE_FORM) as Record<string,BufferGeometry>;
for(const [key,value] of Object.entries(restored.inserts)){const old=inserts[key];if(!old)throw Error('Missing insert');same(key,geometry(value),geometry(old));}
const hardware=oldHardware.createHardwareGeometry(DEFAULT_DEVICE_FORM) as {name:string;material:string;geometry:BufferGeometry}[];
same('hardware',restored.hardware.map(part=>({...part,geometry:geometry(part.geometry)})),hardware.map(part=>({...part,geometry:geometry(part.geometry)})));
const aluminum=oldTextures.createAluminumFinishMaps();const noise=oldTextures.createMicroNoiseRoughnessMap();noise.repeat.set(.04,.04);const steel=oldTextures.createSteelAnisotropyMap();steel.repeat.set(.02,.02);
const oldMaps:Record<string,DataTexture>={noise,steel,aluminumColor:aluminum.color,aluminumHeight:aluminum.height,aluminumRoughness:aluminum.roughness};
for(const [key,value] of Object.entries(restored.textures)){const old=oldMaps[key];if(!old)throw Error('Missing texture');same(key,hash(value.image.data),hash(old.image.data));for(const field of ['colorSpace','wrapS','wrapT','minFilter','magFilter','flipY','premultiplyAlpha','anisotropy','generateMipmaps','unpackAlignment','format','type'] as const)same(`${key}.${field}`,value[field],old[field]);same(`${key}.repeat`,value.repeat.toArray(),old.repeat.toArray());}
const pixels=await import(join(source,'backplate-reference.ts'));same('backplate base pixels',hash(data.backplatePixels),hash(pixels.referencePixels()));
const samples:number[]=[];let steps=0;const iterator=prepareDeviceSteps(DEFAULT_DEVICE_FORM);
for(;;){const start=performance.now(),result=iterator.next();samples.push(performance.now()-start);steps++;if(result.done)break;}
let heartbeat=0;const timer=setInterval(()=>heartbeat++,0);const cooperative=await yieldSteps(prepareDeviceSteps(DEFAULT_DEVICE_FORM),new AbortController().signal);clearInterval(timer);
same('cooperative front',geometry(restorePreparedDevice(cooperative).front),geometry(restored.front));
const output={baseline:base,geometryCount:2+Object.keys(restored.inserts).length+restored.hardware.length,hardwareCount:restored.hardware.length,geometryParity:true,textureChannelsAndSamplers:true,backplateBasePixels:true,cooperativeParity:true,heartbeat,steps,maxStepMs:samples.reduce((max,value)=>Math.max(max,value),0),stepsOver4ms:samples.filter(value=>value>4),preparedBytes:preparedDeviceBuffers(data).reduce((sum,buffer)=>sum+buffer.byteLength,0),timingEnvironment:'Unthrottled local Bun; not browser/device/GPU timing'};
writeFileSync(resolve('docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation/parity.json'),JSON.stringify(output,null,2)+'\n');console.log(output);disposePreparedDevice(restored);rmSync(temporary,{recursive:true,force:true});
