import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-ingest-sandiego.db`;

const sampleCsv = `"DEVELOPMENT_ID","PROJECT_ID","PROJECT_TYPE","PROJECT_STATUS","PROJECT_PROCESSING_CODE","PROJECT_CREATE_DATE","PROJECT_DEEMEDCOMPLETE_DATE","PROJECT_TRUST_ACCOUNT_NO","PROJECT_TITLE","PROJECT_SCOPE","JOB_ID","JOB_DRAWING_NUMBER","GIS_ADDRESS","GIS_APN","JOB_BC_CODE","JOB_BC_CODE_DESCRIPTION","GIS_LATITUDE","GIS_LONGITUDE","APPROVAL_ID","APPROVAL_CATEGORY_CODE","APPROVAL_PROCESSING_CODE","APPROVAL_TYPE","APPROVAL_STATUS","APPROVAL_SCOPE","APPROVAL_CREATE_DATE","APPROVAL_ISSUE_DATE","APPROVAL_CLOSE_DATE","APPROVAL_EXPIRE_DATE","APPROVAL_VALUATION","APPROVAL_DU_NET_CHANGE","APPROVAL_STORIES","APPROVAL_FLOOR_AREA","APPROVAL_DU_EXTREMELY_LOW","APPROVAL_DU_VERY_LOW","APPROVAL_DU_LOW","APPROVAL_DU_MODERATE","APPROVAL_DU_ABOVE_MODERATE","APPROVAL_DU_FUTURE_DEMO","APPROVAL_DU_BONUS","APPROVAL_ADU_EXTREMELY_LOW","APPROVAL_ADU_VERY_LOW","APPROVAL_ADU_LOW","APPROVAL_ADU_MODERATE","APPROVAL_ADU_ABOVE_MODERATE","APPROVAL_ADU_BONUS","APPROVAL_ADU_TOTAL","APPROVAL_JADU_EXTREMELY_LOW","APPROVAL_JADU_VERY_LOW","APPROVAL_JADU_LOW","APPROVAL_JADU_MODERATE","APPROVAL_JADU_ABOVE_MODERATE","APPROVAL_JADU_BONUS","APPROVAL_JADU_TOTAL","APPROVAL_PERMIT_HOLDER"
"1","101",,"Permit(s) Issued","Standard","2026-01-02",,,"Downtown mixed-use","Build new mixed-use project","201",,"100 MARKET ST ","5331110100",,,,,"9001","B",,"Building Permit","Issued","New construction for mixed-use building with 48 dwelling units","2026-01-03","2026-02-01",,,"12500000","48",,"80000",,,,,,,,,,,,,,,,,,,,,"Example Developer"
"2","102",,"Permit(s) Issued","Standard","2026-01-02",,,"Routine repair","Replace water heater","202",,"200 SIDE ST ","5331110200",,,,,"9002","B",,"Mechanical Permit","Issued","Replace water heater","2026-01-03","2026-02-01",,,"1200",,,"0",,,,,,,,,,,,,,,,,,,,,"Homeowner"`;

describe("San Diego ingestion", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PROVIDER = "sqlite";
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => sampleCsv,
      })
    );
    const db = await import("@/lib/db");
    db.resetDatabaseForTests();
  });

  afterEach(async () => {
    const db = await import("@/lib/db");
    db.resetDatabaseForTests();
    vi.unstubAllGlobals();
    delete process.env.BUILD_SIGNALS_DB_PROVIDER;
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  it("parses quoted San Diego approval CSV rows", async () => {
    const ingestion = await import("@/lib/ingest-sandiego");
    const rows = ingestion.parseSanDiegoApprovalsCsv(sampleCsv);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.APPROVAL_ID).toBe("9001");
    expect(rows[0]?.APPROVAL_SCOPE).toContain("48 dwelling units");
  });

  it("loads high-signal San Diego development approvals into ingestion tables", async () => {
    const ingestion = await import("@/lib/ingest-sandiego");
    const store = await import("@/lib/ingestion-store");

    const firstRun = await ingestion.ingestSanDiegoDevelopmentApprovals();
    const secondRun = await ingestion.ingestSanDiegoDevelopmentApprovals();
    const health = await store.listDataHealthByMarket();

    expect(firstRun.recordsScanned).toBe(2);
    expect(firstRun.recordsFound).toBe(1);
    expect(firstRun.recordsInserted).toBe(1);
    expect(secondRun.recordsInserted).toBe(0);
    expect(secondRun.recordsUpdated).toBe(1);
    expect(health[0]?.market_id).toBe("ca-san-diego-development");
    expect(health[0]?.permit_records).toBe(1);
    expect(health[0]?.latest_run_status).toBe("succeeded");
  });
});
