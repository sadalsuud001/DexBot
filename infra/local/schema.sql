-- DexBot local demo schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- pgvector may not exist in the Timescale image.
-- For now, DexBot demo uses embedding_json fallback.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN undefined_file THEN
  RAISE NOTICE 'pgvector extension is not installed; using jsonb fallback for embeddings.';
END $$;

-- ----------------------------
-- Identity
-- ----------------------------

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'member')),
  password_hash TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  encrypted_mfa_secret BYTEA,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------
-- Groups
-- ----------------------------

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- ----------------------------
-- Robot lifecycle
-- ----------------------------

CREATE TABLE IF NOT EXISTS robots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  firmware_version TEXT NOT NULL,
  ip_address INET,
  connection_status TEXT NOT NULL CHECK (connection_status IN ('online', 'offline', 'error')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  certificate_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS robot_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS robot_permission_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  grantee_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  grantee_group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'control', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    grantee_user_id IS NOT NULL OR grantee_group_id IS NOT NULL
  )
);

-- ----------------------------
-- Fleet orchestration
-- ----------------------------

CREATE TABLE IF NOT EXISTS fleet_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'announced',
      'bidding',
      'human_gate',
      'awarded',
      'executing',
      'settled',
      'failed',
      'cancelled'
    )
  ),
  required_capabilities TEXT[] NOT NULL DEFAULT '{}',
  location_constraint TEXT,
  deadline TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  awarded_robot_id UUID REFERENCES robots(id) ON DELETE SET NULL,
  human_gate_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES fleet_jobs(id) ON DELETE CASCADE,
  robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  cost NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------
-- Telemetry
-- ----------------------------

CREATE TABLE IF NOT EXISTS robot_telemetry (
  time TIMESTAMPTZ NOT NULL DEFAULT now(),
  robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  battery NUMERIC NOT NULL,
  network_quality NUMERIC NOT NULL,
  error_code TEXT,
  joint_positions JSONB NOT NULL DEFAULT '{}'::jsonb,
  imu JSONB NOT NULL DEFAULT '{}'::jsonb
);

SELECT create_hypertable('robot_telemetry', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_robot_telemetry_robot_time
ON robot_telemetry (robot_id, time DESC);

-- ----------------------------
-- Agent platform
-- ----------------------------

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  plan JSONB,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  kind TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------
-- Content layer: minimal first version
-- ----------------------------

CREATE TABLE IF NOT EXISTS forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS forum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES forum_categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_html TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wiki_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES wiki_pages(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS software_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS software_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES software_packages(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'mac', 'linux')),
  checksum TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  changelog TEXT NOT NULL,
  download_url TEXT NOT NULL,
  download_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);