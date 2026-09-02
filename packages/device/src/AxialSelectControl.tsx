import { useEffect, useRef, type ReactNode } from "react";
import { type BufferGeometry, Mesh } from "three";

import { useControlPhysics } from "./ControlPhysicsScope";

export type AxialSelectControlProps = {
  readonly geometry: BufferGeometry;
  readonly position: readonly [number, number, number];
  readonly children: ReactNode;
};

/**
 * Keeps the authored rest frame declarative while physics owns child-local Z.
 *
 * The child deliberately has no JSX `position`: a semantic Select callback can
 * rerender the device while the pointer remains held, and R3F must not reapply
 * the rest transform over the controller's imperative axial travel.
 */
export function AxialSelectControl({
  geometry,
  position,
  children,
}: AxialSelectControlProps) {
  const controlPhysics = useControlPhysics();
  const selectRef = useRef<Mesh>(null);

  useEffect(() => {
    const select = selectRef.current;
    if (select === null) return;
    return controlPhysics?.attachSelect(select);
  }, [controlPhysics]);

  return (
    <group name="device-select-rest-frame" position={position}>
      <mesh ref={selectRef} name="device-select" geometry={geometry}>
        {children}
      </mesh>
    </group>
  );
}
