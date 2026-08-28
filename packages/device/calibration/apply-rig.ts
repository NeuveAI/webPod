/**
 * Fold the tuned rig back into the package defaults.
 *
 * ⚑ Without this step the tuned numbers would live only in
 * `packages/device/calibration/rig.json` and the device renders standalone with the
 * untuned defaults — a spike route that passes its own gate and a package that
 * does not. The tuner's output is not the artefact; the defaults are.
 *
 * Rewrites the literal after each named field in the four modules that hold a
 * default. Deliberately a narrow textual patch rather than a code generator:
 * the modules are hand-written documentation as much as data, and a generator
 * would flatten the comments that explain why each number is what it is.
 *
 *   bun run packages/device/calibration/apply-rig.ts
 */
const RIG = (await Bun.file('packages/device/calibration/rig.json').json()) as Record<string, number>

/** `rig key` → `[file, the field name to patch]`. */
const TARGETS: ReadonlyArray<readonly [string, string, string]> = [
  ['lightRig.key.intensity', 'packages/device/src/light-rig.ts', 'intensity'],
  ['lightRig.key.distance', 'packages/device/src/light-rig.ts', 'distance'],
  ['lightRig.fill.azimuthDeg', 'packages/device/src/light-rig.ts', 'azimuthDeg'],
  ['lightRig.fill.elevationDeg', 'packages/device/src/light-rig.ts', 'elevationDeg'],
  ['envRoom.elevHalfSpanDeg', 'packages/device/src/env-map.ts', 'elevHalfSpanDeg'],
  ['envRoom.exposure', 'packages/device/src/env-map.ts', 'exposure'],
  ['envRoom.profileContrast', 'packages/device/src/env-map.ts', 'profileContrast'],
  ['envRoom.profileSharpenAmount', 'packages/device/src/env-map.ts', 'profileSharpenAmount'],
  ['envRoom.profileSharpenSigma', 'packages/device/src/env-map.ts', 'profileSharpenSigma'],
  ['envRoom.profileSharpenAmount2', 'packages/device/src/env-map.ts', 'profileSharpenAmount2'],
  ['envRoom.profileSharpenSigma2', 'packages/device/src/env-map.ts', 'profileSharpenSigma2'],
  ['envRoom.azimuthVariation', 'packages/device/src/env-map.ts', 'azimuthVariation'],
  ['form.ringDishTiltDeg', 'packages/device/src/form.ts', 'ringDishTiltDeg'],
  ['form.ringDishExponent', 'packages/device/src/form.ts', 'ringDishExponent'],
  ['form.selectDomeTiltDeg', 'packages/device/src/form.ts', 'selectDomeTiltDeg'],
  ['form.selectDomeExponent', 'packages/device/src/form.ts', 'selectDomeExponent'],
  ['form.recessDepth', 'packages/device/src/form.ts', 'recessDepth'],
  ['form.selectProud', 'packages/device/src/form.ts', 'selectProud'],
]

/** Nested under `sky:` in `DEFAULT_ENV_ROOM`. */
const SKY: ReadonlyArray<readonly [string, string]> = [
  ['envRoom.sky.intensity', 'intensity'],
  ['envRoom.sky.sizeDeg', 'sizeDeg'],
  ['envRoom.sky.azimuthDeg', 'azimuthDeg'],
  ['envRoom.sky.elevationDeg', 'elevationDeg'],
]

/** Nested under `horizon:`. */
const HORIZON: ReadonlyArray<readonly [string, string]> = [
  ['envRoom.horizon.opacity', 'opacity'],
  ['envRoom.horizon.widthDeg', 'widthDeg'],
]

/** Per-surface `envMapIntensity` in the §12.3 table. */
const MATERIAL_KEYS = [
  'bodyBlack',
  'bodyWhite',
  'wheelRingBlack',
  'wheelRingWhite',
  'selectBlack',
  'selectWhite',
] as const

function round(value: number): string {
  const rounded = Math.round(value * 10000) / 10000
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(4).replace(/0+$/, '')
}

/** Replace `name: <number>,` with the tuned value, once, inside `scope`. */
function patch(source: string, name: string, value: number, scopeStart = 0): string {
  const pattern = new RegExp(`(\\b${name}:\\s*)(-?[0-9_.]+)(,)`)
  const head = source.slice(0, scopeStart)
  const tail = source.slice(scopeStart)
  if (!pattern.test(tail)) throw new Error(`device calibration: no field \`${name}\` to patch`)
  return head + tail.replace(pattern, `$1${round(value)}$3`)
}

const edits = new Map<string, string>()
async function read(file: string): Promise<string> {
  const cached = edits.get(file)
  if (cached !== undefined) return cached
  return await Bun.file(file).text()
}

for (const [key, file, field] of TARGETS) {
  const value = RIG[key]
  if (value === undefined) continue
  edits.set(file, patch(await read(file), field, value))
}

const envFile = 'packages/device/src/env-map.ts'
let env = await read(envFile)
for (const [key, field] of SKY) {
  const value = RIG[key]
  if (value !== undefined) env = patch(env, field, value, env.indexOf('  sky: {'))
}
for (const [key, field] of HORIZON) {
  const value = RIG[key]
  if (value !== undefined) env = patch(env, field, value, env.indexOf('  horizon: {'))
}
edits.set(envFile, env)

const materialsFile = 'packages/device/src/materials.ts'
let materials = await read(materialsFile)
for (const surface of MATERIAL_KEYS) {
  const value = RIG[`materials.${surface}.envMapIntensity`]
  if (value === undefined) continue
  materials = patch(materials, 'envMapIntensity', value, materials.indexOf(`  ${surface}: {`))
}
edits.set(materialsFile, materials)

for (const [file, content] of edits) {
  await Bun.write(file, content)
  console.log(`patched ${file}`)
}
