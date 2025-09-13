-- Schedule analytics-pull Edge Function to run hourly
-- This uses pg_cron extension to create the schedule

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the analytics-pull function to run every hour
SELECT cron.schedule(
  'analytics-pull-hourly', -- job name
  '0 * * * *',              -- cron expression: every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:=concat('https://', current_setting('app.jwt_secret')::text, '.supabase.co/functions/v1/analytics-pull'),
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', concat('Bearer ', current_setting('app.service_role_key')::text)
        ),
        body:=jsonb_build_object('scheduled', true)::text
    ) as request_id;
  $$
);
