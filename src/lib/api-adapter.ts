import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { ebiFetch, ebiSubmitJob } from "./http";

export function createEbiToolsApiFetch(): ApiFetchFn {
    return async (request) => {
        let response: Response;

        if (request.method === "POST" && request.body) {
            // POST to /{tool}/run — extract tool name from path
            const match = request.path.match(/^\/([^/]+)\/run/);
            if (match) {
                const toolName = match[1];
                const formData: Record<string, string> = {};
                if (typeof request.body === "object" && request.body !== null) {
                    for (const [k, v] of Object.entries(request.body as Record<string, unknown>)) {
                        formData[k] = String(v);
                    }
                }
                response = await ebiSubmitJob(toolName, formData);
            } else {
                // Fallback: treat as GET with params
                response = await ebiFetch(request.path, request.params);
            }
        } else {
            response = await ebiFetch(request.path, request.params);
        }

        if (!response.ok) {
            let errorBody: string;
            try {
                errorBody = await response.text();
            } catch {
                errorBody = response.statusText;
            }
            const error = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = errorBody;
            throw error;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            const text = await response.text();
            return { status: response.status, data: text };
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
