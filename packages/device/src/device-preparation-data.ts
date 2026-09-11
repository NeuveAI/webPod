import { DataTexture, RGBAFormat, type BufferGeometry } from 'three';
import type { DeviceFormParams } from './form';
import { createImmutableShellsSteps } from './immutable-shells';
import { createDeviceInsertGeometrySteps } from './device-insert-geometry';
import { createHardwareGeometrySteps, type HardwarePart } from './hardware-geometry';
import { createMicroNoiseRoughnessMapSteps, createSteelAnisotropyMapSteps, createAluminumFinishMapsSteps } from './textures';
import { createBackplatePixelsSteps } from './backplate-finish';
import { transferShell, restoreShell, type ShellGeometryTransfer } from './immutable-shell-transfer';

/** Increment when the immutable recipe or transfer interpretation changes. */
export const DEVICE_PREPARATION_VERSION=1;
export type DevicePreparationRequest =
 | {readonly id:number;readonly form:DeviceFormParams;readonly type?:'prepare'}
 | {readonly type:'lease';readonly id:number;readonly leaseId:number;readonly port:MessagePort}
 | {readonly type:'evict';readonly id:number};
export type DevicePreparationResponse=
 | {readonly id:number;readonly result:PreparedDeviceData}
 | {readonly id:number;readonly error:string}
 | {readonly type:'leased';readonly id:number;readonly leaseId:number}
 | {readonly type:'lease-failed';readonly id:number;readonly leaseId:number;readonly error:string};
/** A privately owned copy, transferred by the sole preparation producer directly
 * to its renderer. The main broker owns admission/release; no live cache buffer
 * is ever included in this message's transfer list. */
export interface PreparedDeviceRenderLease { readonly id:number;readonly leaseId:number;readonly result:PreparedDeviceData }
type Inserts = { [K in keyof ReturnType<typeof import('./device-insert-geometry').createDeviceInsertGeometry>]: BufferGeometry };
/** Data-only texture wire format. Buffers transfer once; restored wrappers own them
 * until the assembly cache releases its last device owner. Sampler settings match
 * the original factories, including color space and mipmap generation. */
export interface PreparedTextureData {
 readonly data: Uint8Array; readonly width: number; readonly height: number;
 readonly wrapS: DataTexture['wrapS']; readonly wrapT: DataTexture['wrapT'];
 readonly minFilter: DataTexture['minFilter']; readonly magFilter: DataTexture['magFilter'];
 readonly colorSpace: string; readonly generateMipmaps: boolean;
 readonly repeat: readonly [number, number];
 readonly flipY:boolean;readonly premultiplyAlpha:boolean;readonly anisotropy:number;readonly unpackAlignment:DataTexture['unpackAlignment'];
}
export interface PreparedDeviceData {
 readonly front: ShellGeometryTransfer; readonly back: ShellGeometryTransfer;
 readonly inserts: Record<keyof Inserts, ShellGeometryTransfer>;
 readonly hardware: readonly {name:string;material:HardwarePart['material'];geometry:ShellGeometryTransfer}[];
 readonly textures: Record<'noise'|'steel'|'aluminumColor'|'aluminumHeight'|'aluminumRoughness',PreparedTextureData>;
 readonly backplatePixels: Uint8ClampedArray;
}
export interface PreparedDevice {
 readonly front:BufferGeometry;readonly back:BufferGeometry;
 readonly inserts:Inserts;readonly hardware:readonly HardwarePart[];
 readonly textures:Record<keyof PreparedDeviceData['textures'],DataTexture>;
 readonly backplatePixels:Uint8ClampedArray;
}
function textureData(texture:DataTexture):PreparedTextureData {
 const {data,width,height}=texture.image;
 if(!(data instanceof Uint8Array))throw Error('Expected RGBA byte texture');
 return {data,width,height,wrapS:texture.wrapS,wrapT:texture.wrapT,minFilter:texture.minFilter,magFilter:texture.magFilter,colorSpace:texture.colorSpace,generateMipmaps:texture.generateMipmaps,repeat:[texture.repeat.x,texture.repeat.y],flipY:texture.flipY,premultiplyAlpha:texture.premultiplyAlpha,anisotropy:texture.anisotropy,unpackAlignment:texture.unpackAlignment};
}
function restoreTexture(data:PreparedTextureData):DataTexture {
 const texture=new DataTexture(data.data,data.width,data.height,RGBAFormat);
 texture.wrapS=data.wrapS;texture.wrapT=data.wrapT;texture.minFilter=data.minFilter;texture.magFilter=data.magFilter;
 texture.colorSpace=data.colorSpace;texture.generateMipmaps=data.generateMipmaps;texture.repeat.fromArray(data.repeat);texture.flipY=data.flipY;texture.premultiplyAlpha=data.premultiplyAlpha;texture.anisotropy=data.anisotropy;texture.unpackAlignment=data.unpackAlignment;texture.needsUpdate=true;
 return texture;
}
function geometryData(geometry:BufferGeometry):ShellGeometryTransfer {
 if(!geometry.boundingBox)geometry.computeBoundingBox();if(!geometry.boundingSphere)geometry.computeBoundingSphere();
 return transferShell(geometry);
}
/** Exact renderer-independent preparation. The worker drains it; exceptional
 * recovery yields between algorithm steps. No live renderer resource is mutated. */
export function* prepareDeviceSteps(form:DeviceFormParams):Generator<void,PreparedDeviceData,void> {
 const owned:BufferGeometry[]=[];const maps:DataTexture[]=[];
 try {
  const shells=yield* createImmutableShellsSteps(form);owned.push(shells.front,shells.back);
  const inserts=yield* createDeviceInsertGeometrySteps(form);owned.push(...Object.values(inserts));
  const hardware=yield* createHardwareGeometrySteps(form);owned.push(...hardware.map(part=>part.geometry));
  const noise=yield* createMicroNoiseRoughnessMapSteps();maps.push(noise);noise.repeat.set(.04,.04);
  const steel=yield* createSteelAnisotropyMapSteps();maps.push(steel);steel.repeat.set(.02,.02);
  const aluminum=yield* createAluminumFinishMapsSteps();maps.push(aluminum.color,aluminum.height,aluminum.roughness);
  const backplatePixels=yield* createBackplatePixelsSteps();
  const transferredInserts={} as Record<keyof Inserts,ShellGeometryTransfer>;
  for(const key of Object.keys(inserts) as (keyof Inserts)[]) { transferredInserts[key]=geometryData(inserts[key]);yield; }
  return {front:geometryData(shells.front),back:geometryData(shells.back),inserts:transferredInserts,
   hardware:hardware.map(part=>({...part,geometry:geometryData(part.geometry)})),
   textures:{noise:textureData(noise),steel:textureData(steel),aluminumColor:textureData(aluminum.color),aluminumHeight:textureData(aluminum.height),aluminumRoughness:textureData(aluminum.roughness)},backplatePixels};
 } finally {for(const geometry of owned)geometry.dispose();for(const map of maps)map.dispose();}
}
/** Restore lightweight Three wrappers. The cache, never an individual mesh,
 * owns their disposal. Typed buffers are adopted without copying. */
export function restorePreparedDevice(data:PreparedDeviceData):PreparedDevice {
 const inserts={} as Inserts;
 for(const key of Object.keys(data.inserts) as (keyof Inserts)[])inserts[key]=restoreShell(data.inserts[key]);
 const textures={} as PreparedDevice['textures'];
 for(const key of Object.keys(data.textures) as (keyof PreparedDevice['textures'])[])textures[key]=restoreTexture(data.textures[key]);
 return {front:restoreShell(data.front),back:restoreShell(data.back),inserts,hardware:data.hardware.map(part=>({...part,geometry:restoreShell(part.geometry)})),textures,backplatePixels:data.backplatePixels};
}
export function disposePreparedDevice(value:PreparedDevice):void {
 for(const geometry of [value.front,value.back,...Object.values(value.inserts),...value.hardware.map(part=>part.geometry)])geometry.dispose();
 for(const texture of Object.values(value.textures))texture.dispose();
}
/** The result is privately owned by its producer until postMessage transfers it.
 * Never include a buffer borrowed from a mounted/cache-owned assembly. */
export function preparedDeviceBuffers(data:PreparedDeviceData):ArrayBuffer[] {
 const result=new Set<ArrayBuffer>();
 for(const geometry of [data.front,data.back,...Object.values(data.inserts),...data.hardware.map(part=>part.geometry)]) {
  for(const attribute of Object.values(geometry.attributes))if(attribute.array.buffer instanceof ArrayBuffer)result.add(attribute.array.buffer);
  if(geometry.index?.buffer instanceof ArrayBuffer)result.add(geometry.index.buffer);
 }
 for(const texture of Object.values(data.textures))if(texture.data.buffer instanceof ArrayBuffer)result.add(texture.data.buffer);
 if(data.backplatePixels.buffer instanceof ArrayBuffer)result.add(data.backplatePixels.buffer);
 return [...result];
}
