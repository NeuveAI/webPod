/**
 * Physical target for webPod's enclosure.
 *
 * The chosen product is the **thin 30GB iPod (5th generation / Late 2006)**.
 * The 60/80GB 0.55-inch rear case is a different housing and must not be
 * mixed into this model.
 *
 * Sources:
 * - Apple model identity and straight-on product image:
 *   https://support.apple.com/en-ie/103823
 *   https://cdsassets.apple.com/live/7WUAS350/images/ipod/ipod-classic/ipod-5th-gen.png
 * - Apple launch specification (2.5-inch colour display, 30/60GB family):
 *   https://www.apple.com/newsroom/2005/10/12Apple-Unveils-the-New-iPod/
 * - iFixit assembly evidence (plastic front separated from metal back):
 *   https://www.ifixit.com/Guide/iPod+5th+Generation+(Video)+Front+Panel+Replacement/610
 * - Thin/thick replacement-shell distinction:
 *   https://imods.com/products/apple-ipod-video-5th-generation-backplate-30gb-replacement-parts-and-service
 * - Orthographic-ish thin-model side profile:
 *   https://www.mobiletechreview.com/iPod/iPod-video.htm
 *   https://www.mobiletechreview.com/iPod/images/ipod_5G/side.jpg
 * - Refurbished multi-angle product photography (secondary visual check):
 *   https://retrospekt.com/products/apple-ipod-5th-generation-mp3-player
 *
 * `appleFrontRaster` is a bounded pixel measurement of Apple's linked 5G
 * product image. It is deliberately stored as source pixels rather than as a
 * pre-rounded ratio so tests can re-derive the model dimensions. Boundaries
 * are uncertain by roughly two raster pixels because the render is anti-aliased.
 */
export const IPOD_5G_30GB_PHYSICAL_SPEC = Object.freeze({
  variant: "iPod 5G/5.5G 30GB thin (A1136)",
  bodyMm: Object.freeze({
    // MobileTechReview's 4.1 × 2.4 × 0.43in thin-player specification,
    // expressed at the less-rounded metric dimensions used by repair parts.
    width: 61.8,
    height: 103.5,
    depth: 11,
  }),
  display: Object.freeze({
    diagonalInches: 2.5,
    semanticWidth: 320,
    semanticHeight: 240,
    activeWidthMm: 50.8,
    activeHeightMm: 38.1,
  }),
  appleFrontRaster: Object.freeze({
    body: Object.freeze({ width: 377, height: 629 }),
    screenTop: 27,
    wheelDiameter: 235,
    wheelCenterFromTop: 444,
    selectDiameter: 84,
    uncertaintyPx: 2,
  }),
  /**
   * Profile dimensions bounded by teardown/side photography, not an OEM
   * drawing. Keep that provenance explicit until the owner supplies a
   * caliper/profile reference.
   */
  photoDerivedProfileMm: Object.freeze({
    frontShellDepth: 2.6,
    rearCrownInset: 1.6,
    selectRise: 1,
  }),
} as const);

export function rasterRatio(
  measurement: number,
  reference: number,
): number {
  if (!(measurement > 0) || !(reference > 0)) {
    throw new Error("physical reference ratios require positive measurements");
  }
  return measurement / reference;
}
