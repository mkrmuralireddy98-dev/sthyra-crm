-- Sthyra CRM BIM Viewer — initial schema (Phase 3)
-- Tenant-scoped: every table has org_id NOT NULL.
-- Constitution §II: multi-tenant isolation at the SQL layer.

BEGIN;

CREATE TABLE IF NOT EXISTS bim_models (
 id              TEXT        PRIMARY KEY,
 org_id          TEXT        NOT NULL,
 project_id      TEXT        NOT NULL,
 file_name       TEXT        NOT NULL,
 schema_version  TEXT        NOT NULL CHECK (schema_version IN ('IFC4X3')),
 model_hash      TEXT        NOT NULL,
 storage_key     TEXT        NOT NULL,
 state           TEXT        NOT NULL DEFAULT 'new' CHECK (state IN ('new','uploading','validating','ready','aligned','diffed','failed')),
 is_current      BOOLEAN     NOT NULL DEFAULT TRUE,
 total_elements  INTEGER     NULL,
 size_bytes      BIGINT      NOT NULL,
 created_by      TEXT        NOT NULL,
 created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 validated_at    TIMESTAMPTZ NULL,
 deleted_at      TIMESTAMPTZ NULL,
 CONSTRAINT bim_models_org_not_empty CHECK (length(org_id) > 0)
);

-- Only one current BIM model per (org, project)
CREATE UNIQUE INDEX IF NOT EXISTS bim_models_current_uq
 ON bim_models (org_id, project_id)
 WHERE is_current = TRUE AND deleted_at IS NULL;

-- Common list query: org + project, current models first
CREATE INDEX IF NOT EXISTS bim_models_org_project_current_idx
 ON bim_models (org_id, project_id, is_current DESC, created_at DESC)
 WHERE deleted_at IS NULL;

-- Read-by-id
CREATE INDEX IF NOT EXISTS bim_models_org_id_idx
 ON bim_models (org_id, id);


CREATE TABLE IF NOT EXISTS bim_deviations (
 id                 BIGSERIAL   PRIMARY KEY,
 org_id             TEXT        NOT NULL,
 model_id           TEXT        NOT NULL,
 capture_id         TEXT        NOT NULL,
 element_id         TEXT        NULL,
 deviation_type     TEXT        NOT NULL CHECK (deviation_type IN ('orphan','extra','missing','misaligned')),
 severity           TEXT        NOT NULL CHECK (severity IN ('minor','major','critical')),
 distance_meters    NUMERIC(10,4) NOT NULL,
 description        TEXT        NULL,
 detected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT bim_deviations_org_not_empty CHECK (length(org_id) > 0)
);

-- Common query: org + model + capture
CREATE INDEX IF NOT EXISTS bim_deviations_org_model_idx
 ON bim_deviations (org_id, model_id, capture_id, distance_meters DESC);

-- Time-based query (recent deviations first)
CREATE INDEX IF NOT EXISTS bim_deviations_recent_idx
 ON bim_deviations (org_id, detected_at DESC);

COMMIT;
