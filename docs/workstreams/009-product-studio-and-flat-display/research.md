# Product lighting research and implementation brief

Sources checked 2026-09-05. No primary source located establishing a fixed proprietary Apple three-light recipe. Apple-like describes intended photographic character; at least three emitters is the owner's explicit requirement.

## Primary sources
- https://broncolor.swiss/news/the-ultimate-product-photography-lighting-setup — manufacturer tutorial. Search index describes a very large soft source lowering contrast and working across shiny, dark and white objects; full page fetch timed out twice. Treat only indexed guidance as confirmed, not a complete inspected lighting diagram.
- https://visualeducation.com/karl-taylor-light-cone/ — professional product photographer Karl Taylor's own demonstration. Reflective surfaces reproduce their surroundings; controlled diffusion yields smooth gradient reflections. Use this principle, not the literal cone apparatus or purchasing claims. Supports deliberate emitter/reflection shape instead of only reducing metallicity or overall exposure.
- https://www.apple.com/newsroom/2022/05/the-music-lives-on/ — Apple's own iPod product imagery is a visual reference for clean material identity and display clarity, not evidence of lamp number/placement and not 5G dimensional authority.
- Installed Three 0.185.1 RectAreaLight, LTC physical shader and roughnessmap_fragment — implementation authority. Correct green-channel roughness map from previous turn is retained. Renderer/LCD transform must not be globally dimmed to solve steel highlights.

## Synthesized scene prescription (our interpretation)
Three deliberate world-fixed area emitters: broad elevated key from front/right shapes front and upper roll; weaker broad front/lower-left fill reveals dark shell/wheel without flattening key-shadow hierarchy; tall narrower rear/side strip rim provides restrained edge separation. Neutral white palette; subtle key warmth only if black/white product identity remains credible. Controlled dark environment/negative fill between sources retains glossy contour contrast. Align reflection environment with intended studio look, avoid unrelated accidental room reflections or clipped softboxes. Judge front, rear and oblique images together, with same-state light isolation. This is a material/light balance, not an arbitrary count of lamps.

## Screen concern
Owner screenshot visibly bows top display silhouette at both ends. Flat screen mesh and coverGlass transmission0 suggest masking/depth/occlusion must be checked before calling it lens distortion. Read-only investigator reproduces cause; Astra owns actual fix. No lighting pass can excuse a warped display border.

## Additional confirmed primary excerpt
https://visualeducation.com/class/rim-lighting-product-photography/ public class synopsis explicitly covers a Sony camera shoot, rim lighting, diffusion/reflection, and masks to control flare. Full class is gated and was not watched. The public example uses two lights to achieve separation; therefore it supports rim-light technique, not a universal three-light requirement. Our three lights fulfill owner direction and provide independently controllable roles.
