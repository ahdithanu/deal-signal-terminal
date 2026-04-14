import OpenAI from "openai";

import {
  formatConfidenceLevel,
  formatCurrency,
  formatDate,
  formatDevelopmentStage,
  formatLotSizeAcres,
  formatOpportunityType,
  formatOwnershipEntityType,
  formatParcelContextStatus,
  formatPropertyKind,
} from "@/lib/formatters";
import type { Opportunity, OpportunityMemo } from "@/types/domain";

function buildParcelRead(opportunity: Opportunity): string {
  const parcelContext = opportunity.parcelContext;

  if (parcelContext.status === "missing") {
    return "Ownership and parcel context are still missing, so APN-level diligence remains open.";
  }

  const facts: string[] = [];

  if (parcelContext.ownerName) {
    facts.push(`${parcelContext.ownerName} is attached to the parcel context`);
  }

  if (parcelContext.landUse && parcelContext.zoning) {
    facts.push(
      `the APN reads as ${parcelContext.landUse.toLowerCase()} in ${parcelContext.zoning.toLowerCase()} zoning`
    );
  } else if (parcelContext.zoning) {
    facts.push(`the APN sits in ${parcelContext.zoning.toLowerCase()} zoning`);
  } else if (parcelContext.landUse) {
    facts.push(`the APN reads as ${parcelContext.landUse.toLowerCase()}`);
  }

  if (parcelContext.lotSizeAcres != null) {
    facts.push(`the site is about ${formatLotSizeAcres(parcelContext.lotSizeAcres).toLowerCase()}`);
  }

  if (parcelContext.lastTransferDate) {
    facts.push(`the last transfer on record is ${formatDate(parcelContext.lastTransferDate)}`);
  }

  const baseRead = facts.length
    ? `Parcel context is ${formatParcelContextStatus(parcelContext.status).toLowerCase()}: ${facts.join(
        ", "
      )}.`
    : `Parcel context is ${formatParcelContextStatus(parcelContext.status).toLowerCase()}, but key site facts remain incomplete.`;

  const sourceRead = `Current parcel context comes from ${parcelContext.sourceLabel} as of ${formatDate(
    parcelContext.sourceAsOf
  )} and still needs verification where fields remain partial.`;

  return `${baseRead} ${sourceRead}`;
}

export function buildOpportunitySummary(opportunity: Opportunity): string {
  const signalDetails = opportunity.signals
    .map(
      (signal) =>
        `${signal.permitNumber} (${signal.permitType.toLowerCase()} / ${signal.permitSubtype.toLowerCase()})`
    )
    .join(", ");

  const missingFacts = opportunity.missingFacts.length
    ? `Public records still do not confirm ${opportunity.missingFacts.join(", ").toLowerCase()}.`
    : "The public record is reasonably complete for a first-pass diligence view.";
  const parcelRead = buildParcelRead(opportunity);

  return `${opportunity.title} surfaced in ${opportunity.locationLabel} after ${signalDetails} hit the weekly county permit report. The engine classifies it as ${formatOpportunityType(opportunity.opportunityType).toLowerCase()} in ${formatDevelopmentStage(opportunity.developmentStage).toLowerCase()} because the signal points to ${formatPropertyKind(opportunity.metadata.propertyKind).toLowerCase()} activity with a clear follow-up path for developers. ${parcelRead} ${missingFacts}`;
}

function buildFallbackMemo(opportunity: Opportunity): string {
  const evidenceLines = opportunity.signals
    .map(
      (signal) =>
        `- ${signal.permitNumber}: ${signal.permitType} / ${signal.permitSubtype} at ${signal.siteAddress} (${formatDate(
          signal.issuedDate ?? signal.approvedDate ?? signal.appliedDate
        )})`
    )
    .join("\n");

  const missingFacts = opportunity.missingFacts.map((fact) => `- ${fact}`).join("\n");
  const parcelContextLines = [
    `- Status: ${formatParcelContextStatus(opportunity.parcelContext.status)}`,
    `- Owner: ${opportunity.parcelContext.ownerName ?? "Missing"}`,
    `- Owner type: ${formatOwnershipEntityType(opportunity.parcelContext.ownershipEntityType)}`,
    `- Zoning: ${opportunity.parcelContext.zoning ?? "Missing"}`,
    `- Land use: ${opportunity.parcelContext.landUse ?? "Missing"}`,
    `- Lot size: ${formatLotSizeAcres(opportunity.parcelContext.lotSizeAcres)}`,
    `- Last transfer: ${formatDate(opportunity.parcelContext.lastTransferDate)}`,
    `- Assessed value: ${formatCurrency(opportunity.parcelContext.assessedValue)}`,
    `- Context source: ${opportunity.parcelContext.sourceLabel} (${formatDate(
      opportunity.parcelContext.sourceAsOf
    )})`,
  ].join("\n");
  const underwritingCaution =
    opportunity.parcelContext.status === "missing"
      ? "The permit record still lacks linked ownership, valuation, and transfer context. Treat the opportunity as an outreach and diligence lead, not a fully underwritten deal."
      : "Parcel context is available, but some or all of it is seeded architecture data and should be verified against live county parcel or assessor records before underwriting or outreach.";
  const parcelRelevance =
    opportunity.parcelContext.status === "missing"
      ? "The current record does not yet tie cleanly to parcel facts, so site-control implications remain provisional."
      : buildParcelRead(opportunity);

  return `Situation
${opportunity.title} is a ${formatOpportunityType(opportunity.opportunityType).toLowerCase()} lead in ${opportunity.locationLabel}. The current thesis is simple: ${opportunity.thesis}

What changed this week
${evidenceLines}

Why it matters
${opportunity.whyItMatters}

Parcel relevance
${parcelRelevance}

Recommended next move
${opportunity.nextStep}

Parcel context
${parcelContextLines}

Underwriting caution
${underwritingCaution}

Missing facts to close
${missingFacts}`;
}

function buildMemoPrompt(opportunity: Opportunity): string {
  return [
    "Write a concise real estate development memo draft using only the facts below.",
    "Do not invent valuations, ownership data, tenant names, or project scope that is not provided.",
    "If data is missing, say it is missing.",
    "If parcel context is marked seeded or partial, explicitly say it still needs verification.",
    "Use short sections titled Situation, Why It Surfaced, Deal Relevance, Missing Facts, and Recommended Next Step.",
    "",
    `Opportunity: ${opportunity.title}`,
    `Location: ${opportunity.locationLabel}`,
    `Opportunity type: ${formatOpportunityType(opportunity.opportunityType)}`,
    `Development stage: ${formatDevelopmentStage(opportunity.developmentStage)}`,
    `Property kind: ${formatPropertyKind(opportunity.metadata.propertyKind)}`,
    `Priority score: ${opportunity.priorityScore}`,
    `Confidence: ${formatConfidenceLevel(opportunity.confidenceLevel)}`,
    `Thesis: ${opportunity.thesis}`,
    `Why it matters: ${opportunity.whyItMatters}`,
    `Next step: ${opportunity.nextStep}`,
    `Missing facts: ${opportunity.missingFacts.join(", ")}`,
    `Parcel context status: ${formatParcelContextStatus(opportunity.parcelContext.status)}`,
    `Owner name: ${opportunity.parcelContext.ownerName ?? "Missing"}`,
    `Owner type: ${formatOwnershipEntityType(opportunity.parcelContext.ownershipEntityType)}`,
    `Owner mailing city: ${opportunity.parcelContext.ownerMailingCity ?? "Missing"}`,
    `Zoning: ${opportunity.parcelContext.zoning ?? "Missing"}`,
    `Land use: ${opportunity.parcelContext.landUse ?? "Missing"}`,
    `Lot size: ${formatLotSizeAcres(opportunity.parcelContext.lotSizeAcres)}`,
    `Last transfer date: ${formatDate(opportunity.parcelContext.lastTransferDate)}`,
    `Transfer context: ${opportunity.parcelContext.transferContext ?? "Missing"}`,
    `Assessed value: ${formatCurrency(opportunity.parcelContext.assessedValue)}`,
    `Parcel relevance: ${buildParcelRead(opportunity)}`,
    "Signals:",
    ...opportunity.signals.map((signal) =>
      JSON.stringify({
        permitNumber: signal.permitNumber,
        permitType: signal.permitType,
        permitSubtype: signal.permitSubtype,
        description: signal.description,
        status: signal.status,
        appliedDate: signal.appliedDate,
        approvedDate: signal.approvedDate,
        issuedDate: signal.issuedDate,
        address: signal.siteAddress,
        city: signal.siteCity,
        apn: signal.siteApn,
      })
    ),
  ].join("\n");
}

export async function generateOpportunityMemo(
  opportunity: Opportunity
): Promise<OpportunityMemo> {
  const summary = buildOpportunitySummary(opportunity);
  const generatedAt = new Date().toISOString();

  if (process.env.OPENAI_API_KEY) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You draft concise real estate development memos from structured facts. You never fabricate missing information.",
          },
          {
            role: "user",
            content: buildMemoPrompt(opportunity),
          },
        ],
      });

      const body = response.output_text?.trim();

      if (body) {
        return {
          body,
          generatedAt,
          mode: "openai",
          summary,
        };
      }
    } catch {
      // Fall back to deterministic memo if live generation is unavailable.
    }
  }

  return {
    body: buildFallbackMemo(opportunity),
    generatedAt,
    mode: "rules",
    summary,
  };
}
