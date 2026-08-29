import { CompositeDevice } from '@webpod/composite'
import { Panel, type PanelState } from '@webpod/panel'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useLayoutEffect, useRef } from 'react'

const STATES: readonly PanelState[] = [
  'ready',
  'loading',
  'empty',
  'error',
  'offline',
  'permission-denied',
  'agent-active',
  'success-confirmation',
]

export const Route = createFileRoute('/_probe/composite')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): {
    readonly colourway: 'black' | 'white'
    readonly state: PanelState
    readonly scale: 1 | 1.3 | 2
    readonly fov: 24 | 30 | 36
    readonly mode: 'bare' | 'composited'
  } => ({
    colourway: search['colourway'] === 'white' ? 'white' : 'black',
    state: STATES.includes(search['state'] as PanelState)
      ? (search['state'] as PanelState)
      : 'ready',
    scale: search['scale'] === 2 ? 2 : search['scale'] === 1.3 ? 1.3 : 1,
    fov: search['fov'] === 24 ? 24 : search['fov'] === 36 ? 36 : 30,
    mode: search['mode'] === 'bare' ? 'bare' : 'composited',
  }),
  component: CompositePreview,
})

function CompositePreview() {
  const { colourway, state, scale, fov, mode } = Route.useSearch()
  const stageRef = useRef<HTMLDivElement>(null)
  const panelTone = colourway === 'white' ? 'light' : 'dark'
  const panel = <Panel colourway={panelTone} state={state} dynamicTypeScale={scale} />
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (stage === null) return
    const authored = mode === 'bare'
      ? { inlineSize: 272, blockSize: 204 }
      : { inlineSize: 330, blockSize: 552 }
    const fit = (): void => {
      const availableInline = stage.clientWidth
      const availableBlock = stage.clientHeight
      const factor = Math.min(
        1,
        availableInline / authored.inlineSize,
        availableBlock / authored.blockSize,
      )
      const inlineValue = `${(authored.inlineSize * factor).toFixed(3)}px`
      const blockValue = `${(authored.blockSize * factor).toFixed(3)}px`
      if (stage.style.getPropertyValue('--wp-preview-inline') !== inlineValue) {
        stage.style.setProperty('--wp-preview-inline', inlineValue)
      }
      if (stage.style.getPropertyValue('--wp-preview-block') !== blockValue) {
        stage.style.setProperty('--wp-preview-block', blockValue)
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [mode])
  return (
    <main className="wp-composite-preview">
      <style>{COMPOSITE_PREVIEW_CSS}</style>
      <header className="wp-composite-preview__header">
        <p>T1 · HTML in Canvas</p>
        <h1>Real DOM, inside the device screen</h1>
        <nav aria-label="Composite preview colourway">
          <Link to="/_probe/composite" search={{ colourway: 'black', state, scale, fov, mode }}>Black</Link>
          <Link to="/_probe/composite" search={{ colourway: 'white', state, scale, fov, mode }}>White</Link>
          <Link to="/_probe/composite" search={{ colourway, state, scale: 1, fov, mode }}>100%</Link>
          <Link to="/_probe/composite" search={{ colourway, state, scale: 1.3, fov, mode }}>130%</Link>
          <Link to="/_probe/composite" search={{ colourway, state, scale: 2, fov, mode }}>200%</Link>
          <Link to="/_probe/composite" search={{ colourway, state, scale, fov: 24, mode }}>Narrow</Link>
          <Link to="/_probe/composite" search={{ colourway, state, scale, fov: 36, mode }}>Wide</Link>
          <Link to="/_probe/composite" search={{ colourway, state, scale, fov, mode: 'bare' }}>Bare</Link>
          <Link to="/_probe/composite" search={{ colourway, state, scale, fov, mode: 'composited' }}>Composited</Link>
        </nav>
      </header>
      <div ref={stageRef} className="wp-composite-preview__stage">
        {mode === 'bare' ? (
          <div className="wp-composite-preview__bare-frame">
            <div className="wp-composite-preview__bare">{panel}</div>
          </div>
        ) : (
          <div className="wp-composite-preview__device-frame">
            <CompositeDevice
              className="wp-composite-preview__device"
              colourway={colourway}
              panelTone={panelTone}
              cameraFov={fov}
              panel={panel}
            />
          </div>
        )}
      </div>
      <p className="wp-composite-preview__help">
        Focus the display. Arrow keys move one row; Enter opens Albums and Now Playing;
        Backspace returns.
      </p>
    </main>
  )
}

const COMPOSITE_PREVIEW_CSS = `
  html:has(.wp-composite-preview), body:has(.wp-composite-preview) {
    margin: 0;
    min-inline-size: 0;
    min-block-size: 100%;
  }
  .wp-composite-preview {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: 100dvb;
    min-block-size: 100dvb;
    overflow-x: clip;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    place-items: safe center;
    gap: 12px;
    padding-block: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-bottom));
    padding-inline: max(12px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-right));
    color: #eef1f5;
    background: radial-gradient(circle at 50% 22%, #252a32 0, #101319 48%, #07090d 100%);
  }
  .wp-composite-preview__header { inline-size: 100%; min-inline-size: 0; text-align: center; font-family: ui-sans-serif, sans-serif; }
  .wp-composite-preview__header p { margin: 0; color: #8d96a4; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  .wp-composite-preview__header h1 { margin: 5px 0 8px; overflow-wrap: anywhere; font-size: clamp(15px, 4.8vi, 18px); }
  .wp-composite-preview__header nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: safe center;
    gap: 6px;
    min-inline-size: 0;
  }
  .wp-composite-preview__header a {
    box-sizing: border-box;
    min-inline-size: 58px;
    min-block-size: 32px;
    padding: 7px 10px;
    border: 1px solid #3b4350;
    border-radius: 999px;
    color: inherit;
    text-decoration: none;
    font: 600 11px ui-sans-serif, sans-serif;
  }
  .wp-composite-preview__stage {
    --wp-preview-inline: 0px;
    --wp-preview-block: 0px;
    display: grid;
    place-items: safe center;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    block-size: 100%;
  }
  .wp-composite-preview__device-frame {
    inline-size: var(--wp-preview-inline);
    block-size: var(--wp-preview-block);
    place-self: center;
  }
  .wp-composite-preview__device,
  .wp-composite-preview__device > div,
  .wp-composite-preview__device canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  .wp-composite-preview__bare-frame {
    inline-size: var(--wp-preview-inline);
    block-size: var(--wp-preview-block);
    place-self: center;
  }
  .wp-composite-preview__bare { inline-size: 100%; block-size: 100%; overflow: clip; }
  .wp-composite-preview__help {
    max-inline-size: 52ch;
    margin: 0;
    color: #8d96a4;
    text-align: center;
    font: 500 11px/1.35 ui-sans-serif, sans-serif;
  }
  @media (max-block-size: 720px) {
    .wp-composite-preview { gap: 8px; padding-block: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-bottom)); }
    .wp-composite-preview__header h1 { margin-block: 2px 5px; }
    .wp-composite-preview__header a { min-block-size: 28px; padding-block: 5px; }
    .wp-composite-preview__help { font-size: 10px; }
  }
`
