// Owned profiling host for the existing production route. Synthetic upstreams,
// native Start handlers, real temporary SQLite, and the existing MusicKit fixture.
// Usage: bun fixture.mjs /isolated/source /owned/output
import { mkdtemp, mkdir, stat, writeFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
const [snapshot, output, diagnosticPath] = process.argv.slice(2);
if (!snapshot || !output) throw new Error('snapshot and output required');
const { createLiveStickerServer } = await import(resolve(snapshot, 'packages/server-core/src/stickers/live.ts'));
const { installDeterministicAppleMusic } = await import(resolve(snapshot, 'apps/web/tests/deterministic-apple-music.ts'));
const { fingerprintBrowserSources } = await import(resolve(snapshot, 'scripts/browser-source-fingerprint.ts'));
const database = await mkdtemp(resolve(tmpdir(), 'webpod-direct-profile-db-'));
await mkdir(output, { recursive: true });
// The existing helper only calls addInitScript with mockDeveloperToken:false.
// Capture its exact transpiled callback for DevTools' before-navigation injection.
await installDeterministicAppleMusic({ async addInitScript(callback, options) {
  await writeFile(resolve(output, 'musickit-init.js'), `(${callback.toString()})(${JSON.stringify(options)});`);
} }, { authorized: false, mockDeveloperToken: false });
const service = createLiveStickerServer({ databasePath: resolve(database, 'collection.sqlite'), developerToken: async () => 'synthetic-developer', fetch: async (input) => {
  const path = new URL(String(input)).pathname;
  if (path.endsWith('/storefront')) return Response.json({ data: [{ id: 'us' }] });
  if (path.includes('/library/')) return Response.json({ data: ['Rock', 'Electronic', 'Jazz'].map((genre,index)=>({ attributes: { playParams: { catalogId: String(123+index) }, durationInMillis: 240000, genreNames: [genre] } })) });
  return Response.json({ data: [] });
} });
await service.ready();
const { default: entry } = await import(resolve(snapshot, 'apps/web/dist/server/server.js'));
const client = resolve(snapshot, 'apps/web/dist/client');
const appleTokenOptions = { env: { APPLE_TEAM_ID: 'ABCDE12345', APPLE_MUSICKIT_KEY_ID: 'ABCDE12345', APPLE_MUSICKIT_KEY_PATH: '/synthetic/no-key-read.p8' }, signer: { async sign() { return new Uint8Array(64); } } };
const server = Bun.serve({ hostname:'127.0.0.1', port:0, async fetch(request) {
  const pathname = new URL(request.url).pathname;
  if (request.method==='GET'||request.method==='HEAD') {
    const path=resolve(client,'.'+decodeURIComponent(pathname));
    if(path.startsWith(client+sep)&&!pathname.split('/').some(part=>part.startsWith('.'))) {
      const file=await stat(path).catch(()=>null);
      if(file?.isFile())return new Response(request.method==='HEAD'?null:Bun.file(path),{headers:{'content-type':Bun.file(path).type}});
    }
  }
  const response = await entry.fetch(request,{context:{stickerServer:service,appleTokenOptions}});
  if (response.headers.get('content-type')?.includes('text/html')) {
    const { readFile } = await import('node:fs/promises');
    const init = await readFile(resolve(output, 'musickit-init.js'), 'utf8') + (diagnosticPath ? await readFile(resolve(diagnosticPath), 'utf8') : '');
    const html = (await response.text()).replace('<head>', '<head><script>'+init+'</script>');
    const headers = new Headers(response.headers); headers.delete('content-length');
    return new Response(html,{status:response.status,headers});
  }
  return response;
} });
await writeFile(resolve(output,'host.json'),JSON.stringify({url:server.url.origin,source:fingerprintBrowserSources(snapshot),bun:Bun.version,pid:process.pid},null,2));
console.log('Owned synthetic profiling host ready at '+server.url.origin);
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;server.stop(true);await service.dispose();await rm(database,{recursive:true,force:true});process.exit(0);};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
