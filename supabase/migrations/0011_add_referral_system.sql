-- Migration: Add referral system
-- Add referrer_id to profiles
ALTER TABLE profiles ADD COLUMN referrer_id uuid REFERENCES auth.users(id);

-- Create referral_codes table
CREATE TABLE IF NOT EXISTS referral_codes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT NOW()
);

-- Index for referral_codes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- Enable RLS on referral_codes
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Policies for referral_codes
CREATE POLICY "Users can view their own referral codes" ON referral_codes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own referral codes" ON referral_codes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create referral_awards table to track awards given
CREATE TABLE IF NOT EXISTS referral_awards (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    awarded_at timestamptz DEFAULT NOW(),
    UNIQUE (referred_id) -- Each referred user can only give one award
);

-- Index for referral_awards
CREATE INDEX IF NOT EXISTS idx_referral_awards_referrer_id ON referral_awards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_awards_referred_id ON referral_awards(referred_id);

-- Enable RLS on referral_awards
ALTER TABLE referral_awards ENABLE ROW LEVEL SECURITY;

-- Policies for referral_awards
CREATE POLICY "Users can view their own referral awards" ON referral_awards
    FOR SELECT USING (auth.uid() = referrer_id);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS text AS $$
DECLARE
    new_code text;
BEGIN
    LOOP
        -- Generate a random 8-character alphanumeric code
        new_code := substring(md5(random()::text) from 1 for 8);
        -- Check if it exists, if not exit loop
        EXIT WHEN NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = new_code);
    END LOOP;
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;
