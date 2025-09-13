-- Add video_id column to analytics table for storing YouTube video IDs
ALTER TABLE analytics ADD COLUMN video_id text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_analytics_video_id ON analytics(video_id);

-- Update analytics table trigger
-- Note: The update_updated_at_column function should already exist
