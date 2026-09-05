# Classic consolidation

## Correctness and source of truth
Choose the aluminum iPod Classic family to match the existing Cover Flow interface. Owner IMG_2289/2290 establish the thin metal front, diffuse reflection, black plastic wheel, and faceplate-matched metal Select. IMG_2286–2288 show the rejected 5G plastic construction. IMG_2284/2285 identify the owner's 120GB Classic rear. Apple https://support.apple.com/en-us/112321 supplies 61.8 × 103.5 × 10.5mm overall dimensions. Front thickness is a photographic modelling estimate, not a measured Apple specification.

The user explicitly authorizes either generation and forbids screen redesign. Preserve screen XY, opening, cover material, stack offsets and UI. A shared rigid-body depth adjustment follows the thinner enclosure. Keep existing wheel placement and dimensions, which remain a reasonable match to the supplied perspective reference; do not claim the legacy raster is a Classic measurement.

## Single implementation slice / ready
- Change: one shared aluminum recipe for each faceplate/Select pair, fine directional roughness, matte plastic wheel, thin front profile, silver naming and Classic repo identity.
- Canonical APIs: installed three 0.185.1 MeshPhysicalMaterial and MeshStandardMaterial source; official MeshPhysicalMaterial docs. Requested ~/code/agentic-context does not exist; ~/code/agent-context has no Three guide. Use installed canonical source, not recalled library behavior.
- Existing code: packages/device/src/{Device,materials,form,physical-spec,layout,textures}; apps/web/src/routes/[_]spike.device.tsx. Legacy 5G material assertions are superseded, screen assertions are authoritative regression guards.
- Verification: existing device tests, typecheck, lint; Chrome front/oblique/edge in both finishes on existing /_spike/device; existing interaction E2E. No new proof route, public API, or unit test suite.
- Visual criteria: metal body brighter than black wheel; Select matches the metal; broad reflections rather than a lacquer highlight; narrower front side band; no new screen bezel.
- Non-goals: playback, lighting redesign, hand cursor, panel redesign, encrypted design.pen, credentials. Preserve all pre-existing edits.
- Human judgment: final appearance is reviewable via screenshots. Generation choice is authorized; no blocking questions.
- Artifacts: evidence/ screenshots and checks.txt, decisions.md, handover.md.
- Commit plan: one coherent commit, `Consolidate iPod Classic enclosure and material identity`; leave unstaged for owner because workspace includes substantial prior edits.
- Review: focused self-review of changed material wiring, geometry invariants, and visual evidence. No parallel implementation.

## Done checklist
- [x] Aluminum faceplate and matching Select in black and silver.
- [x] Plastic wheel and unchanged clear screen cover.
- [x] Thin profile and coherent Classic identity.
- [x] Existing checks and browser interaction pass.
- [x] Front/oblique/side evidence inspected and handover recorded.
