/** Browser-resolved immutable artwork. Bounds use exclusive right/bottom pixels. */
export interface StickerArtwork {
  readonly id: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly visibleBounds: readonly [number, number, number, number];
}

/** Normalized rear-view coordinates: center origin at top left, clockwise rotation. */
export interface DeviceStickerPlacement {
  readonly stickerId: string;
  readonly surface: 'back';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly rotationDeg: number;
}

/** Continuous visual values are driven by the application's shared Jotai actions. */
export interface StickerPackVisual {
  /** Zero exposes the bottom lip; one brings the entire pack into view. */
  readonly progress: number;
  /** Zero keeps print on its backing; one curls it free. */
  readonly peel: number;
  readonly stickerId: string | null;
  readonly placement: DeviceStickerPlacement | null;
  readonly landing: number;
}

export interface DeviceStickerScene {
  readonly assets: readonly StickerArtwork[];
  readonly placements: readonly DeviceStickerPlacement[];
  readonly pack: StickerPackVisual | null;
  /** Calibration seam: disables only clearcoat, preserving the printed map. */
  readonly finishEnabled?: boolean;
  readonly onProjectionReady?: (handle: StickerRearProjection | null) => void;
  readonly onArtworkReady?: (id: string) => void;
  readonly onArtworkError?: (id: string) => void;
}

/** Runtime camera handle; never persist this or put it in Jotai user data. */
export interface StickerRearProjection { readonly project: (clientX: number, clientY: number) => {readonly x: number; readonly y: number} | null }
export const STICKER_PACK_LAYOUT = Object.freeze({ maxWidthPx: 240, widthRatio: .5, heightRatio: .875, teasePx: 32, bottomGapPx: 16 });
