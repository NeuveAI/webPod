/**
 * Placeholder for the static correctness gates.
 *
 * Exits non-zero on purpose. The gate set is not implemented yet, and a
 * placeholder that exited 0 would report "no findings" for checks that
 * never ran — which is the one failure mode a gate runner must not have.
 */
console.error('bun run gates: not implemented')
process.exit(1)
