// Read-only arithmetic on the saved state; no Three, native engine or simulation.
const dir = import.meta.dir;
const names = ["c03-facecluster-120.json", "c03-facecluster-contact-strata.json"];
const inputs = await Promise.all(names.map(async name => {
  const bytes = new Uint8Array(await Bun.file(`${dir}/${name}`).arrayBuffer());
  return { name, sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"), data: JSON.parse(new TextDecoder().decode(bytes)) };
}));
const [state, strata] = inputs.map(input => input.data);
const pins = new Set<number>(state.pins.map((pin: { id: number }) => pin.id));
const incident: number[][] = Array.from({ length: state.finalNodes.length }, () => []);
for (let face = 0; face < state.indices.length / 3; face++) {
  for (const node of state.indices.slice(face * 3, face * 3 + 3)) incident[node].push(face);
}
const threshold = .06 + .04 + .1;
const epsilon = 1e-7;
const counts = (items: any[], key: string) => Object.fromEntries([...new Set(items.map(item => item[key]))].map(value => [value, items.filter(item => item[key] === value).length]));
const behind = strata.nodes.filter((node: any) => node.status === "behind exposed facet interior");
const cases: any[] = [];
const nodeResults: any[] = [];
for (const node of behind) {
  const normal = node.position.map((component: number, axis: number) => (component - node.supportPoint[axis]) / node.signed);
  const normalLength = Math.hypot(...normal);
  if (Math.abs(normalLength - 1) > 1e-7) throw new Error(`Invalid normal for node ${node.id}`);
  const signed = (point: number[]) => point.reduce((sum, component, axis) => sum + (component - node.supportPoint[axis]) * normal[axis], 0);
  const nodeCases = incident[node.id].map(face => {
    const ids = state.indices.slice(face * 3, face * 3 + 3);
    const signedValues = ids.map((id: number) => signed(state.finalNodes[id].position));
    const minimum = Math.min(...signedValues), maximum = Math.max(...signedValues);
    const anchored = ids.some((id: number) => pins.has(id));
    const category = anchored ? "anchor-excluded" : maximum < -threshold - epsilon ? "entire-cluster-behind-inflated-slab" : minimum > threshold + epsilon ? "entire-cluster-in-front-of-inflated-slab" : "normal-range-overlaps-inflated-slab";
    const row = { node: node.id, face, ids, source: node.source, supportPoint: node.supportPoint, outwardNormal: normal, signedValues, minimum, maximum, category,
      originalPlaneStraddled: minimum <= 0 && maximum >= 0,
      actualExtrudedHullSlabOverlapped: minimum <= .06 && maximum >= -.06,
      normalVelocity: state.finalNodes[node.id].velocity.reduce((sum: number, value: number, axis: number) => sum + value * normal[axis], 0) };
    cases.push(row);
    return row;
  });
  nodeResults.push({ node: node.id, source: node.source, signed: node.signed, position: node.position, supportPoint: node.supportPoint, outwardNormal: normal,
    speed: Math.hypot(...state.finalNodes[node.id].velocity), normalVelocity: nodeCases[0]?.normalVelocity,
    beyondInflatedSlab: node.signed < -threshold - epsilon,
    counts: counts(nodeCases, "category"), allIncidentClustersBehindSlab: nodeCases.every(row => row.category === "entire-cluster-behind-inflated-slab") });
}
const faceResults = [...new Set(cases.map(row => row.face))].map(face => {
  const rows = cases.filter(row => row.face === face);
  return { face, ids: rows[0].ids, categories: [...new Set(rows.map(row => row.category))], classifiedAtNodes: rows.map(row => row.node) };
});
const result = {
  inputs: inputs.map(({ name, sha256 }) => ({ name, sha256 })),
  state: { hz: state.hz, completedSteps: state.completedSteps, physicalTime: state.physicalTime, staticTriangles: state.staticTriangles, clusterCount: state.clusterCount },
  sourceAssumptions: { flags: "0x62", shellMass: 0, staticClusterHardness: 1, staticSplit: .5, clusterIterations: 4, originalTriangleExtrusion: .06, childHullMargin: .04, softMargin: .1, normalSlabHalfWidth: threshold, epsilon,
    reference: "Pinned SignedDistance convex-pair path disables GJK margins; CL_RS separately tests signed distance against .04 + .1. The .06 source extrusion plus that distance envelope yields a conservative .2 normal slab." },
  qualification: "Conditional on existing admitted exposed-facet planes. Arithmetic normal-slab exclusion only: a fully separated cluster cannot contact that particular triangle hull, but another native facet may. Normal-range overlap does not establish finite-triangle overlap, native broadphase/GJK admission or an active solver contact. A saved state cannot prove temporal tunneling. Node/plane incidences are not unique sheet faces.",
  summary: { penetratingNodes: behind.length, penetratingNodesBeyondSlab: nodeResults.filter(row => row.beyondInflatedSlab).length,
    nodesAllIncidentClustersBehindSlab: nodeResults.filter(row => row.allIncidentClustersBehindSlab).length,
    nodeSources: counts(nodeResults, "source"), nodeFacePlaneIncidences: cases.length, incidenceCategories: counts(cases, "category"),
    uniqueIncidentFaces: faceResults.length, uniqueAnchorExcludedFaces: faceResults.filter(row => row.categories.includes("anchor-excluded")).length,
    uniqueFacesBehindAtAnyNodePlane: faceResults.filter(row => row.categories.includes("entire-cluster-behind-inflated-slab")).length,
    uniqueFacesOverlappingAtAnyNodePlane: faceResults.filter(row => row.categories.includes("normal-range-overlaps-inflated-slab")).length,
    incidenceOriginalPlaneStraddles: cases.filter(row => row.originalPlaneStraddled).length,
    deepest: [...nodeResults].sort((a, b) => a.signed - b.signed).slice(0, 5),
    firstBehindWitness: cases.find(row => row.category === "entire-cluster-behind-inflated-slab"),
    firstOverlapWitness: cases.find(row => row.category === "normal-range-overlaps-inflated-slab") },
  nodeResults, faceResults, cases,
};
await Bun.write(`${dir}/contact-slab-classification.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.summary, null, 2));
