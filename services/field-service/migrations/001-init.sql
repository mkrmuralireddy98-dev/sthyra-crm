-- Sthyra CRM Field Service — initial schema (Phase 2)
-- Tenant-scoped (every table has org_id NOT NULL).
-- Constitution §II: multi-tenant isolation at the SQL layer.

BEGIN;

CREATE TABLE IF NOT EXISTS issues (
 id              TEXT        PRIMARY KEY,
 org_id          TEXT        NOT NULL,
 project_id      TEXT        NOT NULL,
 capture_id      TEXT        NULL,
 client_issue_id TEXT        NULL,
 title           TEXT        NOT NULL,
 description     TEXT        NOT NULL,
 severity        TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
 status          TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wont_fix')),
 assigned_to     TEXT        NULL,
 coordinates     JSONB       NULL,
 due_date        TIMESTAMPTZ NULL,
 created_by      TEXT        NOT NULL,
 created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 resolved_at     TIMESTAMPTZ NULL,
 deleted_at      TIMESTAMPTZ NULL,
 CONSTRAINT issues_org_not_empty CHECK (length(org_id) > 0)
);

-- Client-side idempotency: same (orgId, projectId, clientIssueId) → unique
CREATE UNIQUE INDEX IF NOT EXISTS issues_org_project_client_uq
 ON issues (org_id, project_id, client_issue_id)
 WHERE client_issue_id IS NOT NULL;

-- Common list query: org + project + status, sorted by recency
CREATE INDEX IF NOT EXISTS issues_org_project_status_created_idx
 ON issues (org_id, project_id, status, created_at DESC)
 WHERE deleted_at IS NULL;

-- Read-by-id
CREATE INDEX IF NOT EXISTS issues_org_id_idx ON issues (org_id, id);

-- Filter by captureId (when tied to a specific 3D coordinate)
CREATE INDEX IF NOT EXISTS issues_org_capture_idx ON issues (org_id, capture_id)
 WHERE capture_id IS NOT NULL AND deleted_at IS NULL;


CREATE TABLE IF NOT EXISTS comments (
 id          TEXT        PRIMARY KEY,
 org_id      TEXT        NOT NULL,
 issue_id    TEXT        NOT NULL,
 author_id   TEXT        NOT NULL,
 text        TEXT        NOT NULL,
 attachments JSONB       NOT NULL DEFAULT '[]',
 created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT comments_org_not_empty CHECK (length(org_id) > 0),
 FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS comments_org_issue_idx
 ON comments (org_id, issue_id, created_at ASC);


CREATE TABLE IF NOT EXISTS status_history (
 id          BIGSERIAL   PRIMARY KEY,
 org_id      TEXT        NOT NULL,
 issue_id    TEXT        NOT NULL,
 from_status TEXT        NOT NULL,
 to_status   TEXT        NOT NULL,
 reason      TEXT        NULL,
 actor_id    TEXT        NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT status_history_org_not_empty CHECK (length(org_id) > 0),
 FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS status_history_org_issue_idx
 ON status_history (org_id, issue_id, occurred_at ASC);

COMMIT;
