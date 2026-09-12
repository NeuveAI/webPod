# Native per-material output proposal

Read-only proposal for CPU009's confirmed LCD output mismatch. No application changes, builds or browser calls were made. The temporary glass mask is restored. The canonical diagnosis is gpu-lcd-renderer-semantics.md; all Three references below are installed 0.185.1, not a newer checkout.

## Required output contract

Restore the original GL sequence for each final-scene fragment: authored straight linear RGB and alpha → AgX/exposure only if material.toneMapped → working-to-sRGB conversion → authored fog → optional material premultiplication → hardware blending. LCD, labels and explicitly unmapped cavity materials skip AgX, but still encode exactly once. Preserve all physical lighting, glass cards, sticker wear, alpha, depth, culling and geometry calculations.

The native renderer must not subsequently tone-map or encode the composited scene again. The installed Renderer._getFrameBufferTarget bypasses that pass only when toneMapping is NoToneMapping AND outputColorSpace equals the working LinearSRGBColorSpace. This nominal output setting is a transport switch, not a claim that the emitted canvas bytes are linear. WebGPUBackend.configure uses the preferred plain unorm canvas format, with premultiplied/opaque alphaMode and no explicit sRGB view; WebGPUUtils defaults to navigator's preferred format, explicit UnsignedByteType to bgra8unorm. The browser canvas remains default sRGB presentation. Implementation must verify the actual configured plain-unorm/sRGB presentation contract and refuse unsupported output formats rather than silently applying this policy to HDR or sRGB attachment views. Keep working color management itself unchanged.

Do not use global NoToneMapping alone. Do not inverse-map AgX, compensate LCD brightness, change exposure, or convert only LCD while leaving transparent blending globally transformed.

## Minimal central policy and exact insertion point

Propose a device-side `native-material-output.ts` with an idempotent typed installer for admitted NodeMaterial instances and an explicit final-scene output policy. It captures the original setupOutput receiver/function, inserts per-material straight-RGB toneMapping and workingToColorSpace before that method, and then invokes the original fog/premult path. The policy reads the existing authored toneMapped and exposure; immutable policy identity participates in material cache invalidation. No per-frame traversal, global prototype patch, extra material or render pass is needed.

Do **not** blindly insert TSL renderOutput into setupOutput: RenderOutputNode112–140 clamps alpha, unpremultiplies, applies mapping/encoding and premultiplies again. Its input contract is composited premultiplied color, whereas NodeMaterial's basicOutput is straight outgoingLight+diffuse alpha. Feeding straight translucent glass into that convenience node changes its RGB. Use the constituent toneMapping and workingToColorSpace nodes with alpha carried unchanged; original setupOutput applies premultiplication exactly where GL does. Test alpha0 as well as fractional alpha, not only opaque LCD.

Installed NodeMaterial523–598 calls setupOutput for the default lighting result and for fragmentNode, but replaces the default result with outputNode afterward. Consequently:

- Current stock/basic/standard/physical node materials and custom lighting/position/wear paths can use the wrapper.
- A scalar vec4 fragmentNode reaches the wrapper and must be included in the reference proof.
- Arbitrary outputNode or MRT/output-struct replacement cannot be certified by that wrapper. No shipped device/composite source currently assigns fragmentNode/outputNode (source inventory performed). The installer should reject unsupported outputNode/MRT/structured fragment contracts before native admission, preserving complete GL fallback, until an explicit exact composition adapter is authored. It must not silently accept a bypass. A future custom output adapter needs to preserve whether its source already contains fog/premult, not apply the sequence twice.

Linear intermediate rendering must remain linear/unmapped. Gate the policy using the builder's actual output-target context; PMREM, shadow, non-output render targets and any future transmission/internal targets must not receive final sRGB encoding. The renderer's compilation/cache key must distinguish output versus linear target contexts. Verify actual PMREM and shadow compilation; do not assume checking renderer settings at material construction suffices. Current glass has transmission0, but unchanged physical material support must not silently break a future nonzero setting.

## Concrete bounded ownership

| File / owner | Necessary change |
|---|---|
| New packages/device/src/native-material-output.ts | Typed final-output policy, straight-alpha transformation and idempotence/unsupported-node guard; no DOM/GPU resources |
| packages/device/src/device-assembly-materials.ts | Apply policy only to native material records after exact construction, covering body, glass, steel, mask, well, hardware, wheel, label, select and supplied LCD; GL branch untouched |
| packages/device/src/sticker-material-nodes.ts | Install on front/back factory results, after existing exact wear/seat setup; reaches equipped, carry and packet prints |
| packages/device/src/sticker-pack-render-frame.ts | Install in the existing ownedMaterial funnel for sleeve exterior/interior/cuts and liner/stock front/back/edge; GPU paper position and normal nodes untouched |
| packages/composite/src/lcd-material-nodes.ts | Optional explicit policy application only if factory standalone consumers require it; avoid duplicate ownership, idempotence required |
| packages/device/src/device-render-worker.ts | Configure direct encoded-fragment canvas transport before native scene compilation; assert full final-scene material coverage at candidate admission, not each render |
| Existing native compile helpers/readiness | Only if needed to validate unsupported node/output contracts for detached candidates before ACK; no shader formula or resource lifetime rewrite |

Existing physical-material-nodes and sticker-wear-nodes subclasses retain their lighting/variant implementations; no edits should be needed merely to install a final output wrapper. New native material conversion must be explicit: a raw MeshBasicMaterial automatically converted by Three must not evade coverage. Current final scene factories construct node materials directly. `product-studio.ts` uses stock MeshBasicMaterial only in separate PMREM capture scenes; those remain untouched and linear. Native warmup builds the same packet/print materials through these factories, so it must compile the same final output policy instead of a different diagnostic approximation.

The revealed pool and motes are DOM spans in apps/web/src/device-reveal-portal.tsx, not native scene particles. Their CSS/browser composition and timing remain unchanged. Inventory/assert any future native Sprite/Points material at admission rather than claiming an unobserved particle path is covered.

## Clear, background and composition

The real worker scene is transparent and has no scene.background; renderer alpha ownership must stay unchanged. Common Background68–85/187 writes clear RGB directly, outside material setupOutput. Transparent black clear stays exactly zero under the proposed policy and should be explicitly checked against GL. The outer server-rendered DOM/CSS background, glow and motes remain browser sRGB content and receive no native output conversion. Do not assign scene.background to mimic those layers.

A nonzero opaque Color background, if introduced, requires the GL-equivalent output conversion at the clear boundary, not a material wrapper. PMREM's #25282E background is a separate linear capture and must not be encoded. Textured final backgrounds would need explicit policy coverage too. These distinctions belong in invariant documentation and validation, not an undocumented global color-management override.

## Minimum verification before acceptance

1. Installed-source reviewer verifies typed NodeMaterial hook receiver/order, target-context/cache separation, plain-unorm canvas/alpha contract and coverage of default, fragmentNode and guarded outputNode/MRT paths.
2. Pinned GL-reference arithmetic/shader proof covers AgX+exposure, unmapped LCD/label, sRGB branches, fractional/zero alpha, premultiplied and straight blending, fog order and overlapping glass/sticker samples. Prove no second encode and no transformation in linear intermediate/PMREM paths.
3. Actual supported WebGPU compilation for every chassis, print appearance, wear, paper front/back/edge, sleeve and LCD variant, including candidate warmup. Existing formulas/geometry/resource proofs remain valid; run affected types/scoped lint and existing material suites after implementation is frozen.
4. Lead captures matched existing-route Silver/light and Black/dark with glass restored, then rear packet/liner/earned+locked/placed+carried prints and entrance DOM effects. Compare to healthy GL references. Screen exemption alone is insufficient if the rest of the scene changes.
5. Verify native unsupported-format/material policy produces complete GL fallback without partial scene; device teardown and candidate cancellation preserve existing owners. No performance acceptance is inferred from these correctness checks.

Open before dispatch: reviewer confirmation of the exact builder output-target discrimination used during compilation and cache invalidation, and how to enforce full candidate material coverage without treating PMREM capture materials as final-scene materials. These are bounded implementation details requiring source proof, not grounds for brightness compensation.

Reviewer refinement: installation must preserve the original method receiver and existing customProgramCacheKey, add policy identity and appropriate needsUpdate invalidation, and never patch a global prototype. Apply the policy before compiling each detached warmup/equipped/pack/carry root, not only after adding it to the visible scene. Shared/reused materials are wrapped exactly once. PMREM-room materials are excluded by their explicit preparation ownership, in addition to any per-pass target guard; the renderer target at the first compile alone is not a sufficient ownership classifier.
