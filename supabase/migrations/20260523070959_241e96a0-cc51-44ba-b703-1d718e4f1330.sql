
-- Shared AI analysis cache (one row per YouTube video, shared across users)
CREATE TABLE IF NOT EXISTS public.video_chapters (
  youtube_video_id TEXT PRIMARY KEY,
  title TEXT,
  channel TEXT,
  chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  duration_seconds INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.video_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read video_chapters"
  ON public.video_chapters FOR SELECT
  USING (auth.uid() IS NOT NULL);
-- No INSERT/UPDATE policy: only server functions (service role) write here.

-- Per-user AI chat for videos
CREATE TABLE IF NOT EXISTS public.video_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  youtube_video_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','ai')),
  content TEXT NOT NULL,
  timestamp_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_chat_user_video
  ON public.video_chat_messages(user_id, youtube_video_id, created_at);
ALTER TABLE public.video_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own video chat"
  ON public.video_chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Per-user timestamped notes
CREATE TABLE IF NOT EXISTS public.video_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  youtube_video_id TEXT NOT NULL,
  material_id UUID,
  timestamp_seconds NUMERIC NOT NULL,
  note_text TEXT NOT NULL,
  chapter_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_notes_user_video
  ON public.video_notes(user_id, youtube_video_id, timestamp_seconds);
ALTER TABLE public.video_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own video_notes"
  ON public.video_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Per-user watch progress (resume)
CREATE TABLE IF NOT EXISTS public.video_watch_progress (
  user_id UUID NOT NULL,
  youtube_video_id TEXT NOT NULL,
  watch_seconds NUMERIC NOT NULL DEFAULT 0,
  total_seconds NUMERIC NOT NULL DEFAULT 0,
  percent_watched NUMERIC NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, youtube_video_id)
);
ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own watch progress"
  ON public.video_watch_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Saved videos library
CREATE TABLE IF NOT EXISTS public.saved_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  youtube_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel TEXT,
  thumbnail_url TEXT,
  subject TEXT DEFAULT 'General',
  material_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, youtube_video_id)
);
ALTER TABLE public.saved_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own saved_videos"
  ON public.saved_videos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
