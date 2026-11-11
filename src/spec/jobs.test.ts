import { describe, expect, it } from "vitest";
import { ebiToolsCatalog } from "./catalog";
import { jobEndpoints } from "./jobs";

describe("Dispatcher job discovery", () => {
  it("retains v5 while exposing v6 and the resumable job lifecycle", () => {
    expect(ebiToolsCatalog.endpoints).toEqual(expect.arrayContaining(jobEndpoints));
    expect(ebiToolsCatalog.endpoints.some(e => e.path === "/iprscan5/parameters")).toBe(true);
    expect(ebiToolsCatalog.endpointCount).toBe(ebiToolsCatalog.endpoints.length);
  });
});
