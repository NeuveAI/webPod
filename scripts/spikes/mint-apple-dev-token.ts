/**
 * S2.1 — Apple Music developer-token minting spike.
 *
 * THROWAWAY SPIKE. The shipping implementation is an Effect service in
 * `packages/server-core` (D-017 §2: the private key is server-side only and
 * must never reach the client). This file exists so S2's probes can run and
 * so that service can be lifted from it later. The shipping service must retain
 * the credential boundaries below when it moves to `packages/server-core`.
 *
 * Credential law (D-017), enforced in code below:
 *   1. The key path comes from an env var. Never hardcoded, never defaulted to
 *      a repo-relative path.
 *   2. Key bytes are read inside the signing call and never returned, logged,
 *      stored on a module-level binding, or interpolated into a message.
 *   3. The minted token is short-lived and is NEVER printed by this module.
 *      The CLI entry point prints metadata only. Consumers import
 *      `mintDeveloperToken()` and pass the value straight into an
 *      Authorization header.
 *
 * Env:
 *   APPLE_MUSICKIT_KEY_PATH  (required) absolute path to the .p8 private key
 *   APPLE_TEAM_ID            (required) 10-character Apple Developer Team ID -> `iss`
 *   APPLE_MUSICKIT_KEY_ID    (optional) 10-character MusicKit Key ID -> `kid`;
 *                            derived from the AuthKey_<KEYID>.p8 filename if absent
 *   APPLE_TOKEN_TTL_SECONDS  (optional) default 900 (15 min). Apple's ceiling is
 *                            15777000s (~6 months); we deliberately stay short.
 *
 * Reference: Apple, "Generating developer tokens" —
 * https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens
 */

import { basename } from "node:path";

export interface DeveloperTokenMeta {
  /** Seconds since epoch at which the token expires. */
  readonly expiresAt: number;
  /** Length in characters. Diagnostic only — never the token itself. */
  readonly length: number;
}

export interface MintedDeveloperToken extends DeveloperTokenMeta {
  /**
   * The signed JWT. Treat as a secret: pass it to an Authorization header and
   * nothing else. Do not log it, write it to a file, or put it in evidence.
   */
  readonly token: string;
}

const APPLE_MAX_TTL_SECONDS = 15_777_000;
const DEFAULT_TTL_SECONDS = 900;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. See the header of scripts/spikes/mint-apple-dev-token.ts.`,
    );
  }
  return value.trim();
}

/** `/path/to/AuthKey_ABCDE12345.p8` -> `ABCDE12345`. */
export function keyIdFromFilename(keyPath: string): string {
  const keyId = /^AuthKey_([A-Z0-9]+)\.p8$/.exec(basename(keyPath))?.[1];
  if (keyId === undefined) {
    throw new Error(
      "Could not derive the MusicKit Key ID from the key filename " +
        "(expected AuthKey_<KEYID>.p8). Set APPLE_MUSICKIT_KEY_ID explicitly.",
    );
  }
  return keyId;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/**
 * Imports the PKCS#8 PEM at `keyPath` as an ECDSA P-256 signing key.
 *
 * The PEM text and its DER bytes are local to this function and are zeroed on
 * the way out. They are never returned, so no caller can accidentally log them.
 */
async function importSigningKey(keyPath: string): Promise<CryptoKey> {
  const pem = await Bun.file(keyPath).text();
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  if (body.length === 0) {
    // Deliberately says nothing about the file's contents.
    throw new Error(`No PKCS#8 body found in the key file at ${keyPath}.`);
  }
  const der = Buffer.from(body, "base64");
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false, // non-extractable: the key material cannot be read back out
      ["sign"],
    );
  } finally {
    der.fill(0);
  }
}

/**
 * Mints a short-lived ES256 Apple Music developer token.
 *
 * The returned token is a secret. Callers must not persist or print it.
 */
export async function mintDeveloperToken(options?: {
  readonly ttlSeconds?: number;
}): Promise<MintedDeveloperToken> {
  const keyPath = requireEnv("APPLE_MUSICKIT_KEY_PATH");
  const teamId = requireEnv("APPLE_TEAM_ID");
  const keyId = process.env.APPLE_MUSICKIT_KEY_ID?.trim() || keyIdFromFilename(keyPath);

  const ttlRaw =
    options?.ttlSeconds ??
    Number(process.env.APPLE_TOKEN_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(ttlRaw) || ttlRaw <= 0 || ttlRaw > APPLE_MAX_TTL_SECONDS) {
    throw new Error(
      `TTL must be a positive number of seconds <= ${APPLE_MAX_TTL_SECONDS}; got ${String(ttlRaw)}.`,
    );
  }
  const ttlSeconds = Math.floor(ttlRaw);

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;

  const signingInput =
    base64urlJson({ alg: "ES256", kid: keyId, typ: "JWT" }) +
    "." +
    base64urlJson({ iss: teamId, iat: issuedAt, exp: expiresAt });

  const signingKey = await importSigningKey(keyPath);
  // WebCrypto emits the raw r||s form, which is exactly what JWS ES256 wants.
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      new TextEncoder().encode(signingInput),
    ),
  );

  const token = `${signingInput}.${base64url(signature)}`;
  return { token, expiresAt, length: token.length };
}

// CLI: prints METADATA ONLY. The token is never written to stdout, stderr or disk.
if (import.meta.main) {
  const minted = await mintDeveloperToken();
  console.log(
    JSON.stringify(
      {
        ok: true,
        alg: "ES256",
        expiresAt: new Date(minted.expiresAt * 1000).toISOString(),
        tokenLength: minted.length,
        note: "token withheld by design (D-017) — import mintDeveloperToken() instead",
      },
      null,
      2,
    ),
  );
}
