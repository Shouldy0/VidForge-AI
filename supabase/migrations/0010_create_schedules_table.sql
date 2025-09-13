-- Create schedules table for automated episode publishing
CREATE TABLE IF NOT EXISTS schedules (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    cron_expr text NOT NULL,
    timezone text NOT NULL DEFAULT 'UTC',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Add update trigger for schedules
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for schedules
CREATE INDEX IF NOT EXISTS idx_schedules_series_id ON schedules(series_id);
CREATE INDEX IF NOT EXISTS idx_schedules_id ON schedules(id);
CREATE INDEX IF NOT EXISTS idx_schedules_series_id_created_at ON schedules(series_id, created_at);

-- Enable RLS for schedules table
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see schedules for series they own
CREATE POLICY "users_select_own_schedules" ON schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM series s
            JOIN brands b ON s.brand_id = b.id
            WHERE s.id = schedules.series_id AND b.user_id = auth.uid()
        )
    );

-- Policy: Users can only insert schedules for series they own
CREATE POLICY "users_insert_own_schedules" ON schedules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM series s
            JOIN brands b ON s.brand_id = b.id
            WHERE s.id = schedules.series_id AND b.user_id = auth.uid()
        )
    );

-- Policy: Users can only update schedules for series they own
CREATE POLICY "users_update_own_schedules" ON schedules
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM series s
            JOIN brands b ON s.brand_id = b.id
            WHERE s.id = schedules.series_id AND b.user_id = auth.uid()
        )
    );

-- Policy: Users can only delete schedules for series they own
CREATE POLICY "users_delete_own_schedules" ON schedules
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM series s
            JOIN brands b ON s.brand_id = b.id
            WHERE s.id = schedules.series_id AND b.user_id = auth.uid()
        )
    );
