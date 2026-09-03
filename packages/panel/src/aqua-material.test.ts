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
  if (darkForeground === lightForeground) {
    violations.push('colourways require independent selection foregrounds')
  }
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

function stationaryWellViolations(source: string): readonly string[] {
  const violations: string[] = []
  if ((source.match(/--wp-list-scroll-thumb-offset/g)?.length ?? 0) !== 1) {
    violations.push('only the thumb may consume the authoritative offset')
  }
  if (!source.includes(
    '.wp-list-scroll__well::before, .wp-list-scroll__well::after { content: none !important; display: none !important; }',
  )) {
    violations.push('well overlays must remain structurally disabled')
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
    expect(material).toContain('var(--wp-selection-glass-band) 52%')
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
      '--wp-selection-fg: #173047;',
      '--wp-selection-fg: #ffffff;',
    )
    const translucentMetadata = css.replace(
      '.wp-list-row[aria-current="true"] :is(.wp-list-row__leading, .wp-list-row__secondary, .wp-list-row__count, .wp-list-row__status, .wp-list-row__chevron) { color: currentColor; opacity: 1; }',
      '.wp-list-row[aria-current="true"] :is(.wp-list-row__leading, .wp-list-row__secondary, .wp-list-row__count, .wp-list-row__status, .wp-list-row__chevron) { color: currentColor; opacity: .84; }',
    )

    expect(selectionMaterialViolations(flat)).toContain('selection must retain three material layers')
    expect(selectionMaterialViolations(noRim)).toContain('selection must retain its crisp one-pixel top rim')
    expect(selectionMaterialViolations(sharedForeground)).toContain('colourways require independent selection foregrounds')
    expect(selectionMaterialViolations(sharedForeground)).toContain('light selection foreground misses 4.5:1 contrast')
    expect(selectionMaterialViolations(translucentMetadata)).toContain('dark selection foreground misses 4.5:1 contrast')
  })

  test('uses independently legible foregrounds for light and dark Aqua', () => {
    const darkForeground = property(darkTokens, '--wp-selection-fg')
    const lightForeground = property(lightTokens, '--wp-selection-fg')
    expect(darkForeground).not.toBe(lightForeground)

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

  test('keeps agent attribution without flattening the selected material', () => {
    const agentSelected = rule(/\.wp-list-row\[data-agent="true"\]\[aria-current="true"\] \{([^}]*)\}/)
    expect(agentSelected).toContain('background: var(--wp-selection-material)')
    expect(agentSelected).toContain('box-shadow: var(--wp-selection-depth)')
    expect(agentSelected).toContain('rgb(34 197 94 / 72%)')
  })

  test('separates a fixed one-pixel striped well from the moving glossy thumb', () => {
    const well = rule(/\.wp-list-scroll__well \{([^}]*)\}/)
    const thumb = rule(/\.wp-list-scroll__thumb \{([^}]*)\}/)
    expect(well).toContain('repeating-linear-gradient(180deg')
    expect(well).toContain('0 2px')
    expect(well).toContain('2px 3px')
    expect(well).toContain('background-position: 0 0')
    expect(well).not.toContain('--wp-list-scroll-thumb-offset')
    expect(stationaryWellViolations(css)).toEqual([])
    expect(css).toContain('.wp-list-scroll__well::before, .wp-list-scroll__well::after { content: none !important; display: none !important; }')
    expect(thumb).toContain('inset-block-start: var(--wp-list-scroll-thumb-offset)')
    expect(thumb.match(/linear-gradient\(/g)).toHaveLength(3)
    expect(thumb).toContain('var(--wp-scroll-thumb-highlight)')
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
