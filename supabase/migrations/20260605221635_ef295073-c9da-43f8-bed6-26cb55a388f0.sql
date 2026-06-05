
-- research_projects
CREATE TABLE public.research_projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  subject      TEXT,
  color        TEXT NOT NULL DEFAULT '#F4A300',
  source_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_projects TO authenticated;
GRANT ALL ON public.research_projects TO service_role;
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp_owner_all" ON public.research_projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_rp_user ON public.research_projects(user_id, updated_at DESC);

-- research_sources
CREATE TABLE public.research_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK (source_type IN ('pdf','url','text','youtube','note')),
  file_url        TEXT,
  file_path       TEXT,
  raw_url         TEXT,
  extracted_text  TEXT,
  page_count      INTEGER,
  word_count      INTEGER,
  summary         TEXT,
  key_claims      JSONB NOT NULL DEFAULT '[]'::jsonb,
  processing_done BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_sources TO authenticated;
GRANT ALL ON public.research_sources TO service_role;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_owner_all" ON public.research_sources FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_rs_project ON public.research_sources(project_id, created_at);

-- research_annotations
CREATE TABLE public.research_annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID NOT NULL REFERENCES public.research_sources(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  page_number   INTEGER,
  selected_text TEXT NOT NULL,
  note          TEXT,
  color         TEXT NOT NULL DEFAULT '#F4A300',
  tag           TEXT,
  position      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_annotations TO authenticated;
GRANT ALL ON public.research_annotations TO service_role;
ALTER TABLE public.research_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ra_owner_all" ON public.research_annotations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ra_source ON public.research_annotations(source_id, page_number);

-- research_chat_sessions
CREATE TABLE public.research_chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  messages   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_chat_sessions TO authenticated;
GRANT ALL ON public.research_chat_sessions TO service_role;
ALTER TABLE public.research_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rcs_owner_all" ON public.research_chat_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_rcs_project ON public.research_chat_sessions(project_id, updated_at DESC);

-- Keep source_count + updated_at on projects in sync when sources change.
CREATE OR REPLACE FUNCTION public.sync_research_project_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.project_id;
  ELSE
    pid := NEW.project_id;
  END IF;
  UPDATE public.research_projects
  SET source_count = (SELECT COUNT(*) FROM public.research_sources WHERE project_id = pid),
      updated_at = now()
  WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_research_sources_sync
AFTER INSERT OR DELETE ON public.research_sources
FOR EACH ROW EXECUTE FUNCTION public.sync_research_project_counts();
