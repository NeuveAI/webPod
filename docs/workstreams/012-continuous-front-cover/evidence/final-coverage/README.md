# Frozen live coverage verification

Production route with deterministic music fixture,1200×900CSSpixels,DPR3. No visibility/material/lighting overrides. Existing preview controls set black/white finish and front(0,0,0) or quarter(10,−48,−2degrees) orientation.

380perspective camera rays per configuration sample the opaque surround:200across all four sides at10outsets(.25through10units including prior6.6/6.75gap) and180across all four corners at9radii and5angles. Across4configurations, all1520rays find front body, display mask or display well as first opaque object; zero uncovered samples.

All four luminous corners are tested at the center of the first native320×240pixel:0.425modelunits inward from each272×204active edge. In all4configurations all16rays find the actual LCD mesh as first opaque object, proving those pixels are not covered by the surround. Transparent cover is intentionally skipped for the opaque-occlusion question.

Source SHA256 before/after capture match for five relevant geometry files. See results.json for individual samples, source identity and exact first intersections. This is a bounded finite sampling check, supplemented by reviewer native images and geometry tests; it does not claim exhaustive every-angle proof. No new screenshots were needed.
