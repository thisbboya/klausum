-- Store the original upload for every material (not just PDFs) so the
-- viewer can render images natively and office docs via embedded viewer.
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS file_storage_path text;
