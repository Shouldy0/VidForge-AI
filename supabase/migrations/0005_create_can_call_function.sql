-- Enable necessary extensions if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function: can_call
-- Counts API calls for a user and route in the last 60 seconds
-- If under limit, inserts a new call and returns true; else false
CREATE OR REPLACE FUNCTION can_call(user_id_param uuid, route_param text, per_minute_param int)
RETURNS boolean AS $$
DECLARE
    call_count int;
BEGIN
    -- Count calls in the last 60 seconds
    SELECT count(*)
    INTO call_count
    FROM api_calls
    WHERE user_id = user_id_param
      AND route = route_param
      AND ts >= NOW() - INTERVAL '60 seconds';

    -- Check if limit exceeded
    IF call_count >= per_minute_param THEN
        RETURN false;
    ELSE
        -- Insert new call
        INSERT INTO api_calls (user_id, route) VALUES (user_id_param, route_param);
        RETURN true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (if RLS is enabled, adjust as needed)
-- Assuming public can call via RPC, but secure appropriately for your use case
