import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class EbiToolsDataDO extends RestStagingDO {
    protected getTabularData(value: unknown): unknown {
        if (value && typeof value === "object" && "content" in value && Array.isArray(value.content) &&
            "structuredContent" in value && value.structuredContent && typeof value.structuredContent === "object" && "data" in value.structuredContent) return value.structuredContent.data;
        return value;
    }

    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        if (Array.isArray(data)) {
            const sample = data[0];
            if (sample && typeof sample === "object") {
                // InterProScan results
                if ("signature" in sample || "ipr" in sample) {
                    return {
                        tableName: "interpro_matches",
                        indexes: ["signature_ac", "signature_desc", "ipr_id"],
                    };
                }
                // BLAST hits
                if ("hit_acc" in sample || "hit_id" in sample || "evalue" in sample) {
                    return {
                        tableName: "blast_hits",
                        indexes: ["hit_acc", "hit_desc", "evalue"],
                    };
                }
            }
        }

        return undefined;
    }
}
