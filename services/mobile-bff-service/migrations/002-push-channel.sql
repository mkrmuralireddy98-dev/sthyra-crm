-- Phase 6 — Android push channel support
-- Add push_channel column to mobile_devices table for FCM support
-- Backward compat: existing rows default to 'apns'

BEGIN;

ALTER TABLE mobile_devices
 ADD COLUMN IF NOT EXISTS push_channel TEXT NOT NULL DEFAULT 'apns'
 CHECK (push_channel IN ('apns', 'fcm'));

ALTER TABLE mobile_devices
 ADD COLUMN IF NOT EXISTS fcm_app_id TEXT NULL;

-- Index for channel-based queries (e.g., "send FCM push to all FCM devices in org")
CREATE INDEX IF NOT EXISTS mobile_devices_org_channel_idx
 ON mobile_devices (org_id, push_channel)
 WHERE push_channel IS NOT NULL;

COMMIT;
