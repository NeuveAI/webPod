import { describe, expect, test } from "bun:test";

import {
  assertReadOnlyRequest,
  EXPECTED_REQUEST_COUNT,
  REQUEST_BUDGET,
  sendReadOnly,
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
  ] as const) {
    test(`rejects the user-library boundary ${path}`, () => {
      expect(() => assertReadOnlyRequest(new Request(`${api}${path}`))).toThrow(
        "touches the user library",
      );
    });
  }

  test("does not reject a non-segment lookalike", () => {
    expect(() => assertReadOnlyRequest(new Request(`${api}/v1/media`))).not.toThrow();
  });
});
