# Per-face cluster collision probe

This is an explicitly changed collision configuration: `0x62` (`CL_RS | CL_SS | CL_SELF`) and `generateClusters(0)`, with all other mesh, force, margin and iteration settings unchanged. The exact pinned prebuilt64MiB engine is used. There are2048actualcollidable faceclusters and no master; the C²booltable has4,194,304entries (~4MiBpayload, not live allocation measurement).

Both runs hit the2s force+native wall-time cap before the2.908333-second press endpoint. Neither reached capture, and capture still uses fixedinitialtargets rather than physical current-support adhesion. The120Hz run is isolated; part of the240Hz run overlapped the120Hz read-only audit, so240Hz cost is explicitly confounded. No rerun or claim of clean timing convergence is made.

The120Hz final partial state has155shell-intersectingtriangles and no self-overlap pairs;240Hz stops earlier with58shell-intersectingtriangles and no selfpairs. None of the six prior nonshared selfpairs intersects these earlier states; this does not prove their later trajectory remains clear. At common0.5seconds both states remain midpress, differ by9.164unitsmaximum/4.415RMS, and have83/55shellintersections respectively.

Each final mesh retains rest coordinates, index topology, solvedpositions/velocities and per-step timings. Unique step30/60/90/120 snapshots are retained. The full-triangle oracle includes bothhalves; its interior-shrink connected-pair caveat and lack of swept/volumetricproof remain explicit. `summary.json` separates thirteenrootincidentfaces (native anchoredclusters skipstaticcollision) from allothers. At120Hz none of those13intersect, so all155contacts occur outside that exclusion.

Commands: `MEMORY_MIB=64 RUN_HZ=120 bun /tmp/webpod-ammo-79190a1f/c03-facecluster.ts`, then the same with240 in a separateprocess. No dependency/binary/productintegration changes. Allownersdestroyed and processes exited.
