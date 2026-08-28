import { describe, expect, spyOn, test } from "bun:test";

import {
  assertReadOnlyRequest,
  executeProbePlan,
  executeProbeRequest,
  EXPECTED_REQUEST_COUNT,
  REQUEST_BUDGET,
  sendReadOnly,
  type TranscriptRecord,
} from "./probe-apple.ts";

const api = "https://api.music.apple.com";

describe("Apple empirical probe boundary", () => {
  test("locks the complete-run request budget", () => {
    expect(REQUEST_BUDGET).toEqual({
      anonymousPreflight: 5,
      credentialSanity: 1,
      row20: 9,
      row21: 4,
      enumeration: 17,
    });
    expect(EXPECTED_REQUEST_COUNT).toBe(36);
  });
  test("permits catalog GET requests", async () => {
    let calls = 0;
    const response = await sendReadOnly(
      new Request(`${api}/v1/catalog/us/songs/651880159`, { method: "GET" }),
      (request) => {
        calls += 1;
        expect(request.method).toBe("GET");
        return Promise.resolve(new Response("{}", { status: 200 }));
      },
    );

    expect(response.status).toBe(200);
    expect(calls).toBe(1);
  });

  test("records all 36 complete response bodies with stable IDs", async () => {
    const records: TranscriptRecord[] = [];
    const expectedBodies: string[] = [];
    let sequence = 0;
    const consoleSpy = spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await executeProbePlan(async (path, options) => {
        sequence += 1;
        const body = JSON.stringify({
          stableId: `body-${String(sequence).padStart(3, "0")}`,
          padding: "x".repeat(900),
          data: [{ id: `ra.${sequence}`, attributes: { name: `Station ${sequence}` } }],
        });
        expectedBodies.push(body);
        return executeProbeRequest(path, {
          anonymous: options?.anonymous,
          token: "fixture-developer-token",
          delayMs: 0,
          sequence,
          transport: () => Promise.resolve(new Response(body, { status: 200 })),
          transcriptSink: (record) => records.push(record),
        });
      });
    } finally {
      consoleSpy.mockRestore();
    }

    expect(records).toHaveLength(EXPECTED_REQUEST_COUNT);
    expect(records.map((record) => record.id)).toEqual(
      Array.from(
        { length: EXPECTED_REQUEST_COUNT },
        (_, index) => `response-${String(index + 1).padStart(3, "0")}`,
      ),
    );
    expect(records.map((record) => record.body)).toEqual(expectedBodies);
    expect(records.every((record) => record.body.length > 700)).toBe(true);

    const oracleRecords = records.slice(-13);
    expect(oracleRecords).toHaveLength(13);
    expect(oracleRecords.map((record) => record.path.split("/").at(-1))).toEqual([
      "albums",
      "artists",
      "composers",
      "genres",
      "music-videos",
      "station",
      "lyrics",
      "syllable-lyrics",
      "credits",
      "similar-songs",
      "radio",
      "videos",
      "zzz-not-a-relationship",
    ]);
  });

  for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
    test(`rejects ${method} at the transport boundary`, async () => {
      let calls = 0;
      const request = new Request(`${api}/v1/catalog/us/songs/651880159`, { method });

      await expect(
        sendReadOnly(request, () => {
          calls += 1;
          return Promise.resolve(new Response());
        }),
      ).rejects.toThrow(`non-GET method ${method}`);
      expect(calls).toBe(0);
    });
  }

  for (const path of [
    "/v1/me",
    "/v1/me/",
    "/v1/me/library",
    "/v1/me/library/playlists",
    "/v1/%6de/library",
    "/v1/%256de/library",
    "/v1/%25256de/library",
    "/v1%252fme/library",
    "/v1/me%252flibrary",
  ] as const) {
    test(`rejects the user-library boundary ${path}`, async () => {
      let calls = 0;
      await expect(
        sendReadOnly(new Request(`${api}${path}`), () => {
          calls += 1;
          return Promise.resolve(new Response());
        }),
      ).rejects.toThrow("touches the user library");
      expect(calls).toBe(0);
    });
  }

  for (const path of [
    "/v1/%",
    "/v1/%2",
    "/v1/%GG",
    "/v1/%25GG",
    "/v1/%252525256de/library",
  ] as const) {
    test(`rejects malformed or non-convergent encoding ${path}`, async () => {
      let calls = 0;
      await expect(
        sendReadOnly(new Request(`${api}${path}`), () => {
          calls += 1;
          return Promise.resolve(new Response());
        }),
      ).rejects.toThrow("BOUNDARY VIOLATION");
      expect(calls).toBe(0);
    });
  }

  test("does not reject a non-segment lookalike", () => {
    expect(() => assertReadOnlyRequest(new Request(`${api}/v1/media`))).not.toThrow();
  });
});
