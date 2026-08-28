import { CompositeDevice } from '@webpod/composite'
import { Panel, type PanelState } from '@webpod/panel'
import { createFileRoute, Link } from '@tanstack/react-router'

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
  } => ({
    colourway: search['colourway'] === 'white' ? 'white' : 'black',
    state: STATES.includes(search['state'] as PanelState)
      ? (search['state'] as PanelState)
      : 'ready',
  }),
  component: CompositePreview,
})

function CompositePreview() {
  const { colourway, state } = Route.useSearch()
  const panelTone = colourway === 'white' ? 'light' : 'dark'
  return (
    <main className="wp-composite-preview">
      <style>{COMPOSITE_PREVIEW_CSS}</style>
      <header className="wp-composite-preview__header">
        <p>T1 · HTML in Canvas</p>
        <h1>Real DOM, inside the device screen</h1>
        <nav aria-label="Composite preview colourway">
          <Link to="/_probe/composite" search={{ colourway: 'black', state }}>Black</Link>
          <Link to="/_probe/composite" search={{ colourway: 'white', state }}>White</Link>
        </nav>
      </header>
      <CompositeDevice
        className="wp-composite-preview__device"
        colourway={colourway}
        panelTone={panelTone}
        panel={<Panel colourway={panelTone} state={state} />}
      />
      <p className="wp-composite-preview__help">
        Focus the display. Arrow keys move one row; Enter opens Albums and Now Playing;
        Backspace returns.
      </p>
    </main>
  )
}

const COMPOSITE_PREVIEW_CSS = `
  .wp-composite-preview {
    min-height: 100dvh;
    overflow: hidden;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    place-items: center;
    gap: 12px;
    padding: 18px;
    color: #eef1f5;
    background: radial-gradient(circle at 50% 22%, #252a32 0, #101319 48%, #07090d 100%);
  }
  .wp-composite-preview__header { text-align: center; font-family: ui-sans-serif, sans-serif; }
  .wp-composite-preview__header p { margin: 0; color: #8d96a4; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  .wp-composite-preview__header h1 { margin: 5px 0 8px; font-size: 18px; }
  .wp-composite-preview__header nav { display: flex; justify-content: center; gap: 8px; }
  .wp-composite-preview__header a { min-width: 58px; padding: 5px 10px; border: 1px solid #3b4350; border-radius: 999px; color: inherit; text-decoration: none; font: 600 11px ui-sans-serif, sans-serif; }
  .wp-composite-preview__device { width: min(390px, calc(100vw - 24px)); height: min(653px, calc(100dvh - 156px)); }
  .wp-composite-preview__device > div, .wp-composite-preview__device canvas { width: 100% !important; height: 100% !important; }
  .wp-composite-preview__help { margin: 0; color: #8d96a4; text-align: center; font: 500 11px/1.35 ui-sans-serif, sans-serif; }
  @media (max-height: 720px) { .wp-composite-preview__header h1 { margin-block: 2px 5px; } .wp-composite-preview { padding: 8px; } }
`
