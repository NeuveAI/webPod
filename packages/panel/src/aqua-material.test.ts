import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
const panelSource = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
const listSource = readFileSync(new URL('./list-view.tsx', import.meta.url), 'utf8')

function rule(pattern: RegExp): string {
  return ruleFrom(css, pattern)
}

function ruleFrom(source: string, pattern: RegExp): string {
  const body = source.match(pattern)?.[1]
  if (body === undefined) throw new Error(`Missing CSS rule: ${pattern.source}`)
  return body
}

function selectionMaterialViolations(source: string): readonly string[] {
  const dark = ruleFrom(source, /(?:^|\n) {2}\.wp-panel \{([\s\S]*?)\n {2}\}/)
  const light = ruleFrom(source, /\.wp-panel\[data-colourway="light"\] \{([\s\S]*?)\n {2}\}/)
  const material = property(dark, '--wp-selection-material')
  const violations: string[] = []
  if ((material.match(/linear-gradient\(/g)?.length ?? 0) !== 2) {
    violations.push('selection must retain three material layers')
  }
  const rimRules = [...source.matchAll(/([^{}]*\.wp-selection-rim[^{}]*)\{([^{}]*)\}/g)]
  const rimIsStructural = rimRules.some(([, selector = '', body = '']) =>
    !selector.includes('::') &&
    body.includes('block-size: 1px') &&
    body.includes('position: absolute'),
  )
  const rimCanDisappear = rimRules.some(([, , body = '']) =>
    /(?:background|background-color):\s*transparent(?:\s*!important)?\s*;/.test(body),
  )
  if (!rimIsStructural || rimCanDisappear || source.includes('--wp-selection-top-rim')) {
    violations.push('selection must retain its crisp one-pixel top rim')
  }

  const darkForeground = property(dark, '--wp-selection-fg')
  const lightForeground = property(light, '--wp-selection-fg')
  for (const [theme, tokens, foreground] of [
    ['dark', dark, darkForeground],
    ['light', light, lightForeground],
  ] as const) {
    const selectedMetadata = ruleFrom(source, /\.wp-list-row\[aria-current="true"\] :is\([^)]+\) \{([^}]*)\}/)
    const metadataOpacity = Number(property(selectedMetadata, 'opacity'))
    for (const backgroundToken of [
      '--wp-selection-glass-top',
      '--wp-selection-glass-band',
      '--wp-selection-glass-bottom',
    ]) {
      if (contrastWithOpacity(foreground, property(tokens, backgroundToken), metadataOpacity) < 4.5) {
        violations.push(`${theme} selection foreground misses 4.5:1 contrast`)
      }
    }
  }
  return violations
}

function property(body: string, name: string): string {
  const value = body.match(new RegExp(`${name}:\\s*([\\s\\S]*?);`))?.[1]
  if (value === undefined) throw new Error(`Missing CSS property: ${name}`)
  return value.trim()
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

function contrastWithOpacity(foreground: string, background: string, opacity: number): number {
  const foregroundRgb = rgb(foreground)
  const backgroundRgb = rgb(background)
  const composited = foregroundRgb.map((channel, index) =>
    Math.round(channel * opacity + (backgroundRgb[index] ?? 0) * (1 - opacity)),
  )
  return contrast(
    `#${composited.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
    background,
  )
}

function rgb(hex: string): readonly number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
}


function pixelValue(body: string, name: string): number {
  const value = property(body, name)
  if (value === '0') return 0
  const parsed = value.match(/^([\d.]+)px(?:\s|$)/)?.[1]
  if (parsed === undefined) throw new Error(`Expected pixel value for ${name}: ${value}`)
  return Number(parsed)
}

function tokenNumber(body: string, name: string, unit: 'px' | 's' | 'deg'): number {
  const value = property(body, name)
  const parsed = value.match(new RegExp(`^([\\d.]+)${unit}$`))?.[1]
  if (parsed === undefined) throw new Error(`Expected ${unit} token for ${name}: ${value}`)
  return Number(parsed)
}

function srgbLuma(hex: string): number {
  const [red = 0, green = 0, blue = 0] = rgb(hex)
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
}

function aquaLoadingViolations(source: string): readonly string[] {
  const tokens = ruleFrom(source, /(?:^|\n) {2}\.wp-panel \{([\s\S]*?)\n {2}\}/)
  const progress = ruleFrom(source, /\.wp-progress \{([^}]*)\}/)
  const pending = ruleFrom(source, /\.wp-progress--indeterminate::after \{([^}]*)\}/)
  const keyframes = ruleFrom(source, /@keyframes wp-aqua-indeterminate \{([^}]*)\}/)
  const violations: string[] = []
  const radius = pixelValue(progress, 'border-radius')
  const repeat = tokenNumber(tokens, '--wp-aqua-gradient-repeat', 'px')
  const cycle = tokenNumber(tokens, '--wp-aqua-stripe-cycle', 'px')
  const blueStop = tokenNumber(tokens, '--wp-aqua-blue-stop', 'px')
  const angle = tokenNumber(tokens, '--wp-aqua-stripe-angle', 'deg')
  const duration = tokenNumber(tokens, '--wp-motion-aqua-indeterminate-duration', 's')
  const projectedRepeat = repeat / Math.sin(angle * Math.PI / 180)
  const duty = blueStop / repeat
  const blue = property(tokens, '--wp-aqua-blue')
  const light = property(tokens, '--wp-aqua-light')
  const [blueRed = 0, , blueBlue = 0] = rgb(blue)

  if (radius !== 2) violations.push('track corners must use the authored asymmetric Aqua radius')
  if (!progress.includes('padding: 1px') || !progress.includes('border: 0')) violations.push('track requires a one-pixel molded lip rather than a uniform border')
  if (!progress.includes('background: var(--wp-aqua-well-material)')) violations.push('track requires the shared translucent channel')
  if (!pending.includes('inset-block: 1px') || !pending.includes('border-radius: 1.5px 1.5px .5px .5px')) violations.push('gel must remain contained inside the molded lip')
  if (angle !== 45) violations.push('stripes must retain the reference diagonal')
  if ((projectedRepeat / 14) < 1.45 || (projectedRepeat / 14) > 1.7) violations.push('projected repeat must match bar-height proportion')
  if (Math.abs(projectedRepeat - cycle) > 0.02) violations.push('translation must equal one projected repeat')
  if (duty < 0.4 || duty > 0.6) violations.push('blue and light stripe duty must stay balanced')
  if (duration < 2.8 || duration > 3.6) violations.push('loop cadence must stay calm')
  if (Math.abs(srgbLuma(light) - srgbLuma(blue)) < 80) violations.push('stripe luminance swing must remain legible')
  if ((blueBlue - blueRed) < 95) violations.push('blue stripe must remain cobalt rather than cyan')
  if (!pending.includes('var(--wp-aqua-cylinder-modulation)') || !pending.includes('background-blend-mode: normal, normal')) violations.push('both loading ribs require the shared cylindrical modulation')
  if (!pending.includes('background-size: auto, var(--wp-aqua-stripe-cycle) 100%')) violations.push('ribs require an exact projected-repeat raster tile')
  if (!pending.includes('box-shadow: var(--wp-aqua-fill-depth)')) violations.push('gel requires soft specular and diffuse depth')
  if (pending.includes('filter:') || pending.includes('text-shadow:')) violations.push('gel cannot glow or bloom')
  if (!keyframes.includes('background-position: 0 0, var(--wp-aqua-stripe-cycle) 0')) violations.push('keyframe must complete one exact rib phase')
  if (!source.includes('.wp-panel .wp-progress--indeterminate::after { animation: none; background-position: 0 0, calc(var(--wp-aqua-stripe-cycle) / 2) 0; }')) violations.push('reduced motion must retain a frozen representative frame')
  return violations
}

function aquaCylinderViolations(source: string): readonly string[] {
  const tokens = ruleFrom(source, /(?:^|\n) {2}\.wp-panel \{([\s\S]*?)\n {2}\}/)
  const progress = ruleFrom(source, /\.wp-progress \{([^}]*)\}/)
  const volume = ruleFrom(source, /\.wp-volume-progress \{([^}]*)\}/)
  const fill = ruleFrom(source, /\.wp-progress i,\n {2}\.wp-volume-progress i \{([^}]*)\}/)
  const seam = ruleFrom(source, /\.wp-progress::before,\n {2}\.wp-volume-progress::before \{([^}]*)\}/)
  const violations: string[] = []
  const requiredStops = [
    ['--wp-aqua-fill-top', '#d8e9fc'],
    ['--wp-aqua-fill-upper', '#b2d3fa'],
    ['--wp-aqua-fill-waist', '#69aaee'],
    ['--wp-aqua-fill-lower', '#91c4f7'],
    ['--wp-aqua-fill-bottom', '#c1e1fb'],
  ] as const

  if (requiredStops.some(([name, value]) => property(tokens, name) !== value)) {
    violations.push('all five owner-authored cylinder colors are required')
  }
  const material = property(tokens, '--wp-aqua-fill-material')
  for (const stop of ['0%', '22%', '52%', '78%', '100%']) {
    if (!material.includes(stop)) violations.push('cylindrical fill requires the five authored stop positions')
  }
  if (!fill.includes('var(--wp-aqua-cylinder-modulation), var(--wp-aqua-fill-material)')) {
    violations.push('progress and volume must share one cylindrical material')
  }
  for (const well of [progress, volume]) {
    if (!well.includes('padding: 1px') || !well.includes('border: 0')) violations.push('well must reserve a molded lip without a uniform border')
    if (!well.includes('background: var(--wp-aqua-well-material)')) violations.push('well must use the shared translucent channel')
    if (!well.includes('box-shadow: var(--wp-aqua-trough-cast)')) violations.push('well must cast a soft exterior shadow')
  }
  if (!seam.includes('box-shadow: var(--wp-aqua-trough-seam)')) violations.push('well requires position-dependent lip and inner seam shading')
  if (source.includes('--wp-aqua-lip-material')) violations.push('opaque perimeter bands must not return')
  if (!property(tokens, '--wp-aqua-well-material').includes('linear-gradient(180deg')) violations.push('empty channel must be softly concave')
  if (source.includes('border: 1px solid var(--wp-aqua-rim)')) violations.push('uniform gray frames are forbidden')
  if (source.includes('--wp-aqua-fill-edge') || source.includes('--wp-aqua-lower-edge')) {
    violations.push('opaque dark bottom bands are forbidden')
  }
  return violations
}

function stationaryWellViolations(source: string): readonly string[] {
  const violations: string[] = []
  if ((source.match(/--wp-list-scroll-thumb-offset/g)?.length ?? 0) !== 1) {
    violations.push('only the thumb may consume the authoritative offset')
  }
  return violations
}

describe('the period Aqua LCD material', () => {
  const darkTokens = rule(/(?:^|\n) {2}\.wp-panel \{([\s\S]*?)\n {2}\}/)
  const lightTokens = rule(/\.wp-panel\[data-colourway="light"\] \{([\s\S]*?)\n {2}\}/)

  test('builds selection from two glass gradients and one structural rim rather than one flat color', () => {
    expect(selectionMaterialViolations(css)).toEqual([])
    const material = property(darkTokens, '--wp-selection-material')
    expect(material.match(/linear-gradient\(/g)).toHaveLength(2)
    expect(material).toContain('var(--wp-selection-glass-band) 56%')
    expect(material).toContain('var(--wp-selection-glass-bottom) 100%')
    expect(panelSource).not.toContain('wp-selection-rim')
    expect(listSource.match(/className="wp-selection-rim"/g)).toHaveLength(1)

    const selectedRule = rule(/\.wp-list-row\[aria-current="true"\] \{([^}]*)\}/)
    expect(selectedRule).toContain('color: var(--wp-selection-fg)')
    expect(selectedRule).toContain('background: var(--wp-selection-material)')
    expect(selectedRule).toContain('box-shadow: var(--wp-selection-depth)')
  })

  test('rejects the three owner-named flattening mutations', () => {
    const flat = css.replace(
      /--wp-selection-material:[\s\S]*?;\n {4}--wp-selection-depth/,
      '--wp-selection-material: #0a84b8;\n    --wp-selection-depth',
    )
    const noRim = `${css}\n.wp-panel .wp-selection-rim { background: transparent !important; }`
    const sharedForeground = css.replace(
      '--wp-selection-fg: #ffffff;',
      '--wp-selection-fg: #333333;',
    )
    const translucentMetadata = css.replace(
      '.wp-list-row[aria-current="true"] :is(.wp-list-row__leading, .wp-list-row__secondary, .wp-list-row__count, .wp-list-row__status, .wp-list-row__chevron) { color: currentColor; opacity: 1; }',
      '.wp-list-row[aria-current="true"] :is(.wp-list-row__leading, .wp-list-row__secondary, .wp-list-row__count, .wp-list-row__status, .wp-list-row__chevron) { color: currentColor; opacity: .6; }',
    )

    expect(selectionMaterialViolations(flat)).toContain('selection must retain three material layers')
    expect(selectionMaterialViolations(noRim)).toContain('selection must retain its crisp one-pixel top rim')
    expect(selectionMaterialViolations(sharedForeground)).toContain('dark selection foreground misses 4.5:1 contrast')
    expect(selectionMaterialViolations(translucentMetadata)).toContain('dark selection foreground misses 4.5:1 contrast')
  })

  test('uses independently legible foregrounds for light and dark Aqua', () => {
    const darkForeground = property(darkTokens, '--wp-selection-fg')
    const lightForeground = property(lightTokens, '--wp-selection-fg')
    expect(darkForeground).toBe(lightForeground)

    for (const backgroundToken of [
      '--wp-selection-glass-top',
      '--wp-selection-glass-band',
      '--wp-selection-glass-bottom',
    ]) {
      expect(contrast(darkForeground, property(darkTokens, backgroundToken))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(lightForeground, property(lightTokens, backgroundToken))).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('keeps metadata, track numbers, and chevrons on the selected foreground', () => {
    expect(css).toContain('.wp-list-row[aria-current="true"] :is(.wp-list-row__leading, .wp-list-row__secondary, .wp-list-row__count, .wp-list-row__status, .wp-list-row__chevron) { color: currentColor; opacity: 1; }')
  })

  test('fills pending playback with a recessed, period-authentic Aqua indeterminate stripe', () => {
    const pendingFill = rule(/\.wp-progress--indeterminate i \{([^}]*)\}/)
    const pending = rule(/\.wp-progress--indeterminate::after \{([^}]*)\}/)
    const transport = rule(/\.wp-titlebar__transport\[data-transport="starting"\] \{([^}]*)\}/)
    expect(pendingFill).toContain('inline-size: 0 !important')
    expect(pendingFill).toContain('transition: none')
    expect(pending).toContain('content: ""')
    expect(pending).toContain('repeating-linear-gradient(var(--wp-aqua-stripe-angle)')
    expect(pending).toContain('wp-aqua-indeterminate var(--wp-motion-aqua-indeterminate-duration) linear infinite')
    expect(css).toContain('--wp-motion-aqua-indeterminate-duration: 3.2s')
    expect(css).toContain('@keyframes wp-aqua-indeterminate')
    expect(aquaLoadingViolations(css)).toEqual([])
    expect(aquaLoadingViolations(css.replace('--wp-aqua-stripe-angle: 45deg', '--wp-aqua-stripe-angle: 135deg'))).toContain('stripes must retain the reference diagonal')
    expect(aquaLoadingViolations(css.replace('--wp-aqua-stripe-cycle: 22px', '--wp-aqua-stripe-cycle: 12px'))).toContain('translation must equal one projected repeat')
    expect(aquaLoadingViolations(css.replace('--wp-aqua-blue-stop: 7.78px', '--wp-aqua-blue-stop: 1px'))).toContain('blue and light stripe duty must stay balanced')
    expect(aquaLoadingViolations(css.replace('--wp-motion-aqua-indeterminate-duration: 3.2s', '--wp-motion-aqua-indeterminate-duration: 1.8s'))).toContain('loop cadence must stay calm')
    expect(aquaLoadingViolations(css.replace('border-radius: 2px 2px 1px 1px', 'border-radius: 3px'))).toContain('track corners must use the authored asymmetric Aqua radius')
    expect(aquaLoadingViolations(css.replace('--wp-aqua-blue: #6eaaf0', '--wp-aqua-blue: #8edcff'))).toContain('stripe luminance swing must remain legible')
    expect(aquaLoadingViolations(css.replace('.wp-panel .wp-progress--indeterminate::after { animation: none; background-position: 0 0, calc(var(--wp-aqua-stripe-cycle) / 2) 0; }', '.wp-panel .wp-progress--indeterminate::after { display: none; }'))).toContain('reduced motion must retain a frozen representative frame')
    expect(transport).toContain('wp-transport-breathe 2.4s ease-in-out infinite')
    expect(panelSource).toContain('data-transport={transport}')
  })

  test('shares one fourteen-pixel cylindrical Aqua object across progress, loading, and volume', () => {
    const body = rule(/\.wp-now-body \{([^}]*)\}/)
    const progress = rule(/\.wp-progress \{([^}]*)\}/)
    const volumeRow = rule(/\.wp-volume-feedback \{([^}]*)\}/)
    const volume = rule(/\.wp-volume-progress \{([^}]*)\}/)
    const fill = rule(/\.wp-progress i,\n {2}\.wp-volume-progress i \{([^}]*)\}/)

    expect(body).toContain('grid-template-rows: 119px 14px minmax(5px, 1fr) 15px')
    expect(progress).toContain('padding: 1px')
    expect(progress).toContain('border: 0')
    expect(progress).toContain('background: var(--wp-aqua-well-material)')
    expect(progress).toContain('border-radius: 2px 2px 1px 1px')
    expect(volumeRow).toContain('inset-block-start: 132px')
    expect(volumeRow).toContain('grid-template-columns: 13px 214px 13px')
    expect(volumeRow).toContain('column-gap: 4px')
    expect(volume).toContain('inline-size: 214px')
    expect(volume).toContain('block-size: 14px')
    expect(fill).toContain('var(--wp-aqua-cylinder-modulation), var(--wp-aqua-fill-material)')
    expect(fill).toContain('box-shadow: var(--wp-aqua-fill-depth)')
    expect(property(darkTokens, '--wp-aqua-fill-material')).toContain('var(--wp-aqua-fill-waist) 52%')
    expect(property(darkTokens, '--wp-aqua-well-material')).toContain('rgb(')
    expect(property(darkTokens, '--wp-aqua-well-material')).toContain('/ 78%')
    expect(property(darkTokens, '--wp-aqua-trough-seam')).toContain('inset 0 1px 2px')
    expect(property(darkTokens, '--wp-aqua-trough-cast')).toContain('/ 22%')
    expect(css).not.toContain('--wp-aqua-lip-material')
    expect(aquaCylinderViolations(css)).toEqual([])
    expect(aquaCylinderViolations(css.replace('--wp-aqua-fill-waist: #69aaee', '--wp-aqua-fill-waist: #36a8de'))).toContain('all five owner-authored cylinder colors are required')
    expect(aquaCylinderViolations(css.replace('var(--wp-aqua-fill-waist) 52%', 'var(--wp-aqua-fill-waist) 90%'))).toContain('cylindrical fill requires the five authored stop positions')
    expect(aquaCylinderViolations(`${css}\n.wp-panel { --wp-aqua-fill-edge: #176fba; }`)).toContain('opaque dark bottom bands are forbidden')
    expect(aquaCylinderViolations(css.replace('padding: 1px; border: 0', 'padding: 0; border: 1px solid #8f969d'))).toContain('well must reserve a molded lip without a uniform border')
    expect(css).toContain('.wp-volume-progress i { transition: none; }')
    expect(panelSource).toContain('aria-label="Volume"')
    expect(panelSource).toContain('data-volume-feedback="visible"')
    expect(panelSource).toContain('volumeFeedback.occurrenceIdentity === occurrenceIdentity')
  })

  test('keeps agent attribution without flattening the selected material', () => {
    const agentSelected = rule(/\.wp-list-row\[data-agent="true"\]\[aria-current="true"\] \{([^}]*)\}/)
    expect(agentSelected).toContain('background: var(--wp-selection-material)')
    expect(agentSelected).toContain('box-shadow: var(--wp-selection-depth)')
    expect(agentSelected).toContain('rgb(34 197 94 / 72%)')
  })

  test('the scrollbar uses a quiet unstriped well and a bounded blue thumb', () => {
    const well = rule(/\.wp-list-scroll__well \{([^}]*)\}/)
    const scroll = rule(/\.wp-list-scroll \{([^}]*)\}/)
    const thumb = rule(/\.wp-list-scroll__thumb \{([^}]*)\}/)
    expect(well).not.toContain('repeating-linear-gradient')
    expect(well).not.toContain('box-shadow')
    expect(well).not.toContain('--wp-list-scroll-thumb-offset')
    expect(pixelValue(scroll, 'inline-size')).toBe(7)
    expect(scroll).toContain('margin-inline: 1px')
    expect(thumb).toContain('inset-inline: 1px')
    expect(thumb).toContain('inset-block-start: var(--wp-list-scroll-thumb-offset)')
    expect(thumb).toContain('inset 1px 0 var(--wp-scroll-thumb-highlight)')
    expect(thumb).not.toContain('border:')
    expect(contrast(property(darkTokens, '--wp-scroll-thumb-top'), property(darkTokens, '--wp-scroll-well-dark'))).toBeGreaterThan(3)
    expect(stationaryWellViolations(css)).toEqual([])
  })

  test('uses hierarchy, not selection weight, so changing selection never shifts row text', () => {
    const row = rule(/\.wp-list-row \{([^}]*)\}/)
    const selected = rule(/\.wp-list-row\[aria-current="true"\] \{([^}]*)\}/)

    expect(property(row, 'font-weight')).toBe('600')
    expect(property(selected, 'font-weight')).toBe(property(row, 'font-weight'))
    expect(css).toMatch(/(?:^|\n) {2}\.wp-list-row__secondary \{[^}]*font-weight:\s*400/s)
  })

  test('rejects a moving stripe overlay anywhere across the full well', () => {
    const movingOverlay = `${css}\n.wp-list-scroll__well::after {
      content: "";
      position: absolute;
      inset: 0 0 0 2px;
      background: repeating-linear-gradient(180deg, #fff 0 1px, #000 1px 2px);
      background-position: 0 var(--wp-list-scroll-thumb-offset);
    }`
    expect(stationaryWellViolations(movingOverlay)).toContain(
      'only the thumb may consume the authoritative offset',
    )
  })
})
