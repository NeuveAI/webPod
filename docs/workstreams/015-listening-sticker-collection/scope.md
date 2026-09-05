# Listening sticker collection — visual exploration

Primary source: the user's request in this task. Deliver in the currently open Pencil document `/Users/vinicius/code/webPod/docs/design/stickers.pen` (saved by user during exploration; replaces initial untitled document path).

## Correctness and definition of done
- Brand strategist and designer both run on Astra (gpt-6-astra). Supervisor coordinates them. The current user request supersedes earlier model names in dispatch artifacts.
- Moodboard and era exploration precede finished pack development.
- Current expanded request: twelve common-genre packs with five original stickers each (60 total): pop, rock, metal, hip-hop, R&B, electronic, indie, jazz, classical, country, reggae, Latin. The user approved the moodboard direction and wants the full collection for approval before implementation.
- Shared collection identity, die-cut edge, vinyl substrate, ink texture and finish family, with documented permitted variation. No existing band logos or copied artwork.
- Show material swatches and stickers applied at plausible scale on an iPod 5G, keeping display and clickwheel usable.
- Listening unlock ideas are clearly illustrative, not implemented product rules.
- Verify complete boards with Pencil screenshots and structural clipping checks. A separate reviewer checks visual coherence, era cues, material consistency and legibility. User makes final aesthetic choice after delivery.

## Dispatch and dependencies
1. Brand agent owns brand moodboard and brand.md. Research period references, establish collection name and common production language. Write only its own canvas frame(s).
2. Designer agent independently owns material exploration moodboard and materials.md. Research physical sticker production feel. Write only its own frames. No finished packs until brand handoff.
3. Designer receives brand.md and creates two finished packs and device studies. Brand agent can review without editing designer frames.
4. Independent visual review, fixes by designer, supervisor sanity check and delivery.

Expanded ownership after user approval of moodboards: designer owns pop, rock, metal, hip-hop, R&B, electronic and device studies; brand agent owns indie, jazz, classical, country, reggae, Latin. Each owns only its own new frames. Shared brand recipe remains binding. Final independent review covers all 60 stickers; user approves the collection before application implementation, which is out of scope this turn. Genre roster is a proposed common-genre catalogue, not an exhaustive music taxonomy.

Generation fallback: Pencil SVG generation repeatedly returned empty completed targets, including a single-target retry. Built-in imagegen may produce one sheet of five separated original stickers per genre, inserted into Pencil as raster reference artwork. Existing successful vectors are retained. Approval scope is artwork and collection direction, not production-ready transparent/vector asset files. Any extraction or redraw needed for integration must be identified honestly and done after user approves designs.

## Artifacts and ownership
This directory owns scope.md, brand.md, materials.md, decisions.md, designer-handover.md, review.md, evidence/ and temporary dispatch/run artifacts. Exact document node IDs must be recorded by agents in their handovers. Prompts name those paths. Dependency graph: brand + materials -> packs -> independent review -> fixes -> delivery.

## Verification and review posture
Proxy-verifiable: era references and shared material qualities, assessed against cited research and screenshots. Objective: pack/sticker count, frame names, clipping, completed generation state. Human judgment: emotional appeal and final direction, deferred to user's requested visual review. Focused design review; code/type/lint tests not applicable because no application code changes. Canonical schema is Pencil get_app_state. No library work. No deployment or commit requested; later optional commit should include only this workstream's design documentation.

## Guardrails and decisions
Never read or write .pen files outside Pencil MCP. Never touch cert/, credentials, application code, unrelated workstreams, git history or existing user artwork. Bun/bunx only. No Neuve or tickets. Use new named top-level frames and FindEmptySpace; current existing frame is user-owned. No hand-built freeform artwork: use Pencil Generate svg, or its AI image function for material imagery. Read full Pencil schema first. Never regenerate while placeholder remains true. Agents may choose palettes, motif names and concept unlock examples; log these as proposals. No blocking user decisions for this exploration. Permissions already cover design changes in the open document.
