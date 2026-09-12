import {translatePreparedGeometrySteps} from './geometry-preparation-steps';
import { drainSteps } from './sticker-computation-steps';
import type {BufferGeometry} from 'three';
import { ExtrudeGeometry } from 'three';
import { creasePreparedNormalsSteps } from './creased-normal-steps';
import { frontCoreDepth, tessellateVerticalCrownSteps } from './curved-shell';
import { createRearShellGeometrySteps, frontShellPlan, productShellDepths } from './product-shell';
import { cutHardwareAperturesSteps } from './hardware-apertures';
import { circleHole, roundedRectHole, silhouetteShape } from './shapes';
import { squareRoundedRectApertureWallsSteps, removeOpaqueApertureWallsSteps } from './screen-aperture';
import { DEVICE_LAYOUT } from './layout';
import { DEVICE_SURFACE_LAYOUT } from './surface-layout';
import type { DeviceFormParams } from './form';
import { indexImmutableGeometrySteps } from './immutable-geometry-index';
const {body,wheel}=DEVICE_LAYOUT, {displayWell}=DEVICE_SURFACE_LAYOUT.front;
const BEVEL_SEGMENTS=16;
/** Exact original procedural shell factory. Worker compacts after all edits;
 * CPU recovery executes the same staged, indexed recipe with cooperative yields. */
export function createImmutableShells(form: DeviceFormParams, indexed = true) { return drainSteps(createImmutableShellsSteps(form,indexed)); }
export function* createImmutableShellsSteps(form:DeviceFormParams,indexed=true):Generator<void,{front:BufferGeometry;back:BufferGeometry},void> {
 const plateBackZ=productShellDepths(body.depth,form.frontThickness).seamZ;
 const back=yield* (function*(){
    const shell = yield* createRearShellGeometrySteps({
      width: body.width,
      height: body.height,
      depth: body.depth,
      cornerR: body.cornerR,
      exponent: body.exponent,
      frontThickness: form.frontThickness,
      rearCrownInset: form.rearCrownInset,
      frontRimInset: form.seamWidth + form.frontBevel + 0.25,
    });
    yield;
    const opened = yield* cutHardwareAperturesSteps(shell);
    shell.dispose();
    return indexed ? yield* indexImmutableGeometrySteps(opened) : opened;
})();
 const front=yield* (function*(){
    // §5.6 modelled rather than stroked: the aluminum front is inset by
    // the seam width, so what runs round the perimeter is the steel shell's own
    // rolled edge, presenting a different angle to the light at every point of
    // the silhouette — §10.4 prevention #6, for free.
    const seam = form.seamWidth;
    const plan = frontShellPlan(
      body.width,
      body.height,
      body.cornerR,
      seam,
      form.frontBevel,
    );
    const shape = silhouetteShape(
      plan.faceWidth,
      plan.faceHeight,
      plan.faceCornerR,
      body.exponent,
      48,
    );
    shape.holes.push(
      roundedRectHole(
        displayWell.centerX,
        displayWell.centerY,
        displayWell.width,
        displayWell.height,
        displayWell.cornerR,
      ),
    );
    shape.holes.push(circleHole(wheel.centerX, wheel.centerY, wheel.outerR));
    const extrusion = new ExtrudeGeometry(shape, {
      depth: frontCoreDepth(form.frontThickness, form.frontBevel),
      bevelEnabled: true,
      bevelThickness: form.frontBevel,
      bevelSize: form.frontBevel,
      bevelSegments: BEVEL_SEGMENTS,
      curveSegments: 1,
    });
    // Three applies the outer-shell bevel to holes as well. The flush LCD
    // opening is square to the glossy face, so collapse only this hole's
    // generated slope before the shell crown is applied.
    yield* squareRoundedRectApertureWallsSteps(
      extrusion,
      {
        centerX: displayWell.centerX,
        centerY: displayWell.centerY,
        width: displayWell.width,
        height: displayWell.height,
        cornerR: displayWell.cornerR,
      },
      form.frontBevel,
    );
    yield* removeOpaqueApertureWallsSteps(extrusion, {
      centerX: displayWell.centerX, centerY: displayWell.centerY,
      width: displayWell.width, height: displayWell.height, cornerR: displayWell.cornerR,
    });
    // Smooth the rolled aluminum before deformation; preserve the LCD wall
    // crease. ExtrudeGeometry starts with an independent normal per triangle.
    yield;
    yield* creasePreparedNormalsSteps(extrusion,Math.PI/4);
    yield;
    const geometry = yield* tessellateVerticalCrownSteps(
      extrusion,
      body.height / 2 - seam,
      form.bodyCrown,
      undefined,
      { top: form.topEdgeCrown, bottom: form.bottomEdgeCrown, extent: form.edgeCrownExtent },
      {
        halfWidth: body.width / 2 - seam,
        crown: form.bodyCrossCrown,
      },
    );
    extrusion.dispose();
    yield* translatePreparedGeometrySteps(geometry,0,0,plateBackZ+form.frontBevel);
    return indexed ? yield* indexImmutableGeometrySteps(geometry) : geometry;
})();
 return {front,back};
}
