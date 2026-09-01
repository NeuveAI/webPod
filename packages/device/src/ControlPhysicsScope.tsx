import { useThree } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { ControlPhysicsController } from "./control-physics";

const ControlPhysicsContext = createContext<ControlPhysicsController | null>(
  null,
);

function browserNow(): number {
  return performance.now();
}

function requestBrowserFrame(callback: FrameRequestCallback): number {
  return requestAnimationFrame(callback);
}

function cancelBrowserFrame(frame: number): void {
  cancelAnimationFrame(frame);
}

export type ControlPhysicsScopeProps = {
  readonly children: ReactNode;
  /** Deterministic seam used by mounted lifecycle tests. */
  readonly controller?: ControlPhysicsController;
};

/**
 * One transient-control controller per canvas. It requests demand frames only
 * while a released surface is travelling home; there is no `useFrame` poll.
 */
export function ControlPhysicsScope({
  children,
  controller: injectedController,
}: ControlPhysicsScopeProps) {
  const invalidate = useThree((state) => state.invalidate);
  const ownedController = useMemo(
    () =>
      new ControlPhysicsController({
        invalidate,
        now: browserNow,
        requestFrame: requestBrowserFrame,
        cancelFrame: cancelBrowserFrame,
      }),
    [invalidate],
  );
  const controller = injectedController ?? ownedController;

  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const synchronize = () => controller.setReducedMotion(query.matches);
    synchronize();
    query.addEventListener("change", synchronize);
    return () => query.removeEventListener("change", synchronize);
  }, [controller]);

  useEffect(
    () => () => {
      if (injectedController === undefined) ownedController.dispose();
    },
    [injectedController, ownedController],
  );

  return (
    <ControlPhysicsContext.Provider value={controller}>
      {children}
    </ControlPhysicsContext.Provider>
  );
}

export function useControlPhysics(): ControlPhysicsController | null {
  return useContext(ControlPhysicsContext);
}
