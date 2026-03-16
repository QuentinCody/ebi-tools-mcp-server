import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const ebiToolsCatalog: ApiCatalog = {
    name: "EBI Job Dispatcher",
    baseUrl: "https://www.ebi.ac.uk/Tools/services/rest",
    version: "1.0",
    auth: "none (email required for job submission)",
    endpointCount: 36,
    notes:
        "- All tools follow the same pattern: POST /run → GET /status/{jobId} → GET /result/{jobId}/{type}\n" +
        "- Job submission requires an email parameter\n" +
        "- For job submission and polling, prefer the hand-built ebi_tools_submit_job tool\n" +
        "- These Code Mode endpoints are for exploring tool parameters and available result types\n" +
        "- Sequence input: FASTA format or plain sequence\n" +
        "- Jobs typically complete in 1-60 seconds depending on the tool",
    endpoints: [
        // === Tool Parameter Info ===
        {
            method: "GET",
            path: "/emboss_backtranseq/parameters",
            summary: "List parameters for EMBOSS Backtranseq (reverse translation)",
            category: "reverse_translation",
        },
        {
            method: "GET",
            path: "/emboss_backtranseq/parameterdetails/{parameterId}",
            summary: "Get details for a specific Backtranseq parameter",
            category: "reverse_translation",
            pathParams: [
                { name: "parameterId", type: "string", required: true, description: "Parameter name (e.g. 'codontable', 'sequence')" },
            ],
        },
        // === BLAST ===
        {
            method: "GET",
            path: "/ncbiblast/parameters",
            summary: "List parameters for NCBI BLAST",
            category: "sequence_similarity",
        },
        {
            method: "GET",
            path: "/ncbiblast/parameterdetails/{parameterId}",
            summary: "Get details for a BLAST parameter (e.g. available databases)",
            category: "sequence_similarity",
            pathParams: [
                { name: "parameterId", type: "string", required: true, description: "Parameter name (e.g. 'program', 'database', 'matrix')" },
            ],
        },
        // === Clustal Omega ===
        {
            method: "GET",
            path: "/clustalo/parameters",
            summary: "List parameters for Clustal Omega multiple alignment",
            category: "alignment",
        },
        {
            method: "GET",
            path: "/clustalo/parameterdetails/{parameterId}",
            summary: "Get details for a Clustal Omega parameter",
            category: "alignment",
            pathParams: [
                { name: "parameterId", type: "string", required: true, description: "Parameter name" },
            ],
        },
        // === InterProScan ===
        {
            method: "GET",
            path: "/iprscan5/parameters",
            summary: "List parameters for InterProScan 5 (protein domain annotation)",
            category: "protein_domains",
        },
        {
            method: "GET",
            path: "/iprscan5/parameterdetails/{parameterId}",
            summary: "Get details for an InterProScan parameter",
            category: "protein_domains",
            pathParams: [
                { name: "parameterId", type: "string", required: true, description: "Parameter name (e.g. 'appl' for application list)" },
            ],
        },
        // === Phobius ===
        {
            method: "GET",
            path: "/phobius/parameters",
            summary: "List parameters for Phobius (signal peptide + TM prediction)",
            category: "protein_features",
        },
        // === MAFFT ===
        {
            method: "GET",
            path: "/mafft/parameters",
            summary: "List parameters for MAFFT multiple alignment",
            category: "alignment",
        },
        // === MUSCLE ===
        {
            method: "GET",
            path: "/muscle/parameters",
            summary: "List parameters for MUSCLE multiple alignment",
            category: "alignment",
        },
        // === FASTA ===
        {
            method: "GET",
            path: "/fasta/parameters",
            summary: "List parameters for FASTA similarity search",
            category: "sequence_similarity",
        },
        // === RADAR ===
        {
            method: "GET",
            path: "/radar/parameters",
            summary: "List parameters for RADAR internal repeat detection",
            category: "protein_features",
        },
        // === T-Coffee ===
        {
            method: "GET",
            path: "/tcoffee/parameters",
            summary: "List parameters for T-Coffee multiple alignment",
            category: "alignment",
        },
        // === EMBOSS Water ===
        {
            method: "GET",
            path: "/emboss_water/parameters",
            summary: "List parameters for EMBOSS Water (local pairwise alignment)",
            category: "alignment",
        },
        // === PSI-Search ===
        {
            method: "GET",
            path: "/psisearch/parameters",
            summary: "List parameters for PSI-Search (iterative BLAST)",
            category: "sequence_similarity",
        },
        // === Result Type Info ===
        {
            method: "GET",
            path: "/ncbiblast/resulttypes/{jobId}",
            summary: "List available result types for a completed BLAST job",
            category: "results",
            pathParams: [
                { name: "jobId", type: "string", required: true, description: "Job ID" },
            ],
        },
        {
            method: "GET",
            path: "/iprscan5/resulttypes/{jobId}",
            summary: "List available result types for a completed InterProScan job",
            category: "results",
            pathParams: [
                { name: "jobId", type: "string", required: true, description: "Job ID" },
            ],
        },
    ],
};
