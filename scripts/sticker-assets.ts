import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

/** Copies only the immutable manifest's verified PNGs before Vite serves/copies public assets. */
export function syncStickerAssets(workspaceRoot: string): number {
  const root = resolve(workspaceRoot, 'assets/stickers/playworn');
  const manifest: unknown = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
  if (typeof manifest !== 'object' || manifest === null || !('stickers' in manifest) || !Array.isArray(manifest.stickers) || manifest.stickers.length !== 60) throw new Error('Invalid PLAYWORN manifest');
  const seen = new Set<string>();
  for (const value of manifest.stickers) {
    if (typeof value !== 'object' || value === null || !('file' in value) || typeof value.file !== 'string'
      || !/^[a-z-]+\/pw-[a-z]\d{2}-[a-z0-9-]+\.png$/.test(value.file)
      || !('sha256' in value) || typeof value.sha256 !== 'string' || seen.has(value.file)) throw new Error('Invalid PLAYWORN asset');
    seen.add(value.file);
    const bytes = readFileSync(resolve(root, value.file));
    if (createHash('sha256').update(bytes).digest('hex') !== value.sha256) throw new Error(`PLAYWORN checksum mismatch: ${value.file}`);
    const destination = resolve(workspaceRoot, 'apps/web/public/stickers/playworn', value.file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(root, value.file), destination);
  }
  return seen.size;
}
