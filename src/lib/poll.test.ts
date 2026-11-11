import { afterEach, describe, expect, it, vi } from "vitest";
import { createEbiToolsApiFetch } from "./api-adapter";
import { pollExistingJob } from "./poll";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("bounded Job Dispatcher polling", () => {
  it("waits between status probes and returns the existing completed job", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("RUNNING\n")).mockResolvedValueOnce(new Response("FINISHED\n"));
    vi.stubGlobal("fetch", fetchMock);
    const result = createEbiToolsApiFetch()({ method: "GET", path: "/iprscan6/poll/job-1", params: { max_wait_ms: 10000 } });
    await vi.advanceTimersByTimeAsync(3000);
    expect((await result).data).toMatchObject({ job_id: "job-1", tool: "iprscan6", status: "FINISHED", pending: false, poll_count: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("https://www.ebi.ac.uk/Tools/services/rest/iprscan6/status/job-1", expect.objectContaining({ method: "GET" }));
  });

  it("returns a resumable handle at the deadline without resubmitting", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async () => new Response("PENDING")); vi.stubGlobal("fetch", fetchMock);
    const result = pollExistingJob("iprscan6", "job-2", { max_wait_ms: 6000 });
    await vi.advanceTimersByTimeAsync(6000);
    expect(await result).toMatchObject({ job_id: "job-2", status: "PENDING", pending: true, poll_count: 2, next_poll_after_ms: 3000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not invent an observed state when the wait budget is zero", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await pollExistingJob("iprscan6", "job-3", { max_wait_ms: 0 })).toMatchObject({ status: "UNOBSERVED", poll_count: 0, pending: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["ERROR", "FAILURE", "NOT_FOUND", "unexpected"])("stops on terminal or invalid status %s", async status => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(status)); vi.stubGlobal("fetch", fetchMock);
    await expect(pollExistingJob("iprscan6", "failed-job")).rejects.toThrow(`failed-job returned status ${status}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks HTTP failure before interpreting a response as job state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 400 })));
    await expect(pollExistingJob("iprscan6", "job-4")).rejects.toThrow("HTTP 400");
  });

  it.each([{ max_wait_ms: 20001 }, { interval_ms: 1000 }, { max_wait_ms: -1 }])("rejects unbounded or excessive polling: %j", async params => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(pollExistingJob("iprscan6", "job-5", params)).rejects.toThrow(); expect(fetchMock).not.toHaveBeenCalled();
  });
});

it.each([[200, "NOT_FOUND\n", 502], [400, "native failure\n", 400]] as const)("preserves native HTTP %i and status-body evidence", async (http, body, status) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: http })); vi.stubGlobal("fetch", fetchMock);
  await expect(pollExistingJob("iprscan6", "existing-job")).rejects.toMatchObject({ status,
    data: { job_id: "existing-job", tool: "iprscan6", http_status: http, response: body } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("bounds a stalled status body even when its cancellation never settles", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }))); vi.stubGlobal("fetch", fetchMock);
  const result = expect(pollExistingJob("iprscan6", "existing-job", { max_wait_ms: 1000 })).rejects.toMatchObject({ status: 504 });
  await vi.advanceTimersByTimeAsync(1000); await result;
  expect(cancel).toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(1);
});
