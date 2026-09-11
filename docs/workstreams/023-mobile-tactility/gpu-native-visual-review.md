# Independent front-view visual review

**REQUEST_CHANGES for full native visual activation:** a visible LCD/glass parity gap remains. This does not revoke independent acceptance of geometry/resource/source slices. Reviewed four existing-route screenshots supplied by lead, current Chrome440×956,DPR3,6×CPU, source3ae4ccf (f89 application), before the disjoint carry/hover corrections. No browser or application changes by reviewer.

The Silver/light pair has matching visible Music rows/counts, including2726 Songs. Native has a substantially flatter, darker gray LCD field and subdued header/selection highlight. GL has a brighter field and visible broad lower-screen gradient/reflection. This difference covers non-text regions and cannot be explained by library count. Black also differs in LCD brightness/glass treatment; its1498+/2726 loading difference excludes text/count pixel comparison. Under the unchanged-appearance requirement, the matched Silver pair blocks full parity approval until explained/corrected and recaptured.

Front chassis silhouette, rounded corners, screen opening/bezel dimensions, wheel/Select diameter and positions, metal grain, edge highlight and device framing appear closely aligned in both finishes. No omitted front geometry or obvious reduced mesh detail is visible at screenshot scale. This is visual inspection, not subpixel equality or proof of edge/rear/carry/shading-in-motion parity.

Both native references show Reset view/Settings at the top right; black GL shows them at bottom center. Silver GL shows two pale blank rectangles in that bottom area. This is a separate unmatched browser/UI state requiring a settled paint/style check; blank controls make that GL screenshot unsuitable as complete UI parity evidence. It does not invalidate the visible matching geometry comparison, but full composited parity is unproven.

## Read-only source triage

- `device-assembly-materials.ts:44–46` sends identical glass params and the separate screen studio map to the two material factories. `materials.ts:224` defines black,20%-opacity transparent glass with zero transmission. Native's flat darkening is consistent with that overlay without matching reflected light, but the screenshot alone does not establish that mechanism.
- First bounded inspection target is glass reflection/PMREM parity: `physical-material-nodes.ts` ports card lighting through `DevicePhysicalLighting.directRectArea`; GL `physical-materials.ts:122` patches rectangle alignment/1.6scale/power. `render-backend-services.ts:92` uses the node PMREM generator over the same two rooms; `StudioEnvironment.tsx:83` uses GL PMREM. `product-studio.ts:19` adds the close lower-left screen accent. Both source paths request that accent, so do not claim it was intentionally omitted. Verify actual node light/card identities and resulting separate screen environment before changing parameters.
- LCD conversion is another bounded isolation seam: `lcd-material-nodes.ts:10` uses explicit one-time sRGB decoding for NoColorSpace unorm native pixels; `html-in-canvas.ts:403` explicitly decodes HTMLTexture RGBA8. `native-element-image.ts:81,116` declares nonpremultiplied RGBA/unorm and sRGB copy destination. Source formulas express the same intent; native raster/alpha/output behavior must be verified, not compensated with a brightness factor or reduced reflection. Comparing raw panel paint versus the composited glass isolates this from PMREM; existing route only, no new debug UI.
- Controls source is backend-neutral: `device-page.tsx:339` renders the same nav outside either renderer, and `:501` positions it at bottom center. No inspected backend-specific rule relocates it to top right. The screenshots therefore do not yet establish a source layout regression; current computed styles and fully settled composited paint need confirmation. The captured Silver blank buttons are not evidence of an intentional native/GL styling decision.

Suggested ownership after current freezes: host/material author handles the existing LCD/glass/raster/PMREM seams; lead verifies matched screen content, room/finish, settled paint and computed controls placement. Preserve authored optics and pixel quality. No broad redesign or global color compensation is warranted from these four images.

Retained unmodified screenshots are under `evidence/gpu-worker/visual-front/`:

| File | SHA256 |
|---|---|
| webpod-native-black-front-reference.png | e6342e97112d98521d65b99a3cd8362e104b353c1ca9a1e271796b924f4f5ebb |
| webpod-gl-black-front-reference.png | b07ed89377f91db745c430ce9af4fd01a9f5490189fb14e428a49f0352e14f50 |
| webpod-native-silver-light-front.png | 473a278a1c706400e55ddc2480b83de1858bb81bd8368c5150bd9edfc74e9f2d |
| webpod-gl-silver-light-front.png | dce235074b62a1a0f68fa6bd802b1caf65c371c4f82eaa617402646b27658e5f |

Front-only screenshots do not close full native rear/edge, packet/liner, peel/drop/edit/return, motion, playback, hide/resume or failure parity. Those remain the existing acceptance checklist, not new scope. No performance conclusion follows from still images.

## Controls placement clarification

Subsequent lead-collected computed-rule evidence is retained as `visual-front/native-controls-computed-rules.json`. `apps/web/src/styles/app.css` explicitly overrides the default with `.webpod-device-preview:has([data-sticker-stage]) .webpod-device-preview__controls`, setting top16px, bottom auto and flex-end. This explains the native top-right placement and supersedes the incomplete earlier source search. The rule is keyed to sticker-stage DOM presence, not backend. `sticker-collection.tsx:533` returns null outside T1, so differing collection/capability DOM can explain the GL bottom layout; the GL stage presence/computed rules were not captured here. This is not a confirmed native layout violation or proof of missing CSS. It indicates unmatched UI state in these reference captures. Silver GL's blank buttons still need settled-paint confirmation. The LCD/glass visual activation blocker remains independent.
