# webPod — Stack Research Grounded in Local Clones

All claims below are traceable to `/Users/vinicius/code/agentic-context/`. Clones were verified fresh
(`git log -1` on `html-in-canvas` → `2026-08-27`, on `three.js` → `2026-08-27`). Nothing here comes from
memory; where I did not verify something in this pass, it is marked **[NOT VERIFIED]** rather than guessed.

## 0. Version inventory as found locally

| Library | Version found | Where |
| --- | --- | --- |
| html-in-canvas | WICG explainer, **no version** — behind a Chromium flag | `html-in-canvas/README.md`, `html-in-canvas/w3c.json` |
| three.js | **0.185.0**, branch `dev` | `three.js/package.json` |
| @react-three/fiber | **9.7.0** | `react-three-fiber/packages/fiber/package.json` |
| jotai | **2.20.3** | `jotai/package.json` |
| effect | **4.0.0-rc.112** | `effect/packages/effect/package.json` |
| @tanstack/react-router | **1.170.32** | `tanstack/router/packages/react-router/package.json` |
| @tanstack/react-start | **1.168.49** | `tanstack/router/packages/react-start/package.json` |
| @tanstack/react-virtual | **3.14.10** | `tanstack/virtual/packages/react-virtual/package.json` |
| bun | **1.4.1** (`LATEST` file says `1.4.0`) | `bun/package.json`, `bun/LATEST` |
| WebMCP | Origin Trial in Chrome 149 / Edge 150 | `webmcp/implementation-status.md` |

**The single biggest finding of this research: Effect is at `4.0.0-rc.112`, not v3.** Almost every Effect API a
model would write from training data is wrong for this repo. See §4.

---

## 1. html-in-canvas — QUESTION A

### 1.1 Status: unshipped WICG proposal behind a Chromium flag

`/Users/vinicius/code/agentic-context/html-in-canvas/README.md`, lines 3–7, verbatim:

> ## Status
>
> This is a living explainer which is continuously updated as we receive feedback.
>
> The APIs described here are implemented behind a flag in Chromium and can be enabled with
> `chrome://flags/#canvas-draw-element`.

And under "Developer Trial (dev trial) Information":

> The HTML-in-Canvas features may be enabled with `chrome://flags/#canvas-draw-element` in **Chrome Canary**.
>
> We are most interested in feedback on the following topics:
> * What content works, and what fails? Which failure modes are most important to fix?
> * **How does the feature interact with accessibility features? How can accessibility support be improved?**

`/Users/vinicius/code/agentic-context/html-in-canvas/w3c.json` shows `"repo-type": "cg-report"` — a W3C
Community Group report, i.e. **incubation, not standards track**. There is no origin trial (contrast with
WebMCP, which does have one — see §8). `security-privacy-questionnaire.md` Q16 confirms the spec is unfinished:

> The specification is still in progress. The privacy issues have been highlighted in the explainer.

**Verdict on status: cannot be relied on in production. Zero non-Chromium support, no origin trial, Canary +
manual flag only, and the API is still being renamed under us — see 1.4.**

### 1.2 The five primitives (verbatim from the explainer)

1. **`layoutsubtree`** attribute on `<canvas>` — opts canvas descendants into layout.
   > canvas descendants work like regular DOM content and respect CSS/HTML primitives like `inert`, but are
   > **initially marked as offscreen** (i.e., only semantic information is exposed to accessibility, without
   > geometry). In terms of hit testing, **canvas descendants are initially not hit testable.**
2. **`drawable`** attribute on descendants — required for drawing; implies `isolation: isolate`.
3. **`paint` event** + `canvas.requestPaint()` — fires when a drawable's snapshot would change.
   > Canvas drawing commands made in the `paint` event will appear in the current frame, but **DOM changes made
   > in the `paint` event will not show up until the subsequent frame.**
4. **`drawElementImage()`** (2D) / **`texElementSubImage2D`** (WebGL) / **`drawElementImageToTexture`** (WebGPU).
5. **`updateElementGeometry()`** — the DOM↔canvas synchronisation primitive.

### 1.3 What `drawElementImage` + `updateElementGeometry` actually give us for hit-testing and a11y

This is the crux. Verbatim from the explainer, §5 "Synchronizing the DOM and drawing":

> * Hit test order can be set to the top or left unmodified with `preserveHitTestOrder`. The canvas maintains an
>   ordered list of drawable descendants to hit test, and **hit testing proceeds straight from the canvas element
>   to each descendant, skipping intervening clips and transforms.**
> * The DOM position of a `drawable` element can be set with a canvas element transform, which is a DOMMatrix
>   that transforms the element's border-box, before CSS transformations, to the drawn location in the canvas.
>   The canvas element transform is not used for rendering, so changes to it do not cause the `paint` event to
>   fire in the next frame. **When the canvas element transform is set, the element's accessibility information
>   is updated to include geometry information.**

And critically for a 3D use case:

> `updateElementGeometry` is automatically run when drawing an element into a 2D context using
> `drawElementImage`. […] **3D contexts must call `updateElementGeometry` because, unlike 2D contexts, the
> transform from the element's drawn location in a texture to the canvas's CSS coordinates is not available in
> the canvas API.**

The IDL, verbatim:

```idl
dictionary UpdateElementGeometryOptions {
  boolean preserveHitTestOrder = false;
  DOMMatrixInit canvasTransform;
};

partial interface HTMLCanvasElement {
  [CEReactions, Reflect] attribute boolean layoutSubtree;
  attribute EventHandler onpaint;
  void requestPaint();
  ElementImage captureElementImage(Element element);
  void updateElementGeometry((Element or ElementImage) element, optional UpdateElementGeometryOptions options = {});
  void clearElementGeometry((Element or ElementImage) element);
  [NewObject] DOMMatrix? getCanvasTransform(Element element);
  attribute EventHandler onelementgeometryupdate;
};
```

**So, precisely:**
- **a11y**: the drawn UI is *real DOM*. It stays in the accessibility tree with full semantics from the moment
  `layoutsubtree` is set. Geometry (bounding boxes for screen-reader cursor / touch exploration) is added
  **only once you call `updateElementGeometry` with a `canvasTransform`.** Without it the a11y tree has content
  but no positions. This is exactly the guarantee webPod needs: the 320×240 screen is genuinely accessible and
  its text is genuinely selectable, not a picture of text.
- **hit-testing**: it works, but it is a *flat, ordered list* maintained by the canvas, and the transform is a
  single `DOMMatrix` per drawable mapping border-box → canvas CSS coordinates. Note "skipping intervening clips
  and transforms" — you get one affine/projective mapping per drawable, not a general 3D pick. For an iPod
  screen that is one flat quad, that is exactly enough. **But** you must recompute and push that matrix every
  time the device moves (the expose flip, the tilt), from inside your render loop.

### 1.4 The API is actively churning — evidence, not speculation

The README's own demo list says, twice:

> Note: This demo needs to be updated to work with the recent API changes.

And `/Users/vinicius/code/agentic-context/html-in-canvas/Examples/webGL.html` contains a runtime
try/catch straddling two incompatible signatures of the same method:

```js
try {
  gl.texElementImage2D(gl.TEXTURE_2D, internalFormat, draw_element);
} catch (e) {
  // The texElementImage2D API was recently changed (see:
  // https://github.com/WICG/html-in-canvas#idl-changes). This snippet
  // supports the old syntax temporarily so that the demos do not break.
  const level = 0;
  const srcFormat = gl.RGBA;
  const destType = gl.UNSIGNED_BYTE;
  gl.texElementImage2D(gl.TEXTURE_2D, level, internalFormat,
                          srcFormat, destType, draw_element);
  console.log('Note: using old texElementImage2D API');
}
```

Note the demo calls `texElementImage2D` while the current IDL in the same repo declares
**`texElementSubImage2D`**. The WebGL entry point does not even have a stable *name* right now. Do not bind
application code directly to it.

### 1.5 Content restrictions that bite webPod specifically

From "Read-back-allowed rendering" — this content **will not paint** into the canvas:

> * Cross-origin data in embedded content (e.g., `<iframe>`, `<img>`), `<url>` references (e.g.,
>   `background-image`, `clip-path`), `<canvas>` elements tainted with cross-origin data, and SVG […]
> * System colors, themes, or preferences.
> * Spelling and grammar markers.
> * Visited link information.
> * Pending form autofill information not otherwise available to JavaScript.
> * Subpixel text anti-aliasing.

**Direct consequence for a music player: album artwork served cross-origin (which is exactly how Apple Music
and Spotify serve artwork) will not paint.** Artwork must be proxied same-origin through the Bun backend, or
CORS-enabled and drawn as a three.js texture outside the DOM layer. This is a concrete, non-obvious blocker
that falls straight out of the local spec text. Also note "no subpixel text anti-aliasing" — text in the
device screen will be greyscale-antialiased, which for a 320×240 panel is arguably correct anyway.

### 1.6 The escape hatch: three.js r185 already ships `HTMLTexture` + `InteractionManager`

This is the finding that changes the answer to A from "no" to "yes, with a fallback".

`/Users/vinicius/code/agentic-context/three.js/src/textures/HTMLTexture.js` (added by commit
`bb42b15d02 Added HTMLTexture (#31233)`, exported at `src/Three.Core.js:35`):

```js
class HTMLTexture extends Texture {
	constructor( element, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy ) {
		super( element, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy );
		this.isHTMLTexture = true;
		this.generateMipmaps = false;
		this.needsUpdate = true;
		const parent = element ? element.parentNode : null;
		if ( parent !== null && 'requestPaint' in parent ) {
			parent.onpaint = () => { this.needsUpdate = true; };
			parent.requestPaint();
		}
	}
	dispose() { /* clears parent.onpaint, then super.dispose() */ }
}
```

Note the feature detection is literally `'requestPaint' in parent` — three.js degrades to a plain `Texture` if
the flag is off.

`/Users/vinicius/code/agentic-context/three.js/examples/jsm/interaction/InteractionManager.js`, class docstring
verbatim:

> Manages interaction for 3D objects independently of the scene graph.
>
> For objects with an `HTMLTexture`, the manager computes CSS `matrix3d` transforms each frame so the underlying
> HTML elements stay aligned with their meshes. **Because the elements are children of the canvas, the browser
> dispatches pointer events to them natively.**

Its `update()` builds `viewport ← projection ← view ← world ← pixelToLocal` and then:

```js
// The browser performs the perspective divide (by w) when applying the matrix3d.
element.style.transform = 'matrix3d(' + _mvp.elements.join( ',' ) + ')';
```

**This is a second, independent hit-testing mechanism that does not require `updateElementGeometry` at all.**
The real DOM element is positioned absolutely at the canvas origin and given a full 4×4 `matrix3d` CSS
transform that reproduces the mesh's on-screen projection. The browser then does native hit-testing, native
focus, native text selection, and native a11y geometry — because it is a genuinely transformed DOM element.
The canvas only supplies the *pixels*; the DOM supplies the *interaction*. It handles perspective correctly
("the browser performs the perspective divide"), which matters for the expose flip.

### 1.7 The polyfill

`/Users/vinicius/code/agentic-context/three.js/examples/webgl_materials_texture_html.html`:

```js
import { installHtmlInCanvasPolyfill } from 'three-html-render/polyfill';

if ( ! ( 'requestPaint' in HTMLCanvasElement.prototype ) ) {
	installHtmlInCanvasPolyfill();
	info.innerHTML += '<br><a href="https://github.com/WICG/html-in-canvas">HTML-in-Canvas API</a> not available. Using <a href="https://github.com/repalash/three-html-render">polyfill</a>.';
}
```

The example also demonstrates exactly our interaction requirement — a live `<input type="text">` and a
`<button>` whose click handler mutates its own `textContent` — on a `RoundedBoxGeometry` with
`MeshStandardMaterial({ roughness: 0, metalness: 0.5 })` and a `RoomEnvironment` PMREM env map. That is
essentially the iPod, already built, in the local three.js clone.

**Caveat, stated honestly:** `three-html-render` is loaded from a CDN import-map entry. It is **not vendored in
any local clone**, so I could not read its source and cannot certify its fidelity, licence, or maintenance.
Treat "the polyfill works" as unverified until it is actually vendored and tested.

### 1.8 The legacy floor: `HTMLMesh` / hand-rolled `html2canvas`

`/Users/vinicius/code/agentic-context/three.js/examples/jsm/interactive/HTMLMesh.js` is the *old* approach and
shows what life is like without the platform feature. It defines its own `class HTMLTexture extends
CanvasTexture` whose image is produced by a bespoke `function html2canvas( element )` that manually walks
`element.childNodes` and calls a hand-written `drawElement( element, style )` for each. Its own docstring
scopes it honestly:

> A typical use case for this class is to render the GUI of `lil-gui` as a texture so it is compatible for VR.

It reintroduces synthetic events (`material.map.dispatchDOMEvent( event )` bound to `mousedown`/`mousemove`/
`mouseup`/`click`) — i.e. **no real focus, no real text selection, no real a11y tree.** This is the floor we are
trying to stay off.

### 1.9 ANSWER TO A

**Viable-with-fallback — but only because the fallback is the same architecture, not a different one.**

`html-in-canvas` itself is an unshipped WICG Community Group explainer implemented behind
`chrome://flags/#canvas-draw-element` in Chrome Canary, with no origin trial, no second implementer, an
unfinished spec, and a WebGL entry point whose name is currently changing under it (`texElementImage2D` vs
`texElementSubImage2D`, with the repo's own demo carrying a try/catch for both). It cannot be a load-bearing
production dependency and must never be on the critical path for a user being able to use webPod. What makes it
usable anyway is that when it *is* present it gives us exactly what we want and nothing less: the screen is real
DOM, so it keeps native semantics, focus, text selection and a11y content for free, and calling
`updateElementGeometry({ canvasTransform })` — mandatory for 3D contexts, since only 2D gets it automatically
from `drawElementImage` — adds a11y *geometry* and inserts the element into the canvas's flat hit-test list.
The decisive point is that the correct architecture is identical whether or not the flag is on: keep the 320×240
UI as real DOM the whole time, let three.js `HTMLTexture` (present in the local r185 `dev` clone,
`src/textures/HTMLTexture.js`, feature-detected via `'requestPaint' in parent`) supply the pixels, and let
`InteractionManager` supply interaction by writing a per-frame `matrix3d` CSS transform onto the DOM element so
the browser hit-tests, focuses and exposes it natively — a mechanism that needs no flag at all. So the tiering
is: flag on → DOM pixels composited into the WebGL scene; flag off with `three-html-render` polyfill → same
scene, polyfilled rasterisation (unverified, not vendored locally); flag off with no polyfill → the DOM screen
renders as a CSS-3D-transformed overlay perfectly registered to the modelled bezel, which loses only the
"pixels genuinely inside the WebGL material" property and loses nothing in accessibility, selectability or
WebMCP actuation. Two constraints must be designed in from day one regardless of tier: cross-origin album
artwork **will not paint** under read-back-allowed rendering and must be proxied same-origin by the Bun backend,
and DOM mutations made during the `paint` event do not appear until the following frame.

---

## 2. react-three-fiber / three.js — QUESTION B

### 2.1 Status

R3F `9.7.0` (`react-three-fiber/packages/fiber/package.json`); three.js clone is `0.185.0` on branch `dev` —
i.e. **a development branch, not a tagged release.** `HTMLTexture` and `InteractionManager` exist only because
of that; do not assume they are in whatever `three` version npm resolves.

### 2.2 `<Canvas>` props — verbatim from `react-three-fiber/docs/API/canvas.mdx`

| Prop | Description | Default |
| --- | --- | --- |
| `gl` | Props that go into the default renderer. Accepts sync/async callback with default props `gl={defaults => new Renderer({ ...defaults })}` | `{}` |
| `camera` | Props that go into the default camera, or your own `THREE.Camera` | `{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 5] }` |
| `shadows` | Props that go into `gl.shadowMap`, can be set true for `PCFsoft` or one of: 'basic', 'percentage', 'soft', 'variance' | `false` |
| `frameloop` | Render mode: always, demand, never | `always` |
| `dpr` | Pixel-ratio, use `window.devicePixelRatio`, or automatic: [min, max] | `[1, 2]` |
| `legacy` | Enables THREE.ColorManagement in three r139 or later | `false` |
| `linear` | Switch off automatic sRGB color space and gamma correction | `false` |
| `flat` | Use `THREE.NoToneMapping` instead of `THREE.ACESFilmicToneMapping` | `false` |
| `eventSource` | The source where events are being subscribed to, HTMLElement | `gl.domElement.parentNode` |
| `eventPrefix` | The event prefix that is cast into canvas pointer x/y events | `offset` |
| `onPointerMissed` | Response for pointer clicks that have missed any target | `(event) => {}` |

Defaults, verbatim: renderer is created with `antialias=true`, `alpha=true`,
`powerPreference="high-performance"`, and `outputColorSpace = THREE.SRGBColorSpace`,
`toneMapping = THREE.ACESFilmicToneMapping`.

### 2.3 On-demand rendering — the answer to B

`/Users/vinicius/code/agentic-context/react-three-fiber/docs/advanced/scaling-performance.mdx`, verbatim:

> ## On-demand rendering
>
> three.js apps usually run in a game-loop that executes 60 times a second, React Three Fiber is no different.
> This is perfectly fine when your scene has _constantly_ moving parts in it. This is what generally drains
> batteries the most and makes fans spin up.
>
> But if the moving parts in your scene are allowed to come to rest, then it would be wasteful to keep
> rendering. In such cases you can opt into on-demand rendering, which will only render when necessary. This
> saves battery and keeps noisy fans in check.
>
> All you need to do is set the canvas `frameloop` prop to `demand`. It will render frames whenever it detects
> prop changes throughout the component tree.
>
> ```jsx
> <Canvas frameloop="demand">
> ```
>
> ### Triggering manual frames
>
> One major caveat is that if anything in the tree _mutates_ props, then React cannot be aware of it and the
> display would be stale. For instance, camera controls just grab into the camera and mutate its values. Here
> you can use React Three Fiber's `invalidate` function to trigger frames manually.
>
> > [!IMPORTANT]
> > Calling `invalidate()` will not render immediately, it merely requests a new frame to be rendered out.
> > Calling invalidate multiple times will not render multiple times. Think of it as a flag to tell the system
> > that something has changed.
>
> ### Sync animations with on-demand-rendering and invalidate
>
> Since `invalidate()` is only a flag that schedules render, you might bump into syncing issues when you run
> animations that are synchronous (as in, they start immediately). By the time fiber renders the first frame
> the animation has already progressed which leads to a visible jump. In such cases you should pre-emptively
> schedule a render and then start the animation in the next frame.
>
> ```jsx
> <mesh
>   onClick={() => {
>     // Pre-emptively schedule a render
>     invalidate()
>     // Wait for the next frame to start the animation
>     requestAnimationFrame(() => controls.dolly(1, true))
>   }}
> ```

Supporting API rows from `docs/API/hooks.mdx` (the `useThree` state table):

| Key | Description | Type |
| --- | --- | --- |
| `frameloop` | Render mode: always, demand, never | `always`, `demand`, `never` |
| `invalidate` | Request a new render, given that `frameloop === 'demand'` | `() => void` |
| `advance` | Advance one tick, given that `frameloop === 'never'` | `(timestamp: number, runGlobalEffects?: boolean) => void` |
| `setFrameloop` | Shortcut to set the current render mode | `(frameloop?: 'always', 'demand', 'never') => void` |

`invalidate` and `advance` are also top-level exports (`docs/API/additional-exports.mdx`), so they are callable
from outside the component tree — which matters for us, because a WebMCP tool callback that changes playback
state must be able to schedule a repaint.

### 2.4 Idiomatic pattern for webPod

```jsx
// Mostly-static device. No frames burned while it sits still.
<Canvas frameloop="demand" dpr={[1, 2]} shadows>
  <Device />
</Canvas>

// Accelerometer-driven specular highlight: mutate, then flag a frame.
function Tilt() {
  const invalidate = useThree((s) => s.invalidate)
  const light = useRef()
  useEffect(() => {
    const onOrient = (e) => {
      light.current.position.set(e.gamma / 90, e.beta / 90, 1)
      invalidate()            // schedule, do not render
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [invalidate])
  return <directionalLight ref={light} />
}

// Expose flip: pre-emptively schedule, then start the animation next frame,
// exactly as the docs prescribe for synchronous animations.
onClick={() => {
  invalidate()
  requestAnimationFrame(() => startFlip())
}}
```

Because the flip is a continuous animation, a `useFrame` that runs *only while the flip is in flight* must call
`invalidate()` each tick to keep the loop alive; otherwise `demand` will render one frame and stop.

### 2.5 `useFrame` — verbatim signature and the render-priority rule

`/Users/vinicius/code/agentic-context/react-three-fiber/docs/API/hooks.mdx`:

```jsx
useFrame((state, delta, xrFrame) => {
  // This function runs at the native refresh rate inside of a shared render-loop
})
```

> [!CAUTION]
> Be careful about what you do inside useFrame! You should never setState in there! Your calculations should be
> slim and you should mind all the commonly known pitfalls when dealing with loops in general, like re-use of
> variables, etc.

> ### Taking over the render-loop
> If you need more control you may pass a numerical `renderPriority` value. **This will cause React Three Fiber
> to disable automatic rendering altogether. It will now be your responsibility to render**, which is useful
> when you're working with effect composers, heads-up displays, etc.

```jsx
useFrame(({ gl, scene, camera }) => { gl.render(scene, camera) }, 1)
```

**Footgun for webPod:** `InteractionManager.update()` must run every frame *before* the render. If we adopt it
we will likely take over the loop with a priority-1 `useFrame`, at which point R3F stops rendering for us and we
own `gl.render` — and we must reconcile that with `frameloop="demand"` by hand.

Also note the hard constraint: *"Hooks can only be used inside the Canvas element because they rely on
context!"* — `useThree`/`useFrame` outside `<Canvas>` "will just crash".

### 2.6 Performance rules — verbatim from `docs/advanced/pitfalls.mdx`

> The most important gotcha in three.js is that creating objects can be expensive, think twice before you
> mount/unmount things! Every material or light that you put into the scene has to compile, every geometry you
> create will be processed. Share materials and geometries if you can

```jsx
const geom = useMemo(() => new BoxGeometry(), [])
const mat = useMemo(() => new MeshBasicMaterial(), [])
```

> ## Avoid setState in loops
> TLDR, don't, mutate inside `useFrame`!
> - Threejs has a render-loop, it does not work like the DOM does. **Fast updates are carried out in `useFrame`
>   by mutation**. […]
> - It is not enough to set values in succession, _you need frame deltas_. Instead of `position.x += 0.1`
>   consider `position.x += delta` or your project will run at different speeds depending on the end-users
>   system. Many updates in threejs need to be paired with update flags (`.needsUpdate = true`), or imperative
>   functions (`.updateProjectionMatrix()`).

Explicitly labelled bad: `setState` in `setInterval` loops, `setState` in `useFrame`, `setState` in fast events
(`onPointerMove`). Explicitly labelled good: `useFrame((state, delta) => (meshRef.current.position.x += delta))`.

**This creates a direct, unavoidable tension with the project's absolute ban on `useState`, and it resolves
cleanly in our favour:** R3F's rule is "don't route per-frame updates through React's scheduler at all". Jotai
atoms are the correct home for *discrete* state (which track is playing, is the device flipped); per-frame
values (tilt angle, flip progress) belong in refs mutated inside `useFrame`, in neither `useState` nor an atom.
Writing a Jotai atom every frame would be exactly the mistake this page warns about.

### 2.7 Contradictions with training data (R3F / three.js)

- `frameloop` accepts `'never'`, not just `'always' | 'demand'`, and `'never'` is driven by `advance(timestamp)`.
- `legacy` **enables** `THREE.ColorManagement` (default `false`); `flat` selects `NoToneMapping`. A model tends
  to reach for the removed `outputEncoding`/`sRGBEncoding` API instead. The local docs state the modern form:
  `outputColorSpace = THREE.SRGBColorSpace`.
- Default tone mapping is **ACESFilmic**, not `NoToneMapping` — matters a lot for "does the steel back look
  real", and it means raw hex colours will not appear as authored.
- `useFrame` now receives a **third** argument, `xrFrame`.
- three.js `HTMLTexture` exists (r185 `dev`). Most models have never seen it.

---

## 3. Jotai — QUESTION C

### 3.1 Status

`jotai@2.20.3` (`/Users/vinicius/code/agentic-context/jotai/package.json`) — stable v2.

### 3.2 THE ANSWER TO C

**`createStore()` (or `getDefaultStore()`), then `store.get(atom)` / `store.set(atom, value)` /
`store.sub(atom, callback)`.** There is a dedicated guide for exactly this use case.

`/Users/vinicius/code/agentic-context/jotai/docs/guides/using-store-outside-react.mdx`, verbatim:

> Jotai's state resides in React, but sometimes it would be nice to interact with the world outside React.
>
> ## createStore
>
> `createStore` provides a store interface that can be used to store your atoms. Using the store, you can access
> and mutate the state of your stored atoms from outside React.

```jsx
import { atom, useAtomValue, createStore, Provider } from 'jotai'

const timeAtom = atom(0)
const store = createStore()

store.set(timeAtom, (prev) => prev + 1) // Update atom's value
store.get(timeAtom) // Read atom's value

function Component() {
  const time = useAtomValue(timeAtom) // Inside React
  return <div className="App"><h1>{time}</h1></div>
}

export default function App() {
  return (
    <Provider store={store}>
      <Component />
    </Provider>
  )
}
```

`/Users/vinicius/code/agentic-context/jotai/docs/core/store.mdx`, verbatim:

> ## createStore
>
> This function is to create a new empty store. The store can be used to pass in `Provider`.
>
> The store has three methods: `get` for getting atom values, `set` for setting atom values, and `sub` for
> subscribing to atom changes.

```jsx
const myStore = createStore()
const countAtom = atom(0)
myStore.set(countAtom, 1)
const unsub = myStore.sub(countAtom, () => {
  console.log('countAtom value is changed to', myStore.get(countAtom))
})
// unsub() to unsubscribe

const Root = () => (<Provider store={myStore}><App /></Provider>)
```

> ## getDefaultStore
>
> This function returns a default store that is used in provider-less mode.

```js
const defaultStore = getDefaultStore()
```

### 3.3 The footgun that decides the architecture

`docs/core/provider.mdx`, verbatim:

> If an atom is used in a tree without a Provider, it will use the default state. This is so-called
> provider-less mode.
>
> Atom configs don't hold values. Atom values reside in separate stores. A Provider is a component that contains
> a store and provides atom values under the component tree. […] If you don't use a Provider, it works as
> provider-less mode with a default store.

**Therefore: pick one store and commit.** If React renders under `<Provider store={appStore}>` but a WebMCP tool
callback calls `getDefaultStore().set(...)`, the write lands in a *different store* and the UI silently does not
update. This is the single most likely bug in the whole state layer. The recommendation is an explicit
`export const appStore = createStore()` in one module, passed to `<Provider store={appStore}>` and imported
directly by every non-React caller. Do not use `getDefaultStore()` anywhere if a `Provider` is in play.

### 3.4 Idiomatic pattern: the WebMCP ↔ Jotai bridge

```ts
// src/state/store.ts — the single source of truth, importable from anywhere.
import { createStore } from 'jotai'
export const appStore = createStore()

// src/state/player.ts
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
export const playbackAtom   = atom<'playing' | 'paused'>('paused')
export const queueAtom      = atom<Track[]>([])
export const cursorAtom     = atom(0)
export const nowPlayingAtom = atom((get) => get(queueAtom)[get(cursorAtom)] ?? null) // derived
export const volumeAtom     = atomWithStorage('webpod:volume', 0.7, undefined, { getOnInit: true })

// src/agent/tools.ts — plain module scope. No hooks, no React.
import { appStore } from '../state/store'
import { playbackAtom, nowPlayingAtom } from '../state/player'

const controller = new AbortController()

await document.modelContext.registerTool({
  name: 'play',
  description: 'Start playback of the current track',
  inputSchema: { type: 'object', properties: {}, required: [] },
  async execute() {
    appStore.set(playbackAtom, 'playing')          // WRITE from outside React
    const track = appStore.get(nowPlayingAtom)     // READ  from outside React
    return { content: [{ type: 'text', text: `Playing ${track?.title ?? 'nothing'}` }] }
  },
}, { signal: controller.signal })

// Push agent-visible state changes back out (e.g. re-describe tools, or invalidate the R3F frame):
const unsub = appStore.sub(playbackAtom, () => { /* … */ })
```

Inside React, `useAtomCallback` covers the same imperative need without leaving the store abstraction.
`/Users/vinicius/code/agentic-context/jotai/docs/utilities/callback.mdx`, verbatim:

```ts
useAtomCallback<Result, Args extends unknown[]>(
  callback: (get: Getter, set: Setter, ...arg: Args) => Result,
  options?: Options
): (...args: Args) => Result
```

> This hook is for interacting with atoms imperatively. It takes a callback function that works like atom write
> function, and returns a function that returns an atom value.
>
> **The callback to pass in the hook must be stable (should be wrapped with useCallback).**

Import path is `jotai/utils`, not `jotai`.

### 3.5 The four categories of state the project asked about

| Need | Jotai expression | Source |
| --- | --- | --- |
| Local ephemeral UI state | plain `atom(initialValue)`, module-scoped or created in `useMemo` | `docs/core/atom.mdx` |
| Derived state | `atom((get) => …)` read-only derived atom | `docs/core/atom.mdx` |
| Async / server state | async read function + Suspense, or `loadable` for non-suspense | `docs/guides/async.mdx`, `docs/utilities/async.mdx` |
| Readable **and writable** from non-React code | **`store.get` / `store.set` / `store.sub` on an explicit `createStore()`** | `docs/guides/using-store-outside-react.mdx` |

Per-frame render values (tilt, flip progress) belong in **neither** — see §2.6.

### 3.6 Utilities verified in this pass

`atomWithStorage` — `docs/utilities/storage.mdx`, verbatim parameters:

> **key** (required): a unique string used as the key when syncing state with localStorage, sessionStorage, or AsyncStorage
> **initialValue** (required): the initial value of the atom
> **storage** (optional): an object with the following methods: `getItem(key, initialValue)` (required), `setItem(key, value)` (required), `removeItem(key)` (required), `subscribe(key, callback, initialValue)` (optional)
> **options** (optional): **getOnInit** (optional, by default **false**): A boolean value indicating whether to get item from storage on initialization. **Note that in an SPA with `getOnInit` either not set or `false` you will always get the initial value instead of the stored value on initialization.** If the stored value is preferred set `getOnInit` to `true`.

> If not specified, the default storage implementation uses `localStorage` for storage/retrieval,
> `JSON.stringify()`/`JSON.parse()` for serialization/deserialization, and subscribes to `storage` events for
> cross-tab synchronization.

**Footgun:** `getOnInit` defaults to `false`. For persisted volume / last-played track this is almost certainly
wrong and you will get a flash of default state. Set `getOnInit: true` deliberately.

`atomFamily` — `docs/utilities/family.mdx`, verbatim:

```
atomFamily(initializeAtom, areEqual): (param) => Atom
```

> This will create a function that takes `param` and returns an atom. **If the atom has already been created, it
> will be returned from the cache.** `initializeAtom` is a function that can return any kind of atom (`atom()`,
> `atomWithDefault()`, ...). Note that the `areEqual` argument is optional and compares if two params are equal
> (defaults to `Object.is`).

The cache is why `atomFamily` leaks if used per-track over a long session — the docs mention a `remove` API for
this. **[NOT VERIFIED in this pass: the exact `remove`/`setShouldRemove` signature.]**

`splitAtom` (`docs/utilities/split.mdx`) and `selectAtom` (`docs/utilities/select.mdx`) exist and are the
idiomatic tools for a long track list where each row should re-render independently.
**[NOT VERIFIED in this pass: their exact signatures.]**

Also present and relevant but **[NOT VERIFIED in this pass]**: `docs/guides/atoms-in-atom.mdx`,
`docs/guides/composing-atoms.mdx`, `docs/guides/performance.mdx`, `docs/guides/initialize-atom-on-render.mdx`,
`docs/utilities/ssr.mdx` (`useHydrateAtoms` — will matter for TanStack Start SSR),
`docs/utilities/lazy.mdx`, `docs/utilities/resettable.mdx`.

### 3.7 Contradictions with training data (Jotai)

- Two of the most relevant docs — `using-store-outside-react.mdx` and `callback.mdx` — carry
  `published: false` in their frontmatter, i.e. they are not on the public docs site. A model is unlikely to
  have them memorised, and this is precisely the API question the project cares most about.
- `store.sub(atom, callback)` — the callback takes **no arguments**; you must call `store.get(atom)` inside it.
  Models routinely write `store.sub(atom, (value) => …)`.
- `atomWithStorage`'s `getOnInit` defaults to **`false`**, contradicting the near-universal assumption that a
  persisted atom hydrates itself.
- `useAtomCallback` lives in `jotai/utils`, not `jotai`.
- The v1 `scope` prop is gone; `docs/guides/migrating-to-v2-api.mdx` exists for a reason.

---

## 4. Effect — QUESTION D

### 4.1 Status: **Effect 4.0.0-rc.112 — a release candidate, not v3**

`/Users/vinicius/code/agentic-context/effect/packages/effect/package.json` → `"version": "4.0.0-rc.112"`.

This is the highest-value finding in this document. **Essentially all Effect knowledge from training data is
v3 and is wrong here.** The local `LLMS.md` opens by saying so, verbatim:

> When you need to find information about Effect, use this documentation and the Effect source code available in
> your environment. **Avoid unrelated copies of Effect or external documentation, as they may be outdated or
> incorrect.**

Being an `rc`, this is a **production-risk flag in its own right**: pinned exact version, expect breaking
changes between rcs.

### 4.2 CONFIRMED: HTTP has moved to `effect/unstable/http`

The coordinator's sub-agent finding is correct and I verified it two ways.

`ls /Users/vinicius/code/agentic-context/effect/packages/effect/src/unstable` →
`ai  arbitrary  cli  cluster  devtools  encoding  eventlog  http  httpapi  observability  persistence
process  reactivity  rpc  schema  socket  sql  workers  workflow`

And the import lines, verbatim, from `ai-docs/src/51_http-server/10_basics.ts`:

```ts
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Context, Effect, flow, Layer, Schedule } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiClient, HttpApiMiddleware, HttpApiScalar } from "effect/unstable/httpapi"
```

**Flagging this prominently: a model will write `import { HttpServer } from "@effect/platform"`. That is wrong
for this codebase.** In Effect 4 these modules are folded into the single `effect` package under an
`unstable/` namespace — the namespace itself is the maintainers' stability disclaimer. `LLMS.md` uses the same
convention for other subsystems: *"Use the `effect/unstable/sql` modules"*, *"Use the `effect/unstable/process`
modules"*, *"Use the \"effect/unstable/cli\" modules"*, and for telemetry *"use the lightweight Otlp modules
from `effect/unstable/observability` in new projects"*. Only the **runtime/platform** bindings
(`@effect/platform-bun`, `@effect/platform-node`) remain separate packages.

### 4.3 ANSWER TO D: `Context.Service`

`LLMS.md` §"Writing Effect services", verbatim:

> Effect services are the most common way to structure Effect code. Prefer using services to encapsulate
> behaviour over other approaches, as it ensures that your code is modular, testable, and maintainable.
>
> ### Context.Service
>
> **The default way to define a service is to extend `Context.Service`**, passing in the service interface as a
> type parameter.

```ts
// file: src/db/Database.ts
import { Context, Effect, Layer, Schema } from "effect"

// Pass in the service class name as the first type parameter, and the service
// interface as the second type parameter.
export class Database extends Context.Service<Database, {
  query(sql: string): Effect.Effect<Array<unknown>, DatabaseError>
}>()(
  // The string identifier for the service, which should include the package
  // name and the subdirectory path to the service file.
  "myapp/db/Database"
) {
  // Attach a static layer to the service, which will be used to provide an
  // implementation of the service.
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function*() {
      // Define the service methods using Effect.fn
      const query = Effect.fn("Database.query")(function*(sql: string) {
        yield* Effect.log("Executing SQL query:", sql)
        return [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]
      })

      // Return an instance of the service using Database.of, passing in an
      // object that implements the service interface.
      return Database.of({ query })
    })
  )
}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  cause: Schema.Defect()
}) {}

// If you ever need to access the service type, use `Database["Service"]`
export type DatabaseService = Database["Service"]
```

**Not `Context.Tag`. Not `Effect.Service`. Not `Context.GenericTag`.** Those are the v3 spellings a model
reaches for and none of them is the documented default here.

Layer composition, verbatim from `ai-docs/src/01_effect/03_services/20_layer-composition.ts`:

```ts
  // Use Layer.provide to compose the UserRepository layer with the SqlClient
  // layer, exposing only the UserRepository service
  static readonly layer: Layer.Layer<UserRepository, Config.ConfigError | SqlError.SqlError> =
    this.layerNoDeps.pipe(Layer.provide(SqlClientLayer))

  // Use Layer.provideMerge to compose the UserRepository layer with the SqlClient
  // layer, exposing both the UserRepository and SqlClient services
  static readonly layerWithSqlClient: Layer.Layer<UserRepository | SqlClient.SqlClient, …> =
    this.layerNoDeps.pipe(Layer.provideMerge(SqlClientLayer))
```

Note the convention: the raw layer is `static readonly layerNoDeps` with its dependencies still in the `R`
channel, and `static readonly layer` is the same thing with deps provided. That is the shape to copy.

### 4.4 Idiomatic `MusicProvider` with two implementations

Modelled directly on `ai-docs/src/50_http-client/10_basics.ts`, which is the closest analogue in the local docs
(a `Context.Service` wrapping an external JSON HTTP API with schema-decoded responses, retries and spans):

```ts
// src/music/MusicProvider.ts
import { Context, Effect, Layer, Schedule, Schema, flow } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

export class Track extends Schema.Class<Track>("webpod/music/Track")({
  id: Schema.String,
  title: Schema.NonEmptyString,
  artist: Schema.String,
  durationMs: Schema.Int,
  artworkUrl: Schema.String
}) {}

export class MusicProviderError extends Schema.TaggedError<MusicProviderError>()(
  "MusicProviderError",
  { provider: Schema.Literals(["apple", "spotify"]), cause: Schema.Defect() }
) {}

// ONE interface, no implementation detail leaked.
export class MusicProvider extends Context.Service<MusicProvider, {
  search(query: string): Effect.Effect<ReadonlyArray<Track>, MusicProviderError>
  getTrack(id: string): Effect.Effect<Track, MusicProviderError>
  play(id: string): Effect.Effect<void, MusicProviderError>
}>()("webpod/music/MusicProvider") {}

// --- Implementation 1: Apple Music (MusicKit) ---
// src/music/AppleMusicProvider.ts
export const AppleMusicLive: Layer.Layer<MusicProvider, never, HttpClient.HttpClient> = Layer.effect(
  MusicProvider,
  Effect.gen(function*() {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(flow(
        HttpClientRequest.prependUrl("https://api.music.apple.com/v1"),
        HttpClientRequest.acceptJson
      )),
      HttpClient.filterStatusOk,
      HttpClient.retryTransient({ schedule: Schedule.exponential(100), times: 3 })
    )

    const search = Effect.fn("AppleMusic.search")(function*(query: string) {
      const res = yield* client.get(`/catalog/us/search?term=${encodeURIComponent(query)}`)
      return yield* HttpClientResponse.schemaBodyJson(Schema.Array(Track))(res)
    }, Effect.mapError((cause) => new MusicProviderError({ provider: "apple", cause })))

    return MusicProvider.of({ search, getTrack, play })
  })
).pipe(Layer.provide(FetchHttpClient.layer))

// --- Implementation 2: Spotify — same shape, different Layer ---
export const SpotifyLive: Layer.Layer<MusicProvider> = /* … */

// --- Swapping is a one-line change at the composition root ---
const AppLive = HttpRouter.serve(ApiRoutes).pipe(Layer.provide(AppleMusicLive))
// later: Layer.provide(SpotifyLive)  — or a MusicProviderTest layer in tests.
```

The two implementations are two `Layer`s satisfying one `Context.Service`; the swap happens once, at the
composition root, and every call site is unchanged. That is the whole answer to D.

### 4.5 `Effect.gen`, `Effect.fn`, errors — verbatim

```ts
Effect.gen(function*() {
  yield* Effect.log("Starting the file processing...")
  // Always return when raising an error, to ensure typescript understands that
  // the function will not continue executing.
  return yield* new FileProcessingError({ message: "Failed to read the file" })
}).pipe(
  Effect.catch((error) => Effect.logError(`An error occurred: ${error}`)),
  Effect.withSpan("fileProcessing", { attributes: { method: "Effect.gen" } })
)
```

**Adapter-less**: `function*()`, not `function* (_)`, and `yield* eff`, not `yield* _(eff)`.

> Prefer `Effect.gen` for inline Effect code. For reusable functions, prefer `Effect.fn("name")` when tracing is
> useful and `Effect.fnUntraced` when it is not […] **Avoid functions that only wrap and return an
> `Effect.gen`**.

```ts
export const effectFunction = Effect.fn("effectFunction")(
  function*(n: number): Effect.fn.Return<string, SomeError> { … },
  // Add additional functionality by passing in additional arguments.
  // **Do not** use .pipe with Effect.fn
  Effect.catch((error) => Effect.logError(`An error occurred: ${error}`))
)
```

Errors, verbatim:

```ts
export class ParseError extends Schema.TaggedError<ParseError>()("ParseError", {
  input: Schema.String, message: Schema.String
}) {}

export const recovered = loadPort("80").pipe(
  Effect.catchTag(["ParseError", "ReservedPortError"], (_) => Effect.succeed(3000))
)
export const withFinalFallback = loadPort("invalid").pipe(
  Effect.catchTag("ReservedPortError", (_) => Effect.succeed(3000)),
  Effect.catch((_) => Effect.succeed(3000))   // catch-all is `Effect.catch`
)
```

`Effect.catchTag` accepts **an array of tags**. The catch-all is **`Effect.catch`**, not `Effect.catchAll`.
Errors are defined with **`Schema.TaggedError`**, not `Data.TaggedError`. There is also a "reason" idiom —
`Effect.catchReason`, `Effect.catchReasons`, `Effect.unwrapReason` (`ai-docs/src/01_effect/04_errors/`).

### 4.6 Schema — verbatim

```ts
import { Effect, Schema } from "effect"       // NOT "@effect/schema"

export class User extends Schema.Class<User>("path/to/module/User")({
  id: Schema.Int,
  name: Schema.NonEmptyString,
  email: Schema.String,
  role: Schema.Literals(["admin", "member"])
}) {}

export type UserType    = typeof User["Type"]
export type UserEncoded = typeof User["Encoded"]

export const decodeUser = Schema.decodeUnknownEffect(User)
export const encodeUser = Schema.encodeEffect(User)
```

> All validation and domain modeling in Effect is done with `Schema`.
> **AVOID using predicates or manual parsing**, instead use `Schema` to parse untrusted data and validate it.

Decoders are `Schema.decodeUnknownEffect` / `Schema.encodeEffect` (**not** `decodeUnknown` / `encode`), and the
literal-union combinator is **`Schema.Literals([...])`** (plural, array argument), not `Schema.Literal(a, b)`.
`Schema.Defect()` is the idiom for an unknown `cause` field. `SCHEMA.md` in `packages/effect/` is the full
reference — *"Make sure to read the guide in chunks, as it is a large document."*

This is the module to validate **both** WebMCP tool inputs and music-provider payloads, per the LLMS.md
directive.

### 4.7 HTTP server on Bun

```ts
// Create an HTTP server Layer that serves the API routes.
// Here we are using the NodeHttpServer, but you could also use the BunHttpServer
export const HttpServerLayer = HttpRouter.serve(AllRoutes).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)
Layer.launch(HttpServerLayer).pipe(NodeRuntime.runMain)

// Or create a web handler, which can be used in serverless environments
export const { handler, dispose } = HttpRouter.toWebHandler(
  AllRoutes.pipe(Layer.provide(HttpServer.layerServices))
)
```

`ai-docs/src/01_effect/06_running/10_run-main.ts` confirms the Bun entry point:

```ts
import { BunRuntime } from "@effect/platform-bun"
// `runMain` installs SIGINT / SIGTERM handlers and interrupts running fibers for graceful shutdown.
BunRuntime.runMain(program, { disableErrorReporting: true })
```

The docs prefer the **declarative `HttpApi`** style over imperative routing:

> `HttpApi` gives you schema-first, type-safe HTTP APIs with runtime validation, typed clients, and OpenAPI docs
> from one definition.

with a strong architectural instruction, verbatim from the example:

> Api definitions should **always** be seperate from the server implementation, so that they can be shared
> between the server and client without leaking server code into clients. Ideally, the would use a seperate
> package in a monorepo.

`HttpRouter.toWebHandler` returning `{ handler, dispose }` is the natural bridge to `Bun.serve({ fetch })` if we
want Bun to own the socket.

### 4.8 Bridging Effect to non-Effect code

> `ManagedRuntime` bridges Effect programs with non-Effect code. Build one runtime from your application Layer,
> then use it anywhere you need imperative execution, like web handlers, framework hooks, worker queues, or
> legacy callback APIs.

This is the documented mechanism if any Effect logic ever needs to run from a TanStack Start server function or
a WebMCP callback. (`ai-docs/src/04_integration/10_managed-runtime.ts`.)

### 4.9 Contradictions with training data (Effect) — the big list

| A model will write (v3) | This repo actually uses (v4-rc) |
| --- | --- |
| `Context.Tag` / `Effect.Service` | **`Context.Service<Self, Iface>()("id")`** |
| `import … from "@effect/schema/Schema"` | **`import { Schema } from "effect"`** |
| `Data.TaggedError` | **`Schema.TaggedError<E>()("Tag", {...})`** |
| `Effect.catchAll` | **`Effect.catch`** |
| `Effect.gen(function* (_) { yield* _(eff) })` | **`Effect.gen(function*() { yield* eff })`** |
| `Schema.decodeUnknown` / `Schema.encode` | **`Schema.decodeUnknownEffect` / `Schema.encodeEffect`** |
| `Schema.Literal("a", "b")` | **`Schema.Literals(["a", "b"])`** |
| `import { HttpServer } from "@effect/platform"` | **`from "effect/unstable/http"`** |
| `@effect/sql`, `@effect/cli`, `@effect/opentelemetry` as packages | **`effect/unstable/sql`, `effect/unstable/cli`, `effect/unstable/observability`** |
| hand-rolled `isRecord`/`isString` helpers | **`Predicate` module — "NEVER write your own helper functions"** |
| plain `Effect.gen` wrappers for reusable fns | **`Effect.fn("name")` / `Effect.fnUntraced`**; "Avoid functions that only wrap and return an `Effect.gen`" |
| `new Date()` / `Date.now()` | **`DateTime` module** — "use the `DateTime` module instead of `Date` and `Date.now`" |

---

## 5. TanStack — QUESTION E

### 5.1 Status

`@tanstack/react-router` 1.170.32, `@tanstack/react-start` **1.168.49** — Start is versioned separately and
*behind* the router. Both are 1.x. **[NOT VERIFIED in this pass: whether the local docs anywhere declare Start
beta/RC status in prose.]**

### 5.2 ANSWER TO E: yes — **Server Functions**, `createServerFn`

`/Users/vinicius/code/agentic-context/tanstack/router/docs/start/framework/react/guide/server-functions.md`,
verbatim:

> Server functions let you define server-only logic that can be called from anywhere in your application -
> loaders, components, hooks, or other server functions. They run on the server but can be invoked from client
> code seamlessly.

```tsx
import { createServerFn } from '@tanstack/react-start'

export const getServerTime = createServerFn().handler(async () => {
  // This runs only on the server
  return new Date().toISOString()
})

// Call from anywhere - components, loaders, hooks, etc.
const time = await getServerTime()
```

> [!NOTE]
> Server functions are meant to be called by your TanStack Start application. […] **If you need an endpoint that
> can be called from outside your Start app, use server routes instead.**

> ## Same-Origin Requests
>
> **Server functions are same-origin RPC endpoints for your application.** Browser requests to server functions
> should come from the same origin, verified with Fetch Metadata (`Sec-Fetch-Site`), `Origin`, or `Referer`
> headers. Use server routes for public APIs or endpoints that intentionally support cross-origin requests.
>
> TanStack Start provides `createCsrfMiddleware()` to protect server functions from cross-site requests. **If
> your app does not define `src/start.ts`, Start installs this middleware automatically for server functions.
> If you define `src/start.ts`, add the middleware explicitly:**

```tsx
// src/start.ts
import { createStart, createCsrfMiddleware } from '@tanstack/react-start'
const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })
export const startInstance = createStart(() => ({ requestMiddleware: [csrfMiddleware] }))
```

> [!TIP]
> **Requests without any of these headers (`Sec-Fetch-Site`, `Origin`, or `Referer`) are rejected by default.**

Method selection and validation, verbatim:

```tsx
export const getData = createServerFn().handler(async () => { … })          // GET (default)
export const saveData = createServerFn({ method: 'POST' }).handler(async () => { … })

createServerFn()
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => { … })

createServerFn()
  .validator(UserSchema)          // a schema object works directly
  .handler(async ({ data }) => { … })
```

**The method is `.validator()` in this version — not `.inputValidator()`.** (Verified by grep: 8 occurrences of
`.validator(`, zero of `.inputValidator(` in `server-functions.md`.) This is a genuine coin-flip a model gets
wrong, because the name has moved around across Start releases.

Calling them:

> Call server functions from: **Route loaders** […] **Components** - Use with `useServerFn()` hook […]
> **Other server functions** […] **Event handlers**

```tsx
export const Route = createFileRoute('/posts')({ loader: () => getServerPosts() })

function PostList() {
  const getPosts = useServerFn(getServerPosts)
  const { data } = useQuery({ queryKey: ['posts'], /* … */ })
}
```

**For webPod:** provider token exchange and the MusicKit developer-token mint belong in **server routes**
(`guide/server-routes.md`) if anything external calls them, and in **server functions** for everything the app
itself calls. Note the `useQuery` usage in Start's own docs — Query is the assumed companion.

Other guides present and directly relevant, all under
`tanstack/router/docs/start/framework/react/guide/`: `spa-mode.md`, `selective-ssr.md`,
`static-server-functions.md`, `streaming-data-from-server-functions.md`, `middleware.md`,
`environment-variables.md`, `import-protection.md`, `authentication.md`, `tailwind-integration.md`,
`static-prerendering.md`, `isr.md`. **[NOT VERIFIED in this pass: their contents.]**

### 5.3 TanStack Virtual (long track lists)

`@tanstack/react-virtual` 3.14.10. `tanstack/virtual/docs/api/virtualizer.md`, verbatim:

```tsx
export class Virtualizer<TScrollElement = unknown, TItemElement = unknown> {
  constructor(options: VirtualizerOptions<TScrollElement, TItemElement>)
}
```

Required options, verbatim:

- `count: number` — "The total number of items to virtualize."
- `getScrollElement: () => TScrollElement` — "A function that returns the scrollable element for the
  virtualizer. It may return null if the element is not available yet."
- `estimateSize: (index: number) => number` —
  > 🧠 **If you are dynamically measuring your elements, it's recommended to estimate the largest possible size
  > (width/height, within comfort) of your items.** This will help the virtualizer calculate more accurate
  > initial positions.

Optional: `enabled?: boolean` ("Set to `false` to disable scrollElement observers and reset the virtualizer's
state"), `debug?: boolean`, `initialRect`, and more.

React adapter (`docs/framework/react/react-virtual.md`):

```tsx
function useVirtualizer<TScrollElement, TItemElement = unknown>(…)
```

> Both `useVirtualizer` and `useWindowVirtualizer` accept a `useFlushSync` option that controls whether React's
> `flushSync` is used for synchronous updates.

**[NOT VERIFIED in this pass: the absolute-positioning CSS pattern and `measureElement`.]**

**Interaction with §1:** if the track list is DOM inside a `layoutsubtree` canvas, the virtualizer's
`getScrollElement` must return a scroller *inside* the drawable subtree, and every scroll must produce a
`paint`. Worth prototyping early — the explainer's "Future considerations: Supporting threaded effects with an
auto-updating canvas" section explicitly notes that threaded scrolling inside canvas is **not yet solved**:

> To support threaded effects such as scrolling and animations, we are considering a future "auto-updating
> canvas" mode.

That is a concrete risk for a scrolling iPod list specifically.

### 5.4 TanStack Form / Table / Query

**[NOT VERIFIED in this pass]** — clones exist at `tanstack/form`, `tanstack/table`, `tanstack/query` but I
prioritised A–E per the coordinator's triage. Do not write code against these from memory; re-run a targeted
pass. The one Query fact I did verify is indirect: Start's own server-functions doc uses `useQuery` with a
`queryKey`, so the Query integration is assumed by Start's docs.

---

## 6. Bun

### 6.1 Status and a caveat about `AGENTS.md`

Bun `1.4.1`. **`/Users/vinicius/code/agentic-context/bun/AGENTS.md` and `CLAUDE.md` are the guide for
contributors working *on Bun itself*, not conventions for apps built with Bun.** Evidence, verbatim:

> **Default: add your test to the existing test file for the code you're changing.** Do not create a new file. A
> fetch bug goes in `test/js/web/fetch/fetch.test.ts`, a `Bun.serve` bug goes in
> `test/js/bun/http/serve.test.ts`, and so on.

> Never contact the public internet (registry.npmjs.org, github.com, CDNs). Use `VerdaccioRegistry` from
> `"harness"` for package installs and a local `Bun.serve({ port: 0 })` for HTTP.

> `src/runtime/server/` - `Bun.serve` HTTP/WebSocket server

Do not mistake these for webPod project conventions. The API docs are under `bun/docs/`.
(The user's own `bun-http` skill states the actual project convention: *"Do NOT use Hono — use Bun.serve()
directly."*)

### 6.2 `Bun.serve()` — verbatim from `bun/docs/runtime/http/server.mdx`

```ts
const server = Bun.serve({
  // `routes` requires Bun v1.2.3+
  routes: {
    "/api/status": new Response("OK"),                       // Static routes
    "/users/:id": req => new Response(`Hello User ${req.params.id}!`),   // Dynamic
    "/api/posts": {                                          // Per-method handlers
      GET: () => new Response("List posts"),
      POST: async req => { const body = await req.json(); return Response.json({ created: true, ...body }) },
    },
    "/api/*": Response.json({ message: "Not found" }, { status: 404 }),   // Wildcard
    "/blog/hello": Response.redirect("/blog/hello/world"),
    "/favicon.ico": Bun.file("./favicon.ico"),               // Lazily loaded file
  },
  // (optional) fallback for unmatched routes:
  // Required if Bun's version < 1.2.3
  fetch(req) { return new Response("Not Found", { status: 404 }) },
});
console.log(`Server running at ${server.url}`);
```

**HTML imports** — potentially significant for how webPod is served:

> Import HTML files directly into your server code to build full-stack applications with both server-side and
> client-side code. […] **Development (`bun --hot`):** Bun bundles assets on demand at runtime and enables hot
> module replacement (HMR) […] **Production (`bun build`):** When you build with `bun build --target=bun`, the
> `import index from "./index.html"` statement resolves to a pre-built manifest object containing all bundled
> client assets. `Bun.serve` serves the assets from this manifest with no bundling at runtime.

```ts
import myReactSinglePageApp from "./index.html";
Bun.serve({ routes: { "/": myReactSinglePageApp } });
```

> HTML imports do more than serve HTML: they run Bun's bundler, JavaScript transpiler, and CSS parser, so you
> can build frontends with React, TypeScript, and Tailwind CSS.

**Architectural note:** this overlaps with TanStack Start's own dev server/bundler. Pick one owner for the
frontend build; running both is a source of confusion.

### 6.3 WebSocket upgrade — verbatim from `bun/docs/runtime/http/websockets.mdx`

```ts
Bun.serve({
  fetch(req, server) {
    // upgrade the request to a WebSocket
    if (server.upgrade(req)) {
      return; // do not return a Response
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {}, // handlers
});
```

```ts
Bun.serve({
  fetch(req, server) {}, // upgrade logic
  websocket: {
    message(ws, message) {}, // a message is received
    open(ws) {},             // a socket is opened
    close(ws, code, message) {}, // a socket is closed
    drain(ws) {},            // the socket is ready to receive more data
  },
});
```

> In Bun, you declare handlers **once per server**, instead of per socket.

Contextual data:

> Attach contextual `data` to a new WebSocket in the `.upgrade()` call. It is available on the `ws.data`
> property inside the WebSocket handlers. To strongly type `ws.data`, add a `data` property to the `websocket`
> handler object.

Headers on upgrade: `server.upgrade(req, { headers: { "Set-Cookie": … } })`.

### 6.4 Contradictions with training data (Bun)

- The `routes` object form is the *documented primary* API now (`requires Bun v1.2.3+`); `fetch` is presented as
  an **optional fallback**. A model will write a `fetch`-only server with hand-rolled `URL` routing.
- Handlers are per-server, not per-socket — `websocket: { open, message, close, drain }`.
- `server.upgrade(req)` returns a boolean and you must **return nothing** on success. Returning a `Response`
  after a successful upgrade is a bug.
- Route values can be a bare `Response`, a `Bun.file()`, or a per-method object — not only functions.

**[NOT VERIFIED in this pass: `bun test` API surface, `Bun.build()` options, pub/sub (`ws.subscribe` /
`server.publish`).]**

---

## 7. shadcn/ui

### 7.1 `components.json` — verbatim from `/Users/vinicius/code/agentic-context/ui/apps/v4/components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "baseColor": "neutral",
    "css": "app/globals.css",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/registry/new-york-v4/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**`"tailwind.config": ""` — empty string.** That is the Tailwind v4 signature: there is no
`tailwind.config.js` any more. A model will confidently emit `"config": "tailwind.config.js"`.

Other `components.json` files exist at `ui/templates/vite-monorepo/{apps/web,packages/ui}/components.json` and
`ui/templates/astro-monorepo/…` — the monorepo split (a `packages/ui` that owns components, an app that
consumes them) is the documented shape for a workspace.

### 7.2 Tailwind v4 `@theme` convention — verbatim from `ui/apps/v4/app/globals.css`

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "./legacy-themes.css";

@source "../styles/base-nova/**/*.tsx";

@custom-variant dark (&:is(.dark *));
@custom-variant fixed (&:is(.layout-fixed *));

@theme inline {
  --breakpoint-3xl: 1600px;
  --font-sans: var(--font-sans);
  --font-heading: var(--font-heading);
  --font-mono: var(--font-mono);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  /* … */
}
```

The convention is a **two-layer indirection**: raw design tokens are plain CSS custom properties
(`--background`, `--radius`), and `@theme inline { --color-background: var(--background) }` promotes them into
Tailwind's utility namespace so `bg-background` exists. Dark mode is a `@custom-variant`, not a config key.
`@source` declares extra content roots. This is exactly the mechanism to use for the iPod's own palette
(click-wheel grey, screen backlight blue-white, anodised aluminium) as first-class tokens.

### 7.3 Contradictions with training data (shadcn/Tailwind)

- **No `tailwind.config.js`.** `@import "tailwindcss"` + `@theme` in CSS replaces it entirely, and
  `components.json` records this as `"config": ""`.
- `@custom-variant dark (&:is(.dark *))` replaces `darkMode: "class"`.
- `@source` replaces the `content: []` glob array.
- `@import "shadcn/tailwind.css"` — a package-provided stylesheet a model will not know about.
- `"style": "new-york"` with the `ui` alias pointing at `@/registry/new-york-v4/ui` — the `-v4` suffix indicates
  a distinct Tailwind-v4 registry generation.

**[NOT VERIFIED in this pass: the `registry.json` item schema (`registry:ui` / `registry:block` / `files` /
`registryDependencies`), the CLI `init`/`add`/`build` docs, and `ui/skills/`.]**

---

## 8. WebMCP

### 8.1 Status — further along than html-in-canvas

`/Users/vinicius/code/agentic-context/webmcp/implementation-status.md`, verbatim:

> **Chrome** — An Origin Trial is live in Chrome 149.
> **Edge** — An Origin Trial is live in Edge 150. Refer to Chrome implementation status for platform support.
> **Brave** — Experimental support is added to Leo AI chat.
> **ChatGPT Desktop** — WebMCP is supported in ChatGPT Desktop.
> **Firefox** — Mozilla standards-positions issue #1412 / Bugzilla 2018306.
> **Safari** — WebKit standards-positions issue #670.

An **origin trial** means we can ship it to real users on a real origin without asking them to flip a flag —
materially stronger than html-in-canvas's Canary-flag-only status. Firefox and Safari are at
"standards-position requested", i.e. no implementation.

`README.md` notes: *"TypeScript type definitions for WebMCP are available in the `webmcp-types` npm package."*

### 8.2 The API — `document.modelContext`, verbatim

> WebMCP introduces an imperative API on the web platform under `document.modelContext`. This interface allows
> pages to expose client-side actions that agents can discover and invoke in a secure, browser-mediated
> environment.

```js
const controller = new AbortController();

await document.modelContext.registerTool({
  name: "add-todo",
  description: "Add a new item to the user's active todo list",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The text content of the todo item" }
    },
    required: ["text"]
  },
  async execute({ text }) {
    // Reuse existing client-side application logic and update UI.
    await addTodoItemToCollection(text);
    return { content: [{ type: "text", text: `Added todo item: "${text}" successfully.` }] };
  }
}, { signal: controller.signal });

// To unregister the tool later, abort the signal.
// controller.abort();
```

Lifecycle, verbatim: **Registration** → **Discovery** → **Invocation** → **Execution** → **Response**.

Permissions: *"Calls to `document.modelContext.registerTool()` will return a promise rejected with
`NotAllowedError` DOMException when the permission is disabled, whether by the `allow` attribute or the
`Permissions-Policy: tools=()` header."* There is also `exposedTo` for cross-origin iframe exposure and a
`toolchange` event on `document.modelContext`.

### 8.3 Contradictions with training data (WebMCP)

- **It is `document.modelContext`, not `navigator.modelContext`, and not `window.agent`.** Earlier drafts used
  other spellings and a model will very likely emit `navigator.modelContext`.
- The callback key is **`execute`**, not `handler` or `call`.
- `registerTool` is **async** (returns a promise) and takes a second argument `{ signal }`; **unregistration is
  via `AbortController.abort()`**, not an `unregisterTool` method.
- Input schemas are **plain JSON Schema**, not Zod. (Which is why Effect `Schema` should validate again on the
  server side — the browser passes through whatever the agent sent.)
- There is a **declarative** alternative (`declarative-api-explainer.md`, HTML `<form>`-based tool exposure)
  which is directly interesting for webPod: our device screen *is* real DOM. **[NOT VERIFIED in this pass.]**

### 8.4 Why this reinforces the §1 architecture

From `README.md`:

> In the absence of alternatives like MCP servers to accomplish their goals, these general-purpose agents often
> rely on observing the browser state through a combination of screenshots, and **DOM and accessibility tree
> snapshots**, and then interact with the page by simulating human user input. […] If an agent or assistive tool
> finds that the task it is trying to accomplish is not achievable through the WebMCP tools that the page
> provides, then it can fall back to general-purpose browser automation to try and accomplish its task.

The agent fallback path *is* the accessibility tree. A canvas-rasterised screen would have no fallback; a real
DOM screen degrades gracefully to a11y-tree automation even where WebMCP is unavailable. This is an independent
argument for the same conclusion reached in §1.9.

---

## 9. web-haptics

`/Users/vinicius/code/agentic-context/web-haptics/SKILL.md`, verbatim.

> Uses the Web Vibration API. **Silently no-ops on unsupported platforms (desktop). No error handling or feature
> detection needed.**

> `trigger()` accepts one of these strings (empty value defaults to a sensible "medium" impact):
>
> Notification (task outcomes):
> - `"success"` -- form saved, payment confirmed, upload complete
> - `"warning"` -- destructive action ahead, approaching limit, irreversible step
> - `"error"` -- validation failure, network error, permission denied
>
> Impact (physical collisions):
> - `"light"` -- small toggle, subtle tap, minor interaction
> - `"medium"` -- button press, card snap-to-position, drop into place
> - `"heavy"` -- major state change, heavy element landed, force press
>
> Selection (discrete stepping):
> - `"selection"` -- picker scroll, stepper increment, slider detent, segment switch

```tsx
import { useWebHaptics } from "web-haptics/react";
const haptic = useWebHaptics();
<button onClick={() => haptic.trigger()}>Tap me</button>;
```

Vanilla (needed for click-wheel handling outside React / inside `useFrame`):

```js
import { WebHaptics } from "web-haptics";
const haptics = new WebHaptics();
```

**For webPod:** `"selection"` is the click wheel — its own description literally says *"picker scroll, stepper
increment, slider detent"*. `"medium"` for the centre button, `"heavy"` for the expose flip landing,
`"success"`/`"error"` for provider auth outcomes. Note it no-ops on desktop, so no feature detection is needed
and no capability atom is required.

---

## 10. Cross-cutting summary of training-data contradictions

Ordered by how much damage the wrong assumption does.

1. **Effect is `4.0.0-rc.112`.** `Context.Service` (not `Context.Tag`/`Effect.Service`); `Schema` from `"effect"`
   (not `@effect/schema`); `Schema.TaggedError` (not `Data.TaggedError`); `Effect.catch` (not `catchAll`);
   `Schema.decodeUnknownEffect` (not `decodeUnknown`); `Schema.Literals([...])` (not `Schema.Literal(a,b)`);
   **HTTP lives at `effect/unstable/http` and `effect/unstable/httpapi`, not `@effect/platform`**; adapter-less
   `Effect.gen(function*(){})`; `Effect.fn("name")` for reusable functions.
2. **`document.modelContext.registerTool({ …, execute })`** — not `navigator.modelContext`, not `handler`,
   unregistration by `AbortController`.
3. **Tailwind v4 has no config file**; `components.json` records `"tailwind": { "config": "" }`; theming is
   `@theme inline` + `@custom-variant dark` + `@source`.
4. **`createServerFn().validator(…).handler(…)`** — `.validator`, not `.inputValidator`, in this Start version;
   and requests missing `Sec-Fetch-Site`/`Origin`/`Referer` are **rejected by default**.
5. **Jotai's `store.sub(atom, cb)` callback takes no arguments**; `atomWithStorage`'s `getOnInit` defaults to
   `false` (so persisted atoms do *not* hydrate unless you opt in); `useAtomCallback` is in `jotai/utils`; the
   two most relevant guides are `published: false` and thus likely absent from training data.
6. **Bun's `routes` object is the primary documented server API**, `fetch` is the fallback; `server.upgrade`
   requires returning nothing on success; ws handlers are per-server.
7. **R3F defaults to ACESFilmic tone mapping and `SRGBColorSpace`**; `legacy` *enables* `ColorManagement`;
   `frameloop` has three values; `useFrame` takes `(state, delta, xrFrame)`; the docs forbid `setState` in the
   frame loop, which is the correct reading of the project's `useState` ban rather than a conflict with it.
8. **three.js r185 `dev` ships `HTMLTexture` and `InteractionManager`** — new enough that no model knows them,
   and they are the entire reason question A has a positive answer.
9. **html-in-canvas's WebGL entry point is mid-rename** (`texElementImage2D` → `texElementSubImage2D`); the
   repo's own demo carries a try/catch across both.

## 11. Gaps to close before implementation

- TanStack **Form**, **Table**, **Query** — not read in this pass.
- Jotai `splitAtom` / `selectAtom` / `atomFamily.remove` / `useHydrateAtoms` exact signatures.
- TanStack Virtual's absolute-positioning CSS pattern and `measureElement`.
- `bun test` / `Bun.build()` surfaces.
- shadcn registry item schema and `ui/skills/`.
- WebMCP `declarative-api-explainer.md` — plausibly a better fit than the imperative API given our screen is
  real DOM.
- `three-html-render` is **not vendored**; vendor and read it before depending on the polyfill tier.
- Effect `Stream` and `Effect.acquireRelease` details (files identified under `ai-docs/src/03_stream/` and
  `ai-docs/src/01_effect/05_resources/`, not read).
