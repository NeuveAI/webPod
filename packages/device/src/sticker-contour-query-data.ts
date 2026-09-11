import type { Vector3 } from 'three';
import type { RenderMatrix, RenderPose } from './device-render-protocol';
import type { StickerCollisionSnapshot } from './sticker-collision';
import type { PreparedStickerContour } from './sticker-contour-preparation-data';
import type { StickerProjectedContour } from './sticker-contract';

export interface StickerContourCanvas {
  readonly left: number; readonly top: number; readonly width: number; readonly height: number;
}
/** One admitted projection sample; matrices and rectangle must be captured together. */
export interface StickerContourProjection {
  readonly world: RenderMatrix;
  readonly cameraInverse: RenderMatrix;
  readonly cameraProjection: RenderMatrix;
  readonly canvas: StickerContourCanvas;
}
/** The synchronous kernel borrows the callback only for this invocation. */
export type StickerContourVisibility = (world: Vector3) => boolean;
/** No independent pose clock: use the renderer/main authority's existing revisions. */
export type StickerContourPoseStamp = Pick<RenderPose,
  'sequence' | 'motionEpoch' | 'lastAcceptedCommand' | 'layoutRevision' | 'sceneRevision' | 'resourceRevision'>;
export interface StickerContourLineage {
  readonly session: number;
  readonly stickerId: string;
  readonly source: 'equipped' | 'carry';
}
export interface StickerContourQueryStamp {
  readonly generation: number;
  readonly sequence: number;
  readonly lineage: StickerContourLineage;
  readonly colliderId: number;
  readonly printId: number;
  readonly visibilityRevision: number;
  readonly pose: StickerContourPoseStamp;
  /** performance.timeOrigin + performance.now(), matching the render protocol. */
  readonly submittedAt: number;
}
/** Float64 local quad samples are nine xyz triples, in canonical quad/edge/center order. */
export interface StickerContourPrintResource {
  readonly contour: PreparedStickerContour;
  readonly quad: Float64Array;
}
/** Private install payloads never confer ownership of a borrowed mounted buffer.
 * A print's port carries the existing transaction delivery envelope/result. */
export type StickerContourQueryRequest =
  | { readonly type: 'install-collider'; readonly version: 1; readonly generation: number;
      readonly id: number; readonly revision: number; readonly snapshot: StickerCollisionSnapshot }
  | { readonly type: 'install-print'; readonly version: 1; readonly generation: number;
      readonly id: number; readonly revision: number; readonly resourceId: number;
      readonly port: MessagePort; readonly quad: Float64Array }
  | { readonly type: 'query'; readonly version: 1; readonly stamp: StickerContourQueryStamp;
      readonly projection: StickerContourProjection; readonly contentWorld: RenderMatrix;
      readonly cameraWorld: RenderMatrix }
  | { readonly type: 'result-ack'; readonly version: 1; readonly generation: number; readonly sequence: number }
  | { readonly type: 'cancel'; readonly version: 1; readonly generation: number; readonly lineage: StickerContourLineage }
  | { readonly type: 'release-resource'; readonly version: 1; readonly generation: number;
      readonly kind: 'collider' | 'print'; readonly id: number }
  | { readonly type: 'dispose'; readonly version: 1; readonly generation: number };

/** Completion does not grant input authority. Consumers admit the echoed lineage,
 * resource/pose stamps and monotonic sequence before publishing a sampled result. */
export type StickerContourQueryResponse =
  | { readonly type: 'installed'; readonly version: 1; readonly generation: number;
      readonly kind: 'collider' | 'print'; readonly id: number; readonly revision: number }
  | { readonly type: 'result'; readonly version: 1; readonly stamp: StickerContourQueryStamp;
      readonly contour: StickerProjectedContour | null; readonly startedAt: number; readonly completedAt: number }
  | { readonly type: 'released'; readonly version: 1; readonly generation: number;
      readonly kind: 'collider' | 'print'; readonly id: number }
  | { readonly type: 'failed'; readonly version: 1; readonly generation: number;
      readonly stage: 'install' | 'query' | 'protocol'; readonly message: string }
  | { readonly type: 'disposed'; readonly version: 1; readonly generation: number };
