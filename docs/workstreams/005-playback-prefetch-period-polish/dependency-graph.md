# Dependency graph

```text
R0 material measurements + runtime baseline
 ├─> I1 immediate async destination frames
 │    └─> I2 bounded relationship/artwork prefetch
 ├─> I3 provider preparation arbitration
 │    └─> I4 playback attempt reconciliation + progress
 ├─> I5 Apple-only runtime entry
 ├─> I6 SFX readiness decision + implementation
 └─> I7 period geometry / loading visuals

I1 + I2 + I3 + I4 + I5 + I6 + I7
 └─> V1 focused tests and static gates
      ├─> V2 authenticated DevTools timing/replay
      ├─> V3 visual/material review
      └─> V4 playback/performance review

Owner rejection of the first I7 loading material created this completed lane:

A1 PM Aqua acceptance contract
 └─> A2 design-engineer implementation + screenshot matrix
      ├─> A3 PM product acceptance
      └─> A4 independent antagonistic visual/code review

A3 + A4
 └─> A5 owner visual approval (superseded by the next fidelity pass)

The owner's next fidelity pass supersedes A2's 5px geometry and adds the missing
volume/quadrant interaction contract:

B1 PM photo measurement + owner-authority correction
 └─> B2 design-engineer taller bars + volume state + full quadrants
      └─> B3 deterministic and visual evidence regeneration
           ├─> B4 PM product acceptance
           └─> B5 independent antagonistic visual/interaction review

B4 + B5
 └─> B6 owner live visual/physical-feel approval
```

B1 is complete. B2 may start. B3 follows implementation. B4 and B5 are blocked
on current-source B3 evidence; B6 is blocked on both written reviews and the live
result.

One implementation owner coordinates B2–B3 because panel rendering/state and
physical input evidence converge in shared integration tests. Review lanes remain
independent.
