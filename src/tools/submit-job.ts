import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ebiSubmitJob, pollJobCompletion, ebiJobResult } from "../lib/http";
import { getToolByName, EBI_TOOLS } from "../lib/tools-registry";
import {
    createCodeModeResponse,
    createCodeModeError,
} from "@bio-mcp/shared/codemode/response";
import { shouldStage, stageToDoAndRespond } from "@bio-mcp/shared/staging/utils";

const DEFAULT_EMAIL = "QuentinCody@gmail.com";

interface SubmitEnv {
    EBI_TOOLS_DATA_DO?: {
        idFromName(name: string): unknown;
        get(id: unknown): { fetch(req: Request): Promise<Response> };
    };
}

export function registerSubmitJob(server: McpServer, env?: SubmitEnv) {
    server.registerTool(
        "ebi_tools_submit_job",
        {
            title: "Submit EBI Tool Job",
            description:
                "Submit a job to an EBI bioinformatics tool (BLAST, Clustal Omega, InterProScan, reverse translation, etc.). " +
                "The job runs synchronously — this tool submits, polls for completion, and returns results. " +
                "Available tools: emboss_backtranseq, ncbiblast, clustalo, iprscan5, phobius, mafft, muscle, emboss_water, fasta, radar, tcoffee, psisearch",
            inputSchema: {
                tool_name: z
                    .string()
                    .min(1)
                    .describe("EBI tool name (e.g. 'emboss_backtranseq', 'ncbiblast', 'clustalo', 'iprscan5', 'phobius')"),
                sequence: z
                    .string()
                    .min(1)
                    .describe("Input sequence (FASTA format or plain sequence). For pairwise tools use 'asequence' param instead."),
                email: z
                    .string()
                    .email()
                    .optional()
                    .describe(`Email address for EBI API policy (default: ${DEFAULT_EMAIL})`),
                params: z
                    .record(z.string(), z.string())
                    .optional()
                    .describe("Additional tool-specific parameters as key-value pairs (e.g. {\"program\": \"blastp\", \"database\": \"uniprotkb_swissprot\"})"),
                result_type: z
                    .string()
                    .default("out")
                    .optional()
                    .describe("Result type to retrieve (default: 'out'). Common: 'out', 'json', 'xml', 'tsv', 'ids'"),
                max_wait_seconds: z
                    .number()
                    .int()
                    .min(10)
                    .max(300)
                    .default(120)
                    .optional()
                    .describe("Maximum seconds to wait for job completion (default: 120)"),
            },
        },
        async (args, extra) => {
            const runtimeEnv = env || (extra as { env?: SubmitEnv })?.env;
            try {
                const toolName = String(args.tool_name).trim();
                const toolDef = getToolByName(toolName);
                if (!toolDef) {
                    const available = EBI_TOOLS.map((t) => t.name).join(", ");
                    return createCodeModeError("INVALID_TOOL", `Unknown tool '${toolName}'. Available: ${available}`);
                }

                const formData: Record<string, string> = {
                    email: String(args.email || DEFAULT_EMAIL),
                    sequence: String(args.sequence),
                    ...(args.params as Record<string, string> || {}),
                };

                // Submit job
                const submitResp = await ebiSubmitJob(toolName, formData);
                if (!submitResp.ok) {
                    const body = await submitResp.text().catch(() => "");
                    throw new Error(`Job submission failed: HTTP ${submitResp.status}${body ? ` - ${body.slice(0, 300)}` : ""}`);
                }
                const jobId = (await submitResp.text()).trim();

                // Poll for completion
                const maxWaitMs = ((args.max_wait_seconds as number) || 120) * 1000;
                await pollJobCompletion(toolName, jobId, maxWaitMs);

                // Get result
                const resultType = String(args.result_type || "out");
                const resultResp = await ebiJobResult(toolName, jobId, resultType);
                if (!resultResp.ok) {
                    throw new Error(`Failed to retrieve results: HTTP ${resultResp.status}`);
                }

                const contentType = resultResp.headers.get("content-type") || "";
                let resultData: unknown;

                if (contentType.includes("json")) {
                    resultData = await resultResp.json();
                } else {
                    const text = await resultResp.text();
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
                            job_id: jobId,
                            tool: toolName,
                            message: `${toolDef.displayName} results staged. Use ebi_tools_query_data with data_access_id '${staged.dataAccessId}' to query.`,
                        },
                        { meta: { staged: true, data_access_id: staged.dataAccessId } },
                    );
                }

                return createCodeModeResponse(
                    {
                        job_id: jobId,
                        tool: toolName,
                        status: "FINISHED",
                        result_type: resultType,
                        result: resultData,
                    },
                    { meta: { fetched_at: new Date().toISOString(), job_id: jobId, tool: toolName } },
                );
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return createCodeModeError("API_ERROR", `ebi_tools_submit_job failed: ${msg}`);
            }
        },
    );
}
