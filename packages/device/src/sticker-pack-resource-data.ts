import { PlaneGeometry, type BufferGeometry } from 'three';
import { createStickerSleeveGeometry } from './sticker-sleeve';
import { createGpuPaperGeometry } from './sticker-paper-gpu';
import { createStickerPeelGeometry } from './sticker-surface';
import { conformStickerToPaper } from './sticker-paper';
import { transferShell, type ShellGeometryTransfer } from './immutable-shell-transfer';
import { PARKED_STICKER_SEGMENTS, type StickerPackGeometryInput } from './sticker-pack-recipe';
export interface StickerPackGeometryData { readonly parts: Readonly<Record<string,ShellGeometryTransfer>> }
/** Exact existing constructors. They execute in the existing paper producer;
 * cooperative recovery yields between constructor/native bounds stages. */
export function* prepareStickerPackGeometry(input:StickerPackGeometryInput):Generator<void,StickerPackGeometryData,void>{
 let geometries:Record<string,BufferGeometry>={};
 try{
  yield;
  if(input.kind==='gpu-paper')geometries=createGpuPaperGeometry(input);
  else if(input.kind==='sleeve')geometries={geometry:createStickerSleeveGeometry(input.width,input.height,input.pixel)};
  else if(input.kind==='plane')geometries={geometry:new PlaneGeometry(input.width,input.height)};
  else geometries={geometry:conformStickerToPaper(createStickerPeelGeometry(input.art,input.width,0,PARKED_STICKER_SEGMENTS),input.bow?.paperWidth??1,input.bow?.pixel??0,input.bow?.seatX??.5)};
  const parts:Record<string,ShellGeometryTransfer>={};
  for(const [key,geometry]of Object.entries(geometries)){yield;geometry.computeBoundingBox();if(!geometry.boundingSphere)geometry.computeBoundingSphere();parts[key]=transferShell(geometry);}
  return {parts};
 }finally{for(const geometry of Object.values(geometries))geometry.dispose();}
}
export function stickerPackGeometryBuffers(value:StickerPackGeometryData):ArrayBuffer[]{
 const buffers=new Set<ArrayBuffer>();
 const add=(array:ArrayBufferView)=>{if(!(array.buffer instanceof ArrayBuffer))throw Error('Pack resources require private buffers');buffers.add(array.buffer);};
 for(const part of Object.values(value.parts)){for(const attribute of Object.values(part.attributes))add(attribute.array);if(part.index)add(part.index);}
 return [...buffers];
}
export type PackResourceWorkerRequest={readonly type:'prepare-pack';readonly id:number;readonly input:StickerPackGeometryInput}|{readonly type:'release-pack';readonly id:number}|{readonly type:'deliver-pack';readonly id:number;readonly deliveryId:number;readonly port:MessagePort};
export type PackResourceWorkerResponse={readonly type:'pack';readonly id:number;readonly value?:StickerPackGeometryData;readonly error?:string}|{readonly type:'pack-delivered';readonly deliveryId:number;readonly error?:string};
