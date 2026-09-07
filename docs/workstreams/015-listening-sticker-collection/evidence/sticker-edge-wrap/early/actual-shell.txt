import {ExtrudeGeometry,ShapeGeometry,BufferGeometry,Float32BufferAttribute,Matrix4,Vector3} from '/Users/vinicius/code/webPod/node_modules/.bun/three@0.185.1/node_modules/three/build/three.module.js';
import {toCreasedNormals} from '/Users/vinicius/code/webPod/node_modules/.bun/three@0.185.1/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {DEFAULT_DEVICE_FORM as form} from '/Users/vinicius/code/webPod/packages/device/src/form';
import {DEVICE_LAYOUT} from '/Users/vinicius/code/webPod/packages/device/src/layout';
import {DEVICE_SURFACE_LAYOUT} from '/Users/vinicius/code/webPod/packages/device/src/surface-layout';
import {createRearShellGeometry,frontShellPlan,productShellDepths} from '/Users/vinicius/code/webPod/packages/device/src/product-shell';
import {silhouetteShape,roundedRectHole,circleHole,roundedRectShape} from '/Users/vinicius/code/webPod/packages/device/src/shapes';
import {frontCoreDepth,tessellateVerticalCrown} from '/Users/vinicius/code/webPod/packages/device/src/curved-shell';
import {squareRoundedRectApertureWalls,removeOpaqueApertureWalls} from '/Users/vinicius/code/webPod/packages/device/src/screen-aperture';
import {createFrontControlPatchGeometry} from '/Users/vinicius/code/webPod/packages/device/src/front-control-geometry';
import {resolveFrontAssemblyDepths,SELECT_CONCAVITY,WHEEL_OUTER_SEAM_WIDTH} from '/Users/vinicius/code/webPod/packages/device/src/front-surface';
import {cutHardwareApertures} from '/Users/vinicius/code/webPod/packages/device/src/hardware-apertures';
export function actualShell(){
const {body,wheel}=DEVICE_LAYOUT,{displayWell,glass}=DEVICE_SURFACE_LAYOUT.front,depths=productShellDepths(body.depth,form.frontThickness);
const base=createRearShellGeometry({width:body.width,height:body.height,depth:body.depth,cornerR:body.cornerR,exponent:body.exponent,frontThickness:form.frontThickness,rearCrownInset:form.rearCrownInset,frontRimInset:form.seamWidth+form.frontBevel+.25});const rear=cutHardwareApertures(base);base.dispose();
const plan=frontShellPlan(body.width,body.height,body.cornerR,form.seamWidth,form.frontBevel),shape=silhouetteShape(plan.faceWidth,plan.faceHeight,plan.faceCornerR,body.exponent,48);shape.holes.push(roundedRectHole(displayWell.centerX,displayWell.centerY,displayWell.width,displayWell.height,displayWell.cornerR),circleHole(wheel.centerX,wheel.centerY,wheel.outerR));
const extrusion=new ExtrudeGeometry(shape,{depth:frontCoreDepth(form.frontThickness,form.frontBevel),bevelEnabled:true,bevelThickness:form.frontBevel,bevelSize:form.frontBevel,bevelSegments:16,curveSegments:1});squareRoundedRectApertureWalls(extrusion,displayWell,form.frontBevel);removeOpaqueApertureWalls(extrusion,displayWell);toCreasedNormals(extrusion,Math.PI/4);
const front=tessellateVerticalCrown(extrusion,body.height/2-form.seamWidth,form.bodyCrown,undefined,{top:form.topEdgeCrown,bottom:form.bottomEdgeCrown,extent:form.edgeCrownExtent},{halfWidth:body.width/2-form.seamWidth,crown:form.bodyCrossCrown});extrusion.dispose();front.translate(0,0,depths.seamZ+form.frontBevel);
const glassGeometry=new ShapeGeometry(roundedRectShape(glass.width,glass.height,glass.cornerR,12),1);
const ring=createFrontControlPatchGeometry({centerX:wheel.centerX,centerY:wheel.centerY,innerRadius:wheel.selectLipR,outerRadius:wheel.outerR-WHEEL_OUTER_SEAM_WIDTH,uvRadius:wheel.outerR},form),select=createFrontControlPatchGeometry({centerX:wheel.centerX,centerY:wheel.centerY,innerRadius:0,outerRadius:wheel.selectR,concavity:SELECT_CONCAVITY,uvRadius:wheel.outerR},form);
const assembly=resolveFrontAssemblyDepths(form);
const raw=front.getAttribute('position'),cap=front.getAttribute('crownCap'),eligible=[];
// Explicitly scoped right-edge ordinary Pulse patch. Aperture walls are not approved support.
for(let i=0;i<raw.count;i+=3){const vertices=[0,1,2].map(k=>new Vector3().fromBufferAttribute(raw,i+k));const insidePatch=vertices.every(p=>p.x>=80&&Math.abs(p.y)<=90);if(!insidePatch||cap.getX(i)<0)continue;for(const p of vertices)eligible.push(...p.toArray());}
const frontSupport=new BufferGeometry();frontSupport.setAttribute('position',new Float32BufferAttribute(eligible,3));
const faces=[{geometry:rear,source:'actual cut rear',kind:'surface',adhesiveSupport:true},{geometry:front,source:'actual crowned front collision only',kind:'surface'},{geometry:frontSupport,source:'approved ordinary right-edge front patch',kind:'surface',adhesiveSupport:true},{geometry:glassGeometry,transform:new Matrix4().makeTranslation(glass.centerX,glass.centerY,assembly.glassFrontZ),source:'actual glass collision',kind:'surface'},{geometry:ring,transform:new Matrix4().makeTranslation(wheel.centerX,wheel.centerY,assembly.wheelSurfaceBaseZ),source:'actual wheel collision',kind:'surface'},{geometry:select,transform:new Matrix4().makeTranslation(wheel.centerX,wheel.centerY,assembly.wheelSurfaceBaseZ),source:'actual select collision',kind:'surface'}];
return{faces,rear,front,dispose(){for(const g of[rear,front,frontSupport,glassGeometry,ring,select])g.dispose();}};
}
