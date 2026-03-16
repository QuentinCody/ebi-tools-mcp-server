import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ebiJobResult } from "../lib/http";
import {
    createCodeModeResponse,
    createCodeModeError,
} from "@bio-mcp/shared/codemode/response";
import { shouldStage, stageToDoAndRespond } from "@bio-mcp/shared/staging/utils";

interface ResultEnv {
    EBI_TOOLS_DATA_DO?: {
        idFromName(name: string): unknown;
        get(id: unknown): { fetch(req: Request): Promise<Response> };
    };
}

export function registerJobResult(server: McpServer, env?: ResultEnv) {
    server.registerTool(
        "ebi_tools_job_result",
        {
            title: "Get EBI Job Result",
            description: "Retrieve results from a completed EBI tool job by result type.",
            inputSchema: {
                tool_name: z.string().min(1).describe("EBI tool name"),
                job_id: z.string().min(1).describe("Job ID"),
                result_type: z
                    .string()
                    .default("out")
                    .optional()
                    .describe("Result type (e.g. 'out', 'json', 'xml', 'tsv', 'ids')"),
            },
        },
        async (args, extra) => {
            const runtimeEnv = env || (extra as { env?: ResultEnv })?.env;
            try {
                const toolName = String(args.tool_name).trim();
                const jobId = String(args.job_id).trim();
                const resultType = String(args.result_type || "out");

                const resp = await ebiJobResult(toolName, jobId, resultType);
                if (!resp.ok) {
                    throw new Error(`Failed to retrieve results: HTTP ${resp.status}`);
                }

                const contentType = resp.headers.get("content-type") || "";
                let resultData: unknown;

                if (contentType.includes("json")) {
                    resultData = await resp.json();
                } else {
                    const text = await resp.text();
                    resultData = { format: resultType, content: text };
                }

                const responseSize = JSON.stringify(resultData).length;
                if (shouldStage(responseSize) && runtimeEnv?.EBI_TOOLS_DATA_DO) {
                    const staged = await stageToDoAndRespond(
                        resultData,
                        runtimeEnv.EBI_TOOLS_DATA_DO as any,
                        `${toolName}_result`,
                        undefined,
                        undefined,
                        "ebi_tools",
                        (extra as { sessionId?: string })?.sessionId,
                    );
                    return createCodeModeResponse(
                        {
                            staged: true,
                            data_access_id: staged.dataAccessId,
                            total_rows: staged.totalRows,
                            _staging: staged._staging,
                            message: `Results staged. Use ebi_tools_query_data with data_access_id '${staged.dataAccessId}' to query.`,
                        },
                        { meta: { staged: true, data_access_id: staged.dataAccessId } },
                    );
                }

                return createCodeModeResponse(
                    { job_id: jobId, tool: toolName, result_type: resultType, result: resultData },
                    { meta: { fetched_at: new Date().toISOString() } },
                );
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return createCodeModeError("API_ERROR", `ebi_tools_job_result failed: ${msg}`);
            }
        },
    );
}
