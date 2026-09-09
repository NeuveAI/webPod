import type { CSSProperties } from 'react'
import './styles/device-reveal-portal.css'

/* Portal storyboard (the device's own timing stays in device-reveal.ts):
 *  450ms   sharp refraction spreads from bottom center to both corners
 *  950ms   the soft pool blooms behind the edge light
 * edges    sharp ivory catches split into fine blue/amber refracted fringes
 * 1150ms+  dust motes lift with staggered, unhurried drift
 * rise     the pool and motes dissolve as the device turns toward us
 */
const MOTES = [
  { x: 6, drift: -12, lift: 66, delay: 180, duration: 2100, size: 1.5 },
  { x: 18, drift: 9, lift: 102, delay: 420, duration: 2300, size: 2 },
  { x: 41, drift: -7, lift: 79, delay: 120, duration: 1900, size: 1 },
  { x: 53, drift: 14, lift: 117, delay: 330, duration: 2400, size: 1.5 },
  { x: 65, drift: -9, lift: 87, delay: 600, duration: 2000, size: 2 },
  { x: 94, drift: 11, lift: 61, delay: 260, duration: 2200, size: 1 },
  { x: 11, drift: 7, lift: 48, delay: 740, duration: 1800, size: 1 },
  { x: 47, drift: -15, lift: 95, delay: 820, duration: 2100, size: 1.5 },
  { x: 86, drift: -6, lift: 72, delay: 940, duration: 1900, size: 1.5 },
  { x: 3, drift: 13, lift: 155, delay: 100, duration: 2400, size: 2 },
  { x: 24, drift: -18, lift: 126, delay: 280, duration: 2200, size: 1.5 },
  { x: 36, drift: 11, lift: 92, delay: 540, duration: 1900, size: 2 },
  { x: 58, drift: -12, lift: 148, delay: 160, duration: 2300, size: 2.5 },
  { x: 74, drift: 17, lift: 112, delay: 370, duration: 2100, size: 1.5 },
  { x: 97, drift: -14, lift: 166, delay: 200, duration: 2500, size: 2 },
  { x: 15, drift: 10, lift: 108, delay: 580, duration: 2200, size: 2 },
  { x: 49, drift: -9, lift: 132, delay: 650, duration: 2300, size: 1.5 },
  { x: 82, drift: -16, lift: 142, delay: 480, duration: 2100, size: 2 },
] as const

/** Purely decorative, compositor-animated floor light; no GPU scene work. */
export function DeviceRevealPortal() {
  return <div className="device-reveal-portal" aria-hidden="true">
    <div className="device-reveal-portal__spill" />
    <div className="device-reveal-portal__edge-light" />
    <div className="device-reveal-portal__pool" />
    <div className="device-reveal-portal__ripple" />
    {MOTES.map((mote, index) => <span key={index} className={`device-reveal-portal__mote ${index % 3 === 0 ? 'device-reveal-portal__mote--soft' : 'device-reveal-portal__mote--crisp'}`} style={{
      left: `${mote.x}%`, width: index % 3 === 0 ? mote.size * 3 : mote.size, height: index % 3 === 0 ? mote.size * 3 : mote.size,
      '--mote-drift': `${mote.drift}px`, '--mote-lift': `${-mote.lift}px`,
      '--mote-delay': `${1150 + mote.delay}ms`, '--mote-duration': `${mote.duration}ms`,
    } as CSSProperties} />)}
  </div>
}
