import { z } from "zod";
import { ebiJobStatus } from "./http";
import { readResponseBytes, decodeResponseText } from "@bio-mcp/shared/http/response-reader";

const polling = z.object({
  max_wait_ms: z.coerce.number().int().min(0).max(20_000).default(10_000),
  interval_ms: z.coerce.number().int().min(3_000).max(10_000).default(3_000),
});
interface JobProgress { job_id: string; tool: string; status: string; pending: boolean; poll_count: number; next_poll_after_ms?: number }

/** Bounded observation of an existing job; never submits or restarts a job. */
export async function pollExistingJob(tool: string, jobId: string, params?: Record<string, unknown>): Promise<JobProgress> {
  const options = polling.parse(params ?? {});
  const deadline = Date.now() + options.max_wait_ms;
  let status = "UNOBSERVED";
  let count = 0;
  while (Date.now() < deadline) {
    const response = await ebiJobStatus(tool, jobId, { timeout: Math.max(1, deadline - Date.now()), retries: 0 });
    const text = decodeResponseText(await readResponseBytes(response,{label:"Job Dispatcher status",maxBytes:64 * 1024,timeoutMs:deadline - Date.now()}),"Job Dispatcher status");
    const evidence = {job_id:jobId,tool,http_status:response.status,response:text};
    if (!response.ok) throw Object.assign(new Error(`Status for ${jobId} returned HTTP ${response.status}`),{status:response.status,data:evidence});
    status = text.trim();
    count += 1;
    if (status === "FINISHED") return { job_id: jobId, tool, status, pending: false, poll_count: count };
    if (!["PENDING", "RUNNING", "QUEUED"].includes(status)) throw Object.assign(new Error(`Job ${jobId} returned status ${status.slice(0,200)}`),{status:502,data:evidence});
    const remaining = deadline - Date.now();
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(options.interval_ms, remaining)));
  }
  return { job_id: jobId, tool, status, pending: true, poll_count: count, next_poll_after_ms: options.interval_ms };
}
