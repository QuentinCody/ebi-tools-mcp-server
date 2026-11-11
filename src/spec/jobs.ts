import type { ApiEndpoint, ParamDef } from "@bio-mcp/shared/codemode/catalog";

const jobParams: ParamDef[] = [
  { name: "tool", type: "string", required: true, description: "Dispatcher tool name, e.g. iprscan6, iprscan5 or clustalo" },
  { name: "jobId", type: "string", required: true, description: "Exact handle returned by submission; retain it for later polling/results" },
];

export const jobNotes =
  "- InterProScan: both /iprscan5 and /iprscan6 discovery respond; v6 includes InterPro-N. Discover /iprscan6/parameterdetails/appl instead of reusing v5 application spellings. Full local Nextflow workflows require external compute.\n" +
  "- First use interpro_execute POST /matches or /matches/sequence for cached sequence matches. Keep InterPro-N predictions distinct from signature/curated evidence. A cache miss can justify a compute job; absence of a particular match does not prove an analysis was not run.\n" +
  "- Submit once with POST /{tool}/run and an explicit valid email. No email is auto-filled in Code Mode. A transport failure during submission has an unknown outcome: do not blindly retry and duplicate work.\n" +
  "- Provider fair use: at most 30 jobs in an active batch; wait for their processing/results before submitting the next batch. The adapter does not track account-wide concurrency.\n" +
  "- Poll an existing handle with GET /{tool}/poll/{jobId}, max_wait_ms <= 20000 and interval_ms >= 3000. pending:true means resume polling the same handle in a later call; never resubmit it. Jobs may take longer than a Code Mode execution.\n" +
  "- Result bodies are bounded to 8 MiB. Binary outputs return {encoding:\"base64\",media_type,byte_length,sha256,base64} with a hash of native bytes; JSON Lines remain native text even when advertised as application/json.\n" +
  "- Once FINISHED, discover /{tool}/resulttypes/{jobId} and fetch the supported /result/{jobId}/{type}. Preserve version/source metadata in returned result formats.\n";

export const jobEndpoints: ApiEndpoint[] = [
  { method: "GET", path: "/iprscan6/parameters", summary: "Discover the supported InterProScan 6 submission parameters", category: "protein_domains" },
  {
    method: "GET", path: "/iprscan6/parameterdetails/{parameterId}", summary: "Discover InterProScan 6 applications, including InterPro-N, and parameter values", category: "protein_domains",
    pathParams: [{ name: "parameterId", type: "string", required: true, description: "Parameter name; appl lists current application identifiers" }],
    example: "return await api.get('/iprscan6/parameterdetails/appl');",
  },
  {
    method: "POST", path: "/{tool}/run", summary: "Submit one asynchronous analysis; returns the job ID as a string", category: "jobs",
    pathParams: [jobParams[0]], body: { contentType: "application/json", description: "Code Mode object converted to form-urlencoded upstream: {email, sequence, ...tool parameters}. Email is required. For iprscan6 use stype:'p' (protein) or 'n' (nucleotide) and discover appl values." },
  },
  { method: "GET", path: "/{tool}/status/{jobId}", summary: "Read one job status without polling", category: "jobs", pathParams: jobParams },
  {
    method: "GET", path: "/{tool}/poll/{jobId}", summary: "Local bounded polling helper; returns progress and the existing handle for later resumption", category: "jobs", pathParams: jobParams,
    queryParams: [
      { name: "max_wait_ms", type: "number", required: false, description: "0–20000 milliseconds; default 10000. Zero returns UNOBSERVED without a status request." },
      { name: "interval_ms", type: "number", required: false, description: "3000–10000 milliseconds between observations; default 3000" },
    ],
    example: "return await api.get('/iprscan6/poll/JOB_ID', {max_wait_ms:10000, interval_ms:3000});",
  },
  { method: "GET", path: "/{tool}/resulttypes/{jobId}", summary: "Discover available output identifiers for a completed job", category: "results", pathParams: jobParams },
  {
    method: "GET", path: "/{tool}/result/{jobId}/{type}", summary: "Retrieve a completed analysis in a discovered output format; large responses stage automatically", category: "results",
    pathParams: [...jobParams, { name: "type", type: "string", required: true, description: "Output identifier from resulttypes; do not assume all tools share formats" }],
  },
];
