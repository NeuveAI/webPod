import type { ControlPhysicsController } from './control-physics';
import { acceptsClickWheelPointer, captureApiOf, cardinalButtonAtWheelPoint, createClickWheelCaptureSlot, finishClickWheelCapture, nativeHost, pointerIdentity, pointerTypeOf, CLICK_WHEEL_CARDINAL_SLOP, CLICK_WHEEL_INPUT_RADII,
  type ClickWheelPointerEvent, type ClickWheelInputSurfaceProps, type WheelLocalPoint, type CardinalCandidate, type ClickWheelArcSample, type ClickWheelArcEnd, type ClickWheelPointerType, type ActivePointer, type ClickWheelSelectEnd } from './click-wheel-input-core';

export interface ClickWheelEventDependencies {
  readonly controlPhysics: ControlPhysicsController | null;
  readonly callbacks: () => ClickWheelInputSurfaceProps;
  readonly point: (event: ClickWheelPointerEvent) => WheelLocalPoint | null;
}
/** Canonical capture/arc/cardinal/Select state machine for both renderers.
 * Geometry admission is performed by the caller; terminal samples, callback
 * failure cleanup and native lost-capture/blur ownership remain shared here. */
export function createClickWheelEventController(input: Pick<ClickWheelEventDependencies, 'controlPhysics'> & Partial<Pick<ClickWheelEventDependencies, 'callbacks' | 'point'>>) {
  const dependencies = {controlPhysics: input.controlPhysics,
    callbacks: input.callbacks ?? (() => {throw new Error('Clickwheel callbacks are not attached');}),
    point: input.point ?? (() => null)};
  const wheel = createWheelEvents(dependencies), select = createSelectEvents(dependencies);
  return {wheel, select,
    configure(next: Pick<ClickWheelEventDependencies, 'callbacks' | 'point'>) {dependencies.callbacks = next.callbacks; dependencies.point = next.point;},
    attachKeyboard: () => attachKeyboard(dependencies.controlPhysics),
    dispose() {
      let firstError: unknown;
      let failed = false;
      try {wheel.dispose();} catch (error) {firstError = error; failed = true;}
      try {select.dispose();} catch (error) {if (!failed) throw error;}
      if (failed) throw firstError;
    }};
}
function attachKeyboard(controlPhysics: ControlPhysicsController | null) {
  const keyboardSelectRef = {current: false};
    if (controlPhysics === null || typeof window === "undefined") return () => {};
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.repeat ||
        keyboardSelectRef.current ||
        !(event.target instanceof Element) ||
        event.target.getAttribute("role") !== "application"
      )
        return;
      keyboardSelectRef.current = true;
      controlPhysics.pressSelect();
    };
    const release = () => {
      if (!keyboardSelectRef.current) return;
      keyboardSelectRef.current = false;
      controlPhysics.releaseSelect();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Enter") release();
    };
    const onVisibilityChange = () => {
      if (document.hidden) release();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };

}
function createWheelEvents(dependencies: ClickWheelEventDependencies) {
  const controlPhysics = dependencies.controlPhysics;
  const captureSlotRef = {current: createClickWheelCaptureSlot()};
  const cardinalCandidateRef: {current: CardinalCandidate | null} = {current: null};
  const cardinalContactRef: {current: CardinalCandidate | null} = {current: null};
  const rotationOriginRef: {current: ClickWheelArcSample | null} = {current: null};
  const arcStartedRef = {current: false};
  const finish = (
    pointerId: number,
    timestampMs: number,
    reason: ClickWheelArcEnd["reason"],
    releaseCapture: boolean,
    releasePoint: WheelLocalPoint | null = null,
  ) => {
    const candidate = cardinalCandidateRef.current;
    const contact = cardinalContactRef.current;
    cardinalCandidateRef.current = null;
    cardinalContactRef.current = null;
    rotationOriginRef.current = null;
    const arcStarted = arcStartedRef.current;
    arcStartedRef.current = false;
    const acceptedCardinal =
      reason === "release" &&
      candidate?.pointerId === pointerId &&
      releasePoint !== null &&
      cardinalButtonAtWheelPoint(releasePoint.x, releasePoint.y) ===
        candidate.button &&
      Math.hypot(
        releasePoint.x - candidate.startX,
        releasePoint.y - candidate.startY,
      ) <= CLICK_WHEEL_CARDINAL_SLOP
        ? candidate
        : null;
    const ended = finishClickWheelCapture(
      captureSlotRef.current,
      pointerId,
      timestampMs,
      reason,
      releaseCapture,
      (end) => {
        controlPhysics?.releaseWheel();
        if (arcStarted) dependencies.callbacks().onArcEnd(end);
      },
    );
    if (ended && contact?.pointerId === pointerId) {
      dependencies.callbacks().onCardinalEnd?.({
        pointerId,
        pointerType: contact.pointerType,
        button: contact.button,
        timestampMs,
        reason,
        accepted: acceptedCardinal !== null,
      });
    }
    if (ended && acceptedCardinal !== null) {
      dependencies.callbacks().onCardinalPress?.({
        pointerId,
        pointerType: acceptedCardinal.pointerType,
        button: acceptedCardinal.button,
        timestampMs,
      });
    }
  };

  const cancelAfterCallbackError = (
    pointerId: number,
    timestampMs: number,
    error: unknown,
  ): never => {
    try {
      finish(pointerId, timestampMs, "cancel", true);
    } catch {
      // Capture/listener cleanup happens before onArcEnd. Preserve the first
      // callback failure if a secondary cancellation callback also throws.
    }
    throw error;
  };

  const dispose = () => {
      const active = captureSlotRef.current.current;
      if (active === null) return;
      const contact = cardinalContactRef.current;
      cardinalCandidateRef.current = null;
      cardinalContactRef.current = null;
      rotationOriginRef.current = null;
      const arcStarted = arcStartedRef.current;
      arcStartedRef.current = false;
      const ended = finishClickWheelCapture(
        captureSlotRef.current,
        active.pointerId,
        performance.now(),
        "cancel",
        true,
        (end) => {
          controlPhysics?.releaseWheel();
          if (arcStarted) dependencies.callbacks().onArcEnd(end);
        },
      );
      if (ended && contact?.pointerId === active.pointerId) {
        dependencies.callbacks().onCardinalEnd?.({
          pointerId: active.pointerId,
          pointerType: contact.pointerType,
          button: contact.button,
          timestampMs: performance.now(),
          reason: "cancel",
          accepted: false,
        });
      }
  };

  const point = (event: ClickWheelPointerEvent) => dependencies.point(event);

  const sample = (
    event: ClickWheelPointerEvent,
    pointerType: ClickWheelPointerType,
  ): ClickWheelArcSample | null => {
    const local = point(event);
    if (local === null) return null;
    return {
      pointerId: event.pointerId,
      pointerType,
      angleDeg: local.angleDeg,
      timestampMs: event.timeStamp,
    };
  };

  const onPointerDown = (event: ClickWheelPointerEvent) => {
    if (
      !acceptsClickWheelPointer(event) ||
      captureSlotRef.current.current !== null
    )
      return;
    const pointerType = pointerTypeOf(event.pointerType);
    const host = nativeHost(event);
    const capture = captureApiOf(event.target);
    if (pointerType === null || host === null || capture === null) return;
    const first = sample(event, pointerType);
    const firstPoint = point(event);
    if (first === null || firstPoint === null) return;
    // RingGeometry includes its inner edge in ray hits. The semantic contract
    // gives that shared r=37 edge to Select, so let the coincident center hit
    // continue through R3F instead of turning a mapper-null point into an arc.
    if (firstPoint.radius <= CLICK_WHEEL_INPUT_RADII.inner) return;

    event.stopPropagation();
    capture.setPointerCapture(event.pointerId);

    const onCancel: EventListener = (nativeEvent) => {
      const pointer = pointerIdentity(nativeEvent);
      if (pointer === null) return;
      finish(pointer.pointerId, pointer.timestampMs, "cancel", false);
    };
    const onLostCapture: EventListener = (nativeEvent) => {
      const pointer = pointerIdentity(nativeEvent);
      if (pointer === null) return;
      finish(
        pointer.pointerId,
        pointer.timestampMs,
        "lost-capture",
        false,
      );
    };
    const blurHost = typeof window === "undefined" ? undefined : window;
    const onBlur: EventListener = () => {
      finish(event.pointerId, performance.now(), "cancel", true);
    };
    const active: ActivePointer = {
      pointerId: event.pointerId,
      pointerType,
      capture,
      host,
      onCancel,
      onLostCapture,
      blurHost,
      onBlur,
    };
    captureSlotRef.current.current = active;
    const cardinalButton = cardinalButtonAtWheelPoint(
      firstPoint.x,
      firstPoint.y,
    );
    cardinalCandidateRef.current =
      cardinalButton === null
        ? null
        : {
            pointerId: event.pointerId,
            pointerType,
            button: cardinalButton,
            startX: firstPoint.x,
            startY: firstPoint.y,
          };
    cardinalContactRef.current = cardinalCandidateRef.current;
    rotationOriginRef.current = first;
    arcStartedRef.current = cardinalButton === null;
    host.addEventListener("pointercancel", onCancel);
    host.addEventListener("lostpointercapture", onLostCapture);
    blurHost?.addEventListener("blur", onBlur);
    controlPhysics?.pressWheel(first.angleDeg);
    try {
      if (cardinalButton !== null) {
        dependencies.callbacks().onCardinalStart?.({
          pointerId: event.pointerId,
          pointerType,
          button: cardinalButton,
          timestampMs: event.timeStamp,
        });
      }
      if (cardinalButton === null) dependencies.callbacks().onArcStart(first);
    } catch (error) {
      cancelAfterCallbackError(event.pointerId, event.timeStamp, error);
    }
  };

  const onPointerMove = (event: ClickWheelPointerEvent) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const next = sample(event, active.pointerType);
    const nextPoint = point(event);
    const candidate = cardinalCandidateRef.current;
    const cancelsCardinal =
      candidate?.pointerId === event.pointerId &&
      (nextPoint === null ||
        cardinalButtonAtWheelPoint(nextPoint.x, nextPoint.y) !==
          candidate.button ||
        Math.hypot(
          nextPoint.x - candidate.startX,
          nextPoint.y - candidate.startY,
        ) > CLICK_WHEEL_CARDINAL_SLOP);
    if (cancelsCardinal) {
      cardinalCandidateRef.current = null;
    }
    if (next !== null && cardinalCandidateRef.current === null) {
      controlPhysics?.moveWheel(next.angleDeg);
      try {
        if (!arcStartedRef.current) {
          const origin = rotationOriginRef.current;
          if (origin === null) return;
          arcStartedRef.current = true;
          dependencies.callbacks().onArcStart(origin);
        }
        dependencies.callbacks().onArcMove(next);
      } catch (error) {
        cancelAfterCallbackError(event.pointerId, event.timeStamp, error);
      }
    }
  };

  const onPointerUp = (event: ClickWheelPointerEvent) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    finish(
      event.pointerId,
      event.timeStamp,
      "release",
      true,
      point(event),
    );
  };


  return {down: onPointerDown, move: onPointerMove, up: onPointerUp, dispose};
}
function createSelectEvents(dependencies: ClickWheelEventDependencies) {
  const controlPhysics = dependencies.controlPhysics;
  const captureSlotRef = {current: createClickWheelCaptureSlot()};
  const finish = (
    pointerId: number,
    timestampMs: number,
    reason: ClickWheelSelectEnd["reason"],
    releaseCapture: boolean,
  ) => {
    finishClickWheelCapture(
      captureSlotRef.current,
      pointerId,
      timestampMs,
      reason,
      releaseCapture,
      (end) => {
        controlPhysics?.releaseSelect();
        dependencies.callbacks().onSelectEnd?.(end);
      },
    );
  };

  const dispose = () => {
      const active = captureSlotRef.current.current;
      if (active === null) return;
      finishClickWheelCapture(
        captureSlotRef.current,
        active.pointerId,
        performance.now(),
        "cancel",
        true,
        (end) => {
          controlPhysics?.releaseSelect();
          dependencies.callbacks().onSelectEnd?.(end);
        },
      );
  };

  const onPointerDown = (event: ClickWheelPointerEvent) => {
    if (
      !acceptsClickWheelPointer(event) ||
      captureSlotRef.current.current !== null
    )
      return;
    const pointerType = pointerTypeOf(event.pointerType);
    const host = nativeHost(event);
    const capture = captureApiOf(event.target);
    if (pointerType === null || host === null || capture === null) return;

    event.stopPropagation();
    capture.setPointerCapture(event.pointerId);
    const onCancel: EventListener = (nativeEvent) => {
      const pointer = pointerIdentity(nativeEvent);
      if (pointer === null) return;
      finish(pointer.pointerId, pointer.timestampMs, "cancel", false);
    };
    const onLostCapture: EventListener = (nativeEvent) => {
      const pointer = pointerIdentity(nativeEvent);
      if (pointer === null) return;
      finish(pointer.pointerId, pointer.timestampMs, "lost-capture", false);
    };
    const blurHost = typeof window === "undefined" ? undefined : window;
    const onBlur: EventListener = () => {
      finish(event.pointerId, performance.now(), "cancel", true);
    };
    captureSlotRef.current.current = {
      pointerId: event.pointerId,
      pointerType,
      capture,
      host,
      onCancel,
      onLostCapture,
      blurHost,
      onBlur,
    };
    host.addEventListener("pointercancel", onCancel);
    host.addEventListener("lostpointercapture", onLostCapture);
    blurHost?.addEventListener("blur", onBlur);
    controlPhysics?.pressSelect();
    try {
      dependencies.callbacks().onSelectStart?.({
        pointerId: event.pointerId,
        pointerType,
        timestampMs: event.timeStamp,
      });
    } catch (error) {
      try {
        finish(event.pointerId, event.timeStamp, "cancel", true);
      } catch {
        // Cleanup precedes the secondary callback, so retain the first error.
      }
      throw error;
    }
  };

  const onPointerMove = (event: ClickWheelPointerEvent) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
  };

  const onPointerUp = (event: ClickWheelPointerEvent) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    finish(event.pointerId, event.timeStamp, "release", true);
  };


  return {down: onPointerDown, move: onPointerMove, up: onPointerUp, dispose};
}
