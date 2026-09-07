# CL_RS contact response source audit — 2026-09-07

**The proposed weak-static-contact explanation is not supported.** This fixture's shell is a mass-zero static body. CL_RS selects kSKHR_CL for static/kinematic contact, whose pinned default is1, rather than the dynamic-rigid kSRHR_CL default.1. Raising kSRHR_CL would not strengthen this shell contact. No configuration, force or simulation was changed for this source-only audit.

The actual face-cluster probe sets native iterations10velocity/10position/4cluster, but does not overwrite the cluster hardness or split defaults. Its shell construction uses btRigidBodyConstructionInfo(0,...). Evidence: evidence/sticker-edge-wrap/early/ammo/face-cluster/c03-facecluster-probe.txt:26–28. Its application acceleration is the existing clamped400*(target−position)−40*velocity, multiplied by mass and ramp, with400modelunit/s² maximum. The actual extended pressing schedule remains349/120seconds plus.5seconds tack; this audit does not replace it with an earlier shorter proposal.

## Defaults, binding and branch

| Setting | Pinned default | Current probe | Applies here |
| --- | --- | --- | --- |
| kSRHR_CL | .1 | inherited | Dynamic rigid counterpart only; not static shell |
| kSKHR_CL | 1 | inherited | Static/kinematic shell |
| kSSHR_CL | .5 | inherited | Self/soft contact |
| kSR_SPLT_CL | .5 | inherited | Dynamic rigid counterpart |
| kSK_SPLT_CL | .5 | inherited | Static/kinematic shell |
| kSS_SPLT_CL | .5 | inherited | Self/soft contact |
| citerations | 4 | explicitly4 | Cluster joint loop |

All six cluster coefficient fields and citerations are exposed in the pinned [Ammo IDL](https://github.com/kripken/ammo.js/blob/79190a1f03845794b1bba1777f30037349967658/ammo.idl), generating get_/set_ methods. This audit verifies binding declarations and source defaults, not a new live getter execution. Record the actual getter values and isStaticOrKinematicObject result in the next already approved fixture preflight to verify the compiled artifact agrees.

In [btSoftBodyInternals.h:CollideCL_RS](https://github.com/kripken/ammo.js/blob/79190a1f03845794b1bba1777f30037349967658/bullet/src/BulletSoftBody/btSoftBodyInternals.h), SolveContact starts ERP and split at1. The static/kinematic branch multiplies those by kSKHR_CL and kSK_SPLT_CL; only its else branch uses the SR values. A separate early return skips anchor-containing clusters against static/kinematic bodies, independently of hardness.

## Native formula and what it does not establish

Let d be the native signed cluster separation minus the summed collision margin, so contact penetration has d<0. Initial positional drift is d*n. [btSoftBody.cpp:CJoint::Prepare/Solve/Terminate](https://github.com/kripken/ammo.js/blob/79190a1f03845794b1bba1777f30037349967658/bullet/src/BulletSoftBody/btSoftBody.cpp) scales this by ERP/dt, sends the split fraction through a separate drift impulse using the contact effective-mass matrix, and divides the remaining velocity-drift contribution by the cluster iteration count. Each solve also responds to closing normal velocity; Terminate applies the split drift. Thus split.5 does not simply discard half the positional correction. Increasing citerations does not multiply nominal total ERP, because the velocity drift is divided by that count.

At120Hz the maximum400acceleration contributes at most3.333units/s of velocity per step. For an actually detected native contact with four units of penetration, ERP1 yields an unsplit drift scale of480units/s; with split.5 and four iterations, its nominal velocity-drift scale is60units/s per iteration, before the effective mass/coupled response. This comparison is not a guarantee of correction: the reported four-unit distance behind an original face need not be the native contact's d, and a thin convex-triangle contact may have been crossed completely. It does show why assuming a default.1weak spring is the wrong explanation.

Cluster impulses are subsequently combined at shared nodes, and contact generation, excluded anchor faces, thin triangle hulls, timestep and competing constraints still matter. The source does not establish which of these caused each saved penetration. A coefficient change cannot correct a contact that was never generated or was explicitly skipped.

## One targeted next diagnostic, not a parameter sweep

Do not add a hardness experiment to the LOD replay. First append the getter/static-flag facts above to its normal preflight. On the existing saved failing mesh, classify each penetrating node's incident per-face clusters into anchor-excluded versus eligible, and for eligible cases test whether the entire cluster has already crossed beyond the corresponding native triangle's contact slab or still straddles it. Preserve the exact original-face/source association and collision-margin provenance; report ambiguity where another facet could still contact it. This bounded existing-state geometric audit distinguishes an unavailable/excluded contact from a potentially insufficient response before changing a coefficient. It requires no native stepping and is compatible with the cost-only LOD work.

If eligible clusters remain in native contact range, a later contact-generation/impulse diagnostic may be justified. Do not infer that doubling iterations or changing split will fix it merely because those settings are exposed. No force reduction or config change is authorized by this source finding.

## Separate selfcontact caveat

The same source has another nontrivial limitation relevant to strict selfcrossings, not shell contact. Per-cluster defaults in [btSoftBody.h](https://github.com/kripken/ammo.js/blob/79190a1f03845794b1bba1777f30037349967658/bullet/src/BulletSoftBody/btSoftBody.h) set m_maxSelfCollisionImpulse=100 and m_selfCollisionImpulseFactor=.01. CJoint::Solve's same-soft-body branch suppresses velocity impulses whose magnitude is below100 and scales the others by.01; its split drift still applies separately. These cluster fields are not exposed by the current IDL. This is source evidence that enabling CL_SELF alone is not a proof of strong thin-sheet selfcontact response. It does not justify an unreviewed binding patch or confound the static hardness conclusion.

## Completed saved-state classification

Executed only arithmetic over the durable120Hz step121 state (physical time1.008333seconds) and its existing exposed-facet classification, as confirmed with the geometry engineer. No native engine, geometry rebuild or simulation ran. Reproducible script and complete output: evidence/sticker-edge-wrap/early/ammo/face-cluster/contact-slab-classification.ts and contact-slab-classification.json. The output hashes both input files and preserves every node/face/plane witness.

The source-derived contact normal slab is±.20unit: the actual concave adapter's±.06extrusion, child convex hull's default.04margin, and soft body's.1margin. The [default margin](https://github.com/kripken/ammo.js/blob/79190a1f03845794b1bba1777f30037349967658/bullet/src/BulletCollision/CollisionShapes/btCollisionMargin.h) belongs to each generated hull; setting the parent mesh margin to zero does not overwrite it in this adapter. The [convex-pair SignedDistance path](https://github.com/kripken/ammo.js/blob/79190a1f03845794b1bba1777f30037349967658/bullet/src/BulletCollision/NarrowPhaseCollision/btGjkEpa2.cpp) disables GJK shape margins, and CL_RS tests the resulting distance against the separately summed.04+.1margin. Consequently no double margin was added here.

Results, conditional on the prior admitted outward planes:

| Quantity | Count |
| --- | ---: |
| Previously certified behind-facet nodes | 47 |
| Nodes themselves farther behind than.20 | 42 |
| Their unique incident sheet faces | 184 |
| Anchor-excluded faces in this set | 0 |
| Node/incident-face/reference-plane combinations | 282 |
| Entire cluster behind that reference plane's inflated slab | 116 |
| Cluster normal range still overlaps that slab | 166 |

The116outside combinations involve66unique faces; the166overlap combinations involve123unique faces. Five faces receive different results against different node reference planes, so those unique counts are deliberately not additive. Of the47nodes,38reference rear surfaces and9reference the front-cap/outer-bevel support partition. One node has all six incident faces wholly behind its admitted plane's slab.

Concrete witnesses: node682 is2.3433units behind the front plane at support point(148.8700,267.9286,28.1173); all six incident faces are behind that plane's.20slab, and its saved normal velocity is−9.7995units/s. Face723, referenced to penetrating rear node373, has signed vertex distances−7.1376,−6.0265,−.3601, excluding contact with that particular hull by normal separation. By contrast, face615 referenced to node350 spans−.1249to2.0470 and straddles the source plane; it remains a possible finite-triangle contact, not a proven active native joint. The deepest admitted node471 is3.9962units behind its rear plane and has three separated and three overlapping incident-face classifications.

These counts rule out anchor exclusion for this47-node failure subset and demonstrate that some failed sheet regions are already beyond the finite native contact envelope. They do not prove temporal tunneling: saved velocity/position cannot reconstruct the crossing event, a different native facet may still contact a separated cluster, and normal overlap does not prove finite-triangle overlap or GJK/solver admission. Twenty-nine nodes move inward and18outward relative to their saved planes; the greatest instantaneous inward displacement estimate is.3414unit per120Hz step. This makes discrete crossing plausible but does not explain all failures.

No further native optimization is recommended by this audit, per the lead's updated direction. Carry these concrete penetration witnesses and the independent full-surface oracle into the procedural alternative review. Real wrapping, preserved visible print and responsiveness are product requirements; the prior force schedule, exact equilibrium and numerical slack/strain targets are experimental choices. This failed solver state does not establish that a procedural physical-looking sticker cannot satisfy the requested behavior.
