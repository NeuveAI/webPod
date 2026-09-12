import { ExtrudeGeometry } from '../../../../../../packages/device/node_modules/three';
import { toCreasedNormals } from '../../../../../../packages/device/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { DEVICE_LAYOUT } from '../../../../../../packages/device/src/layout';
import { DEFAULT_DEVICE_FORM as form } from '../../../../../../packages/device/src/form';
import { DEVICE_SURFACE_LAYOUT } from '../../../../../../packages/device/src/surface-layout';
import { createRearShellGeometry, productShellDepths, frontShellPlan } from '../../../../../../packages/device/src/product-shell';
import { cutHardwareApertures } from '../../../../../../packages/device/src/hardware-apertures';
import { silhouetteShape, roundedRectHole, circleHole } from '../../../../../../packages/device/src/shapes';
import { frontCoreDepth, tessellateVerticalCrown } from '../../../../../../packages/device/src/curved-shell';
import { squareRoundedRectApertureWalls, removeOpaqueApertureWalls } from '../../../../../../packages/device/src/screen-aperture';
const {body,wheel}=DEVICE_LAYOUT, {displayWell}=DEVICE_SURFACE_LAYOUT.front;
const BEVEL_SEGMENTS=16, plateBackZ=productShellDepths(body.depth,form.frontThickness).seamZ;
const front=(()=>{
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
    squareRoundedRectApertureWalls(
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
    removeOpaqueApertureWalls(extrusion, {
      centerX: displayWell.centerX, centerY: displayWell.centerY,
      width: displayWell.width, height: displayWell.height, cornerR: displayWell.cornerR,
    });
    // Smooth the rolled aluminum before deformation; preserve the LCD wall
    // crease. ExtrudeGeometry starts with an independent normal per triangle.
    toCreasedNormals(extrusion, Math.PI / 4);
    const geometry = tessellateVerticalCrown(
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
    geometry.translate(0, 0, plateBackZ + form.frontBevel);
    return geometry;})();
const rearSource=createRearShellGeometry({width:body.width,height:body.height,depth:body.depth,cornerR:body.cornerR,exponent:body.exponent,frontThickness:form.frontThickness,rearCrownInset:form.rearCrownInset,frontRimInset:form.seamWidth+form.frontBevel+.25});
const rear=cutHardwareApertures(rearSource);rearSource.dispose();


import {createImmutableShells} from '../../../../../../packages/device/src/immutable-shells';
import {transferShell,restoreShell} from '../../../../../../packages/device/src/immutable-shell-transfer';
const start=performance.now(), built=createImmutableShells(form),workerConstructionAndIndexMs=performance.now()-start;
const transfer={front:transferShell(built.front),back:transferShell(built.back)};
const buffers=Object.values(transfer).flatMap(g=>[...Object.values(g.attributes).map(a=>a.array.buffer),...(g.index?[g.index.buffer]:[])]);
const restored=structuredClone(transfer,{transfer:buffers});
if(buffers.some(b=>b.byteLength!==0))throw Error('worker buffers did not transfer');
const output={front:restoreShell(restored.front),back:restoreShell(restored.back)};
const rows=[];
for(const [name,original]of [['front',front],['back',rear]]as const){const actual=output[name];const count=original.index?.count??original.getAttribute('position').count;
 for(let i=0;i<count;i++){const a=original.index?.getX(i)??i,b=actual.index?.getX(i)??i;for(const[key,attribute]of Object.entries(original.attributes)){const compact=actual.getAttribute(key);const n=attribute.itemSize*attribute.array.BYTES_PER_ELEMENT;const before=new Uint8Array(attribute.array.buffer,attribute.array.byteOffset+a*n,n),after=new Uint8Array(compact.array.buffer,compact.array.byteOffset+b*n,n);if(before.some((v,k)=>v!==after[k]))throw Error('worker byte parity '+name)}}
 if(JSON.stringify(original.groups)!==JSON.stringify(actual.groups)||JSON.stringify(original.boundingBox)!==JSON.stringify(actual.boundingBox)||JSON.stringify(original.boundingSphere)!==JSON.stringify(actual.boundingSphere))throw Error('metadata parity');
 rows.push({name,triangles:count/3,allExpandedAttributesExact:true,groupsAndBoundsExact:true,bytes:Object.values(actual.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(actual.index?.array.byteLength??0)});
 original.dispose();actual.dispose();
}
built.front.dispose();built.back.dispose();console.log(JSON.stringify({note:'Offline same pure factory run; constructor+index time is host CPU evidence, production executes in worker. Transfer uses real structuredClone buffers.',workerConstructionAndIndexMs,workerBuffersDetached:true,rows},null,2));
