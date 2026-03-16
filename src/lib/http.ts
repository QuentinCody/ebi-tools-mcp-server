import { restFetch } from "@bio-mcp/shared/http/rest-fetch";
import type { RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const EBI_TOOLS_BASE = "https://www.ebi.ac.uk/Tools/services/rest";

export interface EbiFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    baseUrl?: string;
}

/**
 * GET from an EBI tool endpoint.
 */
export async function ebiFetch(
    path: string,
    params?: Record<string, unknown>,
    opts?: EbiFetchOptions,
): Promise<Response> {
    const baseUrl = opts?.baseUrl ?? EBI_TOOLS_BASE;
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(opts?.headers ?? {}),
    };

    return restFetch(baseUrl, path, params, {
        ...opts,
        headers,
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 3,
        timeout: opts?.timeout ?? 30_000,
        userAgent: "ebi-tools-mcp-server/1.0 (bio-mcp)",
    });
}

/**
 * POST to submit a job to an EBI tool.
 * Uses form-urlencoded body as required by the API.
 */
export async function ebiSubmitJob(
    toolName: string,
    formData: Record<string, string>,
    opts?: EbiFetchOptions,
): Promise<Response> {
    const baseUrl = opts?.baseUrl ?? EBI_TOOLS_BASE;
    const body = new URLSearchParams(formData);

    return restFetch(baseUrl, `/${toolName}/run`, undefined, {
        ...opts,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "text/plain",
            ...(opts?.headers ?? {}),
        },
        rawBody: body.toString(),
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 2,
        timeout: opts?.timeout ?? 60_000,
        userAgent: "ebi-tools-mcp-server/1.0 (bio-mcp)",
    });
}

/**
 * Check job status.
 */
export async function ebiJobStatus(
    toolName: string,
    jobId: string,
    opts?: EbiFetchOptions,
): Promise<Response> {
    return ebiFetch(`/${toolName}/status/${jobId}`, undefined, {
        ...opts,
        headers: { Accept: "text/plain", ...(opts?.headers ?? {}) },
    });
}

/**
 * Get job result by type.
 */
export async function ebiJobResult(
    toolName: string,
    jobId: string,
    resultType: string,
    opts?: EbiFetchOptions,
): Promise<Response> {
    return ebiFetch(`/${toolName}/result/${jobId}/${resultType}`, undefined, opts);
}

/**
 * Poll for job completion with timeout.
 */
export async function pollJobCompletion(
    toolName: string,
    jobId: string,
    maxWaitMs = 120_000,
    intervalMs = 3_000,
): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const resp = await ebiJobStatus(toolName, jobId);
        const status = await resp.text();
        const s = status.trim();
        if (s === "FINISHED") return "FINISHED";
        if (s === "ERROR" || s === "FAILURE" || s === "NOT_FOUND") {
            throw new Error(`Job ${jobId} failed with status: ${s}`);
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Job ${jobId} timed out after ${maxWaitMs / 1000}s`);
}
