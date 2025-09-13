-- Migration: Add job_log table for progress reporting
-- This table will store detailed logs and progress updates for jobs

CREATE TABLE IF NOT EXISTS jobs.job_log (
    id SERIAL PRIMARY KEY,
    job_id uuid REFERENCES jobs.pgboss_archive(id),
    queue_name text NOT NULL,
    message text,
    progress integer CHECK (progress >= 0 AND progress <= 100),
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS job_log_job_id_idx ON jobs.job_log (job_id);
CREATE INDEX IF NOT EXISTS job_log_queue_name_idx ON jobs.job_log (queue_name);
CREATE INDEX IF NOT EXISTS job_log_created_at_idx ON jobs.job_log (created_at);

-- Grant permissions
GRANT ALL ON TABLE jobs.job_log TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE jobs.job_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE jobs.job_log_id_seq TO authenticated;
