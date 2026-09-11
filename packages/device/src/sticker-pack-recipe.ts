import { BackSide, DoubleSide, FrontSide } from 'three';
import { STICKER_PACK_MATERIAL } from './materials';
import { SLEEVE_LAMINATE } from './sticker-sleeve';
import { stickerPaperCurlProgress } from './sticker-paper';
import { stickerVisibleAspect } from './sticker-surface';
import { isStickerCarried, STICKER_PACK_LAYOUT, STICKER_PACK_MOTION, STICKER_SHEET_PRINT_WIDTH, STICKER_SHEET_SLOTS, stickerPackPresentation, type DeviceStickerScene, type StickerArtwork, type StickerPackVisual } from './sticker-contract';

export const STICKER_PACK_PHYSICAL = Object.freeze({ depth: 130, returnClearancePx: 20, returnCurl: .35, linerClearcoat: .55, linerRoughness: .38, linerCoatRoughness: .23 });
export const PARKED_STICKER_SEGMENTS = 24;
export interface StickerPaperSize { readonly width: number; readonly height: number; readonly pixel: number }
export interface StickerPrintBow { readonly pixel: number; readonly paperWidth: number; readonly seatX: number }
export type StickerPackGeometryInput =
 | ({ readonly kind: 'sleeve' } & StickerPaperSize)
 | ({ readonly kind: 'gpu-paper'; readonly liner: boolean } & StickerPaperSize)
 | { readonly kind: 'parked-print'; readonly art: StickerArtwork; readonly width: number; readonly bow?: StickerPrintBow }
 | { readonly kind: 'plane'; readonly width: number; readonly height: number };
export const stickerPackGeometryKey = (input: StickerPackGeometryInput): string => `pack:${JSON.stringify(input)}`;
type Triple = readonly [number, number, number];
interface NodeBase { readonly id: string; readonly name?: string; readonly position?: Triple; readonly rotation?: Triple; readonly visible?: boolean }
export type StickerPackNode = NodeBase & (
 | { readonly kind: 'group'; readonly children: readonly StickerPackNode[] }
 | { readonly kind: 'paper'; readonly size: StickerPaperSize; readonly ink: string; readonly liner: boolean; readonly curl: number; readonly epoch: number }
 | { readonly kind: 'sleeve'; readonly size: StickerPaperSize; readonly ink: string }
 | { readonly kind: 'print'; readonly artId: string; readonly width: number; readonly bow?: StickerPrintBow; readonly appearance: 'earned' | 'locked' | 'placed'; readonly wear: number; readonly geometry: StickerPackGeometryInput; readonly geometryKey: string; readonly renderOrder: 4 }
);
/** Stock material values are shared verbatim by GL and native material factories.
 * Texture IDs are supplied by the rendering owner; no live texture crosses wire. */
export function stickerPackPaperMaterials(size: StickerPaperSize, ink: string, liner: boolean) {
 return {
  back: { color: liner ? '#c4bba8' : '#b8a88d', roughness: .94, side: BackSide },
  edge: { color: liner ? '#b6aa92' : '#aa9574', roughness: .96, side: DoubleSide },
  front: { ...STICKER_PACK_MATERIAL, color: ink, bumpScale: size.pixel * .2, roughness: liner ? STICKER_PACK_PHYSICAL.linerRoughness : SLEEVE_LAMINATE.roughness, clearcoat: liner ? STICKER_PACK_PHYSICAL.linerClearcoat : SLEEVE_LAMINATE.clearcoat, clearcoatRoughness: liner ? STICKER_PACK_PHYSICAL.linerCoatRoughness : SLEEVE_LAMINATE.clearcoatRoughness, side: FrontSide },
 };
}
export function stickerPackSleeveMaterials(pixel: number, ink: string) {
 return { exterior: { ...SLEEVE_LAMINATE, color: ink, bumpScale: pixel * .2 }, cut: {color:'#bca787',roughness:.94}, interior:{color:'#b8a88d',roughness:.94} };
}
/** Exact original pocket folds, including the two side pitches and bottom pitch. */
export function stickerPackSleeveParts({width,height,pixel}: StickerPaperSize) {
 return [
  {id:'pocket', geometry:{kind:'sleeve',width,height,pixel} as StickerPackGeometryInput, material:'pocket' as const, position:[0,0,0] as Triple, rotation:[0,0,0] as Triple},
  ...[-1,1].map(side=>({id:`fold-${side}`,geometry:{kind:'plane',width:pixel*7,height:height-pixel*2} as StickerPackGeometryInput,material:'exterior' as const,position:[side*(width/2-pixel*4),0,pixel*1.05] as Triple,rotation:[0,side*.045,0] as Triple})),
  {id:'fold-bottom',geometry:{kind:'plane',width:width-pixel*2,height:pixel*5} as StickerPackGeometryInput,material:'exterior' as const,position:[0,-height/2+pixel*3,pixel*1.05] as Triple,rotation:[.06,0,0] as Triple},
 ];
}
/** Data-only authored pack hierarchy. Carry remains a sibling owned by its exact
 * deformation authority; callbacks never become render recipe values. */
export function createStickerPackRecipe(scene: Pick<DeviceStickerScene,'assets'|'appearances'>, pack: StickerPackVisual, layout: StickerPaperSize & {readonly x:number;readonly y:number;readonly workspaceLowering:number}, visible: boolean): StickerPackNode {
 const {width,height,pixel,x,y,workspaceLowering}=layout, sheet=pack.sheet, reveal=sheet?.reveal??0, progress=Math.max(0,Math.min(1,pack.progress));
 const presentation=stickerPackPresentation(progress,reveal,pack.turn), linerTravel=height*STICKER_PACK_LAYOUT.linerTravel*reveal;
 const print=(id:string,art:StickerArtwork,width:number,appearance:'earned'|'locked'|'placed',bow?:StickerPrintBow):StickerPackNode=>{
  const geometry:StickerPackGeometryInput={kind:'parked-print',art,width,...(bow?{bow}:{})};
  return {kind:'print',id,artId:art.id,width,appearance,bow,wear:scene.appearances?.find(entry=>entry.stickerId===art.id)?.wear??0,geometry,geometryKey:stickerPackGeometryKey(geometry),renderOrder:4};
 };
 const cover=(id:string,artId:string):StickerPackNode[]=>{const art=scene.assets.find(asset=>asset.id===artId),coverWidth=width*.58;return art?[{kind:'group',id,position:[0,-coverWidth*.04,pixel*4],children:[print(`${id}/print`,art,coverWidth,'earned')]}]:[];};
 const neighbors:StickerPackNode[]=(sheet?.neighbors??[]).slice(0,2).map((neighbor,index)=>({kind:'group',id:`neighbor-${index}`,position:[(index===0?-1:1)*pixel*(8+presentation.fan*STICKER_PACK_MOTION.fanSpread),pixel*10,-pixel*(8+index)],rotation:[0,0,(index===0?1:-1)*(.055+presentation.fan*STICKER_PACK_MOTION.fanAngle)],children:[
  {kind:'paper',id:`neighbor-${index}/paper`,name:'printed-sleeve-stock',size:{width,height,pixel},ink:neighbor.ink,liner:false,curl:1,epoch:pack.computationEpoch??0},
  {kind:'group',id:`neighbor-${index}/cover`,position:[0,0,pixel*2],children:cover(`neighbor-${index}/cover/art`,neighbor.stickerId)},
 ]}));
 const slots:StickerPackNode[]=[];
 for(const [index,slot]of (sheet?.slots??[]).entries()){
  const art=scene.assets.find(item=>item.id===slot.stickerId),position=STICKER_SHEET_SLOTS[index];if(!art||!position)continue;
  slots.push({kind:'group',id:`slot-${index}`,position:[(position.x-.5)*width,(.5-position.y)*height,pixel*(5*(1-(position.x*2-1)**2)+.8)],children:[print(`slot-${index}/print`,art,Math.min(width*STICKER_SHEET_PRINT_WIDTH,height*.21/stickerVisibleAspect(art)),isStickerCarried(pack,slot.stickerId)||slot.state==='placed'?'placed':slot.state==='locked'||slot.state==='sealed'?'locked':'earned',{pixel,paperWidth:width,seatX:position.x})]});
 }
 return {kind:'group',id:'pack',name:'sticker-pack-scene',visible,children:[{kind:'group',id:'wrapper',name:'sticker-pack-wrapper',visible:pack.workspaceVisible!==false,position:[x,y-workspaceLowering-(pack.tuck??0)*((height-STICKER_PACK_LAYOUT.teasePx*pixel)*progress+linerTravel),STICKER_PACK_PHYSICAL.depth],rotation:[0,-presentation.turnRadians,0],children:[...neighbors,
  {kind:'group',id:'liner',position:[0,linerTravel,pixel*2],children:[{kind:'paper',id:'liner/paper',name:'release-liner-stock',size:{width,height,pixel},ink:'#e9e2d1',liner:true,curl:stickerPaperCurlProgress(width,height,pixel,linerTravel),epoch:pack.computationEpoch??0},{kind:'group',id:'slots',visible:reveal>.02,children:slots}]},
  {kind:'group',id:'pocket',position:[0,0,pixel*8],children:[{kind:'sleeve',id:'pocket/sleeve',size:{width:width+pixel*4,height,pixel},ink:sheet?.ink??'#b7aa86'},...(sheet?.slots[0]?cover('pocket/cover',sheet.slots[0].stickerId):[])]},
 ]}]};
}
