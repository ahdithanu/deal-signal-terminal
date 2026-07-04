import type { OpportunityGraphContext, GraphEntityType } from "@/types/graph";

const ENTITY_LABELS: Record<GraphEntityType, string> = {
  opportunity: "Opportunity",
  permit: "Permits",
  parcel: "Parcels",
  property: "Properties",
  developer: "Developers",
  owner: "Owners",
  general_contractor: "General contractors",
  architect: "Architects",
  engineer: "Engineers",
  city: "Cities",
  lender: "Lenders",
  broker: "Brokers",
  organization: "Organizations",
  person: "People",
};

const FEATURED_TYPES: GraphEntityType[] = [
  "developer",
  "owner",
  "general_contractor",
  "architect",
  "engineer",
  "parcel",
  "property",
  "permit",
  "city",
  "lender",
  "broker",
];

function relationshipLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function OpportunityGraphPanel({ graph }: { graph: OpportunityGraphContext }) {
  const entitiesByType = new Map<GraphEntityType, typeof graph.entities>();

  for (const entity of graph.entities) {
    if (entity.id === graph.opportunityEntity.id) {
      continue;
    }

    const group = entitiesByType.get(entity.entityType) ?? [];
    group.push(entity);
    entitiesByType.set(entity.entityType, group);
  }

  const evidencedRelationships = graph.relationships.filter(
    (relationship) => relationship.evidence.length > 0
  );

  return (
    <div className="panel graph-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Knowledge graph</p>
          <h2 className="section-title">Connected entities and evidence</h2>
        </div>
        <div className="subtle-text">
          {graph.entities.length} entities · {graph.relationships.length} relationships
        </div>
      </div>

      <p className="tight-copy">
        Build Signals resolves the public-record trail into a reusable graph of parties, parcels,
        permits, places, and opportunity context. Every edge below is source-backed with confidence
        and verification timestamps.
      </p>

      <div className="graph-entity-grid">
        {FEATURED_TYPES.map((entityType) => {
          const entities = entitiesByType.get(entityType) ?? [];

          return (
            <div className="graph-entity-card" key={entityType}>
              <span className="copy-label">{ENTITY_LABELS[entityType]}</span>
              {entities.length > 0 ? (
                <ul className="plain-list plain-list-tight">
                  {entities.slice(0, 4).map((entity) => (
                    <li key={entity.id}>
                      <strong>{entity.displayName}</strong>
                      <span className="subtle-text">
                        {" "}
                        {Math.round(entity.confidence * 100)}% confidence
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="subtle-text">Not resolved from current source evidence.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="graph-edge-stack">
        {evidencedRelationships.slice(0, 8).map((relationship) => {
          const from = graph.entities.find((entity) => entity.id === relationship.fromEntityId);
          const to = graph.entities.find((entity) => entity.id === relationship.toEntityId);
          const evidence = relationship.evidence[0];

          return (
            <div className="graph-edge-card" key={relationship.id}>
              <div>
                <span className="copy-label">{relationshipLabel(relationship.relationshipType)}</span>
                <p className="tight-copy">
                  <strong>{from?.displayName ?? relationship.fromEntityId}</strong> →{" "}
                  <strong>{to?.displayName ?? relationship.toEntityId}</strong>
                </p>
              </div>
              <div className="subtle-text">
                {Math.round(relationship.confidence * 100)}% confidence · verified{" "}
                {relationship.lastVerifiedAt.slice(0, 10)}
              </div>
              {evidence ? (
                <p className="tight-copy graph-evidence-copy">
                  {evidence.reportLabel}: {evidence.excerpt}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
