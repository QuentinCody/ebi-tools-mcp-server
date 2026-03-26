import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { ebiToolsCatalog } from "../spec/catalog";
import { createEbiToolsApiFetch } from "../lib/api-adapter";

interface CodeModeEnv {
    EBI_TOOLS_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
}

export function registerCodeMode(
    server: McpServer,
    env: CodeModeEnv,
): void {
    const apiFetch = createEbiToolsApiFetch();

    const searchTool = createSearchTool({
        prefix: "ebi_tools",
        catalog: ebiToolsCatalog,
    });
    searchTool.register(server as unknown as { tool: (...args: unknown[]) => void });

    const executeTool = createExecuteTool({
        prefix: "ebi_tools",
        catalog: ebiToolsCatalog,
        apiFetch,
        doNamespace: env.EBI_TOOLS_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(server as unknown as { tool: (...args: unknown[]) => void });
}
