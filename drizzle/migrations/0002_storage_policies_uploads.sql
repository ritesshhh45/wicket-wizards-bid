CREATE POLICY "uploads read all" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "uploads insert any" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "uploads update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'uploads');