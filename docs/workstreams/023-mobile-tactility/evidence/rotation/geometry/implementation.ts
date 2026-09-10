import { ExtrudeGeometry, type BufferGeometry, ShapeGeometry } from '../../../../../../packages/device/node_modules/three';
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
const buildStart=performance.now();
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

import {createHardwareGeometry} from '../../../../../../packages/device/src/hardware-geometry';
import {createFrontControlPatchGeometry,createWheelGapFloorGeometries} from '../../../../../../packages/device/src/front-control-geometry';
import {SELECT_CONCAVITY,WHEEL_OUTER_SEAM_WIDTH} from '../../../../../../packages/device/src/front-surface';
import {roundedRectShape,roundedRectFrameShape} from '../../../../../../packages/device/src/shapes';
import {createScreenGeometry} from '../../../../../../packages/device/src/screen-geometry';
import {SCREEN_CORNER_R} from '../../../../../../packages/device/src/layout';
const {glass,mask}=DEVICE_SURFACE_LAYOUT.front;
const {screen}=DEVICE_LAYOUT;
const controls=(()=>{    const controlForm = {
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

const hardware=createHardwareGeometry(form);
const entries=[{name:'front',geometry:front},{name:'rear',geometry:rear},...Object.entries(controls).map(([name,geometry])=>({name,geometry})),{name:'glass',geometry:glassGeometry},{name:'displayMask',geometry:displayMaskGeometry},{name:'displayWell',geometry:displayWellGeometry},{name:'screen',geometry:createScreenGeometry(screen.width,screen.height,SCREEN_CORNER_R)},...hardware];
const baselineConstructionMs=performance.now()-buildStart;
function measure(geometry:BufferGeometry) {
 const attrs=Object.entries(geometry.attributes);
 const count=geometry.getAttribute('position').count;
 const map=new Map<string,number>(), unique:number[]=[], indices:number[]=[];
 let allAttributeBytes=0;
 for(const [,attr] of attrs) allAttributeBytes+=attr.array.byteLength;
 for(let i=0;i<count;i++) {
  // Raw byte keys preserve signed zero and every Float32 bit: no tolerance weld.
  const key=attrs.map(([name,a])=> {const bytes=new Uint8Array(a.array.buffer,a.array.byteOffset+i*a.itemSize*a.array.BYTES_PER_ELEMENT,a.itemSize*a.array.BYTES_PER_ELEMENT);return name+':'+Array.from(bytes).join(',')}).join('|');
  let id=map.get(key);if(id===undefined){id=unique.length;map.set(key,id);unique.push(i)}indices.push(id);
 }
 const sourceIndex=geometry.index;
 const expanded=sourceIndex?Array.from(sourceIndex.array):Array.from({length:count},(_,i)=>i);
 for(const original of expanded) {const compact=indices[original];if(compact===undefined)throw Error('missing index');const canonical=unique[compact];if(canonical===undefined)throw Error('missing vertex');for(const [,a] of attrs){const size=a.itemSize*a.array.BYTES_PER_ELEMENT;const src=new Uint8Array(a.array.buffer,a.array.byteOffset+original*size,size),dst=new Uint8Array(a.array.buffer,a.array.byteOffset+canonical*size,size);if(src.some((v,k)=>v!==dst[k]))throw Error('bit parity')}}
 const attributeStride=attrs.reduce((n,[,a])=>n+a.itemSize*a.array.BYTES_PER_ELEMENT,0);
 const existingBytes=allAttributeBytes+(sourceIndex?.array.byteLength??0),exactIndexedBytes=unique.length*attributeStride+expanded.length*(unique.length>65535?4:2);
 return {vertices:count,triangles:expanded.length/3,indexed:!!sourceIndex,attributes:attrs.map(([name,a])=>({name,itemSize:a.itemSize,type:a.array.constructor.name,bytes:a.array.byteLength})),attributeBytes:allAttributeBytes,indexBytes:sourceIndex?.array.byteLength??0,totalBytes:existingBytes,groups:geometry.groups.length,uniqueExactVertices:unique.length,exactIndexedBytes,savedBytes:existingBytes-exactIndexedBytes,triangleAttributeExpansionBitExact:true};
}
import {indexImmutableGeometry} from '../../../../../../packages/device/src/immutable-geometry-index';
const implementation=entries.map(({name,geometry})=>{
 const original=geometry.clone();const groups=JSON.stringify(geometry.groups),bounds=JSON.stringify([geometry.boundingBox,geometry.boundingSphere]);
 const start=performance.now();if(name==='front'||name==='rear')indexImmutableGeometry(geometry);const finalizeMs=performance.now()-start;
 const count=original.index?.count??original.getAttribute('position').count;
 for(let i=0;i<count;i++) {const a=original.index?.getX(i)??i,b=geometry.index?.getX(i)??i;for(const [key,attr] of Object.entries(original.attributes)) {const actual=geometry.getAttribute(key);const bytes=attr.itemSize*attr.array.BYTES_PER_ELEMENT;const before=new Uint8Array(attr.array.buffer,attr.array.byteOffset+a*bytes,bytes),after=new Uint8Array(actual.array.buffer,actual.array.byteOffset+b*bytes,bytes);if(before.some((v,k)=>v!==after[k]))throw Error('implementation parity '+name)}}
 if(groups!==JSON.stringify(geometry.groups)||bounds!==JSON.stringify([geometry.boundingBox,geometry.boundingSphere]))throw Error('metadata changed');
 const bytes=Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(geometry.index?.array.byteLength??0);
 original.dispose();return {name,finalizeMs,bytes,expandedAttributeBytesExact:true,groupsAndBoundsExact:true};
});
const rows=entries.map(({name,geometry})=>({name,...measure(geometry)}));
const byMaterial=Object.fromEntries([...new Set(hardware.map(p=>p.material))].map(material=>[material,hardware.filter(p=>p.material===material).map(p=>p.name)]));
const sum=(key:'totalBytes'|'exactIndexedBytes'|'triangles')=>rows.reduce((n,r)=>n+r[key],0);
const result={baselineConstructionMs,note:'Default form offline generated geometry. Buffer byte counts are exact typed-array payload, not driver allocation, peak JS heap, GPU time or frame rate. Draw counts are source-derived one color pass, absent stickers and auxiliary lighting/PMREM.',rows,totals:{uniqueGeometryObjects:entries.length,triangles:sum('triangles'),typedBytes:sum('totalBytes'),exactIndexedBytes:sum('exactIndexedBytes'),savedBytes:sum('totalBytes')-sum('exactIndexedBytes'),hardwareMeshes:hardware.length,hardwareMaterials:Object.keys(byMaterial).length,deviceVisibleDraws:11+hardware.length,deviceSubmittedTriangles:sum('triangles')+(rows.find(r=>r.name==='ringGeometry')?.triangles??0)},hardwareByMaterial:byMaterial,implementation,production:{baselineBytes:21939808,finalBytes:sum('totalBytes'),savedBytes:21939808-sum('totalBytes'),note:'Only front/rear finalized in production worker; all-geometry theoretical maximum remains measurements.json'}};
console.log(JSON.stringify(result,null,2));entries.forEach(e=>e.geometry.dispose());
