export type GraphEntityType =
  | "opportunity"
  | "permit"
  | "parcel"
  | "property"
  | "developer"
  | "owner"
  | "general_contractor"
  | "architect"
  | "engineer"
  | "city"
  | "lender"
  | "broker"
  | "organization"
  | "person";

export type GraphRelationshipType =
  | "has_permit"
  | "located_on"
  | "located_in"
  | "owns"
  | "applicant_for"
  | "contractor_on"
  | "architect_on"
  | "engineer_on"
  | "lender_on"
  | "broker_on"
  | "associated_with"
  | "same_as";

export type GraphAliasType =
  | "name"
  | "normalized_name"
  | "source_id"
  | "address"
  | "parcel_number"
  | "permit_number";

export type GraphEvidence = {
  id: string;
  evidenceKey: string;
  label: string;
  reportLabel: string;
  url: string | null;
  pageUrl: string | null;
  recordId: string | null;
  publishedAt: string | null;
  accessedAt: string;
  excerpt: string;
  createdAt: string;
};

export type GraphEntityAlias = {
  id: string;
  entityId: string;
  alias: string;
  normalizedAlias: string;
  aliasType: GraphAliasType;
  sourceSystem: string | null;
  sourceId: string | null;
  confidence: number;
  createdAt: string;
  lastVerifiedAt: string;
};

export type GraphEntity = {
  id: string;
  entityType: GraphEntityType;
  displayName: string;
  normalizedName: string;
  sourceSystem: string | null;
  sourceId: string | null;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string;
};

export type GraphRelationship = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: GraphRelationshipType;
  confidence: number;
  sourceSystem: string | null;
  sourceId: string | null;
  provenance: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string;
  evidence: GraphEvidence[];
};

export type GraphRelatedEntity = {
  entity: GraphEntity;
  relationship: GraphRelationship;
  direction: "outbound" | "inbound";
};

export type GraphEntityDetail = GraphEntity & {
  aliases: GraphEntityAlias[];
  related: GraphRelatedEntity[];
};

export type GraphRelationshipPath = {
  entities: GraphEntity[];
  relationships: GraphRelationship[];
};

export type OpportunityGraphContext = {
  opportunityEntity: GraphEntity;
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  related: GraphRelatedEntity[];
};
