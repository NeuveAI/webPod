import { memo, useEffect, useMemo } from "react";
import { MeshBasicMaterial, MeshPhysicalMaterial, type Material } from "three";
import { type HardwarePart, type HardwareMaterial } from "./hardware-geometry";
import { effectiveStudioEnvironmentIntensity, useStudioEnvironmentSnapshot } from "./StudioEnvironment";

/** Physical connector surfaces use the same studio as the front controls. */
export const DeviceHardware = memo(function DeviceHardware({ parts, isBlack }: { readonly parts: readonly HardwarePart[]; readonly isBlack: boolean }) {
  const studio = useStudioEnvironmentSnapshot();
  const materials = useMemo(() => {
    const physical = (color: string, metalness: number, roughness: number) => new MeshPhysicalMaterial({
      color, metalness, roughness, envMap: studio.texture,
      envMapIntensity: effectiveStudioEnvironmentIntensity(0.3, studio.intensity),
    });
    return {
      metal: physical("#A8AFB4", 0.92, 0.28),
      slider: physical(isBlack ? "#242629" : "#D9D9D2", 0, 0.48),
      insulator: physical("#24272A", 0, 0.66),
      cavity: new MeshBasicMaterial({ color: "#030405", toneMapped: false }),
      orange: physical("#F67927", 0, 0.62),
      contact: physical("#AB9259", 0.75, 0.35),
    } satisfies Record<HardwareMaterial, Material>;
  }, [isBlack, studio]);
  useEffect(() => () => { for (const material of Object.values(materials)) material.dispose(); }, [materials]);
  return <group name="device-hardware">{parts.map((part) => (
    <mesh key={part.name} name={part.name} geometry={part.geometry} material={materials[part.material]} />
  ))}</group>;
});
