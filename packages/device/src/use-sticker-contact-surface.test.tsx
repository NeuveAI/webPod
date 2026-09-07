import { expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { StrictMode, act, useLayoutEffect } from 'react';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { useStickerContactSurface } from './use-sticker-contact-surface';

if (typeof document === 'undefined') GlobalRegistrator.register();

test('contact collider survives Strict Mode effect replay and releases each lifetime', async () => {
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const { createRoot } = await import('react-dom/client');
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), content = new Group(), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
  content.add(new Mesh(geometry, material));
  const resources: NonNullable<ReturnType<typeof useStickerContactSurface>['current']>[] = [];
  function Probe({ tick }: { tick: number }) {
    const surface = useStickerContactSurface();
    useLayoutEffect(() => {
      const collider = surface.current;
      if (!collider) throw new Error('Missing collider');
      collider.update(content);
      expect(collider.castSegment(new Vector3(0, 0, 5), new Vector3())).not.toBeNull();
      resources.push(collider);
    }, [surface, tick]);
    return null;
  }
  try {
    await act(async () => { root.render(<StrictMode><Probe tick={0} /></StrictMode>); });
    expect(resources).toHaveLength(2);
    expect(resources[0]).not.toBe(resources[1]);
    expect(() => resources[0]?.update(content)).toThrow('disposed');
    await act(async () => { root.render(<StrictMode><Probe tick={1} /></StrictMode>); });
    expect(resources[2]).toBe(resources[1]);
    await act(async () => { root.unmount(); });
    expect(() => resources[1]?.update(content)).toThrow('disposed');
  } finally {
    host.remove(); geometry.dispose(); material.dispose();
    if (previousAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct);
    else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  }
});
