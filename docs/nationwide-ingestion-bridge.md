# Nationwide ingestion bridge

## Purpose

The nationwide ingestion engine fetches and normalizes jurisdiction-specific records. The Vercel
application ranks opportunities, persists user-facing evidence, and projects records into the
knowledge graph. The bridge is the versioned contract between those services.

This boundary intentionally keeps source-specific permit rules out of the opportunity and graph
layers. The same contract can carry building permits, planning applications, entitlement filings,
and other development records as long as the producing service maps them to the canonical fields.

## Endpoint and authentication

`POST /api/internal/ingestion/import` accepts contract version `1.0` in batches of up to 500
records. The producer sends `Authorization: Bearer <INGESTION_BRIDGE_SECRET>` over HTTPS. The
Vercel application rejects imports when the secret is missing, the version is unsupported, or a
record fails validation. Every batch is scoped to one source and one market so source health and
opportunity conversion remain attributable.

Use a dedicated `INGESTION_BRIDGE_SECRET`; do not reuse an operator password, API key, or the
Vercel cron secret. Rotate the producer and receiver values together.

## Canonical record

Each record includes:

- stable source key and external record ID
- market and jurisdiction
- explicit lifecycle stage: `pre_approval`, `approved`, `denied`, `withdrawn`, or `unknown`
- application/permit identity, type, status, project description, and proposed use
- address, parcel, coordinates, and jurisdictional location
- applicant, developer, owner, contractor, architect, and engineer when supplied by the source
- filed, status-change, approval, issuance, and completion timestamps
- direct source URL, page URL, evidence excerpt, access time, and confidence
- provider-neutral attributes for fields not yet promoted into the canonical contract

The receiver uses the source key plus external record ID as the durable identity. Replaying a
batch updates the existing record instead of creating a duplicate. Public permit/application
numbers remain the labels shown to users.

## Graph projection

Imported records flow through the existing opportunity generator. Opening an opportunity builds
evidence-backed relationships among the opportunity, permit, property, parcel, city, developer,
owner, contractor, architect, and engineer. Every relationship keeps confidence, provenance,
source evidence, creation time, and last-verified time through the existing graph service.

## Scaling path

Version 1 uses bounded HTTPS batches because it is simple to operate and sufficient for initial
enterprise pilots. The contract is transport-independent. Higher volume can move to object storage
manifests or a queue while retaining the same record schema and idempotency keys.

Near-term controls:

1. Add per-source import metrics and dead-letter storage.
2. Sign requests with timestamped HMAC headers to prevent replay across environments.
3. Partition large sources into deterministic pages and checkpoint acknowledgements.
4. Move graph projection to an asynchronous worker when import volume makes request-time projection
   expensive.
5. Add contract fixtures and compatibility tests to both repositories before introducing version
   `2.0`.
