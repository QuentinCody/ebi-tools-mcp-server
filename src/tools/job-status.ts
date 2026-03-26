import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ebiJobStatus } from "../lib/http";
import {
    createCodeModeResponse,
    createCodeModeError,
} from "@bio-mcp/shared/codemode/response";

export function registerJobStatus(server: McpServer, _env?: unknown): void {
    server.registerTool(
        "ebi_tools_job_status",
        {
            title: "Check EBI Job Status",
            description: "Check the status of a previously submitted EBI tool job.",
            inputSchema: {
                tool_name: z.string().min(1).describe("EBI tool name (e.g. 'ncbiblast', 'iprscan5')"),
                job_id: z.string().min(1).describe("Job ID returned from ebi_tools_submit_job"),
            },
        },
        async (args) => {
            try {
                const toolName = String(args.tool_name).trim();
                const jobId = String(args.job_id).trim();

                const resp = await ebiJobStatus(toolName, jobId);
                const status = (await resp.text()).trim();

                return createCodeModeResponse(
                    { job_id: jobId, tool: toolName, status },
                    { meta: { fetched_at: new Date().toISOString() } },
                );
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return createCodeModeError("API_ERROR", `ebi_tools_job_status failed: ${msg}`);
            }
        },
    );
}
