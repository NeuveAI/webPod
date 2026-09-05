import { ExtrudeGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3, DoubleSide } from '../../../../../packages/device/node_modules/three/build/three.module.js'
import { frontShellPlan, productShellDepths } from '../../../../../packages/device/src/product-shell'
import { DEFAULT_DEVICE_FORM as form } from '../../../../../packages/device/src/form'
import { DEVICE_LAYOUT } from '../../../../../packages/device/src/layout'
import { DEVICE_SURFACE_LAYOUT } from '../../../../../packages/device/src/surface-layout'
import { circleHole,roundedRectHole,silhouetteShape } from '../../../../../packages/device/src/shapes'
import { frontCoreDepth,tessellateVerticalCrown } from '../../../../../packages/device/src/curved-shell'
import { squareRoundedRectApertureWalls, roundedRectBoundaryDistance } from '../../../../../packages/device/src/screen-aperture'
import { resolveFrontAssemblyDepths } from '../../../../../packages/device/src/front-surface'
const {body,wheel,screen}=DEVICE_LAYOUT
const hole=DEVICE_SURFACE_LAYOUT.front.displayWell
const plan=frontShellPlan(body.width,body.height,body.cornerR,form.seamWidth,form.frontBevel)
const shape=silhouetteShape(plan.faceWidth,plan.faceHeight,plan.faceCornerR,body.exponent,48)
shape.holes.push(roundedRectHole(hole.centerX,hole.centerY,hole.width,hole.height,hole.cornerR))
shape.holes.push(circleHole(wheel.centerX,wheel.centerY,wheel.outerR))
const extrusion=new ExtrudeGeometry(shape,{depth:frontCoreDepth(form.frontThickness,form.frontBevel),bevelEnabled:true,bevelThickness:form.frontBevel,bevelSize:form.frontBevel,bevelSegments:6,curveSegments:1})
const pos=extrusion.getAttribute('position')
const before=[]
for(let i=0;i<pos.count;i++) {
 const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i)
 if(Math.abs(x)<hole.width/2 && y>hole.centerY+hole.height/2-4 && y<hole.centerY+hole.height/2-3) before.push({x,y,z,distanceToVertex:roundedRectBoundaryDistance({x,y},hole)})
}
squareRoundedRectApertureWalls(extrusion,hole,form.frontBevel)
const missed=before.filter(p=>p.distanceToVertex>form.frontBevel+1e-5)
const unique=[...new Map(missed.map(p=>[JSON.stringify(p),p])).values()]
const geometry=tessellateVerticalCrown(extrusion,body.height/2-form.seamWidth,form.bodyCrown,undefined,{top:form.topEdgeCrown,bottom:form.bottomEdgeCrown,extent:form.edgeCrownExtent},{halfWidth:body.width/2-form.seamWidth,crown:form.bodyCrossCrown})
const depths=productShellDepths(body.depth,form.frontThickness)
geometry.translate(0,0,depths.seamZ+form.frontBevel)
const mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld()
const screenFrontZ=resolveFrontAssemblyDepths().screenFrontZ+.1
const raycaster=new Raycaster()
const rows=[]
for(const x of [-120,-80,0,80,120]) {
 for(const belowTop of [.25,.5,1,1.5,2,3]) {
  const y=screen.centerY+screen.height/2-belowTop
  raycaster.set(new Vector3(x,y,1000),new Vector3(0,0,-1))
  const hits=raycaster.intersectObject(mesh).filter(h=>h.point.z>screenFrontZ)
  rows.push({x,belowTop,bodyOccludes:hits.length>0,nearestZ:hits[0]?.point.z})
 }
}
console.log(JSON.stringify({hole,screen,form,missedUniqueVertices:unique,screenFrontZ,orthographicActiveTopRays:rows},null,2))
geometry.dispose();extrusion.dispose();mesh.material.dispose()
