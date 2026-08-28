/**
 * `@webpod/panel` — the 272x204 screen, rendered as real DOM.
 *
 * Placeholder surface. The package exists from the first commit so that
 * concurrent lanes can land code without editing shared configuration:
 * the workspace glob, the tsconfig base and the typecheck loop already
 * cover it. The lane that owns this package defines its real exports.
 */
export {};
