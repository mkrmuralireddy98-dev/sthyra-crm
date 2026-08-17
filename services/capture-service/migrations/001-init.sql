-- Sthyra CRM Capture Service — initial schema
-- Per plan.md §Postgres Schema. Tenant-scoped (every table has org_id NOT NULL).
-- Designed for cross-tenant safety at the SQL layer, not just the application layer.

BEGIN;

CREATE TABLE IF NOT EXISTS captures (
 id                TEXT        PRIMARY KEY,
 org_id            TEXT        NOT NULL,
 project_id        TEXT        NOT NULL,
 client_capture_id TEXT        NOT NULL,
 kind              TEXT        NOT NULL CHECK (kind IN ('walkthrough_360', 'drone', 'laser_scan')),
 status            TEXT        NOT NULL DEFAULT 'uploading'
 CHECK (status IN ('draft','uploading','processing','ready','failed','archived')),
 device_model      TEXT        NULL,
 device_os_version TEXT        NULL,
 started_at        TIMESTAMPTZ NOT NULL,
 finalized_at      TIMESTAMPTZ NULL,
 total_chunks      INTEGER     NULL,
 sha256            TEXT        NULL,
 error_message     TEXT        NULL,
 created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT captures_org_not_empty CHECK (length(org_id) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS captures_org_project_client_uq
 ON captures (org_id, project_id, client_capture_id);

CREATE INDEX IF NOT EXISTS captures_org_project_status_created_idx
 ON captures (org_id, project_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS captures_org_id_idx
 ON captures (org_id, id);

CREATE TABLE IF NOT EXISTS upload_sessions (
 id              TEXT        PRIMARY KEY,
 capture_id      TEXT        NOT NULL,
 org_id          TEXT        NOT NULL,
 project_id      TEXT        NOT NULL,
 chunk_size_bytes BIGINT     NOT NULL,
 total_chunks    INTEGER     NOT NULL DEFAULT 0,
 received_chunks INTEGER[]   NOT NULL DEFAULT '{}',
 status          TEXT        NOT NULL DEFAULT 'uploading'
 CHECK (status IN ('pending','uploading','complete','abandoned')),
 expires_at      TIMESTAMPTZ NOT NULL,
 created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE,
 CONSTRAINT upload_sessions_org_not_empty CHECK (length(org_id) > 0)
);

CREATE INDEX IF NOT EXISTS upload_sessions_org_id_idx
 ON upload_sessions (org_id, id);

CREATE INDEX IF NOT EXISTS upload_sessions_capture_idx
 ON upload_sessions (capture_id);

CREATE INDEX IF NOT EXISTS upload_sessions_expires_idx
 ON upload_sessions (expires_at) WHERE status = 'uploading';

CREATE TABLE IF NOT EXISTS pipeline_runs (
 id              BIGSERIAL   PRIMARY KEY,
 capture_id      TEXT        NOT NULL,
 org_id          TEXT        NOT NULL,
 project_id      TEXT        NOT NULL,
 stage           TEXT        NOT NULL CHECK (stage IN ('decode','sfm','mesh','segment','align')),
 status          TEXT        NOT NULL CHECK (status IN ('running','succeeded','failed','skipped')),
 attempt         INTEGER     NOT NULL DEFAULT 0,
 error_message   TEXT        NULL,
 pipeline_status TEXT        NOT NULL,
 started_at      TIMESTAMPTZ NULL,
 finished_at     TIMESTAMPTZ NULL,
 artifacts       JSONB       NULL,
 created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE,
 CONSTRAINT pipeline_runs_org_not_empty CHECK (length(org_id) > 0)
);

CREATE INDEX IF NOT EXISTS pipeline_runs_capture_stage_idx
 ON pipeline_runs (capture_id, stage, created_at DESC);

CREATE INDEX IF NOT EXISTS pipeline_runs_org_capture_idx
 ON pipeline_runs (org_id, capture_id);

CREATE TABLE IF NOT EXISTS event_outbox (
 id          BIGSERIAL   PRIMARY KEY,
 event_type  TEXT        NOT NULL,
 capture_id  TEXT        NULL,
 org_id      TEXT        NOT NULL,
 project_id  TEXT        NOT NULL,
 payload     JSONB       NOT NULL,
 published   BOOLEAN     NOT NULL DEFAULT FALSE,
 created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT event_outbox_org_not_empty CHECK (length(org_id) > 0)
);

CREATE INDEX IF NOT EXISTS event_outbox_unpublished_idx
 ON event_outbox (created_at) WHERE published = FALSE;

COMMIT;
