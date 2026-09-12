import {Matrix4} from 'three';
import type {DeviceStickerScene} from '../../device/src/sticker-contract';
import {STICKER_PACK_LAYOUT} from '../../device/src/sticker-contract';
import type {RenderLayout} from '../../device/src/device-render-protocol';
import type {DeviceMotionBinding} from '../../device/src/device-motion-authority';
/** Matches StickerPackContents' authored rear workspace translation and release
 * spring. Only the device-root translation is published; no geometry is walked. */
export function createNativeWorkspaceReframe(input:{readonly binding:DeviceMotionBinding;readonly layout:()=>RenderLayout}){
 let frame:number|null=null,disposed=false,previousRearCarry=false,restingPresentation=0,restingY=0,lastKey='';
 const publish=(y:number)=>{
  restingY=y;const pose=input.binding.read(),model=pose.nodes.find(node=>node.id==='device-model');if(!model||model.matrix[13]===y)return;
  const matrix=new Matrix4().fromArray(model.matrix).toArray();matrix[13]=y;input.binding.sendPose({...pose,nodes:pose.nodes.map(node=>node===model?{...node,matrix}:node)});
 };
 return{update(scene:DeviceStickerScene){
  if(disposed)return;const layout=input.layout(),rearCarry=scene.pack?.sourcePlacement!=null,presentation=(scene.pack?.progress??0)*(scene.pack?.sheet?.reveal??0);
  const key=JSON.stringify([rearCarry,presentation,layout.cssWidth,layout.cssHeight,layout.cameraWorld,layout.cameraProjection]);if(key===lastKey)return;lastKey=key;
  if(frame!==null)cancelAnimationFrame(frame);frame=null;
  const released=previousRearCarry&&!rearCarry;previousRearCarry=rearCarry;if(!rearCarry)restingPresentation=presentation;
  const [x,y,z]=[layout.cameraWorld[12],layout.cameraWorld[13],layout.cameraWorld[14]],vertical=layout.cameraProjection[5];if(x===undefined||y===undefined||z===undefined||vertical===undefined)throw new Error('Incomplete workspace camera');
  const pixel=2*Math.hypot(x,y,z)/vertical/layout.cssHeight;
  const target=rearCarry?restingY:layout.cssWidth<STICKER_PACK_LAYOUT.desktopBreakpoint?Math.min(120,layout.cssHeight*.15)*pixel*restingPresentation:0;
  const initial=restingY;
  if(released&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&Math.abs(target-initial)>pixel*.15){
   publish(initial);let position=initial,velocity=0,previous=performance.now();const started=previous;
   const settle=(now:number)=>{if(disposed)return;const dt=Math.min(.032,Math.max(0,(now-previous)/1000));previous=now;velocity+=((target-position)*240-velocity*30)*dt;position+=velocity*dt;
    if(now-started>1800||Math.abs(target-position)<pixel*.15&&Math.abs(velocity)<pixel){frame=null;publish(target);return;}publish(position);frame=requestAnimationFrame(settle);
   };frame=requestAnimationFrame(settle);
  }else publish(target);
 },dispose(){if(disposed)return;disposed=true;if(frame!==null)cancelAnimationFrame(frame);frame=null;}};
}
