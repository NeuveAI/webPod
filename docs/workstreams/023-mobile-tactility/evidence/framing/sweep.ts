import { PerspectiveCamera, Euler, Matrix4 } from '../../../../../packages/device/node_modules/three'
import { applyDeviceCameraFit, fitPerspectiveCameraToRotationalEnvelope, boxCorners, projectedPointsMetrics } from '../../../../../packages/device/src/camera-fit'
import { DEFAULT_DEVICE_ENVELOPE, deviceEnvelopeBounds } from '../../../../../packages/device/src/device-envelope'
import { deviceOrientationToRotation } from '../../../../../packages/device/src/orientation'
const results = []
for (const [width,height] of [[320,500],[390,776],[844,322]]) {
 const viewport = {width,height,safePadding:8,safeMarginRatio:.04}
 const bounds = deviceEnvelopeBounds(DEFAULT_DEVICE_ENVELOPE)
 const fit = fitPerspectiveCameraToRotationalEnvelope(bounds,viewport,12)
 const camera = new PerspectiveCamera(12)
 applyDeviceCameraFit(camera,fit,viewport)
 let maxX=0,maxY=0
 for(let yaw=-180;yaw<180;yaw+=3) for(let pitch=-48;pitch<=48;pitch+=3) {
  const rotation=new Matrix4().makeRotationFromEuler(new Euler(...deviceOrientationToRotation({pitchDeg:pitch,yawDeg:yaw,rollDeg:0}),'XYZ'))
  const points=boxCorners(bounds).map(p=>p.sub(bounds.getCenter(p.clone())).applyMatrix4(rotation))
  const metrics=projectedPointsMetrics(points,camera)
  maxX=Math.max(maxX,metrics.maxAbsX);maxY=Math.max(maxY,metrics.maxAbsY)
 }
 if(maxX>fit.maxNdcX+1e-6||maxY>fit.maxNdcY+1e-6)throw Error('clipped rotational envelope')
 results.push({viewport,distance:fit.distance,maxX,maxY,limitX:fit.maxNdcX,limitY:fit.maxNdcY})
}
console.log(JSON.stringify(results,null,2))
