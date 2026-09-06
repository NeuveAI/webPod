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
  readonly sheet?: { readonly neighbors?: readonly { readonly ink: string; readonly stickerId: string }[]; readonly reveal: number; readonly ink: string; readonly slots: readonly { readonly stickerId: string; readonly state: 'locked' | 'sealed' | 'earned' | 'placed' }[] };
  /** Mobile packet moves aside after peel while the device and held print stay put. */
  readonly workspaceLowering?: number;
  readonly dragOffset?: { readonly x: number; readonly y: number } | null;
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
export const STICKER_PACK_LAYOUT = Object.freeze({ maxWidthPx: 320, widthRatio: .70, heightRatio: 1.05, teasePx: 44, bottomGapPx: 32, desktopBreakpoint: 960, desktopCenter: .79, linerTravel: .72 });
/** One pixel layout drives the DOM hit regions and camera-projected physical liner. */
export function stickerPackViewportLayout(viewportWidth: number, viewportHeight: number) {
  const width = Math.min(STICKER_PACK_LAYOUT.maxWidthPx, viewportWidth * STICKER_PACK_LAYOUT.widthRatio, viewportHeight * .64 / (STICKER_PACK_LAYOUT.heightRatio * (1 + STICKER_PACK_LAYOUT.linerTravel)));
  return { width, height: width * STICKER_PACK_LAYOUT.heightRatio, centerX: viewportWidth >= STICKER_PACK_LAYOUT.desktopBreakpoint ? viewportWidth * STICKER_PACK_LAYOUT.desktopCenter : viewportWidth / 2 };
}
/** Five seats on a single liner: the lower pair is centered rather than leaving a blank cell. */
export const STICKER_SHEET_SLOTS = Object.freeze([
  { x: .19, y: .35 }, { x: .5, y: .35 }, { x: .81, y: .35 }, { x: .345, y: .59 }, { x: .655, y: .59 },
]);
export const STICKER_SHEET_PRINT_WIDTH = .245;
