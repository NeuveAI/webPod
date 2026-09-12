import { sampleGpuPaperBounds, type GpuPaperInput } from './sticker-paper-gpu';
import { atom, createStore, useAtomValue } from 'jotai';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { BufferGeometry } from 'three';
import { restoreShell } from './immutable-shell-transfer';
import { acquirePaperPackGeometry } from './sticker-paper-pool';
import { stickerPackGeometryKey, type StickerPackGeometryInput } from './sticker-pack-recipe';
export { acquirePrivatePaperPackGeometry, releaseUnusedPaperPackGeometry } from './sticker-paper-pool';
export type { StickerPackGeometryData } from './sticker-pack-resource-data';
interface PreparedPackGeometry {readonly key:string;readonly parts:Readonly<Record<string,BufferGeometry>>;release():void}
/** Lightweight main wrappers borrow one existing paper authority lease. Native
 * rendering acquires a private producer copy through acquirePrivatePaperPackGeometry. */
export async function preparePackGeometry(input:StickerPackGeometryInput,signal:AbortSignal):Promise<PreparedPackGeometry>{
 signal.throwIfAborted();const lease=acquirePaperPackGeometry(input);let released=false;const parts:Record<string,BufferGeometry>={};
 const release=()=>{if(released)return;released=true;for(const geometry of Object.values(parts))geometry.dispose();lease.release();};
 try{
  const value=await new Promise<Awaited<typeof lease.result>>((resolve,reject)=>{const abort=()=>{release();reject(new DOMException('Pack preparation cancelled','AbortError'));};signal.addEventListener('abort',abort,{once:true});void lease.result.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});
  signal.throwIfAborted();for(const [id,data]of Object.entries(value.parts))parts[id]=restoreShell(data);
  return{key:lease.key,parts,release};
 }catch(error){release();throw error;}
}
/** Resource publication is keyed by immutable geometry recipe, not pose or ink.
 * Cancellation retires only this caller; old wrappers live through mesh commit. */
export function usePackGeometry(input:StickerPackGeometryInput):PreparedPackGeometry|null{
 const key=stickerPackGeometryKey(input),latest=useRef(input);
 const owner=useMemo(()=>({store:createStore(),state:atom<PreparedPackGeometry|null>(null),error:atom<{key:string;cause:Error}|null>(null),retired:new Set<PreparedPackGeometry>()}),[]);
 const current=useAtomValue(owner.state,{store:owner.store}),error=useAtomValue(owner.error,{store:owner.store});
 useLayoutEffect(()=>{latest.current=input;});
 useLayoutEffect(()=>{const controller=new AbortController();void preparePackGeometry(latest.current,controller.signal).then(value=>{if(controller.signal.aborted){value.release();return;}const previous=owner.store.get(owner.state);if(previous)owner.retired.add(previous);owner.store.set(owner.state,value);},cause=>{if(!controller.signal.aborted)owner.store.set(owner.error,{key,cause:cause instanceof Error?cause:new Error('Pack geometry unavailable')});});return()=>controller.abort();},[owner,key]);
 useLayoutEffect(()=>{for(const value of owner.retired)if(value!==current){value.release();owner.retired.delete(value);}return()=>current?.release();},[owner,current]);
 useLayoutEffect(()=>()=>{owner.store.get(owner.state)?.release();for(const value of owner.retired)value.release();owner.retired.clear();},[owner]);
 if(error?.key===key)throw error.cause;
 return current?.key===key?current:null;
}

/** The lease owns these mutable GPU wrappers. Bind the exact existing return
 * clearance sampler and restore original methods when the material owner ends. */
export function bindPackPaperBounds(stock:{readonly front:BufferGeometry;readonly back:BufferGeometry;readonly edge:BufferGeometry},input:GpuPaperInput,curl:{readonly value:number}):()=>void{
 let sampledCurl=NaN,sampled:ReturnType<typeof sampleGpuPaperBounds>|null=null;
 const original={front:stock.front.computeBoundingBox,back:stock.back.computeBoundingBox,edge:stock.edge.computeBoundingBox};
 for(const part of ['front','back','edge']as const)stock[part].computeBoundingBox=()=>{if(sampled===null||sampledCurl!==curl.value){sampled=sampleGpuPaperBounds(input,curl.value);sampledCurl=curl.value;}stock[part].boundingBox=sampled[part].clone();};
 return()=>{for(const part of ['front','back','edge']as const)stock[part].computeBoundingBox=original[part];};
}
