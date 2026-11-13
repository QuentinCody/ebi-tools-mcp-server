/**
 * Tests for the EBI job submission tool. The EBI API requires a contact email
 * with every job; the default MUST be the public support address, never a
 * personal one (2026-11-12: a personal address was visible in every tool
 * description the fleet served).
 *
 * Only the HTTP layer is replaced. Registration, the tool schema, the error
 * paths and the staging decision are the real ones.
 */

import { McpServer } from "@bio-mcp/shared/mcp";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as http from "../lib/http";
import { registerSubmitJob } from "./submit-job";

afterEach(() => vi.restoreAllMocks());

type Handler = (args: Record<string, unknown>, extra: unknown) => Promise<Record<string, unknown>>;

/** The registered tool, plus the form EBI received. */
function fixture() {
  const server = new McpServer({ name: "fixture", version: "1" });
  registerSubmitJob(server);
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: Handler; description?: string }> })._registeredTools;
  return { tool: tools.ebi_tools_submit_job };
}

function textOf(result: Record<string, unknown>): string {
  return JSON.stringify(result);
}

describe("registerSubmitJob", () => {
  it("registers the tool, and its public description carries no personal address", () => {
    const { tool } = fixture();
    expect(tool).toBeDefined();
    expect(JSON.stringify(tool)).toContain("Submit EBI Tool Job");
    // The default contact address reaches EBI and every tool listing. A
    // personal one must never be in it (the default itself is asserted below).
    expect(JSON.stringify(tool)).not.toMatch(/@gmail\.com/i);
  });

  it("refuses a tool name the registry does not know, and names the ones it has", async () => {
    const { tool } = fixture();
    const result = await tool.handler({ tool_name: "no_such_tool", sequence: "MKV" }, {});
    expect(textOf(result)).toContain("INVALID_TOOL");
    expect(textOf(result)).toContain("ncbiblast");
  });

  it("submits with the default email, polls, and returns the result", async () => {
    const { tool } = fixture();
    const submitted: Record<string, string>[] = [];
    vi.spyOn(http, "ebiSubmitJob").mockImplementation(async (_name: string, form: Record<string, string>) => {
      submitted.push(form);
      return new Response("ebi-job-1", { status: 200 });
    });
    const poll = vi.spyOn(http, "pollJobCompletion").mockResolvedValue(undefined as never);
    vi.spyOn(http, "ebiJobResult").mockResolvedValue(new Response("ATGGCC", { status: 200, headers: { "content-type": "text/plain" } }));

    const result = await tool.handler({ tool_name: "emboss_backtranseq", sequence: "MKV" }, {});
    expect(submitted[0]?.email).toBe("support@quentincody.dev");
    expect(submitted[0]?.sequence).toBe("MKV");
    expect(poll).toHaveBeenCalled();
    expect(textOf(result)).toContain("ebi-job-1");
    expect(textOf(result)).toContain("ATGGCC");
    expect(textOf(result)).toContain("FINISHED");
  });

  it("sends the caller's own email when one is given, and keeps extra parameters", async () => {
    const { tool } = fixture();
    const submitted: Record<string, string>[] = [];
    vi.spyOn(http, "ebiSubmitJob").mockImplementation(async (_name: string, form: Record<string, string>) => {
      submitted.push(form);
      return new Response("ebi-job-2", { status: 200 });
    });
    vi.spyOn(http, "pollJobCompletion").mockResolvedValue(undefined as never);
    vi.spyOn(http, "ebiJobResult").mockResolvedValue(
      new Response(JSON.stringify({ hits: 1 }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    const result = await tool.handler(
      { tool_name: "ncbiblast", sequence: "MKV", email: "lab@example.org", params: { program: "blastp" }, result_type: "json" },
      {},
    );
    expect(submitted[0]?.email).toBe("lab@example.org");
    expect(submitted[0]?.program).toBe("blastp");
    expect(textOf(result)).toContain('"hits":1');
  });

  it("reports the HTTP status and body when EBI refuses the submission", async () => {
    const { tool } = fixture();
    vi.spyOn(http, "ebiSubmitJob").mockResolvedValue(new Response("sequence too long", { status: 400 }));
    const result = await tool.handler({ tool_name: "clustalo", sequence: "MKV" }, {});
    expect(textOf(result)).toContain("API_ERROR");
    expect(textOf(result)).toContain("HTTP 400");
    expect(textOf(result)).toContain("sequence too long");
  });

  it("still reports the status when the refusal body cannot be read", async () => {
    // A body that throws on read must not replace EBI's status with a crash.
    const broken = new Response(null, { status: 503 });
    Object.defineProperty(broken, "text", {
      value: async () => {
        throw new Error("stream closed");
      },
    });
    const { tool } = fixture();
    vi.spyOn(http, "ebiSubmitJob").mockResolvedValue(broken);
    const result = await tool.handler({ tool_name: "clustalo", sequence: "MKV" }, {});
    expect(textOf(result)).toContain("HTTP 503");
  });

  it("reports a failure while reading the result", async () => {
    const { tool } = fixture();
    vi.spyOn(http, "ebiSubmitJob").mockResolvedValue(new Response("ebi-job-3", { status: 200 }));
    vi.spyOn(http, "pollJobCompletion").mockResolvedValue(undefined as never);
    vi.spyOn(http, "ebiJobResult").mockResolvedValue(new Response("gone", { status: 404 }));
    const result = await tool.handler({ tool_name: "clustalo", sequence: "MKV" }, {});
    expect(textOf(result)).toContain("Failed to retrieve results: HTTP 404");
  });

  it("stages a large result in the data object instead of returning it inline", async () => {
    const { tool } = fixture();
    const processed: unknown[] = [];
    const namespace = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (request: Request) => {
          const path = new URL(request.url).pathname;
          if (path === "/process") {
            processed.push(await request.json());
            return Response.json({ success: true, tables_created: ["rows"], total_rows: 1 });
          }
          return Response.json({ success: true });
        },
      }),
    };
    const server = new McpServer({ name: "fixture", version: "1" });
    registerSubmitJob(server, { EBI_TOOLS_DATA_DO: namespace } as unknown as Parameters<typeof registerSubmitJob>[1]);
    const staging = (server as unknown as { _registeredTools: Record<string, { handler: Handler }> })._registeredTools.ebi_tools_submit_job;

    vi.spyOn(http, "ebiSubmitJob").mockResolvedValue(new Response("ebi-job-4", { status: 200 }));
    vi.spyOn(http, "pollJobCompletion").mockResolvedValue(undefined as never);
    vi.spyOn(http, "ebiJobResult").mockResolvedValue(
      new Response("A".repeat(200_000), { status: 200, headers: { "content-type": "text/plain" } }),
    );

    const result = await staging.handler({ tool_name: "clustalo", sequence: "MKV" }, {});
    expect(processed.length).toBeGreaterThan(0);
    expect(textOf(result)).toContain("staged");
    expect(textOf(result)).toContain("ebi_tools_query_data");
    // The whole 200 kB payload must NOT come back inline.
    expect(textOf(result).length).toBeLessThan(100_000);
  });
});
