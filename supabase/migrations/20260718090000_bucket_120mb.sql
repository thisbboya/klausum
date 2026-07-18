-- Allow materials up to 120MB in storage (viewer streams them; AI pipeline
-- still only receives files small enough for inline processing)
UPDATE storage.buckets
SET file_size_limit = 125829120
WHERE id = 'materials';
