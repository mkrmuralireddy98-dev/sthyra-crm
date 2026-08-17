-- Phase 7 — QA / Punch List schema migration
-- Extends field-service per Constitution §VII
--
-- Changes:
-- 1. Add 'kind' discriminator ('standard' | 'punch') to issues
-- 2. Add 'punch_data' JSONB column for punch-specific fields (trade, location, etc.)
-- 3. Add 'closed' to the issue_status CHECK constraint
-- 4. New table 'issue_photos' for multipart photo uploads (MVP: BYTEA storage)

BEGIN;

-- Step 1: Add 'kind' column with default 'standard' (backward compat)
ALTER TABLE issues
 ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'standard'
 CHECK (kind IN ('standard', 'punch'));

-- Step 2: Add punch_data JSONB column (NULL for standard issues)
ALTER TABLE issues
 ADD COLUMN IF NOT EXISTS punch_data JSONB NULL;

-- Step 3: Extend the status CHECK constraint to include 'closed'
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
 CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix'));

-- Step 4: New issue_photos table
CREATE TABLE IF NOT EXISTS issue_photos (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 issue_id TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 content_type TEXT NOT NULL,
 caption TEXT NULL,
 size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10 * 1024 * 1024),
 data BYTEA NOT NULL,
 captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT issue_photos_org_not_empty CHECK (length(org_id) > 0),
 FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

-- Phase 7.b: replace data BYTEA with s3_key TEXT (object storage migration)
ALTER TABLE issue_photos ADD COLUMN IF NOT EXISTS s3_key TEXT NULL;
CREATE INDEX IF NOT EXISTS issue_photos_org_issue_idx
 ON issue_photos (org_id, issue_id, captured_at DESC);

-- Step 5: Index for kind-based queries (punch list filter)
CREATE INDEX IF NOT EXISTS issues_org_kind_idx
 ON issues (org_id, kind, status)
 WHERE kind = 'punch' AND deleted_at IS NULL;

COMMIT;
