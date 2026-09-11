import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { DeviceMotionAuthority } from './device-motion-authority';
import { deviceOrientationToRotation } from './orientation';
import { DEVICE_MODEL_NAME } from './ViewerLitDeviceFrame';

/** Minimal GL fallback publication: mutate the one rigid model root, then use
 * the existing render/screen signal. No React tree or assembly reconstruction. */
export function DeviceMotionBridge({authority}: {readonly authority: DeviceMotionAuthority}) {
  const scene = useThree(state => state.scene);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const model = scene.getObjectByName(DEVICE_MODEL_NAME);
    if (!model) return;
    const publish = () => {
      const orientation = authority.readIntent().orientation;
      const [x, y, z] = deviceOrientationToRotation(orientation);
      model.rotation.set(x, y, z, 'XYZ');
      model.updateMatrix();
      model.updateWorldMatrix(true, false);
      invalidate();
    };
    publish();
    return authority.subscribeIntent(publish);
  }, [authority, scene, invalidate]);
  return null;
}
