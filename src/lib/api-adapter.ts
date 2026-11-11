/// <reference types="node" />
import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { ebiFetch, ebiSubmitJob } from "./http";
import { z } from "zod";
import { pollExistingJob } from "./poll";
import { readResponseBytes, decodeResponseText } from "@bio-mcp/shared/http/response-reader";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export function createEbiToolsApiFetch(): ApiFetchFn {
    return async (request) => {
        let response: Response;
        const poll = request.path.match(/^\/([a-z0-9_]+)\/poll\/([A-Za-z0-9_.-]+)$/);
        if (request.method === "GET" && poll) {
            return { status: 200, data: await pollExistingJob(poll[1], poll[2], request.params) };
        }

        if (request.method === "POST") {
            // POST to /{tool}/run — extract tool name from path
            const match = request.path.match(/^\/([a-z0-9_]+)\/run$/);
            if (match) {
                const toolName = match[1];
                const formData: Record<string, string> = {};
                if (typeof request.body === "object" && request.body !== null) {
                    for (const [k, v] of Object.entries(request.body as Record<string, unknown>)) {
                        formData[k] = String(v);
                    }
                }
                z.email().parse(formData.email);
                response = await ebiSubmitJob(toolName, formData);
            } else {
                throw new Error("Job submission requires POST /{tool}/run with a valid email and tool parameters");
            }
        } else if (request.method === "GET") {
            response = await ebiFetch(request.path, request.params);
        } else {
            throw new Error("Job Dispatcher supports GET discovery/status/results and POST /{tool}/run");
        }

        return await decodeDispatcherResponse(response, request.path);
    };
}

async function decodeDispatcherResponse(response: Response, path: string) {
  const bytes = await readResponseBytes(response,{label:"Job Dispatcher",maxBytes:8 * 1024 * 1024,timeoutMs:30_000});
  const contentType = response.headers.get("content-type") || "";
  if (response.ok && /^(application\/(zip|octet-stream|gzip)|image\/(?!svg\+xml))/i.test(contentType)) {
      return {status:response.status,data:{encoding:"base64",media_type:contentType,byte_length:bytes.byteLength,
          sha256:createHash("sha256").update(bytes).digest("hex"),base64:Buffer.from(bytes).toString("base64")}};
  }
  const text = decodeResponseText(bytes,"Job Dispatcher");
  if (!response.ok) {
      const errorBody = text || response.statusText;
      const error = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`) as Error & {
          status: number;
          data: unknown;
      };
      error.status = response.status;
      error.data = errorBody;
      throw error;
  }

  if (!contentType.includes("json")) {
      return { status: response.status, data: text };
  }

  // Dispatcher advertises JSON Lines as application/json. Keep its native
  // text rather than parsing multiple independent records as one document.
  const data = path.endsWith("/jsonl") ? text : JSON.parse(text.replace(/^\uFEFF/, ""));
  return { status: response.status, data };
}
