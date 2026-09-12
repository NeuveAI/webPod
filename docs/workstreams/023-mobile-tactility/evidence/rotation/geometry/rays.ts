import { Mesh, MeshBasicMaterial, Raycaster, Vector3, ExtrudeGeometry, type Intersection } from '../../../../../../packages/device/node_modules/three';
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
const points=[[0,0],[0,wheel.centerY],[wheel.outerR*.7,wheel.centerY],[wheel.outerR,wheel.centerY],[0,wheel.centerY+wheel.outerR],[-160,0],[-140,0],[-100,0],[160,0],[140,0],[100,0],[0,270],[0,-270],[145,250],[-145,-250],[0,displayWell.centerY],[displayWell.width/2,displayWell.centerY],[displayWell.width/2+2,displayWell.centerY],[displayWell.width/2-2,displayWell.centerY],[0,displayWell.centerY+displayWell.height/2]];
const poses=[[0,0],[0,45],[0,90],[0,180],[45,45],[-45,-45],[30,160]];
const report=[];
const indexReport=[];
const {buildShellPickingIndex}=await import('../../../../../../packages/device/src/shell-picking-index');
const {createIndexedShellRaycast}=await import('../../../../../../packages/device/src/shell-picking');
for(const [name,geometry] of [['front',front],['rear',rear]] as const) {
 const baselineGeometry=geometry.clone();
 const {indexImmutableGeometry}=await import('../../../../../../packages/device/src/immutable-geometry-index');indexImmutableGeometry(geometry);
 const position=geometry.getAttribute('position'); const start=performance.now();
 const index=buildShellPickingIndex({positions:Float32Array.from(position.array),indices:geometry.index?Uint32Array.from(geometry.index.array):null});
 const buildMs=performance.now()-start, prepared=createIndexedShellRaycast(geometry,index), shell=new Mesh(geometry,new MeshBasicMaterial());
 const baseline=new Mesh(baselineGeometry,shell.material);
 let baselineMs=0,indexedMs=0,rays=0;
 for(const side of [0,1,2]) {shell.material.side=side;
 for(const [pitch,yaw] of poses) {shell.rotation.set((pitch??0)*Math.PI/180,(yaw??0)*Math.PI/180,0);shell.updateMatrixWorld();baseline.matrixWorld.copy(shell.matrixWorld);
 for(const [x,y] of points) {
  const origin=new Vector3(0,0,1500), target=new Vector3(x,y,0).applyMatrix4(shell.matrixWorld), ray=new Raycaster(origin,target.sub(origin).normalize());
  const expected:Intersection[]=[],actual:Intersection[]=[];
  let t=performance.now();Mesh.prototype.raycast.call(baseline,ray,expected);baselineMs+=performance.now()-t;
  t=performance.now();prepared.raycast.call(shell,ray,actual);indexedMs+=performance.now()-t;
  if(expected.length!==actual.length || actual.some((h,i)=> {const e=expected[i];if(!e)throw Error('missing expected hit');return h.faceIndex!==e.faceIndex||h.object!==shell||h.point.distanceTo(e.point)>1e-8||Math.abs(h.distance-e.distance)>1e-8||JSON.stringify(h.face?.normal)!==JSON.stringify(e.face?.normal)||h.face?.materialIndex!==e.face?.materialIndex||JSON.stringify(h.uv)!==JSON.stringify(e.uv)||JSON.stringify(h.normal)!==JSON.stringify(e.normal)}))throw Error('indexed parity '+name+' '+pitch+' '+yaw+' '+x+' '+y);
  rays++;
 }}}
 indexReport.push({name,buildMs,rays,baselineMs,indexedMs});prepared.dispose();baselineGeometry.dispose();shell.material.dispose();
}
front.dispose();rear.dispose();
console.log(JSON.stringify({note:'Offline unthrottled Bun, render geometry source copied verbatim from Device front factory; timings single bounded pass, not browser/input latency.',report,indexReport},null,2));
