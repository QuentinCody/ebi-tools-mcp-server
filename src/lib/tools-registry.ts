export interface EbiToolDef {
    name: string;
    displayName: string;
    description: string;
    category: string;
    resultTypes: string[];
    requiredParams: string[];
    optionalParams: { name: string; description: string; default?: string }[];
}

export const EBI_TOOLS: EbiToolDef[] = [
    {
        name: "emboss_backtranseq",
        displayName: "EMBOSS Backtranseq",
        description: "Reverse-translate a protein sequence to a nucleotide sequence using codon usage tables",
        category: "sequence_translation",
        resultTypes: ["out"],
        requiredParams: ["sequence", "email"],
        optionalParams: [
            { name: "codontable", description: "Codon usage table organism", default: "Ehuman" },
        ],
    },
    {
        name: "ncbiblast",
        displayName: "NCBI BLAST",
        description: "Sequence similarity search against NCBI databases",
        category: "sequence_similarity",
        resultTypes: ["out", "xml", "json", "ids"],
        requiredParams: ["sequence", "email", "program", "database", "stype"],
        optionalParams: [
            { name: "program", description: "BLAST program", default: "blastp" },
            { name: "database", description: "Target database", default: "uniprotkb_swissprot" },
            { name: "stype", description: "Sequence type (protein/dna)", default: "protein" },
            { name: "matrix", description: "Scoring matrix", default: "BLOSUM62" },
            { name: "exp", description: "E-value threshold", default: "10" },
        ],
    },
    {
        name: "clustalo",
        displayName: "Clustal Omega",
        description: "Multiple sequence alignment using Clustal Omega",
        category: "alignment",
        resultTypes: ["aln-clustal_num", "aln-fasta", "pim", "phylotree"],
        requiredParams: ["sequence", "email"],
        optionalParams: [
            { name: "stype", description: "Sequence type", default: "protein" },
            { name: "outfmt", description: "Output format", default: "clustal_num" },
        ],
    },
    {
        name: "iprscan5",
        displayName: "InterProScan 5",
        description: "Protein domain and family annotation using InterPro member databases",
        category: "protein_domains",
        resultTypes: ["out", "json", "xml", "tsv", "gff"],
        requiredParams: ["sequence", "email"],
        optionalParams: [
            { name: "stype", description: "Sequence type", default: "protein" },
            { name: "appl", description: "Applications to run (comma-separated)", default: "" },
            { name: "goterms", description: "Include GO terms", default: "true" },
            { name: "pathways", description: "Include pathway annotations", default: "true" },
        ],
    },
    {
        name: "phobius",
        displayName: "Phobius",
        description: "Combined signal peptide and transmembrane topology prediction",
        category: "protein_features",
        resultTypes: ["out", "short"],
        requiredParams: ["sequence", "email"],
        optionalParams: [
            { name: "stype", description: "Sequence type", default: "protein" },
        ],
    },
    {
        name: "mafft",
        displayName: "MAFFT",
        description: "Multiple sequence alignment using MAFFT",
        category: "alignment",
        resultTypes: ["aln-fasta", "aln-clustal", "phylotree"],
        requiredParams: ["sequence", "email"],
        optionalParams: [
            { name: "stype", description: "Sequence type", default: "protein" },
        ],
    },
    {
        name: "muscle",
        displayName: "MUSCLE",
        description: "Multiple sequence alignment using MUSCLE",
        category: "alignment",
        resultTypes: ["aln-fasta", "aln-clustal_num", "pim", "phylotree"],
        requiredParams: ["sequence", "email"],
        optionalParams: [
            { name: "stype", description: "Sequence type", default: "protein" },
        ],
    },
    {
        name: "emboss_water",
        displayName: "EMBOSS Water",
        description: "Smith-Waterman local pairwise sequence alignment",
        category: "alignment",
        resultTypes: ["out", "aln"],
        requiredParams: ["asequence", "bsequence", "email"],
        optionalParams: [
            { name: "stype", description: "Sequence type", default: "protein" },
            { name: "matrix", description: "Scoring matrix", default: "EBLOSUM62" },
        ],
    },
    {
        name: "fasta",
        displayName: "FASTA",
        description: "Sequence similarity search using FASTA",
        category: "sequence_similarity",
        resultTypes: ["out", "ids", "aln"],
        requiredParams: ["sequence", "email", "program", "database", "stype"],
        optionalParams: [
            { name: "program", description: "FASTA program", default: "fasta" },
            { name: "database", description: "Target database", default: "uniprotkb_swissprot" },
            { name: "stype", description: "Sequence type", default: "protein" },
        ],
    },
    {
        name: "radar",
        displayName: "RADAR",
        description: "Detection of internal repeats in protein sequences",
        category: "protein_features",
        resultTypes: ["out"],
        requiredParams: ["sequence", "email"],
        optionalParams: [],
    },
    {
        name: "tcoffee",
        displayName: "T-Coffee",
        description: "Multiple sequence alignment using T-Coffee",
        category: "alignment",
        resultTypes: ["aln-fasta", "aln-clustal_num", "phylotree"],
        requiredParams: ["sequence", "email"],
        optionalParams: [
            { name: "stype", description: "Sequence type", default: "protein" },
        ],
    },
    {
        name: "psisearch",
        displayName: "PSI-Search",
        description: "Iterative protein sequence similarity search using PSI-BLAST",
        category: "sequence_similarity",
        resultTypes: ["out", "ids", "xml"],
        requiredParams: ["sequence", "email", "database"],
        optionalParams: [
            { name: "database", description: "Target database", default: "uniprotkb" },
            { name: "stype", description: "Sequence type", default: "protein" },
        ],
    },
];

export function getToolByName(name: string): EbiToolDef | undefined {
    return EBI_TOOLS.find((t) => t.name === name);
}
