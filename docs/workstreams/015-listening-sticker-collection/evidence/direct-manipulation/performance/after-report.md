# Reviewed-candidate performance measurements

Source: `58fa8839f150a8fe61175ca416d58ee442fd421b0801b9bd05a4bbca7387c261`, 380 files. Independently snapshotted, installed and built; `after-build.txt` and `after-host.json` retain provenance. Product source was not modified. Bun 1.4.0, Chrome 152, Apple M4 Pro ANGLE Metal, T1, DPR 1, CPU 1x, no network throttle. Desktop 1280×900; narrow 375×812 uses desktop mouse emulation, not physical mobile hardware. Same Chrome process as baseline: driver/shader cache is not proven cold.

All accepted data came from the owned real production route through Chrome DevTools MCP evaluate_script, native drag/click/key tools and bounded page observers. Page 4 used synthetic fixture origin http://127.0.0.1:61428; clean fresh context page 8 used http://127.0.0.1:63048. Both were checked against location.href and the deterministic MusicKit authorize implementation. The fixture injects the existing test SDK before application scripts in its HTML response because this tool's navigate initScript did not retain it. This modifies only the isolated test host, not the shipped route or UI.

## Results

- Clean first ready packet and liner pulls had no long animation frames or long tasks. Their first-second maximum RAF intervals were 17.6 and 17.5 ms. First changing pointer move to next RAF after the changed pose was 15.9 and 16.4 ms. This is a scheduling proxy, not compositor presentation time.
- A separate ready gesture instrumented actual WebGL draw submission after changed progress: packet 16.8 ms and liner 16.9 ms from the changing pointer move. Geometry was submitted on the next frame. This confirms rendering beyond request/DOM mutation timing; it cannot measure physical screen scanout.
- Three warm physical packet/liner cycles had no ≥50 ms LoAF/long tasks. The complete observer interval maximum RAF gap was 33.74 ms. Per-input windows are retained in `after-derived-metrics.json`; idle periods are not used to dilute percentile claims.
- Three closes reached liner zero after 200.2–216.8 ms and began lowering the packet 16.3–16.5 ms later. Baseline had approximately 417 ms of invisible handoff delay. Total close was 802.4–819.2 ms versus baseline 1200.7 ms.
- Clean first rear lift/return had 69 nonzero peel observations, no LoAF, maximum RAF interval 17.5 ms. Repeated rear interaction in the first context had maximum 17.7 ms. Neither performed drawImage/getImageData during pickup; final source prepares the alpha cache before input. This does not establish the cost of an artificially uncached hit.
- Narrow packet/liner/close had no LoAF and maximum RAF interval 17.7 ms. This is viewport performance only; the owner's separate 188-assertion native suite supplies real CDP touch behavior coverage and reduced-motion correctness.
- An open, settled packet remained at exactly 495 instrumented draw submissions from page time 125879.7 to 148055.6 ms (22.176 seconds). No permanent renderer loop was introduced.

## Preparation and limits

`after-clean-first-ready.json` starts before product initialization. Initial application startup produced a 459.3 ms LoAF (412 ms task) and a 59.6 ms frame before sign-in; first rear admission produced a 59 ms frame, before the packet was pulled. These are retained, not reported as smooth interaction. Five collection PNG requests started at page time 13997.3–13997.4 ms, shortly after synthetic sign-in at 13955.8. Five blocking upload calls occurred at 14012.3–14046.3 ms, each 2.1–3.3 ms. Two other PNG uploads occurred around rear admission at 17074.3/17077.1 ms (2.7/11.5 ms). First valid packet pull began at 28272.1 and liner at 42105.2; neither had a recorded ≥0.2 ms instrumented GL call. Thus preparation moved ahead of ready manipulation in this run; a completely cold GPU process was not tested and shader-only attribution is unsupported.

MCP drag supplies a short approximately 133 ms native pointer gesture with a large movement, not arbitrary many-step slow dragging. Repeated native movement and actual rendering are measured, but this is not a continuous fidelity sweep or a physical Safari test. Observer MutationObserver/RAF overhead is included. Reduced-motion behavior was not reprofiled here; native integration evidence remains the correctness reference.

## Rejected attempts and tool limitation

The first navigate initScript attempt exposed the real SDK instead of the deterministic seam; it was rejected and its popup closed without authentication. No data from that attempt is accepted. A later synthetic page was correctly targeted by evaluate_script and native input, but performance_stop_trace returned only `http://localhost:3000/` insights even after explicit select_page and repeated page-ID targeting. `after-rejected-target-trace.txt` preserves that mismatch. Its INP is **not attributed to this fixture**. Raw export remains subject to the previously recorded MCP workspace-root denial; no workaround changed its roots.

`after-initial-observers.json` retains an additional initial synthetic attempt recorded while the misbound tracing machinery was active. It contains a 124.3 ms unattributed LoAF during a malformed cross-screen drag and another trace-start task. Its empty script attribution cannot distinguish tool/browser overhead from app work. It is not discarded silently or used to claim improvement; the fresh-context, correctly directed gesture rerun without that tracing machinery is the clean comparison above.

Persisted baseline warm/phone trace summaries were checked and do name the original synthetic origin http://127.0.0.1:55696. Therefore those baseline attributions remain supported; the broken after trace does not supply a comparable INP delta. The supported comparison is owned-page frame and phase measurements, with explicit input/cache limitations.

## Evidence mapping

- `after-clean-first-ready.json`: startup, admission, first ready packet/liner, PNG and GL timings.
- `after-warm-observers.json`: three closes and three physical packet/liner cycles.
- `after-clean-rear.json`, `after-rear-observers.json`: first and repeated rear lift/return.
- `after-narrow-observers.json`: narrow physical packet/liner/close.
- `after-render-submission.json`: changed progress correlated with actual WebGL draw submission.
- `after-derived-metrics.json`: explicit input-window bounds and derived measurements.
- `after-observer-init.js`: startup observer and GL diagnostic used by the isolated fixture.

Owned app pages were closed where supported; the final owned page was navigated to blank because MCP refused to close the last page. All fixture servers are stopped and temporary SQLite is disposed. Immutable baseline, superseded diagnostic and final snapshots are removed after the audit artifacts are retained.
