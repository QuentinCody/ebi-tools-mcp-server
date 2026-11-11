import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { ebiToolsCatalog } from "../spec/catalog";
import { createEbiToolsApiFetch } from "../lib/api-adapter";
import { ebiToolsResponse } from "../lib/tool-result";

interface CodeModeEnv {
    EBI_TOOLS_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
}

export function registerCodeMode(
    server: McpServer,
    env: CodeModeEnv,
): void {
    const apiFetch = createEbiToolsApiFetch();
    const registrar = { tool: (...args: unknown[]) => {
        const [name, ...rest] = args;
        // SAFETY: shared factories supply the SDK handler and registration arguments.
        const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof ebiToolsResponse>;
        const respond = (input: unknown, extra: unknown) => ebiToolsResponse(() => handler(input, extra), env, String(name), extra, input);
        const register = server.tool.bind(server) as (...values: unknown[]) => void;
        register(name, ...rest, respond);
        register(`mcp_${String(name)}`, ...rest, respond);
    } };

    const searchTool = createSearchTool({
        prefix: "ebi_tools",
        catalog: ebiToolsCatalog,
    });
    searchTool.register(registrar);

    const executeTool = createExecuteTool({
        prefix: "ebi_tools",
        // Verifiable provenance: ebi_tools_execute results carry a _meta.citation.
        source: { id: "ebi_tools", name: "EMBL-EBI Job Dispatcher", url: "https://www.ebi.ac.uk/jdispatcher" },
        catalog: ebiToolsCatalog,
        apiFetch,
        maxInlineBytes: 30 * 1024,
        stagingThreshold: 30 * 1024,
        preserveApiErrors: true,
        timeout: 45_000,
        doNamespace: env.EBI_TOOLS_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(registrar);
}
