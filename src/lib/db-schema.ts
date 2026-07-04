export type DatabaseProvider = "sqlite" | "postgres";

const tableDefinitions = [
  {
    name: "organizations",
    sqlite: `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE
      );
    `,
  },
  {
    name: "users",
    sqlite: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        FOREIGN KEY (org_id) REFERENCES organizations (id)
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations (id),
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL
      );
    `,
  },
  {
    name: "sessions",
    sqlite: `
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (org_id) REFERENCES organizations (id)
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id),
        org_id TEXT NOT NULL REFERENCES organizations (id),
        expires_at TEXT NOT NULL
      );
    `,
  },
  {
    name: "user_states",
    sqlite: `
      CREATE TABLE IF NOT EXISTS user_states (
        state_key TEXT PRIMARY KEY,
        watchlist_json TEXT NOT NULL,
        notes_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS user_states (
        state_key TEXT PRIMARY KEY,
        watchlist_json TEXT NOT NULL,
        notes_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    name: "audit_events",
    sqlite: `
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        org_id TEXT,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        metadata_json TEXT NOT NULL
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        org_id TEXT,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        metadata_json TEXT NOT NULL
      );
    `,
  },
  {
    name: "pilot_leads",
    sqlite: `
      CREATE TABLE IF NOT EXISTS pilot_leads (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT NOT NULL,
        role TEXT,
        market_focus TEXT,
        team_size TEXT,
        notes TEXT NOT NULL
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS pilot_leads (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT NOT NULL,
        role TEXT,
        market_focus TEXT,
        team_size TEXT,
        notes TEXT NOT NULL
      );
    `,
  },
  {
    name: "source_documents",
    sqlite: `
      CREATE TABLE IF NOT EXISTS source_documents (
        id TEXT PRIMARY KEY,
        market_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        document_url TEXT NOT NULL,
        report_label TEXT NOT NULL,
        reporting_period_start TEXT,
        reporting_period_end TEXT,
        published_at TEXT,
        accessed_at TEXT NOT NULL,
        checksum TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS source_documents (
        id TEXT PRIMARY KEY,
        market_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        document_url TEXT NOT NULL,
        report_label TEXT NOT NULL,
        reporting_period_start TEXT,
        reporting_period_end TEXT,
        published_at TEXT,
        accessed_at TEXT NOT NULL,
        checksum TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    name: "permit_records",
    sqlite: `
      CREATE TABLE IF NOT EXISTS permit_records (
        id TEXT PRIMARY KEY,
        source_document_id TEXT NOT NULL,
        market_id TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        permit_number TEXT NOT NULL,
        permit_type TEXT NOT NULL,
        permit_subtype TEXT,
        status TEXT,
        applied_date TEXT,
        issued_date TEXT,
        finaled_date TEXT,
        address TEXT,
        city TEXT,
        parcel_number TEXT,
        applicant TEXT,
        contractor TEXT,
        valuation REAL,
        description TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_document_id) REFERENCES source_documents (id),
        UNIQUE (market_id, permit_number)
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS permit_records (
        id TEXT PRIMARY KEY,
        source_document_id TEXT NOT NULL REFERENCES source_documents (id),
        market_id TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        permit_number TEXT NOT NULL,
        permit_type TEXT NOT NULL,
        permit_subtype TEXT,
        status TEXT,
        applied_date TEXT,
        issued_date TEXT,
        finaled_date TEXT,
        address TEXT,
        city TEXT,
        parcel_number TEXT,
        applicant TEXT,
        contractor TEXT,
        valuation DOUBLE PRECISION,
        description TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (market_id, permit_number)
      );
    `,
  },
  {
    name: "ingestion_runs",
    sqlite: `
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id TEXT PRIMARY KEY,
        source_document_id TEXT,
        market_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        records_found INTEGER NOT NULL DEFAULT 0,
        records_inserted INTEGER NOT NULL DEFAULT 0,
        records_updated INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        metadata_json TEXT NOT NULL,
        FOREIGN KEY (source_document_id) REFERENCES source_documents (id)
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id TEXT PRIMARY KEY,
        source_document_id TEXT REFERENCES source_documents (id),
        market_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        records_found INTEGER NOT NULL DEFAULT 0,
        records_inserted INTEGER NOT NULL DEFAULT 0,
        records_updated INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        metadata_json TEXT NOT NULL
      );
    `,
  },
  {
    name: "graph_entities",
    sqlite: `
      CREATE TABLE IF NOT EXISTS graph_entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        source_system TEXT,
        source_id TEXT,
        properties_json TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS graph_entities_type_name_idx
        ON graph_entities (entity_type, normalized_name);
      CREATE INDEX IF NOT EXISTS graph_entities_source_idx
        ON graph_entities (entity_type, source_system, source_id);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS graph_entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        source_system TEXT,
        source_id TEXT,
        properties_json TEXT NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS graph_entities_type_name_idx
        ON graph_entities (entity_type, normalized_name);
      CREATE INDEX IF NOT EXISTS graph_entities_source_idx
        ON graph_entities (entity_type, source_system, source_id);
    `,
  },
  {
    name: "graph_entity_aliases",
    sqlite: `
      CREATE TABLE IF NOT EXISTS graph_entity_aliases (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        alias TEXT NOT NULL,
        normalized_alias TEXT NOT NULL,
        alias_type TEXT NOT NULL,
        source_system TEXT,
        source_id TEXT,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES graph_entities (id)
      );
      CREATE INDEX IF NOT EXISTS graph_entity_aliases_lookup_idx
        ON graph_entity_aliases (normalized_alias, alias_type);
      CREATE INDEX IF NOT EXISTS graph_entity_aliases_entity_idx
        ON graph_entity_aliases (entity_id);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS graph_entity_aliases (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES graph_entities (id),
        alias TEXT NOT NULL,
        normalized_alias TEXT NOT NULL,
        alias_type TEXT NOT NULL,
        source_system TEXT,
        source_id TEXT,
        confidence DOUBLE PRECISION NOT NULL,
        created_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS graph_entity_aliases_lookup_idx
        ON graph_entity_aliases (normalized_alias, alias_type);
      CREATE INDEX IF NOT EXISTS graph_entity_aliases_entity_idx
        ON graph_entity_aliases (entity_id);
    `,
  },
  {
    name: "graph_relationships",
    sqlite: `
      CREATE TABLE IF NOT EXISTS graph_relationships (
        id TEXT PRIMARY KEY,
        from_entity_id TEXT NOT NULL,
        to_entity_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence REAL NOT NULL,
        source_system TEXT,
        source_id TEXT,
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL,
        FOREIGN KEY (from_entity_id) REFERENCES graph_entities (id),
        FOREIGN KEY (to_entity_id) REFERENCES graph_entities (id)
      );
      CREATE INDEX IF NOT EXISTS graph_relationships_from_idx
        ON graph_relationships (from_entity_id, relationship_type);
      CREATE INDEX IF NOT EXISTS graph_relationships_to_idx
        ON graph_relationships (to_entity_id, relationship_type);
      CREATE INDEX IF NOT EXISTS graph_relationships_source_idx
        ON graph_relationships (source_system, source_id);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS graph_relationships (
        id TEXT PRIMARY KEY,
        from_entity_id TEXT NOT NULL REFERENCES graph_entities (id),
        to_entity_id TEXT NOT NULL REFERENCES graph_entities (id),
        relationship_type TEXT NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        source_system TEXT,
        source_id TEXT,
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS graph_relationships_from_idx
        ON graph_relationships (from_entity_id, relationship_type);
      CREATE INDEX IF NOT EXISTS graph_relationships_to_idx
        ON graph_relationships (to_entity_id, relationship_type);
      CREATE INDEX IF NOT EXISTS graph_relationships_source_idx
        ON graph_relationships (source_system, source_id);
    `,
  },
  {
    name: "graph_relationship_evidence",
    sqlite: `
      CREATE TABLE IF NOT EXISTS graph_relationship_evidence (
        id TEXT PRIMARY KEY,
        relationship_id TEXT NOT NULL,
        evidence_key TEXT NOT NULL,
        label TEXT NOT NULL,
        report_label TEXT NOT NULL,
        url TEXT,
        page_url TEXT,
        record_id TEXT,
        published_at TEXT,
        accessed_at TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (relationship_id) REFERENCES graph_relationships (id)
      );
      CREATE INDEX IF NOT EXISTS graph_relationship_evidence_relationship_idx
        ON graph_relationship_evidence (relationship_id);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS graph_relationship_evidence (
        id TEXT PRIMARY KEY,
        relationship_id TEXT NOT NULL REFERENCES graph_relationships (id),
        evidence_key TEXT NOT NULL,
        label TEXT NOT NULL,
        report_label TEXT NOT NULL,
        url TEXT,
        page_url TEXT,
        record_id TEXT,
        published_at TEXT,
        accessed_at TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS graph_relationship_evidence_relationship_idx
        ON graph_relationship_evidence (relationship_id);
    `,
  },
  {
    name: "agent_research_runs",
    sqlite: `
      CREATE TABLE IF NOT EXISTS agent_research_runs (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL,
        opportunity_slug TEXT NOT NULL,
        status TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
        total_completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_latency_ms INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        final_output_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_research_runs_opportunity_idx
        ON agent_research_runs (opportunity_id, started_at);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS agent_research_runs (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL,
        opportunity_slug TEXT NOT NULL,
        status TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
        total_completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_latency_ms INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        final_output_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_research_runs_opportunity_idx
        ON agent_research_runs (opportunity_id, started_at);
    `,
  },
  {
    name: "agent_research_outputs",
    sqlite: `
      CREATE TABLE IF NOT EXISTS agent_research_outputs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        status TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES agent_research_runs (id)
      );
      CREATE INDEX IF NOT EXISTS agent_research_outputs_run_idx
        ON agent_research_outputs (run_id, agent_name);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS agent_research_outputs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES agent_research_runs (id),
        agent_name TEXT NOT NULL,
        status TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_research_outputs_run_idx
        ON agent_research_outputs (run_id, agent_name);
    `,
  },
  {
    name: "review_workflows",
    sqlite: `
      CREATE TABLE IF NOT EXISTS review_workflows (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL UNIQUE,
        opportunity_slug TEXT NOT NULL,
        state TEXT NOT NULL,
        original_output_json TEXT,
        current_edited_output_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_transition_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS review_workflows_slug_idx
        ON review_workflows (opportunity_slug);
      CREATE INDEX IF NOT EXISTS review_workflows_state_idx
        ON review_workflows (state);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS review_workflows (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL UNIQUE,
        opportunity_slug TEXT NOT NULL,
        state TEXT NOT NULL,
        original_output_json TEXT,
        current_edited_output_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_transition_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS review_workflows_slug_idx
        ON review_workflows (opportunity_slug);
      CREATE INDEX IF NOT EXISTS review_workflows_state_idx
        ON review_workflows (state);
    `,
  },
  {
    name: "workflow_events",
    sqlite: `
      CREATE TABLE IF NOT EXISTS workflow_events (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        opportunity_id TEXT NOT NULL,
        actor_user_id TEXT,
        actor_org_id TEXT,
        action TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        comment TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES review_workflows (id)
      );
      CREATE INDEX IF NOT EXISTS workflow_events_workflow_idx
        ON workflow_events (workflow_id, created_at);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS workflow_events (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES review_workflows (id),
        opportunity_id TEXT NOT NULL,
        actor_user_id TEXT,
        actor_org_id TEXT,
        action TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        comment TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workflow_events_workflow_idx
        ON workflow_events (workflow_id, created_at);
    `,
  },
  {
    name: "review_decisions",
    sqlite: `
      CREATE TABLE IF NOT EXISTS review_decisions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        opportunity_id TEXT NOT NULL,
        reviewer_user_id TEXT,
        decision TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        rationale TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES review_workflows (id)
      );
      CREATE INDEX IF NOT EXISTS review_decisions_workflow_idx
        ON review_decisions (workflow_id, created_at);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS review_decisions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES review_workflows (id),
        opportunity_id TEXT NOT NULL,
        reviewer_user_id TEXT,
        decision TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        rationale TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS review_decisions_workflow_idx
        ON review_decisions (workflow_id, created_at);
    `,
  },
  {
    name: "reviewer_comments",
    sqlite: `
      CREATE TABLE IF NOT EXISTS reviewer_comments (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        opportunity_id TEXT NOT NULL,
        reviewer_user_id TEXT,
        body TEXT NOT NULL,
        comment_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES review_workflows (id)
      );
      CREATE INDEX IF NOT EXISTS reviewer_comments_workflow_idx
        ON reviewer_comments (workflow_id, created_at);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS reviewer_comments (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES review_workflows (id),
        opportunity_id TEXT NOT NULL,
        reviewer_user_id TEXT,
        body TEXT NOT NULL,
        comment_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS reviewer_comments_workflow_idx
        ON reviewer_comments (workflow_id, created_at);
    `,
  },
  {
    name: "edited_outputs",
    sqlite: `
      CREATE TABLE IF NOT EXISTS edited_outputs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        opportunity_id TEXT NOT NULL,
        editor_user_id TEXT,
        original_output_json TEXT NOT NULL,
        edited_output_json TEXT NOT NULL,
        edit_summary TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES review_workflows (id)
      );
      CREATE INDEX IF NOT EXISTS edited_outputs_workflow_idx
        ON edited_outputs (workflow_id, created_at);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS edited_outputs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES review_workflows (id),
        opportunity_id TEXT NOT NULL,
        editor_user_id TEXT,
        original_output_json TEXT NOT NULL,
        edited_output_json TEXT NOT NULL,
        edit_summary TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS edited_outputs_workflow_idx
        ON edited_outputs (workflow_id, created_at);
    `,
  },
  {
    name: "approval_history",
    sqlite: `
      CREATE TABLE IF NOT EXISTS approval_history (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        opportunity_id TEXT NOT NULL,
        approver_user_id TEXT,
        approved_output_json TEXT NOT NULL,
        approved_state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES review_workflows (id)
      );
      CREATE INDEX IF NOT EXISTS approval_history_workflow_idx
        ON approval_history (workflow_id, created_at);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS approval_history (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES review_workflows (id),
        opportunity_id TEXT NOT NULL,
        approver_user_id TEXT,
        approved_output_json TEXT NOT NULL,
        approved_state TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS approval_history_workflow_idx
        ON approval_history (workflow_id, created_at);
    `,
  },
  {
    name: "feedback_labels",
    sqlite: `
      CREATE TABLE IF NOT EXISTS feedback_labels (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        opportunity_id TEXT NOT NULL,
        reviewer_user_id TEXT,
        label TEXT NOT NULL,
        value TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES review_workflows (id)
      );
      CREATE INDEX IF NOT EXISTS feedback_labels_workflow_idx
        ON feedback_labels (workflow_id, created_at);
      CREATE INDEX IF NOT EXISTS feedback_labels_label_idx
        ON feedback_labels (label, value);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS feedback_labels (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES review_workflows (id),
        opportunity_id TEXT NOT NULL,
        reviewer_user_id TEXT,
        label TEXT NOT NULL,
        value TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS feedback_labels_workflow_idx
        ON feedback_labels (workflow_id, created_at);
      CREATE INDEX IF NOT EXISTS feedback_labels_label_idx
        ON feedback_labels (label, value);
    `,
  },
  {
    name: "workspace_deployment_configs",
    sqlite: `
      CREATE TABLE IF NOT EXISTS workspace_deployment_configs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL UNIQUE,
        model_provider TEXT NOT NULL,
        model_name TEXT NOT NULL,
        model_secret_ref TEXT,
        embedding_provider TEXT NOT NULL,
        embedding_model_name TEXT NOT NULL,
        embedding_secret_ref TEXT,
        retrieval_depth INTEGER NOT NULL,
        confidence_threshold REAL NOT NULL,
        scoring_weights_json TEXT NOT NULL,
        prompt_template_selection TEXT NOT NULL,
        notification_rules_json TEXT NOT NULL,
        rate_limits_json TEXT NOT NULL,
        feature_flags_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by_user_id TEXT,
        FOREIGN KEY (org_id) REFERENCES organizations (id)
      );
      CREATE INDEX IF NOT EXISTS workspace_deployment_configs_org_idx
        ON workspace_deployment_configs (org_id);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS workspace_deployment_configs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL UNIQUE REFERENCES organizations (id),
        model_provider TEXT NOT NULL,
        model_name TEXT NOT NULL,
        model_secret_ref TEXT,
        embedding_provider TEXT NOT NULL,
        embedding_model_name TEXT NOT NULL,
        embedding_secret_ref TEXT,
        retrieval_depth INTEGER NOT NULL,
        confidence_threshold DOUBLE PRECISION NOT NULL,
        scoring_weights_json TEXT NOT NULL,
        prompt_template_selection TEXT NOT NULL,
        notification_rules_json TEXT NOT NULL,
        rate_limits_json TEXT NOT NULL,
        feature_flags_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by_user_id TEXT
      );
      CREATE INDEX IF NOT EXISTS workspace_deployment_configs_org_idx
        ON workspace_deployment_configs (org_id);
    `,
  },
  {
    name: "workspace_deployment_config_history",
    sqlite: `
      CREATE TABLE IF NOT EXISTS workspace_deployment_config_history (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT,
        changed_at TEXT NOT NULL,
        section TEXT NOT NULL,
        old_value_json TEXT NOT NULL,
        new_value_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        FOREIGN KEY (org_id) REFERENCES organizations (id)
      );
      CREATE INDEX IF NOT EXISTS workspace_deployment_config_history_org_idx
        ON workspace_deployment_config_history (org_id, changed_at);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS workspace_deployment_config_history (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations (id),
        user_id TEXT,
        changed_at TEXT NOT NULL,
        section TEXT NOT NULL,
        old_value_json TEXT NOT NULL,
        new_value_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workspace_deployment_config_history_org_idx
        ON workspace_deployment_config_history (org_id, changed_at);
    `,
  },
  {
    name: "copilot_runs",
    sqlite: `
      CREATE TABLE IF NOT EXISTS copilot_runs (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        user_id TEXT,
        query TEXT NOT NULL,
        intent TEXT NOT NULL,
        retrieved_context_json TEXT NOT NULL,
        response_json TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS copilot_runs_org_idx
        ON copilot_runs (org_id, created_at);
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS copilot_runs (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        user_id TEXT,
        query TEXT NOT NULL,
        intent TEXT NOT NULL,
        retrieved_context_json TEXT NOT NULL,
        response_json TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS copilot_runs_org_idx
        ON copilot_runs (org_id, created_at);
    `,
  },
] as const;

export function buildSchemaSql(provider: DatabaseProvider): string {
  return tableDefinitions.map((definition) => definition[provider].trim()).join("\n\n");
}

export function listSchemaTables() {
  return tableDefinitions.map((definition) => definition.name);
}
