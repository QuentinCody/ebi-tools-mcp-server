# Ebi Tools MCP Server

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets MCP clients (Claude Desktop, Claude Code, Continue, etc.) query the upstream Ebi Tools API in natural language. It is one of 100+ servers in the [Bio MCP](../../README.md) monorepo.

## Connect

The server is deployed and ready at:

```
https://ebi-tools-mcp-server.quentincody.workers.dev/mcp
```

Add it to your MCP client (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "ebi-tools": {
      "command": "npx",
      "args": ["mcp-remote", "https://ebi-tools-mcp-server.quentincody.workers.dev/mcp"]
    }
  }
}
```

For local development the server runs at `http://localhost:8842/mcp` (start it with `./scripts/dev-servers.sh ebi-tools`):

```json
{
  "mcpServers": {
    "ebi-tools-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8842/mcp"]
    }
  }
}
```

## Tools

- `ebi_tools_search` — discover available API operations, including both InterProScan versions and job lifecycle routes
- `ebi_tools_execute` — **Code Mode**: write JavaScript in a V8 isolate (`api.get()` / `api.post()` / `searchSpec()`) instead of issuing tool calls one by one
- `ebi_tools_query_data` — run SQL over large responses auto-staged into a per-session SQLite database
- `ebi_tools_get_schema` — inspect the inferred schema of a staged dataset

Large responses (>30KB) are auto-staged into a queryable SQLite database; the tools return a `data_access_id` you can query with SQL.

Every tool returns both a human-readable `content` summary and a structured `structuredContent` payload.

All four tools also have `mcp_` aliases. Complete tool responses, including
composed Code Mode results and SQL/schema output, stage above 30 KiB measured
in UTF-8. The staged `payloads` table retains the original response and its
citation; the returned citation hashes that complete stored response. Missing
or unavailable staging storage produces an explicit bounded error.

## InterProScan 6 and resumable jobs

The public Dispatcher exposes both `iprscan5` and `iprscan6`. Discover `/{tool}/parameters` and `/{tool}/parameterdetails/appl` before submitting: application identifiers differ, and v6 includes `InterPro-N`. Its `stype` accepts `p` or `n`, not the word `protein`. Full local InterProScan 6 Nextflow execution requires external compute.

Use `interpro_execute` with `/matches` or `/matches/sequence` to retrieve cached matches first. Keep InterPro-N predictions separate from member-database signatures. A sequence cache miss can be followed by a Dispatcher submission; missing individual matches do not by themselves establish that an analysis was not run.

Submit once in `ebi_tools_execute`, using your valid email:

```js
return await api.post('/iprscan6/run', {
  email: 'your.email@example.org', sequence: 'YOUR_PROTEIN_SEQUENCE',
  stype: 'p', appl: 'Pfam,InterPro-N'
}); // returns the job ID; save it
```

In a later call, replace `JOB_ID` with that handle:

```js
const progress = await api.get('/iprscan6/poll/JOB_ID', {
  max_wait_ms: 10000, interval_ms: 3000
});
if (progress.pending) return progress; // resume this handle later; do not resubmit
return await api.get('/iprscan6/resulttypes/JOB_ID');
```

Retrieve a listed format with `/iprscan6/result/JOB_ID/FORMAT`. Polling is capped at 20 seconds per call with at least three seconds between requests; it reports pending work without creating another job. HTTP and terminal job failures remain errors. Submissions have a 30-second timeout and are not automatically retried, because their outcome can be unknown after a network failure. Code Mode requires an explicit email.

Result bodies have an 8 MiB limit and a 30-second read budget. ZIP and other
binary outputs return `{encoding:"base64", media_type, byte_length, sha256,
base64}`; `sha256` hashes the original bytes. JSON Lines stay native text even
when Dispatcher advertises `application/json`. Text keeps its original line
endings and BOM. Oversized, stalled or invalid UTF-8 text responses fail
explicitly. Poll failures retain the native HTTP status and body, including
HTTP 200 `NOT_FOUND` responses.

October 3 native/local acceptance verifies both aliases, v5/v6 application and
sequence-type discovery, and recovery of an existing completed v6 job. JSON,
JSON Lines, TSV, XML, GFF/GFF3, FASTA and ZIP match native responses. The job
reports InterProScan 6.0.2.2 and InterPro 110.0. No new job was submitted for this
acceptance run. Large result and error recovery, SQLite projection and small
SQL/schema citations are covered by behavioral tests.

The [provider fair-use policy](https://ebi-biows.gitdocs.ebi.ac.uk/documentation/webservices/) permits batches of at most 30 active jobs, with processing/results completed before the next batch. Account-wide concurrency is the caller's responsibility; this adapter does not enforce a global queue.

## Development

```bash
./scripts/dev-servers.sh ebi-tools            # run locally (port 8842)
pnpm --filter ebi-tools-mcp-server run deploy   # deploy to Cloudflare Workers
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the root [README](../../README.md) for the full architecture (Code Mode, staging, portals).

---

*Auto-generated baseline README — refine with server-specific detail as needed.*

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from EMBL-EBI Job Dispatcher and stays under the terms of that source: EMBL-EBI terms (no extra restrictions); fair use.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
