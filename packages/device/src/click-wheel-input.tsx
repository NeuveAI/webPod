import { useThree } from '@react-three/fiber';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Mesh, Group } from 'three';
import { completeDeviceEnvelope } from './device-envelope';
import { deviceOrientationToRotation } from './orientation';
import { useControlPhysics } from './ControlPhysicsScope';
import { DeviceCanvasOrientationContext } from './DeviceCanvas';
import { setDeviceControlCursor } from './cursor-intent';
import { createClickWheelEventController } from './click-wheel-event-controller';
import { clickWheelInputPosition, wheelPointFromRay, raycastWheelRing, raycastWheelSelect, CLICK_WHEEL_INPUT_RADII, type ClickWheelInputSurfaceProps } from './click-wheel-input-core';
export * from './click-wheel-input-core';

export function ClickWheelInputSurface({
  onArcStart,
  onArcMove,
  onArcEnd,
  onSelectStart,
  onSelectEnd,
  onCardinalPress,
  onCardinalStart,
  onCardinalEnd,
}: ClickWheelInputSurfaceProps) {
  const canvas = useThree((state) => state.gl.domElement);
  const orientationState = useContext(DeviceCanvasOrientationContext);
  const controlPhysics = useControlPhysics();
  const inputPosition = useMemo(
    () => clickWheelInputPosition(orientationState.form),
    [orientationState.form],
  );
  const envelope = useMemo(() => completeDeviceEnvelope(orientationState.form), [orientationState.form]);
  const meshRef = useRef<Mesh>(null);
  const poseRef = useRef<Group>(null);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const authority = orientationState.motionAuthority;
    const pose = poseRef.current;
    if (!authority || !pose) return;
    const publish = () => {
      const [x, y, z] = deviceOrientationToRotation(authority.readIntent().orientation);
      pose.rotation.set(x, y, z, 'XYZ');
      pose.updateMatrix(); pose.updateWorldMatrix(true, false);
      invalidate();
    };
    publish();
    return authority.subscribeIntent(publish);
  }, [orientationState.motionAuthority, orientationState.frontInteractive, invalidate]);
  const callbacksRef = useRef<ClickWheelInputSurfaceProps>({onArcStart, onArcMove, onArcEnd, onSelectStart, onSelectEnd, onCardinalPress, onCardinalStart, onCardinalEnd});
  useLayoutEffect(() => {callbacksRef.current = {onArcStart, onArcMove, onArcEnd, onSelectStart, onSelectEnd, onCardinalPress, onCardinalStart, onCardinalEnd};});
  const events = useMemo(() => createClickWheelEventController({controlPhysics}), [controlPhysics]);
  useLayoutEffect(() => {events.configure({callbacks: () => callbacksRef.current,
    point: event => meshRef.current ? wheelPointFromRay(meshRef.current, event.ray) : null});}, [events]);
  useLayoutEffect(() => {
    if (!orientationState.frontInteractive) {
      events.dispose();
      setDeviceControlCursor(canvas, false);
    }
  }, [events, canvas, orientationState.frontInteractive]);
  useEffect(() => orientationState.frontInteractive ? events.attachKeyboard() : undefined, [events, orientationState.frontInteractive]);
  useEffect(() => () => {events.dispose(); setDeviceControlCursor(canvas, false);}, [events, canvas]);

  if (!orientationState.frontInteractive) return null;

  return (
    <group ref={poseRef} name="click-wheel-input-pose" rotation={deviceOrientationToRotation(orientationState.orientation)}>
      <group position={[-envelope.center[0], -envelope.center[1], -envelope.center[2]]}>
      <mesh
        ref={meshRef}
        name="click-wheel-input"
        raycast={raycastWheelRing}
        userData={{ wheelSurfaceForm: orientationState.form }}
        position={inputPosition}
        onPointerDown={events.wheel.down}
        onPointerMove={events.wheel.move}
        onPointerUp={events.wheel.up}
        onPointerOver={() => setDeviceControlCursor(canvas, true)}
        onPointerOut={() => setDeviceControlCursor(canvas, false)}
        renderOrder={-1}
      >
        <ringGeometry
          args={[
            CLICK_WHEEL_INPUT_RADII.inner,
            CLICK_WHEEL_INPUT_RADII.outer,
            128,
          ]}
        />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>
      <mesh name="click-wheel-select-input" raycast={raycastWheelSelect} userData={{wheelSurfaceForm: orientationState.form}} position={inputPosition}
        onPointerDown={events.select.down} onPointerMove={events.select.move} onPointerUp={events.select.up}
        onPointerOver={() => setDeviceControlCursor(canvas, true)} onPointerOut={() => setDeviceControlCursor(canvas, false)} renderOrder={-1}>
        <circleGeometry args={[CLICK_WHEEL_INPUT_RADII.inner, 128]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      </group>
    </group>
  );
}
