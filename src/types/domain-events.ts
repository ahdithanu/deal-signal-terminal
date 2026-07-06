export type DomainEventStatus = "pending" | "published" | "failed";

export type DomainEventType =
  | "copilot.run.completed"
  | "copilot.run.failed"
  | "eval.run.completed"
  | "ingestion.market.completed"
  | "review.workflow.transitioned";

export type DomainEvent = {
  id: string;
  eventType: DomainEventType | string;
  aggregateType: string;
  aggregateId: string;
  orgId: string | null;
  userId: string | null;
  payload: Record<string, unknown>;
  status: DomainEventStatus;
  attempts: number;
  availableAt: string;
  publishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type DomainEventSubscription = {
  id: string;
  name: string;
  eventType: string;
  targetType: "internal" | "webhook" | "queue";
  targetRef: string;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
};

export type PublishDomainEventInput = {
  eventType: DomainEventType | string;
  aggregateType: string;
  aggregateId: string;
  orgId?: string | null;
  userId?: string | null;
  payload: Record<string, unknown>;
  availableAt?: string;
};

export type EventDispatchResult = {
  scanned: number;
  published: number;
  failed: number;
};

export type EventDashboard = {
  pending: number;
  published: number;
  failed: number;
  recentEvents: DomainEvent[];
  subscriptions: DomainEventSubscription[];
};
