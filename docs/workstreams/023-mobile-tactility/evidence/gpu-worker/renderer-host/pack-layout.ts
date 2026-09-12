import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from '../../../../../../packages/device/node_modules/three';
import {nativePackLayout} from '../../../../../../packages/composite/src/native-pack-layout';
import {nativePackResourceKey} from '../../../../../../packages/composite/src/native-pack-resources';
import {STICKER_PACK_LAYOUT,stickerPackViewportLayout,type DeviceStickerScene} from '../../../../../../packages/device/src/sticker-contract';
const scene:DeviceStickerScene={assets:[{id:'known',url:'/known.svg',width:100,height:100,visibleBounds:[0,0,100,100]}],placements:[],pack:{progress:0,peel:0,landing:0,placement:null,stickerId:null,sheet:{ink:'#888888',reveal:0,slots:[{stickerId:'known',state:'earned'}]}}};
let cases=0,maxError=0;const keys=new Set<string>();
for(const [width,height]of [[440,888],[320,568],[1024,768]])for(const fov of [12,30])for(const progress of [0,.4,1])for(const reveal of [0,.5,1]){
 const camera=new PerspectiveCamera(fov,width/height,.1,10000);camera.position.z=3500;camera.updateMatrixWorld();
 const pack={...scene.pack,progress,peel:0,landing:0,placement:null,stickerId:null,presence:.8,workspaceLowering:.3,sheet:{ink:'#888888',reveal,slots:[{stickerId:'known',state:'earned' as const}]}};
 const input={...scene,pack};const layout={revision:1,cssWidth:width,cssHeight:height,backingWidth:width*3,backingHeight:height*3,pixelRatio:3,cameraWorld:camera.matrixWorld.toArray(),cameraProjection:camera.projectionMatrix.toArray()};
 const actual=nativePackLayout(input,layout);assert(actual);
 // The original StickerPackContents formulas with pinned Fiber perspective
 // getCurrentViewport's tan(fov/2)*distance definition, independently evaluated.
 const visibleHeight=2*Math.tan(fov*Math.PI/360)*camera.getWorldPosition(new Vector3()).distanceTo(new Vector3(0,0,130));
 const pixel=visibleHeight/height,box=stickerPackViewportLayout(width,height),paperWidth=box.width*pixel,paperHeight=box.height*pixel;
 const start=-visibleHeight/2-paperHeight/2+(STICKER_PACK_LAYOUT.teasePx+STICKER_PACK_LAYOUT.bottomGapPx)*pixel;
 const end=-visibleHeight/2+paperHeight/2+STICKER_PACK_LAYOUT.bottomGapPx*pixel;
 const travel=paperHeight*(progress+STICKER_PACK_LAYOUT.linerTravel*reveal)+(STICKER_PACK_LAYOUT.teasePx+STICKER_PACK_LAYOUT.bottomGapPx)*pixel;
 const values=[actual.pixel-pixel,actual.width-paperWidth,actual.height-paperHeight,actual.x-(box.centerX-width/2)*pixel,actual.y-(start+(end-start)*progress-.2*travel)];
 maxError=Math.max(maxError,...values.map(Math.abs));assert(values.every(value=>Math.abs(value)<1e-10));cases++;
 if(width===440&&fov===12)keys.add(nativePackResourceKey(actual.recipe,input));
}
assert.equal(keys.size,1);
console.log(JSON.stringify({cases,maxWorldScalarError:maxError,resourceIdentityIndependentOfPacketProgressAndLinerCurl:true,scope:'Offline original GL/Fiber formula versus native scalar packet layout; no browser or timing claim.'},null,2));
