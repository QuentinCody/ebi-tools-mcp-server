/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEbiToolsApiFetch } from "./api-adapter";

afterEach(() => vi.unstubAllGlobals());
const api = createEbiToolsApiFetch();
describe("Dispatcher submission and discovery", () => {
  it.each(["iprscan5", "iprscan6"])("submits one %s job as form data and returns its handle", async tool => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(`${tool}-job`)); vi.stubGlobal("fetch", fetchMock);
    expect(await api({ method: "POST", path: `/${tool}/run`, body: { email: "researcher@example.org", sequence: "ACDE", appl: ["Pfam", "InterPro-N"] } })).toEqual({ status: 200, data: `${tool}-job` });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST"); expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(new URLSearchParams(init.body).get("appl")).toBe("Pfam,InterPro-N");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { method: "POST", path: "/iprscan6/run", body: { sequence: "ACDE" } },
    { method: "POST", path: "/iprscan6/run/extra", body: { email: "researcher@example.org" } },
    { method: "POST", path: "/iprscan6/parameters", body: {} },
    { method: "DELETE", path: "/iprscan6/run" },
  ])("rejects invalid submissions before network access: %j", async request => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(api(request)).rejects.toThrow(); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves current application discovery JSON", async () => {
    const data = { values: { values: [{ value: "InterPro-N" }, { value: "Pfam" }] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
    expect((await api({ method: "GET", path: "/iprscan6/parameterdetails/appl" })).data).toEqual(data);
  });

  it("does not retry a failed submission, avoiding duplicate jobs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })); vi.stubGlobal("fetch", fetchMock);
    await expect(api({ method: "POST", path: "/iprscan6/run", body: { email: "researcher@example.org", sequence: "ACDE" } })).rejects.toThrow("HTTP 503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

it("retains exact binary bytes and a raw-byte hash for ZIP downloads", async () => {
  const { createHash } = await import("node:crypto");
  const native = new Uint8Array([80, 75, 3, 4, 0, 255, 128, 10]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(native, { headers: { "content-type": "application/zip" } })));
  const { data } = await api({ method: "GET", path: "/iprscan6/result/job-1/zip" });
  expect(data).toEqual({ encoding: "base64", media_type: "application/zip", byte_length: native.length,
    sha256: createHash("sha256").update(native).digest("hex"), base64: Buffer.from(native).toString("base64") });
});

it("keeps multiple JSON Lines records and BOM as native text", async () => {
  const native = '\uFEFF{"md5":"001"}\r\n{"md5":"002","value":null}\n';
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(native, { headers: { "content-type": "application/json" } })));
  expect((await api({ method: "GET", path: "/iprscan6/result/job-1/jsonl" })).data).toBe(native);
});

it("keeps the full native error body while bounding the error message", async () => {
  const native = "α🧬".repeat(20000);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(native, { status: 400 })));
  await expect(api({ method: "GET", path: "/iprscan6/result/job-1/json" })).rejects.toMatchObject({ status: 400, data: native });
});

it("rejects an advertised oversized download before reading it", async () => {
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { "content-length": "8388609" } })));
  await expect(api({ method: "GET", path: "/iprscan6/result/job-1/zip" })).rejects.toMatchObject({ status: 413 });
  expect(cancel).toHaveBeenCalled();
});
