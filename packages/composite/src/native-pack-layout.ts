import {createStickerPackRecipe,STICKER_PACK_PHYSICAL} from '../../device/src/sticker-pack-recipe';
import {STICKER_PACK_LAYOUT,stickerPackViewportLayout,type DeviceStickerScene} from '../../device/src/sticker-contract';
import type {RenderLayout} from '../../device/src/device-render-protocol';
/** Installed Fiber getCurrentViewport for the authored perspective camera: exact
 * distance to packet depth, vertical projection scale and CSS aspect. */
export function nativePackLayout(scene:DeviceStickerScene,layout:RenderLayout){
 const pack=scene.pack??(scene.preparedSheet?{presence:0,progress:0,peel:0,stickerId:null,placement:null,landing:0,sheet:{...scene.preparedSheet,reveal:0}}:null);
 if(!pack)return null;
 const camera=layout.cameraWorld,projection=layout.cameraProjection;
 const z=camera[14],xCamera=camera[12],yCamera=camera[13],vertical=projection[5];
 if(z===undefined||xCamera===undefined||yCamera===undefined||vertical===undefined)throw new Error('Missing pack camera scalar');
 const visibleHeight=2*Math.hypot(xCamera,yCamera,z-STICKER_PACK_PHYSICAL.depth)/vertical,visibleWidth=visibleHeight*layout.cssWidth/layout.cssHeight,pixel=visibleWidth/layout.cssWidth;
 const box=stickerPackViewportLayout(layout.cssWidth,layout.cssHeight),width=box.width*pixel,height=box.height*pixel,x=(box.centerX-layout.cssWidth/2)*pixel;
 const progress=Math.max(0,Math.min(1,pack.progress));
 const start=-visibleHeight/2-height/2+(STICKER_PACK_LAYOUT.teasePx+STICKER_PACK_LAYOUT.bottomGapPx)*pixel;
 const end=-visibleHeight/2+height/2+STICKER_PACK_LAYOUT.bottomGapPx*pixel;
 const presenceTravel=height*(progress+STICKER_PACK_LAYOUT.linerTravel*(pack.sheet?.reveal??0))+(STICKER_PACK_LAYOUT.teasePx+STICKER_PACK_LAYOUT.bottomGapPx)*pixel;
 const y=start+(end-start)*progress-(1-(pack.presence??1))*presenceTravel;
 const workspaceLowering=layout.cssWidth<STICKER_PACK_LAYOUT.desktopBreakpoint?height*STICKER_PACK_LAYOUT.linerTravel*Math.max(0,Math.min(1,pack.workspaceLowering??0)):0;
 return {pack,width,height,pixel,x,y,workspaceLowering,recipe:createStickerPackRecipe(scene,pack,{width,height,pixel,x,y,workspaceLowering},scene.pack!==null)};
}

export function nativePackRecipe(scene:DeviceStickerScene,layout:RenderLayout){return nativePackLayout(scene,layout)?.recipe??null;}
