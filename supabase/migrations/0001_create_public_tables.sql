-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    display_name text,
    role text DEFAULT 'USER',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: brands
CREATE TABLE IF NOT EXISTS brands (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    name text,
    palette jsonb,
    font text,
    voice_preset jsonb,
    cta text,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: series
CREATE TABLE IF NOT EXISTS series (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id uuid NOT NULL REFERENCES brands(id),
    title text,
    topic text,
    cadence jsonb,
    language text,
    status text,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_series_updated_at BEFORE UPDATE ON series FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: episodes
CREATE TABLE IF NOT EXISTS episodes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id uuid NOT NULL REFERENCES series(id),
    title text,
    status text,
    duration_sec int,
    timeline jsonb,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_episodes_updated_at BEFORE UPDATE ON episodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: scenes
CREATE TABLE IF NOT EXISTS scenes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id uuid NOT NULL REFERENCES episodes(id),
    idx int,
    t_start numeric,
    t_end numeric,
    type text,
    src text,
    pan_zoom text,
    prompt_id uuid REFERENCES prompts(id),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_scenes_updated_at BEFORE UPDATE ON scenes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: assets
CREATE TABLE IF NOT EXISTS assets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id uuid NOT NULL REFERENCES auth.users(id),
    kind text,
    url text,
    width int,
    height int,
    duration_sec numeric,
    meta jsonb,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: prompts
CREATE TABLE IF NOT EXISTS prompts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    type text,
    input jsonb,
    output jsonb,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: renders
CREATE TABLE IF NOT EXISTS renders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id uuid NOT NULL REFERENCES episodes(id),
    status text,
    url text,
    preset text,
    bitrate int,
    size_mb numeric,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_renders_updated_at BEFORE UPDATE ON renders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: job_log (lightweight app)
CREATE TABLE IF NOT EXISTS job_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    type text,
    status text,
    payload jsonb,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_job_log_updated_at BEFORE UPDATE ON job_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    stripe_customer_id text,
    stripe_price_id text,
    plan text,
    renew_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: credit_ledger
CREATE TABLE IF NOT EXISTS credit_ledger (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    delta int,
    reason text,
    job_id uuid,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_credit_ledger_updated_at BEFORE UPDATE ON credit_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: social_accounts
CREATE TABLE IF NOT EXISTS social_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    platform text,
    oauth jsonb,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_social_accounts_updated_at BEFORE UPDATE ON social_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: analytics
CREATE TABLE IF NOT EXISTS analytics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id uuid NOT NULL REFERENCES episodes(id),
    platform text,
    views bigint,
    retention03 numeric,
    completion_pct numeric,
    ctr_thumb numeric,
    collected_at date,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: api_calls
CREATE TABLE IF NOT EXISTS api_calls (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    route text,
    ts timestamptz DEFAULT NOW(),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER update_api_calls_updated_at BEFORE UPDATE ON api_calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes by foreign keys
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON brands(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_id ON brands(id);
CREATE INDEX IF NOT EXISTS idx_series_brand_id ON series(brand_id);
CREATE INDEX IF NOT EXISTS idx_series_id ON series(id);
CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_id ON episodes(id);
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes(episode_id);
CREATE INDEX IF NOT EXISTS idx_scenes_prompt_id ON scenes(prompt_id);
CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_assets_id ON assets(id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_id ON prompts(id);
CREATE INDEX IF NOT EXISTS idx_renders_episode_id ON renders(episode_id);
CREATE INDEX IF NOT EXISTS idx_renders_id ON renders(id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_id ON subscriptions(id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_job_id ON credit_ledger(job_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_id ON social_accounts(id);
CREATE INDEX IF NOT EXISTS idx_analytics_episode_id ON analytics(episode_id);
CREATE INDEX IF NOT EXISTS idx_analytics_id ON analytics(id);
CREATE INDEX IF NOT EXISTS idx_api_calls_user_id ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_id ON api_calls(id);

-- Composite indexes (user_id, created_at)
CREATE INDEX IF NOT EXISTS idx_brands_user_id_created_at ON brands(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id_created_at ON prompts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assets_owner_id_created_at ON assets(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_created_at ON subscriptions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id_created_at ON credit_ledger(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id_created_at ON social_accounts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_calls_user_id_created_at ON api_calls(user_id, created_at);

-- Index (episode_id)
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes(episode_id);
-- (episode_id) for renders and analytics
CREATE INDEX IF NOT EXISTS idx_renders_episode_id ON renders(episode_id);
CREATE INDEX IF NOT EXISTS idx_analytics_episode_id ON analytics(episode_id);

-- Index (platform, collected_at)
CREATE INDEX IF NOT EXISTS idx_analytics_platform_collected_at ON analytics(platform, collected_at);
