# Build Signals Knowledge Graph

## Purpose

The knowledge graph connects public development signals into reusable enterprise intelligence:
permits, parcels, properties, owners, developers, contractors, architects, engineers, cities,
lenders, brokers, and opportunities.

The graph layer is intentionally generic. It does not know how a permit works. Domain-specific
adapters, such as the opportunity graph adapter, translate product data into graph entities and
relationships.

## Minimal Schema

### `graph_entities`

Canonical nodes in the graph.

- `entity_type`: opportunity, permit, parcel, property, developer, owner, general_contractor,
  architect, engineer, city, lender, broker, organization, person.
- `display_name` and `normalized_name`: human display plus matching key.
- `source_system` and `source_id`: optional external identity for deterministic upserts.
- `properties_json`: flexible attributes without schema churn.
- `confidence`, `created_at`, `updated_at`, `last_verified_at`: required enterprise lineage fields.

### `graph_entity_aliases`

Resolution keys for duplicate names and source identifiers.

- Supports names, normalized names, source IDs, addresses, parcel numbers, and permit numbers.
- Aliases include source/provenance fields and confidence.
- Entity resolution first checks source IDs, then exact normalized aliases, then conservative fuzzy
  matching.

### `graph_relationships`

Typed directed edges between entities.

- Relationship examples: `has_permit`, `located_on`, `located_in`, `owns`, `contractor_on`,
  `architect_on`, `engineer_on`, `lender_on`, `broker_on`, `associated_with`, `same_as`.
- Every relationship stores confidence, provenance JSON, created timestamp, updated timestamp, and
  last verified timestamp.

### `graph_relationship_evidence`

Source-backed proof for each relationship.

- Stores source label, report label, URL/page URL, record ID, published/accessed dates, and excerpt.
- Evidence is attached to relationships rather than only entities because enterprise users need to
  know why an edge exists.

## Service Boundaries

`src/lib/knowledge-graph.ts` owns generic graph persistence and queries:

- create/update entities
- create/update relationships
- store aliases and evidence
- query entity detail
- query related entities
- find bounded relationship paths

`src/lib/opportunity-graph.ts` is an adapter:

- maps an `Opportunity` into graph entities
- attaches permit, parcel, property, owner, contractor, and city context
- keeps opportunity/permit-specific rules out of the core graph service

## Current Tradeoffs

- Fuzzy matching is intentionally conservative. False entity merges are worse than duplicate nodes
  in an enterprise diligence workflow.
- The first implementation uses relational tables rather than a dedicated graph database. This fits
  the current Postgres deployment, keeps operational complexity low, and still supports path search
  for short relationship chains.
- Architects, engineers, lenders, brokers, and developers are supported by schema and APIs, but only
  appear when upstream source data supplies those parties.

## API Surface

- `GET /api/graph/entities/:id`: entity detail, aliases, and immediate relationships.
- `GET /api/graph/entities/:id/related`: related entities and evidence-backed relationships.
- `GET /api/graph/paths?from=:id&to=:id&maxDepth=3`: bounded relationship path search.
- `GET /api/opportunities/:slug/graph`: builds and returns graph context for an opportunity.

## Scaling Path

1. Add source adapters for deeds, assessor records, planning cases, business registrations, lender
   filings, broker announcements, and architect/engineer permit parties.
2. Promote resolution rules into per-entity strategies with review queues for low-confidence merges.
3. Add graph snapshots per customer workspace for tenant-isolated enterprise deployments.
4. Add materialized path summaries for common questions like “what else has this owner touched?”.
5. Move high-volume traversal to a graph database only if Postgres path queries become a bottleneck.
