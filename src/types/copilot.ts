export type CopilotIntent =
  | "search_opportunities"
  | "explain_score"
  | "compare_opportunities"
  | "summarize_opportunity"
  | "generate_executive_memo"
  | "recommend_next_action"
  | "answer_question_with_citations";

export type CopilotCitation = {
  id: string;
  label: string;
  sourceType:
    | "opportunity"
    | "permit"
    | "parcel"
    | "memo"
    | "score"
    | "graph_relationship"
    | "source_evidence";
  url: string | null;
  recordId: string | null;
  excerpt: string;
};

export type CopilotRetrievedContext = {
  opportunities: Array<{
    id: string;
    slug: string;
    title: string;
    score: number;
    confidence: string;
    citedFacts: CopilotCitation[];
  }>;
  graphRelationships: CopilotCitation[];
  memoContext: CopilotCitation[];
};

export type CopilotRequest = {
  question: string;
  intent?: CopilotIntent;
  opportunitySlug?: string;
  compareSlugs?: string[];
  visibleOpportunitySlugs?: string[];
};

export type CopilotResponse = {
  id: string;
  intent: CopilotIntent;
  directAnswer: string;
  citations: CopilotCitation[];
  confidence: "high" | "medium" | "low";
  assumptions: string[];
  suggestedNextActions: string[];
  retrievedContext: CopilotRetrievedContext;
  refused: boolean;
};
