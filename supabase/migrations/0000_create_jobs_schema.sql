-- Create jobs schema for pg-boss
CREATE SCHEMA IF NOT EXISTS jobs;

-- Grant permissions
GRANT USAGE ON SCHEMA jobs TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA jobs TO postgres, service_role;

-- Allow authenticated users to use pg-boss functions in jobs schema
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jobs TO authenticated;

-- Table for storing the current migration version
CREATE TABLE IF NOT EXISTS jobs.version (
    version int PRIMARY KEY,
    maintained_on timestamp with time zone,
    maintained_by text
);

-- Insert initial version
INSERT INTO jobs.version VALUES (0, now(), 'supabase')
ON CONFLICT (version) DO NOTHING;

-- Table for logging bus operations
CREATE TABLE IF NOT EXISTS jobs.pgboss_archive (
    id uuid PRIMARY KEY,
    name text,
    data jsonb,
    opts jsonb,
    created_on timestamp with time zone,
    completed_on timestamp with time zone,
    started_on timestamp with time zone,
    singleton_key text,
    expire_in interval,
    keep_until timestamp with time zone,
    retry_delay interval DEFAULT ('0 minutes'::interval),
    retry_limit integer DEFAULT 0,
    retry_count integer DEFAULT 0,
    retry_backoff boolean DEFAULT false,
    priority integer DEFAULT 0,
    state text DEFAULT 'created',
    singleton_on timestamp with time zone,
    archive_failed boolean DEFAULT false
);

-- Index for performance
CREATE INDEX IF NOT EXISTS pgboss_archive_state_idx ON jobs.pgboss_archive (state);
CREATE INDEX IF NOT EXISTS pgboss_archive_name_idx ON jobs.pgboss_archive (name);
CREATE INDEX IF NOT EXISTS pgboss_archive_singleton_key_idx ON jobs.pgboss_archive (singleton_key);
CREATE INDEX IF NOT EXISTS pgboss_archive_start_after_idx ON jobs.pgboss_archive (started_on) WHERE (state = 'retry'::text);
CREATE INDEX IF NOT EXISTS pgboss_archive_created_on_idx ON jobs.pgboss_archive (created_on);

-- Grant permissions on archive table
GRANT ALL ON TABLE jobs.pgboss_archive TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE jobs.pgboss_archive TO authenticated;
