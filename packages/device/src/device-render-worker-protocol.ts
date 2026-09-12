import type {NativeCarryFrameMessage} from '../../composite/src/native-carry-resources';
import type {NativeCarryState} from '../../composite/src/native-carry-controller';
import type { NativePackFrame } from '../../composite/src/native-pack-resources';
import type { StickerPackNode } from './sticker-pack-recipe';
import type { NativeEquippedFrameMessage } from './sticker-render-frame';
import type { DeviceFormParams } from './form';
import type { DeviceMaterials } from './materials';
import type { LightRigParams } from './light-rig';
import type { DeviceFontAssets } from './device-font-assets';
import type { NativeElementImage } from './native-element-image';
import type { RenderEnvelope, RenderLayout, RenderPose, NativePaintStamp, RenderControlRequest, RenderControlResponse } from './device-render-protocol';

export type DeviceRenderWorkerRequest = RenderControlRequest | RenderEnvelope & (
  | {readonly type:'carry-state';readonly state:NativeCarryState}
  | {readonly type:'carry-frame';readonly frame:NativeCarryFrameMessage}
  | {readonly type:'warmup-frame';readonly sequence:number;readonly frame:NativePackFrame}
  | {readonly type:'pack-frame';readonly sequence:number;readonly frame:NativePackFrame}
  | {readonly type:'pack-pose';readonly notificationSequence:number;readonly key:string;readonly recipe:StickerPackNode}
  | { readonly type: 'layout-raster';readonly layout:RenderLayout;readonly raster:NativePaintStamp }
  | { readonly type: 'sticker-epoch'; readonly computationEpoch: number }
  | { readonly type: 'equipped-frame'; readonly frame: NativeEquippedFrameMessage }
  | { readonly type: 'pose-update'; readonly notificationSequence: number; readonly pose: RenderPose }
  | { readonly type: 'initialize'; readonly canvas: OffscreenCanvas; readonly resources: MessagePort;
      readonly form: DeviceFormParams; readonly materials: DeviceMaterials; readonly lightRig: LightRigParams;
      readonly isBlack: boolean; readonly fonts: DeviceFontAssets; readonly layout: RenderLayout; readonly pose: RenderPose;
      readonly raster: NativePaintStamp; readonly studio: { readonly sigma: number; readonly intensity: number };
      readonly sceneRevision: number; readonly resourceRevision: number }
  | { readonly type: 'paint'; readonly stamp: NativePaintStamp; readonly image: NativeElementImage }
);
export type DeviceRenderWorkerResponse = RenderControlResponse | RenderEnvelope & (
  | {readonly type:'carry-frame-complete';readonly sequence:number;readonly accepted:boolean}
  | {readonly type:'carry-cleared';readonly carryEpoch:number}
  | {readonly type:'warmup-complete';readonly sequence:number;readonly accepted:boolean}
  | {readonly type:'pack-pose-consumed';readonly notificationSequence:number;readonly accepted:boolean}
  | {readonly type:'pack-frame-complete';readonly sequence:number;readonly key:string;readonly accepted:boolean;readonly recipe:StickerPackNode|null}
  | { readonly type: 'equipped-frame-adopted'; readonly sequence: number; readonly pose: RenderPose }
  | { readonly type: 'equipped-frame-rejected'; readonly sequence: number }
  | { readonly type: 'pose-consumed'; readonly notificationSequence: number; readonly accepted: boolean }
  | { readonly type: 'initialized' }
  | { readonly type: 'ready'; readonly pose: RenderPose }
);
