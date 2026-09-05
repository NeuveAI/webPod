/**
 * Aluminum iPod Classic enclosure, matching the owner's 120GB reference.
 * Primary appearance: IMG_2289/2290 in ~/code/tmp/ipod-reference.
 * Overall dimensions: https://support.apple.com/en-us/112321.
 * The preserved front raster below is the legacy 5G layout source, not a new
 * measurement of Classic hardware. The owner explicitly protects the screen;
 * both families share its 2.5-inch 320×240 display and overall front dimensions.
 */
export const IPOD_CLASSIC_PHYSICAL_SPEC = Object.freeze({
  variant: "iPod Classic 120GB thin (A1238)",
  bodyMm: Object.freeze({
    width: 61.8,
    height: 103.5,
    depth: 10.5,
  }),
  display: Object.freeze({
    diagonalInches: 2.5,
    semanticWidth: 320,
    semanticHeight: 240,
    activeWidthMm: 50.8,
    activeHeightMm: 38.1,
  }),
  legacyFrontRaster: Object.freeze({
    body: Object.freeze({ width: 377, height: 629 }),
    screenTop: 27,
    wheelDiameter: 235,
    wheelCenterFromTop: 444,
    selectDiameter: 84,
    uncertaintyPx: 2,
  }),
  /**
   * Profile dimensions bounded by teardown/side photography, not an OEM
   * drawing.
   */
  photoDerivedProfileMm: Object.freeze({
    frontShellDepth: 1.5,
    rearCrownInset: 1.6,
  }),
  /**
   * Projected seam bounds measured across Apple, iFixit and contemporary OEM
   * photographs. These are image-space limits, not an unsupported claim that
   * either assembly seam has a known millimetre depth.
   */
  wheelAssemblyRasterBounds: Object.freeze({
    wheelDiameterPx: 235,
    wheelSeamMaxPx: 2,
    selectDiameterPx: 84,
    selectSeamMaxPx: 2,
  }),
  /**
   * Structural acceptance envelope from owner IMG_2239/2240/2242/2243/2248/
   * 2249. These are maximum model tolerances, not claims of Apple machining
   * dimensions: the production surfaces are exactly coincident and the floor
   * is only a depth-buffer separator.
   */
  wheelAssemblyAcceptanceMm: Object.freeze({
    topPlaneTolerance: 0.1,
    outerSeamMaximum: 0.1,
    selectSeamMaximum: 0.2,
    visibleSidewallMaximum: 0.02,
    referenceObliqueDegrees: 40,
  }),
} as const);

export function rasterRatio(measurement: number, reference: number): number {
  if (!(measurement > 0) || !(reference > 0)) {
    throw new Error("physical reference ratios require positive measurements");
  }
  return measurement / reference;
}
