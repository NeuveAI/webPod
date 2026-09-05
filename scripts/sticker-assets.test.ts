import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { STICKER_CATALOGUE } from '../packages/stickers/src/catalogue';
import { syncStickerAssets } from './sticker-assets';

test('all sixty production URL files match source bytes and decode to manifest RGBA dimensions', () => {
  const root = resolve(import.meta.dirname, '..');
  expect(syncStickerAssets(root)).toBe(60);
  for (const art of STICKER_CATALOGUE) {
    const bytes = readFileSync(resolve(root, 'apps/web/public', art.url.slice(1)));
    expect(bytes.equals(readFileSync(resolve(root, 'assets', art.url.slice(1))))).toBe(true);
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(bytes.readUInt32BE(16)).toBe(art.width);
    expect(bytes.readUInt32BE(20)).toBe(art.height);
    expect(bytes[24]).toBe(8); expect(bytes[25]).toBe(6); expect(bytes[28]).toBe(0);
    const chunks: Buffer[] = [];
    for (let offset = 8; offset < bytes.length;) {
      const length = bytes.readUInt32BE(offset);
      if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const decoded = inflateSync(Buffer.concat(chunks));
    expect(decoded.length).toBe((art.width * 4 + 1) * art.height);
    for (let row = 0; row < art.height; row++) expect(decoded[row * (art.width * 4 + 1)]).toBeLessThanOrEqual(4);
  }
});
