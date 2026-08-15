export const INGESTION_BRIDGE_VERSION = "1.0" as const;

export type ImportedApprovalStage =
  | "pre_approval"
  | "approved"
  | "denied"
  | "withdrawn"
  | "unknown";

export type NationwideIngestionRecord = {
  externalRecordId: string;
  marketId: string;
  jurisdiction: string;
  approvalStage: ImportedApprovalStage;
  applicationNumber?: string | null;
  permitNumber?: string | null;
  permitType: string;
  permitSubtype?: string | null;
  workClass?: string | null;
  proposedUse?: string | null;
  occupancyType?: string | null;
  status?: string | null;
  description: string;
  projectName?: string | null;
  location?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    parcelId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  parties?: {
    applicant?: string | null;
    owner?: string | null;
    developer?: string | null;
    contractor?: string | null;
    architect?: string | null;
    engineer?: string | null;
  };
  dates?: {
    filedAt?: string | null;
    statusUpdatedAt?: string | null;
    approvedAt?: string | null;
    issuedAt?: string | null;
    completedAt?: string | null;
  };
  evidence: {
    recordUrl: string;
    pageUrl?: string | null;
    excerpt: string;
    publishedAt?: string | null;
    accessedAt: string;
  };
  confidence: number;
  attributes?: Record<string, unknown>;
};

export type NationwideIngestionBatch = {
  version: typeof INGESTION_BRIDGE_VERSION;
  batchId: string;
  generatedAt: string;
  source: {
    key: string;
    name: string;
    jurisdiction?: string | null;
    sourceUrl: string;
  };
  records: NationwideIngestionRecord[];
};

export type NationwideImportResult = {
  batchId: string;
  runId: string;
  sourceKey: string;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
};
