-- Add music_id to episodes table
ALTER TABLE episodes ADD COLUMN music_id uuid REFERENCES music_tracks(id);

-- Index for music_id
CREATE INDEX IF NOT EXISTS idx_episodes_music_id ON episodes(music_id);

-- Update the updated_at trigger if needed (music_tracks already has one)
