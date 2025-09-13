-- Create storage buckets for VidForge AI

-- Insert buckets into storage.buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('assets', 'assets', false),
  ('renders', 'renders', false),
  ('thumbs', 'thumbs', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policies for assets bucket (private, users manage own files)
CREATE POLICY "Users can read own files in assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'assets' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "Users can insert own files in assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'assets' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "Users can update own files in assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'assets' AND name LIKE (auth.uid()::text || '/%')) WITH CHECK (bucket_id = 'assets' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "Users can delete own files in assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'assets' AND name LIKE (auth.uid()::text || '/%'));

-- Policies for renders bucket (private, users manage own files)
CREATE POLICY "Users can read own files in renders" ON storage.objects
  FOR SELECT USING (bucket_id = 'renders' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "Users can insert own files in renders" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'renders' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "Users can update own files in renders" ON storage.objects
  FOR UPDATE USING (bucket_id = 'renders' AND name LIKE (auth.uid()::text || '/%')) WITH CHECK (bucket_id = 'renders' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "Users can delete own files in renders" ON storage.objects
  FOR DELETE USING (bucket_id = 'renders' AND name LIKE (auth.uid()::text || '/%'));

-- Policies for thumbs bucket (public read, users manage own files)
-- Public can read all files in thumbs
CREATE POLICY "Public can read files in thumbs" ON storage.objects
  FOR SELECT USING (bucket_id = 'thumbs');

-- Users can insert/update/delete own files in thumbs
CREATE POLICY "Users can insert own files in thumbs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'thumbs' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "Users can update own files in thumbs" ON storage.objects
  FOR UPDATE USING (bucket_id = 'thumbs' AND name LIKE (auth.uid()::text || '/%')) WITH CHECK (bucket_id = 'thumbs' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "Users can delete own files in thumbs" ON storage.objects
  FOR DELETE USING (bucket_id = 'thumbs' AND name LIKE (auth.uid()::text || '/%'));

-- Grant necessary permissions
GRANT ALL ON storage.buckets TO postgres, service_role;
GRANT ALL ON storage.objects TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
