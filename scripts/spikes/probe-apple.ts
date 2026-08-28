/**
 * S2 — Apple Music API empirical probe. READ-ONLY.
 *
 * ============================ THE BOUNDARY ============================
 * Every request this script makes is a GET carrying a DEVELOPER token only.
 * There is no user token, no `authorize()`, no POST/PUT/PATCH/DELETE, and no
 * path under `/v1/me/`. Rows 10, 11 and 18 are NOT probed here: settling them
 * empirically requires creating and mutating playlists in the owner's real
 * Apple Music library, which is irreversible and is NOT AUTHORISED.
 *
 * `assertReadOnly()` below enforces this at the only place a request can be
 * made. If a future edit tries to add a write, it throws.
 * ======================================================================
 *
 * Credential law (D-017): the token is minted in-process by
 * `mint-apple-dev-token.ts`, held in a local binding, and passed only to an
 * Authorization header. `redact()` scrubs it from every line of output. It is
 * never written to a file.
 *
 * Env (see mint-apple-dev-token.ts):
 *   APPLE_MUSICKIT_KEY_PATH, APPLE_TEAM_ID, [APPLE_MUSICKIT_KEY_ID]
 *
 * Run:  bun run scripts/spikes/probe-apple.ts
 */

import { mintDeveloperToken } from "./mint-apple-dev-token.ts";

const BASE = "https://api.music.apple.com";
const SF = "us";
const POLITE_DELAY_MS = 350;

/**
 * The Row 20 fixture. Three artists x two songs each.
 *
 * ⚠ This is DELIBERATELY NOT the fixture S1 named, and not the one the S2
 * dispatch inherited from it. Both said "three songs by three different
 * artists". That design cannot discriminate: if three songs by three DIFFERENT
 * artists return three DIFFERENT stations, that is equally consistent with
 * per-track seeding and with per-ARTIST seeding, because the artists differ
 * too. S1's own stated decision rule -- "if the same artist's songs all return
 * one identical ra.* id, it is an artist station" -- cannot be evaluated by a
 * fixture that never puts two songs by one artist side by side.
 *
 * The discriminating comparisons are the two added here:
 *   (a) WITHIN-ARTIST: two songs by the same artist. Same station id => the
 *       relationship is artist-level, NOT track-seeded.
 *   (b) SONG vs ARTIST: the song's station id compared against that artist's
 *       own `station` relationship. Identical => decisively not track-seeded.
 *       `Artists` carrying an identically-named relationship is the live
 *       reason to doubt, so it must be measured, not reasoned about.
 * IDs sourced from the public iTunes lookup API (no token required).
 */
const ROW20_FIXTURE = [
  {
    artist: "Fleetwood Mac",
    artistId: "158038",
    songs: [
      { id: "651880159", name: "The Chain" },
      { id: "202271847", name: "Rhiannon" },
    ],
  },
  {
    artist: "Kendrick Lamar",
    artistId: "368183298",
    songs: [
      { id: "1440882165", name: "HUMBLE." },
      { id: "1781353929", name: "Not Like Us" },
    ],
  },
  {
    artist: "Björk",
    artistId: "295015",
    songs: [
      { id: "300205497", name: "Human Behaviour" },
      { id: "300205685", name: "Army of Me" },
    ],
  },
] as const;

/** A song used as the subject of the Row 21 and S2.4 calibration probes. */
const CALIBRATION_SONG = ROW20_FIXTURE[0].songs[0];

/**
 * Names fed to the relationship existence oracle in P3. Mixes the seven
 * relationships S1 enumerated as the complete documented set for `Songs`
 * against names that are NOT in that set, so the live surface can be compared
 * with the documented one.
 */
const RELATIONSHIP_ORACLE_NAMES = [
  // documented by Apple (S1's exhaustive set)
  "albums", "artists", "composers", "genres", "music-videos", "station",
  // NOT in the documented set
  "lyrics", "syllable-lyrics", "credits",
  // negative controls: expected not to be relationships at all
  "similar-songs", "radio", "videos", "zzz-not-a-relationship",
] as const;

// ---------------------------------------------------------------------------
// Read-only enforcement + redaction
// ---------------------------------------------------------------------------

let TOKEN = "";

/** Scrubs the developer token from anything on its way to stdout. */
function redact(text: string): string {
  if (TOKEN.length > 0 && text.includes(TOKEN)) text = text.split(TOKEN).join("<TOKEN REDACTED>");
  // Belt and braces: any bare JWT-shaped run.
  return text.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "<JWT REDACTED>");
}

function log(...parts: unknown[]): void {
  console.log(redact(parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ")));
}

/** Hard stop on anything that could mutate the owner's library. */
function assertReadOnly(method: string, path: string): void {
  if (method !== "GET") {
    throw new Error(`BOUNDARY VIOLATION: non-GET method ${method} is forbidden in this spike.`);
  }
  if (path.includes("/v1/me/")) {
    throw new Error(`BOUNDARY VIOLATION: ${path} touches the user library; no user token is authorised.`);
  }
}

interface Probe {
  readonly path: string;
  readonly status: number;
  readonly body: string;
  readonly note?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string, opts?: { readonly anonymous?: boolean }): Promise<Probe> {
  assertReadOnly("GET", path);
  await sleep(POLITE_DELAY_MS);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts?.anonymous !== true) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}${path}`, { method: "GET", headers });
  const raw = await res.text();
  return { path, status: res.status, body: redact(raw) };
}

function report(label: string, p: Probe, bodyChars = 700): void {
  log(`\n  GET ${p.path}`);
  log(`  -> ${p.status}  [${label}]`);
  log(`  body: ${p.body.length === 0 ? "<empty>" : p.body.slice(0, bodyChars)}`);
}

/** Pulls `data[0]` id/name out of a relationship response, if present. */
function firstResource(body: string): { id?: string; name?: string; notes?: string } {
  try {
    const j = JSON.parse(body) as { data?: Array<{ id?: string; attributes?: Record<string, unknown> }> };
    const d = j.data?.[0];
    if (d === undefined) return {};
    const attrs = d.attributes ?? {};
    const notes = attrs.editorialNotes as { short?: string; standard?: string } | undefined;
    return {
      id: d.id,
      name: attrs.name as string | undefined,
      notes: notes?.short ?? notes?.standard,
    };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// P0 — preflight, no credentials. Establishes what a 401 means here.
// ---------------------------------------------------------------------------

async function p0Preflight(): Promise<void> {
  log("\n================ P0 — UNAUTHENTICATED PREFLIGHT (no token) ================");
  log("Question: does this API route before it authenticates? If an unknown path");
  log("404s while a known one 401s, the route surface is enumerable anonymously.");
  const paths = [
    `/v1/catalog/${SF}/songs/${CALIBRATION_SONG.id}`,
    `/v1/catalog/${SF}/songs/${CALIBRATION_SONG.id}/station`,
    `/v1/catalog/${SF}/songs/${CALIBRATION_SONG.id}/lyrics`,
    `/v1/catalog/${SF}/songs/${CALIBRATION_SONG.id}/zzz-not-a-relationship`,
    `/v1/this-route-does-not-exist`,
  ];
  for (const path of paths) {
    report("anonymous", await get(path, { anonymous: true }));
  }
}

// ---------------------------------------------------------------------------
// P1 — Row 20: is a song's `station` relationship seeded from THAT SONG?
// ---------------------------------------------------------------------------

async function p1Row20(): Promise<void> {
  log("\n================ P1 — ROW 20: song.station semantics ================");
  const rows: Array<{ artist: string; song: string; stationId?: string; stationName?: string; notes?: string }> = [];
  const artistStations: Record<string, { id?: string; name?: string }> = {};

  for (const entry of ROW20_FIXTURE) {
    for (const song of entry.songs) {
      const p = await get(`/v1/catalog/${SF}/songs/${song.id}/station`);
      report(`${entry.artist} — ${song.name}`, p);
      const r = firstResource(p.body);
      rows.push({ artist: entry.artist, song: song.name, stationId: r.id, stationName: r.name, notes: r.notes });
    }
    // The control that S1's fixture omits: the ARTIST's own station.
    const ap = await get(`/v1/catalog/${SF}/artists/${entry.artistId}/station`);
    report(`${entry.artist} — ARTIST station (control)`, ap);
    artistStations[entry.artist] = firstResource(ap.body);
  }

  log("\n---- Row 20 analysis ----");
  log("Comparison table:", JSON.stringify({ songs: rows, artistStations }, null, 2));

  for (const entry of ROW20_FIXTURE) {
    const mine = rows.filter((r) => r.artist === entry.artist);
    const ids = new Set(mine.map((r) => r.stationId ?? "<none>"));
    const withinArtistDistinct = ids.size === mine.length;
    const matchesArtistStation = mine.some(
      (r) => r.stationId !== undefined && r.stationId === artistStations[entry.artist]?.id,
    );
    log(
      `  ${entry.artist}: within-artist station ids ${withinArtistDistinct ? "DISTINCT (consistent with track-seeded)" : "IDENTICAL (=> artist-level, NOT track-seeded)"}` +
        `; equals that artist's own station relationship: ${matchesArtistStation ? "YES (=> NOT track-seeded)" : "no"}`,
    );
  }
  const crossArtist = new Set(rows.map((r) => r.stationId ?? "<none>"));
  log(`  cross-artist distinct station ids: ${crossArtist.size} of ${rows.length} — NON-DISCRIMINATING on its own (this is the comparison S1 proposed).`);
}

// ---------------------------------------------------------------------------
// P2 — Row 21: does a lyrics endpoint exist, and what does 404 mean here?
// ---------------------------------------------------------------------------

async function p2Row21(): Promise<void> {
  log("\n================ P2 — ROW 21: lyrics endpoint ================");
  log("A bare 404 on /lyrics proves nothing without a calibration baseline, so");
  log("each probe is run against the SAME song id, alongside a known-good and a");
  log("known-nonsense relationship. What matters is whether /lyrics behaves like");
  log("the nonsense control (no such route) or unlike it (route exists, gated).");
  const id = CALIBRATION_SONG.id;
  report("known-good relationship (expect 200)", await get(`/v1/catalog/${SF}/songs/${id}/artists`), 300);
  report("nonsense relationship (calibrates 'no such relationship')", await get(`/v1/catalog/${SF}/songs/${id}/zzz-not-a-relationship`));
  report("ROW 21 SUBJECT: /lyrics", await get(`/v1/catalog/${SF}/songs/${id}/lyrics`));
  report("third-party-named variant: /syllable-lyrics", await get(`/v1/catalog/${SF}/songs/${id}/syllable-lyrics`));
  log("\nNOTE: 21b (what entitlement third-party lyrics DISPLAY requires) is a");
  log("licensing question. No API call resolves it; it needs Apple in writing.");
  log("This probe deliberately does not attempt it.");
}

// ---------------------------------------------------------------------------
// P3 — S2.4: check the exhaustive-enumeration claim against the live API
// ---------------------------------------------------------------------------

async function p3Enumeration(): Promise<void> {
  log("\n================ P3 — S2.4: is the documented surface the REAL surface? ================");
  log("S1's negative findings rest on enumerating a closed DOCUMENTED surface.");
  log("Rather than re-read the same doc page, ask Apple's own server to");
  log("enumerate: feed deliberately invalid values to the parameters that take a");
  log("relationship/view name and harvest the error text. If the server names its");
  log("legal values, that is an independent, authoritative enumeration.");
  const id = CALIBRATION_SONG.id;
  report("invalid include=", await get(`/v1/catalog/${SF}/songs/${id}?include=zzz-bogus`));
  report("invalid views=", await get(`/v1/catalog/${SF}/songs/${id}?views=zzz-bogus`));
  report("invalid extend=", await get(`/v1/catalog/${SF}/songs/${id}?extend=zzz-bogus`));
  report("invalid resource type", await get(`/v1/catalog/${SF}/zzz-bogus-resources/${id}`));

  // The relationship-path error codes turn out to be a usable existence
  // ORACLE, which the query-parameter probes above are not. Apple returns
  // three distinguishable outcomes for a relationship name:
  //   40008 (400) "No relationship found matching X"  -> name is not a relationship
  //   40403 (404) "No related resources found for X"  -> name IS a relationship, no data here
  //   40012 (400) "'X' entities require permissions"  -> name IS a relationship, gated
  //   200                                             -> exists and returned data
  // That lets the live surface be enumerated independently of the docs.
  log("\n---- relationship existence oracle ----");
  for (const name of RELATIONSHIP_ORACLE_NAMES) {
    const p = await get(`/v1/catalog/${SF}/songs/${id}/${name}`);
    let code = "";
    let detail = "";
    try {
      const e = (JSON.parse(p.body) as { errors?: Array<{ code?: string; detail?: string }> }).errors?.[0];
      code = e?.code ?? "";
      detail = e?.detail ?? "";
    } catch {
      /* 200 responses are not error envelopes */
    }
    const verdict =
      p.status === 200 ? "EXISTS (data)"
      : code === "40403" ? "EXISTS (no data for this song)"
      : code === "40012" ? "EXISTS (permission-gated)"
      : code === "40008" ? "not a relationship"
      : "unclassified";
    log(`  ${String(p.status).padEnd(4)} ${name.padEnd(24)} code=${code.padEnd(6)} => ${verdict}${detail === "" ? "" : `  [${detail}]`}`);
  }

  log("\nNOTE: the enumeration of the WRITE surface (rows 10/11 — whether an");
  log("undocumented DELETE or PUT exists on /v1/me/library/playlists) is NOT");
  log("probed. It requires a user token and a real mutation of the owner's");
  log("library. assertReadOnly() blocks it. See the report.");
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await p0Preflight();

  let minted;
  try {
    minted = await mintDeveloperToken({ ttlSeconds: 900 });
  } catch (err) {
    log("\n!! Could not mint a developer token — the authenticated probes cannot run.");
    log(`!! ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }
  TOKEN = minted.token;
  log(`\n[token minted: ES256, expires ${new Date(minted.expiresAt * 1000).toISOString()}, value withheld]`);

  // Fail fast and loudly if the credentials are not accepted, rather than
  // reporting a wall of 401s as if they were findings.
  const sanity = await get(`/v1/catalog/${SF}/songs/${CALIBRATION_SONG.id}`);
  if (sanity.status !== 200) {
    log(`\n!! Credential sanity check failed: GET ${sanity.path} -> ${sanity.status}`);
    log(`!! body: ${sanity.body.length === 0 ? "<empty>" : sanity.body.slice(0, 400)}`);
    log("!! Every subsequent probe would return 401 and would mean nothing.");
    log("!! Check APPLE_TEAM_ID and that the key is an enabled MusicKit key.");
    process.exitCode = 1;
    return;
  }
  log(`\n[credential sanity check OK: GET ${sanity.path} -> 200]`);

  await p1Row20();
  await p2Row21();
  await p3Enumeration();
}

await main();
