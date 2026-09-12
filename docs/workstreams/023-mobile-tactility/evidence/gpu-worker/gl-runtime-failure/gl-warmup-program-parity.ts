import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Texture,DataTexture,MeshPhysicalMaterial,FrontSide,BackSide,Mesh,Scene,SRGBColorSpace,NoToneMapping,ShaderLib,CubeUVReflectionMapping} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {WebGLPrograms} from '../../../../../../packages/device/node_modules/three/src/renderers/webgl/WebGLPrograms.js';
import {STICKER_LAMINATE} from '../../../../../../packages/device/src/materials';
import {STICKER_SURFACE,createStickerPeelGeometry} from '../../../../../../packages/device/src/sticker-surface';
import {applyStickerWear} from '../../../../../../packages/device/src/sticker-wear';
import {STICKER_CATALOGUE} from '../../../../../../packages/stickers/src/catalogue';
const art=STICKER_CATALOGUE[0];assert(art);
const source=readFileSync(new URL('../../../../../../packages/device/src/StickerSurface.tsx',import.meta.url),'utf8');
const factory=source.split('const materials = useMemo(() => {')[1]?.split('}, [texture, roughness, studio.texture, finishEnabled, appearance, art.id]);')[0];assert(factory);
const make=new Function('STICKER_LAMINATE','texture','roughness','studio','STICKER_SURFACE','MeshPhysicalMaterial','FrontSide','BackSide','finishEnabled','applyStickerWear','art','appearance',factory);
const texture=new Texture(),roughness=new Texture(),environment=new Texture();texture.name=art.url;texture.colorSpace=SRGBColorSpace;environment.mapping=CubeUVReflectionMapping;environment.image={height:512};
const renderer={getRenderTarget:()=>null,state:{buffers:{depth:{getReversed:()=>false}}},toneMapping:NoToneMapping,outputColorSpace:SRGBColorSpace,shadowMap:{enabled:true,type:1}};
const programs=WebGLPrograms(renderer,{get:(value:unknown)=>value},{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false,getMaxPrecision:(value:string)=>value},{},{numPlanes:0,numIntersection:0});
const lights={directional:[{}],point:[],spot:[],spotLightMap:[],rectArea:[],hemi:[],directionalShadowMap:[],pointShadowMap:[],spotShadowMap:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};
const geometry=createStickerPeelGeometry(art,1,.75,4),scene=new Scene(),rows:unknown[]=[];
const field={width:1,height:1,alpha:new Uint8Array([255]),onset:new Uint8Array([255]),boundaryCandidates:new Uint32Array(0)};
const damage={id:art.id,field,texture:new DataTexture(new Uint8Array([255]),1,1)};
for(const appearance of ['earned','locked','placed']){
 const result=make(STICKER_LAMINATE,texture,roughness,{texture:environment},STICKER_SURFACE,MeshPhysicalMaterial,FrontSide,BackSide,true,applyStickerWear,STICKER_CATALOGUE[0],appearance);
 for(const [side,material,wear]of [['front',result.front,result.wearing],['back',result.back,result.backingWear]] as const){
  const mesh=new Mesh(geometry,material);
  const snapshot=()=>{const parameters=programs.getParameters(material,lights,[],scene,mesh,[]);const shader={uniforms:{},vertexShader:ShaderLib.physical.vertexShader,fragmentShader:ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader,renderer);return {parameters,key:programs.getProgramCacheKey(parameters),shader:shader.fragmentShader};};
  const warm=snapshot();wear.setDamage(damage);const prepared=snapshot();assert.deepEqual(warm,prepared,`${appearance}/${side} installed shader/cache parameter parity`);
  rows.push({appearance,side,cacheKey:warm.key,shaderHash:createHash('sha256').update(warm.shader).digest('hex')});material.dispose();
 }
}
geometry.dispose();texture.dispose();roughness.dispose();environment.dispose();damage.texture.dispose();
await Bun.write(new URL('./gl-warmup-program-parity.json',import.meta.url),JSON.stringify({factorySha256:createHash('sha256').update(factory).digest('hex'),rows,scope:'Exact production material factory; installed Three WebGLPrograms parameters/cache keys and patched GLSL, six variants. CPU-only compile-key proof; actual GPU compile readiness remains browser gate.'},null,2)+'\n');
console.log('PASS: six exact production material variants, installed program parameters/cache keys and patched GLSL identical with/without prepared damage uniforms');
