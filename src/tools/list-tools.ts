import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EBI_TOOLS } from "../lib/tools-registry";
import {
    createCodeModeResponse,
} from "@bio-mcp/shared/codemode/response";

export function registerListTools(server: McpServer) {
    server.registerTool(
        "ebi_tools_list_tools",
        {
            title: "List Available EBI Tools",
            description:
                "List all available EBI bioinformatics tools with their descriptions, categories, and required parameters.",
            inputSchema: {},
        },
        async () => {
            const tools = EBI_TOOLS.map((t) => ({
                name: t.name,
                display_name: t.displayName,
                description: t.description,
                category: t.category,
                result_types: t.resultTypes,
                required_params: t.requiredParams,
                optional_params: t.optionalParams,
            }));

            return createCodeModeResponse(
                { tools, total: tools.length },
                { meta: { fetched_at: new Date().toISOString() } },
            );
        },
    );
}
