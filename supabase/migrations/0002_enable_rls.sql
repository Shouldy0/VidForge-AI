-- Enable RLS on all tables except analytics
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_calls ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can select own profile" ON profiles FOR SELECT USING (id = auth.uid() OR role = 'ADMIN');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid() OR role = 'ADMIN');
CREATE POLICY "Enable insert for authenticated users" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- ADMIN can select/update all via role check in USING clause

-- Helper function to check if user owns via brand chain
CREATE OR REPLACE FUNCTION check_brand_access(brand_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM brands
        WHERE brands.id = check_brand_access.brand_id
        AND brands.user_id = check_brand_access.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user owns via episode chain (episode -> series -> brand -> user)
CREATE OR REPLACE FUNCTION check_episode_access(episode_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM episodes e
        JOIN series s ON e.series_id = s.id
        JOIN brands b ON s.brand_id = b.id
        WHERE e.id = check_episode_access.episode_id
        AND b.user_id = check_episode_access.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for brands
CREATE POLICY "Users can access own brands" ON brands FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Enable insert for authenticated users" ON brands FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for series
CREATE POLICY "Users can access series via brand" ON series FOR ALL USING (
    check_brand_access((SELECT brand_id FROM series WHERE series.id = id), auth.uid())
);
CREATE POLICY "Insert series on own brand" ON series FOR INSERT WITH CHECK (
    check_brand_access(brand_id, auth.uid())
);

-- Policies for episodes
CREATE POLICY "Users can access episodes via series/brand" ON episodes FOR ALL USING (
    check_brand_access((SELECT brand_id FROM series WHERE series.id = (SELECT series_id FROM episodes WHERE episodes.id = id)), auth.uid())
);
CREATE POLICY "Insert episodes on own series" ON episodes FOR INSERT WITH CHECK (
    check_brand_access((SELECT brand_id FROM series WHERE series.id = series_id), auth.uid())
);

-- Policies for scenes
CREATE POLICY "Users can access scenes via episode" ON scenes FOR ALL USING (
    check_brand_access((
        SELECT brand_id FROM series WHERE series.id = (
            SELECT series_id FROM episodes WHERE episodes.id = (
                SELECT episode_id FROM scenes WHERE scenes.id = id
            )
        )
    ), auth.uid())
);
CREATE POLICY "Insert scenes on own episode" ON scenes FOR INSERT WITH CHECK (
    check_brand_access((
        SELECT brand_id FROM series WHERE series.id = (
            SELECT series_id FROM episodes WHERE episodes.id = episode_id
        )
    ), auth.uid())
);

-- Policies for assets
CREATE POLICY "Users can access own assets" ON assets FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Enable insert for authenticated users" ON assets FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Policies for prompts
CREATE POLICY "Users can access own prompts" ON prompts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Enable insert for authenticated users" ON prompts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for renders
CREATE POLICY "Users can access renders via episode" ON renders FOR ALL USING (
    check_brand_access((
        SELECT brand_id FROM series WHERE series.id = (
            SELECT series_id FROM episodes WHERE episodes.id = episode_id
        )
    ), auth.uid())
);
CREATE POLICY "Insert renders on own episode" ON renders FOR INSERT WITH CHECK (
    check_brand_access((
        SELECT brand_id FROM series WHERE series.id = (
            SELECT series_id FROM episodes WHERE episodes.id = (
                SELECT series_id FROM episodes WHERE episodes.id = episode_id
            )
        )
    ), auth.uid())
);

-- Policies for credit_ledger
CREATE POLICY "Users can access own credit_ledger" ON credit_ledger FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Enable insert for authenticated users" ON credit_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for social_accounts
CREATE POLICY "Users can access own social_accounts" ON social_accounts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Enable insert for authenticated users" ON social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for api_calls
CREATE POLICY "Users can access own api_calls" ON api_calls FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Enable insert for authenticated users" ON api_calls FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for subscriptions
CREATE POLICY "Users can access own subscriptions" ON subscriptions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Enable insert for authenticated users" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for job_log (internal, perhaps only service_role)
CREATE POLICY "Service role can access job_log" ON job_log FOR ALL USING (auth.role() = 'service_role');

-- Policies for analytics (read-only aggregated)
CREATE POLICY "Users can read analytics via episode/brand chain" ON analytics FOR SELECT USING (
    check_brand_access((
        SELECT brand_id FROM series WHERE series.id = (
            SELECT series_id FROM episodes WHERE episodes.id = episode_id
        )
    ), auth.uid())
);

-- Helper view: v_user_episodes
CREATE OR REPLACE VIEW v_user_episodes AS
SELECT e.*, b.user_id as brand_user_id
FROM episodes e
JOIN series s ON e.series_id = s.id
JOIN brands b ON s.brand_id = b.id;
