import { ExtrudeGeometry, ShapeGeometry } from 'three';
import type { DeviceFormParams } from './form';
import { createFrontControlPatchGeometry, createWheelGapFloorGeometries } from './front-control-geometry';
import { SELECT_CONCAVITY, WHEEL_OUTER_SEAM_WIDTH } from './front-surface';
import { DEVICE_LAYOUT, SCREEN_CORNER_R } from './layout';
import { DEVICE_SURFACE_LAYOUT } from './surface-layout';
import { roundedRectShape, roundedRectFrameShape } from './shapes';
import { createScreenGeometry } from './screen-geometry';
import { drainSteps } from './sticker-computation-steps';
const {wheel,screen}=DEVICE_LAYOUT;
const {glass,mask,displayWell}=DEVICE_SURFACE_LAYOUT.front;
/** Exact insert geometry, prepared before any renderer owns its buffers. */
export function createDeviceInsertGeometry(form: DeviceFormParams) { return drainSteps(createDeviceInsertGeometrySteps(form)); }
export function* createDeviceInsertGeometrySteps(form: DeviceFormParams) {
 const controls=(()=>{
    const controlForm = {
      seamWidth: form.seamWidth,
      bodyCrown: form.bodyCrown,
      bodyCrossCrown: form.bodyCrossCrown,
      topEdgeCrown: form.topEdgeCrown,
      bottomEdgeCrown: form.bottomEdgeCrown,
      edgeCrownExtent: form.edgeCrownExtent,
    };
    const gapFloor = createWheelGapFloorGeometries(controlForm);
    const selectGeometry = createFrontControlPatchGeometry(
        {
          centerX: wheel.centerX,
          centerY: wheel.centerY,
          innerRadius: 0,
          outerRadius: wheel.selectR,
          concavity: SELECT_CONCAVITY,
          uvRadius: wheel.outerR,
        },
        controlForm,
      );
    // Match the extrusion's model-unit UVs; the wheel retains its decal UVs.
    const position = selectGeometry.getAttribute("position");
    const uv = selectGeometry.getAttribute("uv");
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, position.getX(index) + wheel.centerX, position.getY(index) + wheel.centerY);
    }
    uv.needsUpdate = true;
    return {
      ringGeometry: createFrontControlPatchGeometry(
        {
          centerX: wheel.centerX,
          centerY: wheel.centerY,
          innerRadius: wheel.selectLipR,
          outerRadius: wheel.outerR - WHEEL_OUTER_SEAM_WIDTH,
          uvRadius: wheel.outerR,
        },
        controlForm,
      ),
      selectGeometry,
      selectSeamGeometry: gapFloor.selectSeam,
      outerSeamGeometry: gapFloor.outerSeam,
    };
})();
yield;
const glassGeometry=(()=>{
    const shape = roundedRectShape(
      glass.width,
      glass.height,
      glass.cornerR,
      12,
    );
    // The cover sheet contributes reflection across its face, not a raised
    // perimeter. A planar shape keeps its thickness from becoming a visible
    // silver lip around the LCD opening at oblique viewing angles.
    return new ShapeGeometry(shape, 1);

})();
yield;
const displayMaskGeometry=(()=>{
    const shape = roundedRectFrameShape(
      {
        width: mask.width,
        height: mask.height,
        radius: mask.cornerR,
      },
      {
        width: screen.width,
        height: screen.height,
        radius: screen.cornerR,
      },
      12,
    );
    const geometry = new ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -0.08);
    return geometry;

})();
yield;
const displayWellGeometry=(()=>{
    const shape = roundedRectFrameShape(
      {
        width: displayWell.width,
        height: displayWell.height,
        radius: displayWell.cornerR,
      },
      {
        width: glass.width - 1,
        height: glass.height - 1,
        radius: glass.cornerR - 0.5,
      },
      12,
    );
    const geometry = new ExtrudeGeometry(shape, {
      // Fill the complete opening depth with black so the glossy face's own
      // hole wall never becomes a reflective bezel at a quarter view.
      depth: Math.max(
        0.1,
        form.displayWellInset + form.displayWellDepth,
      ),
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.translate(
      0,
      0,
      -Math.max(0.1, form.displayWellInset + form.displayWellDepth),
    );
    return geometry;

})();
yield;
const screenGeometry=createScreenGeometry(screen.width,screen.height,SCREEN_CORNER_R);
return {...controls,glassGeometry,displayMaskGeometry,displayWellGeometry,screenGeometry};
}
