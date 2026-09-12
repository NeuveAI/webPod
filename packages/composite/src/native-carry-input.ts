import {Box3,Vector3} from 'three';
import {nativePackLayout} from './native-pack-layout';
import type {DeviceStickerScene} from '../../device/src/sticker-contract';
import {STICKER_PACK_LAYOUT,STICKER_SHEET_SLOTS,STICKER_SHEET_PRINT_WIDTH} from '../../device/src/sticker-contract';
import {stickerVisibleAspect} from '../../device/src/sticker-surface';
import {STICKER_PACK_PHYSICAL} from '../../device/src/sticker-pack-recipe';
import type {RenderLayout} from '../../device/src/device-render-protocol';
import type {CarryInput} from '../../device/src/sticker-carry-computation';
import type {createDeviceQueryView} from '../../device/src/device-query-view';
import {DEVICE_LAYOUT} from '../../device/src/layout';
export function nativeCarryInput(scene:DeviceStickerScene,layout:RenderLayout,query:ReturnType<typeof createDeviceQueryView>):CarryInput|null{
 const view=nativePackLayout(scene,layout);if(!view)return null;
 const {pack,width,height,pixel,x,y}=view,art=scene.assets.find(item=>item.id===pack.stickerId);
 const slotIndex=(pack.sheet?.slots??[]).findIndex(slot=>slot.stickerId===pack.stickerId),seat=STICKER_SHEET_SLOTS[slotIndex]??(pack.sourcePlacement==null?undefined:{x:.5,y:.5});
 if(!art||!seat||(pack.peel===0&&pack.placement===null&&pack.dragOffset==null&&pack.sourcePlacement==null))return null;
 const linerTravel=height*STICKER_PACK_LAYOUT.linerTravel*(pack.sheet?.reveal??0),offset=pack.dragOffset;
 const origin:[number,number,number]=[x+(seat.x-.5)*width+(offset?.x??0)*pixel,y+linerTravel+(.5-seat.y)*height-(offset?.y??0)*pixel,STICKER_PACK_PHYSICAL.depth+pixel*(2+5*(1-(seat.x*2-1)**2)+.8)];
 query.content.updateWorldMatrix(true,false);
 const center=pack.sourcePlacement?new Vector3((.5-pack.sourcePlacement.x)*DEVICE_LAYOUT.body.width,(.5-pack.sourcePlacement.y)*DEVICE_LAYOUT.body.height,-DEVICE_LAYOUT.body.depth/2).applyMatrix4(query.content.matrixWorld):new Vector3();
 const camera=new Vector3().fromArray(layout.cameraWorld,12);
 const vertical=layout.cameraProjection[5];if(vertical===undefined)throw new Error('Incomplete carry camera');
 const worldPixel=2*camera.distanceTo(center)/vertical/layout.cssHeight;
 const workspace=pack.returnToSheet?query.scene.getObjectByName('sticker-pack-wrapper'):undefined,bounds=workspace?new Box3().setFromObject(workspace):null;
 return{art,pack,width:Math.min(width*STICKER_SHEET_PRINT_WIDTH,height*.21/stickerVisibleAspect(art)),paperWidth:width,pixel,seatX:seat.x,origin,world:query.content.matrixWorld.toArray(),cameraWorld:layout.cameraWorld,projection:layout.cameraProjection,viewportWidth:layout.cssWidth,viewportHeight:layout.cssHeight,worldPixel,workspaceBounds:bounds&&!bounds.isEmpty()?{min:bounds.min.toArray(),max:bounds.max.toArray()}:null};
}
